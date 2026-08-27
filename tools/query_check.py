# -*- coding: utf-8 -*-
"""Verify that every stored query in queries/ still executes, and record that it did.

    python tools/query_check.py            # verify what changed, update the record
    python tools/query_check.py --all      # re-verify everything
    python tools/query_check.py --check    # CI: is the record current? never writes
    python tools/query_check.py -v         # show every query, not just the problems

Two kinds of check, and they cost very different amounts.

The STATIC checks read the query text and the ontology: is the header complete, is gsn:
bound to the namespace the ontology actually uses, does every gsn: term named in the query
exist? That last one is the failure this directory was rewritten to fix - a query naming
gsn:Evidence or gsn:Model returns nothing at all, silently and forever, and no amount of
running it will say so. Static checks are cheap and always run.

The DYNAMIC check loads serializations/ontogsn.ttl and the example ABox into an in-memory
Oxigraph store and executes the query against it: reads must return rows, writes must
change the store in the direction they claim. That is the expensive part, so it is not
re-run for a query nothing has touched.

What "nothing has touched" means is recorded in provenance/ontogsn-provenance-queries.ttl
as gsnprov:verificationKey - one hash over the query text, the ontology, the fixture and
CHECKER_VERSION below. Edit one query and one query is re-verified; edit the ontology and
all of them are, because a query's meaning depends on the terms it names.

The record is the point. --check does not execute anything: it recomputes the keys and
compares, so CI answers "is every query verified against what is committed?" in
milliseconds. A stale key is not a failing query, it is an unverified one, and the fix is
to run this script without --check and commit what it writes.
"""
import argparse
import glob
import hashlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matching
import prov_ttl
import ttl_model
from prov_ttl import Lit
from rdflib import RDF, RDFS, URIRef

SWRL_IMP = URIRef("http://www.w3.org/2003/11/swrl#Imp")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUERY_DIR = os.path.join(REPO, "queries")
TESTDATA = os.path.join(REPO, "tools", "testdata")
FIXTURE = os.path.join(TESTDATA, "example_case.ttl")
RULE_FIXTURE = os.path.join(TESTDATA, "rule_cases.ttl")
ONTOLOGY = os.path.join(REPO, "serializations", "ontogsn.ttl")
RECORD = os.path.join(REPO, "provenance", "ontogsn-provenance-queries.ttl")

FIXTURES = [FIXTURE, RULE_FIXTURE]
FIXTURE_LABELS = ["example assurance case ABox",
                  "one minimal trigger per SWRL rule"]

ONTOLOGY_NS = "https://w3id.org/OntoGSN/ontology#"

# Bump when a change here alters what verification means - a new check, a different
# expectation - so that every query is re-verified under the new rules. Editing a comment
# is not such a change, which is why this is a constant and not the file's own checksum.
CHECKER_VERSION = "1"

OPERATIONS = ("create", "read", "update", "delete", "rule")
EXPECTATIONS = {"rows", "empty", "insert", "delete", "change", "none"}
HEADER_FIELDS = ("id", "operation", "question", "expect")
RULE_HEADER_FIELDS = ("rule", "name", "section", "operation", "expect", "swrl")

PREFIX_RE = re.compile(r"(?m)^\s*PREFIX\s+(\w*):\s*<([^>]+)>")
GSN_TERM_RE = re.compile(r"\bgsn:([A-Za-z][A-Za-z0-9_]*)")
FORM_RE = re.compile(r"(?m)^\s*(SELECT|ASK|CONSTRUCT|DESCRIBE|INSERT|DELETE|WITH|LOAD"
                     r"|CLEAR|DROP|COPY|MOVE|ADD)\b", re.IGNORECASE)
HEADER_RE = re.compile(r"^#\s{1,}(\w+):\s{1,}(.*)$")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def rel(path):
    return os.path.relpath(path, REPO).replace("\\", "/")


class Query(object):
    """One .rq file: its header, its text, and what verifying it concluded."""

    def __init__(self, path):
        self.path = path
        self.name = os.path.relpath(path, QUERY_DIR).replace(os.sep, "/")
        self.is_rule = self.name.startswith("rules/")
        with open(path, encoding="utf-8") as fh:
            self.text = fh.read()
        self.checksum = matching.file_checksum(path)
        self.header = self._parse_header()
        self.problems = []
        self.outcome = None
        self.detail = ""
        self.reused = False

    def _parse_header(self):
        """Leading '# key: value' lines, with indented continuations folded in."""
        header, key = {}, None
        for line in self.text.splitlines():
            if not line.startswith("#"):
                break
            match = HEADER_RE.match(line)
            if match:
                key = match.group(1).lower()
                header[key] = match.group(2).strip()
            elif key and re.match(r"^#\s{4,}\S", line):
                header[key] += " " + line.lstrip("# ").strip()
            else:
                key = None
        return header

    @property
    def operation(self):
        return self.header.get("operation", "")

    @property
    def expect(self):
        return self.header.get("expect", "")

    @property
    def form(self):
        match = FORM_RE.search(strip_comments(self.text))
        return match.group(1).upper() if match else "?"

    @property
    def is_update(self):
        return self.form in ("INSERT", "DELETE", "WITH", "LOAD", "CLEAR", "DROP",
                             "COPY", "MOVE", "ADD")

    def key(self, ontology_sum, fixture_sums):
        digest = hashlib.sha256()
        for part in (CHECKER_VERSION, self.checksum, ontology_sum) + tuple(fixture_sums):
            digest.update(part.encode("utf-8") + b"\0")
        return digest.hexdigest()


def strip_comments(text):
    """Comments only - a '#' inside an IRI or a string is not one.

    Crude but sufficient: the stored queries contain no '#' in a literal, and IRIs are the
    only other place one appears.
    """
    out = []
    for line in text.splitlines():
        in_iri = in_string = False
        for i, char in enumerate(line):
            if char == '"' and not in_iri:
                in_string = not in_string
            elif char == "<" and not in_string:
                in_iri = True
            elif char == ">" and not in_string:
                in_iri = False
            elif char == "#" and not in_iri and not in_string:
                line = line[:i]
                break
        out.append(line)
    return "\n".join(out)


# --------------------------------------------------------------------------------------
#  Static checks - cheap, and the ones that catch the silent failures
# --------------------------------------------------------------------------------------

def check_static(queries, known_terms, known_rules):
    seen_ids, seen_rules = {}, {}
    for query in queries:
        if query.is_rule:
            for field in RULE_HEADER_FIELDS:
                if not query.header.get(field):
                    query.problems.append(f"header is missing '{field}:'")
            if query.operation != "rule":
                query.problems.append(
                    f"a file in rules/ must declare 'operation: rule', not "
                    f"'{query.operation}'")
            name = query.header.get("name")
            if name and name not in known_rules:
                query.problems.append(
                    f"name '{name}' matches no rdfs:label on a SWRL rule in the ontology")
            rule = query.header.get("rule")
            if rule:
                if rule in seen_rules:
                    query.problems.append(
                        f"rule '{rule}' is already translated by {seen_rules[rule]}")
                seen_rules[rule] = query.name
        else:
            expected_operation = query.name.split("_", 1)[0]
            for field in HEADER_FIELDS:
                if not query.header.get(field):
                    query.problems.append(f"header is missing '{field}:'")
            if query.operation and query.operation != expected_operation:
                query.problems.append(
                    f"header says operation '{query.operation}' but the file name says "
                    f"'{expected_operation}'")
            if expected_operation not in OPERATIONS:
                query.problems.append(
                    f"file name must start with one of {'/'.join(OPERATIONS)}_")
            identifier = query.header.get("id")
            if identifier:
                if identifier in seen_ids:
                    query.problems.append(
                        f"id '{identifier}' is already used by {seen_ids[identifier]}")
                seen_ids[identifier] = query.name

        if query.expect and query.expect not in EXPECTATIONS:
            query.problems.append(
                f"expect: '{query.expect}' is not one of {sorted(EXPECTATIONS)}")
        if query.expect in ("rows", "empty") and query.is_update:
            query.problems.append(f"a {query.form} query cannot expect '{query.expect}'")
        if query.expect in ("insert", "delete", "change", "none") and not query.is_update:
            query.problems.append(f"a {query.form} query cannot expect '{query.expect}'")

        namespaces = dict(PREFIX_RE.findall(query.text))
        if "gsn" not in namespaces:
            query.problems.append("declares no gsn: prefix")
        elif namespaces["gsn"] != ONTOLOGY_NS:
            query.problems.append(
                f"binds gsn: to {namespaces['gsn']} - the ontology is {ONTOLOGY_NS}")

        body = strip_comments(query.text)
        for prefix in sorted(set(re.findall(r"(?m)(?<![\w:<])([A-Za-z][\w.-]*):[A-Za-z_]",
                                            body))):
            if prefix not in namespaces and prefix.upper() not in ("HTTP", "HTTPS"):
                query.problems.append(f"uses the prefix {prefix}: without declaring it")

        for term in sorted(set(GSN_TERM_RE.findall(body))):
            if term not in known_terms:
                query.problems.append(
                    f"names gsn:{term}, which the ontology does not declare")


# --------------------------------------------------------------------------------------
#  Dynamic check - does it actually run against an ABox
# --------------------------------------------------------------------------------------

def load_store(pyoxigraph, fixtures):
    store = pyoxigraph.Store()
    store.load(path=ONTOLOGY, format=pyoxigraph.RdfFormat.TURTLE)
    for fixture in fixtures:
        store.load(path=fixture, format=pyoxigraph.RdfFormat.TURTLE)
    return store


def run(query, pyoxigraph):
    """Execute one query against a fresh store and judge it against its 'expect:'.

    A rule also sees tools/testdata/rule_cases.ttl - one minimal trigger per SWRL rule.
    The example case alone does not fire all fifty-one, and contorting it until it did
    would leave an assurance case nobody could read as an example of anything.
    """
    fixtures = [FIXTURE, RULE_FIXTURE] if query.is_rule else [FIXTURE]
    try:
        store = load_store(pyoxigraph, fixtures)
    except Exception as error:                                   # noqa: BLE001
        return "failed", f"could not load the fixture: {error}", {}

    try:
        if query.is_update:
            before = set(store)
            store.update(query.text)
            after = set(store)
            added, removed = len(after - before), len(before - after)
            facts = {"triplesAdded": added, "triplesRemoved": removed}
            if query.expect == "insert" and added == 0:
                return "failed", "inserted nothing", facts
            if query.expect == "delete" and removed == 0:
                return "failed", "deleted nothing", facts
            if query.expect == "change" and added == 0 and removed == 0:
                return "failed", "changed nothing", facts
            if query.expect == "none" and (added or removed):
                return "failed", f"expected no effect, got +{added} -{removed}", facts
            return "passed", f"+{added} -{removed} triples", facts

        result = store.query(query.text)
        if isinstance(result, bool):
            return "passed", f"ASK -> {result}", {"rowCount": 1 if result else 0}
        rows = list(result)
        facts = {"rowCount": len(rows)}
        if query.expect == "rows" and not rows:
            return "failed", "returned no rows against the example ABox", facts
        if query.expect == "empty" and rows:
            return "failed", f"returned {len(rows)} rows, expected none", facts
        return "passed", f"{len(rows)} rows", facts
    except Exception as error:                                   # noqa: BLE001
        return "failed", str(error).replace("\n", " ")[:300], {}


# --------------------------------------------------------------------------------------
#  The record
# --------------------------------------------------------------------------------------

VERIFICATION_RE = re.compile(
    r"(?ms)^gsnprov:verification-(\S+)\n(.*?)\n\n")
FIELD_RE = re.compile(r"(?m)^\s+(gsnprov:\w+|prov:\w+|skos:\w+|rdfs:\w+|a)\s+(.+?)\s*[;.]$")


def unliteral(value):
    """'"12"^^xsd:integer' -> '12'; a bare IRI or qname is returned unchanged."""
    value = value.strip()
    if value.startswith('"'):
        end = value.find('"', 1)
        return value[1:end] if end > 0 else value[1:]
    return value


def read_record(path):
    """Parse the file this script writes. It is written by prov_ttl in a fixed shape, so
    a regex is enough and rdflib does not have to be loaded to answer --check."""
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    if not text.endswith("\n\n"):
        text += "\n\n"
    record = {}
    for name, body in VERIFICATION_RE.findall(text):
        fields = {}
        for predicate, value in FIELD_RE.findall(body):
            fields[predicate] = unliteral(value)
        record[name] = fields
    return record


def write_record(path, queries, ontology_sum, fixture_sums, engine):
    blocks = [prov_ttl.header(
        f"Query verification ({len(queries)})",
        "GENERATED by tools/query_check.py. One activity per stored query, recording that\n"
        "it executed against the example ABox and what came back.\n\n"
        "gsnprov:verificationKey is a hash over the query, the ontology, the fixture and\n"
        "the checker's own version. It is what makes verification incremental: a key that\n"
        "still matches is a query nothing has touched, and re-running it would ask a\n"
        "question already answered. A key that no longer matches is not a failure - it is\n"
        "an unverified query, and running the script without --check answers it.")]

    for path_, checksum, label in zip(FIXTURES, fixture_sums, FIXTURE_LABELS):
        blocks.append((f"gsnprov:file-{slug(os.path.basename(path_)[:-4])}", [
            ("a", ["gsnprov:File"]),
            ("rdfs:label", [Lit(label, lang="en")]),
            ("gsnprov:path", [Lit(rel(path_))]),
            ("gsnprov:fileChecksum", [Lit(checksum)]),
        ]))
    blocks.append(("gsnprov:agent-query-check-py", [
        ("a", ["prov:SoftwareAgent", "prov:Plan"]),
        ("rdfs:label", [Lit("tools/query_check.py", lang="en")]),
        ("gsnprov:path", [Lit("tools/query_check.py")]),
        ("gsnprov:declaredVersion", [Lit(CHECKER_VERSION)]),
    ]))

    for query in sorted(queries, key=lambda q: q.name):
        used = [f"gsnprov:query-{slug(query.name[:-3])}", "gsnprov:file-ontogsn-ttl",
                "gsnprov:file-example-case"]
        if query.is_rule:
            used.append("gsnprov:file-rule-cases")
        pairs = [
            ("a", ["gsnprov:QueryVerification"]),
            ("rdfs:label", [Lit(query.name, lang="en")]),
            ("prov:used", used),
            ("prov:wasAssociatedWith", ["gsnprov:agent-query-check-py"]),
            ("gsnprov:verificationKey", [Lit(query.key(ontology_sum, fixture_sums))]),
            ("gsnprov:operation", [Lit(query.operation)]),
            ("gsnprov:expectation", [Lit(query.expect)]),
            ("gsnprov:resultForm", [Lit(query.form)]),
            ("gsnprov:verificationOutcome", [Lit(query.outcome or "not run")]),
            ("gsnprov:verifiedWith", [Lit(engine)]),
        ]
        for name, value in sorted(query.facts.items()):
            pairs.append((f"gsnprov:{name}",
                          [Lit(str(value), datatype="xsd:integer")]))
        if query.is_rule:
            pairs.insert(5, ("gsnprov:ruleName", [Lit(query.header.get("name", ""))]))
        if query.detail:
            pairs.append(("skos:note", [Lit(query.detail, lang="en")]))
        blocks.append((f"gsnprov:verification-{slug(query.name[:-3])}", pairs))

    preamble = (
        "# GENERATED by tools/query_check.py - do not edit. Re-run the script instead.\n\n"
        "<https://w3id.org/OntoGSN/provenance/queries> a owl:Ontology ;\n"
        "    owl:imports <https://w3id.org/OntoGSN/provenance> ;\n"
        "    dc:title \"OntoGSN Provenance - query verification\"@en ;\n"
        "    owl:versionInfo \"1.0.0\" .\n\n")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    prov_ttl.write(path, blocks, preamble)


# --------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true",
                    help="re-execute every query, ignoring the record")
    ap.add_argument("--check", action="store_true",
                    help="do not execute or write anything: is the record current?")
    ap.add_argument("--verbose", "-v", action="store_true",
                    help="one line per query, not only the problems")
    ap.add_argument("--only", default=None,
                    help="verify only queries whose name contains this")
    args = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(QUERY_DIR, "**", "*.rq"), recursive=True))
    if not paths:
        sys.exit(f"no queries found in {rel(QUERY_DIR)}")
    queries = [Query(p) for p in paths]
    if args.only:
        queries = [q for q in queries if args.only in q.name]

    graph = ttl_model.load()
    known_terms = {ttl_model.ln(s) for s in graph.subjects()
                   if str(s).startswith(ONTOLOGY_NS)}
    known_rules = {str(o) for s, o in graph.subject_objects(RDFS.label)
                   if (s, RDF.type, SWRL_IMP) in graph}
    check_static(queries, known_terms, known_rules)

    ontology_sum = matching.file_checksum(ONTOLOGY)
    fixture_sums = [matching.file_checksum(f) for f in FIXTURES]
    record = read_record(RECORD)

    engine = "not run"
    pyoxigraph = None
    if not args.check:
        try:
            import pyoxigraph as engine_module
            pyoxigraph = engine_module
            engine = f"pyoxigraph {pyoxigraph.__version__}"
        except ImportError:
            sys.exit("pyoxigraph is not installed - pip install -r tools/requirements.txt")

    reused = 0
    for query in queries:
        query.facts = {}
        previous = record.get(slug(query.name[:-3]), {})
        current_key = query.key(ontology_sum, fixture_sums)
        up_to_date = (previous.get("gsnprov:verificationKey") == current_key
                      and previous.get("gsnprov:verificationOutcome") == "passed")

        if args.check:
            if up_to_date:
                query.outcome, query.detail = "passed", "from the record"
            elif not previous:
                query.outcome = "unverified"
                query.detail = "not in the record - run tools/query_check.py"
            elif previous.get("gsnprov:verificationKey") != current_key:
                query.outcome = "unverified"
                query.detail = "the query, the ontology or the fixture changed since it " \
                               "was last verified - run tools/query_check.py"
            else:
                query.outcome = previous.get("gsnprov:verificationOutcome", "failed")
                query.detail = previous.get("skos:note", "recorded as not passing")
            continue

        if up_to_date and not args.all:
            # carry the previous run's finding forward - the record should say what the
            # query returned, not that it was skipped
            query.outcome, query.reused = "passed", True
            query.detail = previous.get("skos:note", "")
            for name in ("rowCount", "triplesAdded", "triplesRemoved"):
                if f"gsnprov:{name}" in previous:
                    query.facts[name] = int(previous[f"gsnprov:{name}"])
            engine_note = previous.get("gsnprov:verifiedWith")
            if engine_note:
                query.engine = engine_note
            reused += 1
            continue

        query.outcome, query.detail, query.facts = run(query, pyoxigraph)

    # a query with a static problem is not verified, whatever the execution said
    for query in queries:
        if query.problems and query.outcome == "passed":
            query.outcome = "failed"
            query.detail = query.problems[0]

    if not args.check:
        for query in queries:
            if not hasattr(query, "engine"):
                query.engine = engine
        if args.only:
            print("--only was given, so the record was not rewritten")
        else:
            write_record(RECORD, queries, ontology_sum, fixture_sums, engine)

    passed = [q for q in queries if q.outcome == "passed"]
    failed = [q for q in queries if q.outcome == "failed"]
    unverified = [q for q in queries if q.outcome == "unverified"]

    by_operation = {}
    for query in queries:
        by_operation.setdefault(query.operation or "?", []).append(query)
    print(f"{len(queries)} queries: " +
          ", ".join(f"{len(v)} {k}" for k, v in sorted(by_operation.items())))
    if args.check:
        print(f"{len(passed)} verified against the committed record, "
              f"{len(unverified)} unverified, {len(failed)} failing\n")
    else:
        print(f"{len(passed)} passed ({reused} reused from the record), "
              f"{len(failed)} failed\n")

    if args.verbose:
        for query in sorted(queries, key=lambda q: q.name):
            mark = {"passed": "ok  ", "failed": "FAIL", "unverified": "??  "}[query.outcome]
            note = " (reused)" if query.reused else ""
            print(f"  {mark}  {query.name:<52} {query.detail}{note}")
        print()

    for query in failed + unverified:
        print(f"  {query.outcome.upper()}  {query.name}")
        for problem in query.problems:
            print(f"          {problem}")
        if query.detail and not query.problems:
            print(f"          {query.detail}")

    if failed or unverified:
        sys.exit(1)
    if not args.check and not args.only:
        print(f"record: {rel(RECORD)}")


if __name__ == "__main__":
    main()
