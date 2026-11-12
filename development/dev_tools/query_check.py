# -*- coding: utf-8 -*-
"""Verify that every stored query in ontology/queries/ still executes, and record that it did.

    python development/dev_tools/query_check.py            # verify what changed, update the record
    python development/dev_tools/query_check.py --all      # re-verify everything
    python development/dev_tools/query_check.py --check    # CI: is the record current? never writes
    python development/dev_tools/query_check.py -v         # show every query, not just the problems

Two kinds of check, and they cost very different amounts.

The STATIC checks read the query text, its section in QUERY-COMMENTS.md and the ontology:
does the file hold no comment, are its header fields complete, is gsn:
bound to the namespace the ontology actually uses, does every gsn: term named in the query
exist? That last one is the failure this directory was rewritten to fix - a query naming
gsn:Evidence or gsn:Model returns nothing at all, silently and forever, and no amount of
running it will say so. Static checks are cheap and always run.

The DYNAMIC check loads ontology/serializations/ontogsn.ttl and the example ABox into an in-memory
Oxigraph store and executes the query against it: reads must return rows, writes must
change the store in the direction they claim. That is the expensive part, so it is not
re-run for a query nothing has touched.

The header of a query (id, operation, question, expect, and for a rule section and swrl) is
not in the file. It is in the query's section of QUERY-COMMENTS.md at the root, which this
script reads. A rule file keeps only its '# rule:' and '# name:' lines.

What "nothing has touched" means is recorded in development/design/ontogsn-design-queries.ttl
as gsndesign:verificationKey - one hash over the query text, its header fields, the ontology,
the fixture and CHECKER_VERSION below. Edit one query and one query is re-verified; edit the ontology and
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

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QUERY_DIR = os.path.join(REPO, "ontology", "queries")
TESTDATA = os.path.join(REPO, "development", "dev_tools", "testdata")
FIXTURE = os.path.join(REPO, "ontology", "example", "example_case.ttl")
RULE_FIXTURE = os.path.join(TESTDATA, "rule_cases.ttl")
ONTOLOGY = os.path.join(REPO, "ontology", "serializations", "ontogsn.ttl")
RECORD = os.path.join(REPO, "development", "design", "ontogsn-design-queries.ttl")
COMMENTS = os.path.join(REPO, "QUERY-COMMENTS.md")
# every SPARQL file of the repository, not only the stored queries, must hold no comment
SPARQL_DIRS = [os.path.join(REPO, *d.split("/")) for d in
               ("ontology/queries", "augmentation", "docs/playground/assets/data/queries")]
RULE_DIRS = ("ontology/queries/rules/", "augmentation/rules/", "augmentation/derivations/")

FIXTURES = [FIXTURE, RULE_FIXTURE]
FIXTURE_LABELS = ["example assurance case ABox",
                  "one minimal trigger per SWRL rule"]

ONTOLOGY_NS = "https://w3id.org/OntoGSN/ontology#"

# Bump when a change here alters what verification means - a new check, a different
# expectation - so that every query is re-verified under the new rules. Editing a comment
# is not such a change, which is why this is a constant and not the file's own checksum.
CHECKER_VERSION = "2"

OPERATIONS = ("create", "read", "update", "delete", "rule")
EXPECTATIONS = {"rows", "empty", "insert", "delete", "change", "none"}
HEADER_FIELDS = ("id", "operation", "question", "expect")
RULE_HEADER_FIELDS = ("rule", "name", "section", "operation", "expect", "swrl")

PREFIX_RE = re.compile(r"(?m)^\s*PREFIX\s+(\w*):\s*<([^>]+)>")
GSN_TERM_RE = re.compile(r"\bgsn:([A-Za-z][A-Za-z0-9_]*)")
FORM_RE = re.compile(r"(?m)^\s*(SELECT|ASK|CONSTRUCT|DESCRIBE|INSERT|DELETE|WITH|LOAD"
                     r"|CLEAR|DROP|COPY|MOVE|ADD)\b", re.IGNORECASE)
HEADER_RE = re.compile(r"^#\s{1,}(\w+):\s{1,}(.*)$")
KEPT_LINE_RE = re.compile(r"^# (rule|name):\s+\S")
TOKEN_RE = re.compile(r'"(?:[^"\\\n]|\\.)*"'          # a double-quoted string
                      r"|'(?:[^'\\\n]|\\.)*'"          # a single-quoted string
                      r'|<[^<>"{}|^`\\\s]*>'           # an IRI
                      r"|#")                           # a comment starts here
SECTION_RE = re.compile(r"^### `([^`]+)`\s*$")
ROW_RE = re.compile(r"^\| (\w+) \| (.*) \|\s*$")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def rel(path):
    return os.path.relpath(path, REPO).replace("\\", "/")


class Query(object):
    """One .rq file: its header, its text, and what verifying it concluded."""

    def __init__(self, path, fields=None):
        self.path = path
        self.name = os.path.relpath(path, QUERY_DIR).replace(os.sep, "/")
        self.is_rule = self.name.startswith("rules/")
        with open(path, encoding="utf-8") as fh:
            self.text = fh.read()
        self.checksum = matching.file_checksum(path)
        self.fields = dict(fields or {})
        self.header = dict(self.fields)
        self.header.update(self._parse_header())
        self.problems = []
        self.outcome = None
        self.detail = ""
        self.reused = False

    def _parse_header(self):
        """The leading '# rule:' and '# name:' lines of a rule file."""
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
        fields = "\n".join(f"{k}={v}" for k, v in sorted(self.fields.items()))
        for part in (CHECKER_VERSION, self.checksum, fields, ontology_sum) + tuple(fixture_sums):
            digest.update(part.encode("utf-8") + b"\0")
        return digest.hexdigest()


def comment_start(line):
    """Index of the '#' that starts a comment on the line, or -1.

    A '#' inside an IRI or a string is not one. No query here has a string over two lines.
    """
    for match in TOKEN_RE.finditer(line):
        if match.group(0) == "#":
            return match.start()
    return -1


def strip_comments(text):
    """The text without its comments."""
    out = []
    for line in text.splitlines():
        position = comment_start(line)
        out.append(line if position < 0 else line[:position])
    return "\n".join(out)


def stray_comments(name, text):
    """Line numbers of the comments a SPARQL file must not hold.

    A rule file may begin with '# rule:' and '# name:'. Any other comment belongs in
    QUERY-COMMENTS.md.
    """
    lines = text.splitlines()
    start = 0
    if name.startswith(RULE_DIRS):
        while start < len(lines) and KEPT_LINE_RE.match(lines[start]):
            start += 1
    return [number for number, line in enumerate(lines[start:], start + 1)
            if comment_start(line) >= 0]


def read_comments(path):
    """{file path: {field: value}} from the header tables of QUERY-COMMENTS.md."""
    sections, current = {}, None
    if not os.path.exists(path):
        return sections
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            heading = SECTION_RE.match(line)
            if heading:
                current = sections.setdefault(heading.group(1), {})
                continue
            if line.startswith("#"):
                current = None
                continue
            row = ROW_RE.match(line)
            if current is not None and row and row.group(1) != "Field":
                current[row.group(1)] = row.group(2).replace("\\|", "|").strip()
    return sections


# --------------------------------------------------------------------------------------
#  Static checks - cheap, and the ones that catch the silent failures
# --------------------------------------------------------------------------------------

def missing(field):
    if field in ("rule", "name"):
        return f"the file has no '# {field}:' line"
    return f"QUERY-COMMENTS.md gives no '{field}' for it"


def check_static(queries, known_terms, known_rules):
    seen_ids, seen_rules = {}, {}
    for query in queries:
        for number in stray_comments(rel(query.path), query.text):
            query.problems.append(
                f"holds a comment on line {number} - move it to QUERY-COMMENTS.md")
        if query.is_rule:
            for field in RULE_HEADER_FIELDS:
                if not query.header.get(field):
                    query.problems.append(missing(field))
            if query.operation != "rule":
                query.problems.append(
                    f"a file in rules/ must declare 'operation: rule', not "
                    f"'{query.operation}'")
            name = query.header.get("name")
            if name and name not in known_rules:
                query.problems.append(
                    f"name '{name}' matches no rdfs:label on a SWRL rule in the ontology")
            elif name and query.header.get("section") not in (None, known_rules[name]):
                query.problems.append(
                    f"section '{query.header['section']}' in QUERY-COMMENTS.md, but the SWRL "
                    f"rule is in '{known_rules[name]}'")
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
                    query.problems.append(missing(field))
            if query.operation and query.operation != expected_operation:
                query.problems.append(
                    f"QUERY-COMMENTS.md says operation '{query.operation}' but the file name says "
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

    A rule also sees development/dev_tools/testdata/rule_cases.ttl - one minimal trigger per SWRL rule.
    The example case alone does not fire all fifty-eight, and contorting it until it did
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
    r"(?ms)^gsndesign:verification-(\S+)\n(.*?)\n\n")
FIELD_RE = re.compile(r"(?m)^\s+(gsndesign:\w+|prov:\w+|skos:\w+|rdfs:\w+|a)\s+(.+?)\s*[;.]$")


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
        "GENERATED by development/dev_tools/query_check.py. One activity per stored query, recording that\n"
        "it executed against the example ABox and what came back.\n\n"
        "gsndesign:verificationKey is a hash over the query, the ontology, the fixture and\n"
        "the checker's own version. It is what makes verification incremental: a key that\n"
        "still matches is a query nothing has touched, and re-running it would ask a\n"
        "question already answered. A key that no longer matches is not a failure - it is\n"
        "an unverified query, and running the script without --check answers it.")]

    for path_, checksum, label in zip(FIXTURES, fixture_sums, FIXTURE_LABELS):
        blocks.append((f"gsndesign:file-{slug(os.path.basename(path_)[:-4])}", [
            ("a", ["gsndesign:File"]),
            ("rdfs:label", [Lit(label, lang="en")]),
            ("gsndesign:path", [Lit(rel(path_))]),
            ("gsndesign:fileChecksum", [Lit(checksum)]),
        ]))
    blocks.append(("gsndesign:agent-query-check-py", [
        ("a", ["prov:SoftwareAgent", "prov:Plan"]),
        ("rdfs:label", [Lit("development/dev_tools/query_check.py", lang="en")]),
        ("gsndesign:path", [Lit("development/dev_tools/query_check.py")]),
        ("gsndesign:declaredVersion", [Lit(CHECKER_VERSION)]),
    ]))

    for query in sorted(queries, key=lambda q: q.name):
        used = [f"gsndesign:query-{slug(query.name[:-3])}", "gsndesign:file-ontogsn-ttl",
                "gsndesign:file-example-case"]
        if query.is_rule:
            used.append("gsndesign:file-rule-cases")
        pairs = [
            ("a", ["gsndesign:QueryVerification"]),
            ("rdfs:label", [Lit(query.name, lang="en")]),
            ("prov:used", used),
            ("prov:wasAssociatedWith", ["gsndesign:agent-query-check-py"]),
            ("gsndesign:verificationKey", [Lit(query.key(ontology_sum, fixture_sums))]),
            ("gsndesign:operation", [Lit(query.operation)]),
            ("gsndesign:expectation", [Lit(query.expect)]),
            ("gsndesign:resultForm", [Lit(query.form)]),
            ("gsndesign:verificationOutcome", [Lit(query.outcome or "not run")]),
            ("gsndesign:verifiedWith", [Lit(engine)]),
        ]
        for name, value in sorted(query.facts.items()):
            pairs.append((f"gsndesign:{name}",
                          [Lit(str(value), datatype="xsd:integer")]))
        if query.is_rule:
            pairs.insert(5, ("gsndesign:ruleName", [Lit(query.header.get("name", ""))]))
        if query.detail:
            pairs.append(("skos:note", [Lit(query.detail, lang="en")]))
        blocks.append((f"gsndesign:verification-{slug(query.name[:-3])}", pairs))

    preamble = (
        "# GENERATED by development/dev_tools/query_check.py - do not edit. Re-run the script instead.\n\n"
        "<https://w3id.org/OntoGSN/design/queries> a owl:Ontology ;\n"
        "    owl:imports <https://w3id.org/OntoGSN/design> ;\n"
        "    dc:title \"OntoGSN Design Record - query verification\"@en ;\n"
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
    comments = read_comments(COMMENTS)
    queries = [Query(p, comments.get(rel(p))) for p in paths]
    if args.only:
        queries = [q for q in queries if args.only in q.name]

    graph = ttl_model.load()
    known_terms = {ttl_model.ln(s) for s in graph.subjects()
                   if str(s).startswith(ONTOLOGY_NS)}
    core_or_extension = URIRef(ONTOLOGY_NS + "coreOrExtension")
    known_rules = {str(o): str(graph.value(s, core_or_extension) or "")
                   for s, o in graph.subject_objects(RDFS.label)
                   if (s, RDF.type, SWRL_IMP) in graph}
    check_static(queries, known_terms, known_rules)

    # the SPARQL files outside ontology/queries/ are not run here, but must hold no comment
    # either, and every section of QUERY-COMMENTS.md must name a file that exists
    elsewhere = []
    for directory in SPARQL_DIRS:
        for pattern in ("*.rq", "*.sparql"):
            for path in sorted(glob.glob(os.path.join(directory, "**", pattern), recursive=True)):
                if path.startswith(QUERY_DIR + os.sep):
                    continue
                with open(path, encoding="utf-8") as fh:
                    lines = stray_comments(rel(path), fh.read())
                if lines:
                    elsewhere.append(f"{rel(path)} holds a comment on line {lines[0]} - "
                                     "move it to QUERY-COMMENTS.md")
    for name in sorted(comments):
        if not os.path.exists(os.path.join(REPO, *name.split("/"))):
            elsewhere.append(f"QUERY-COMMENTS.md has a section for {name}, which does not exist")

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
            sys.exit("pyoxigraph is not installed - pip install -r development/dev_tools/requirements.txt")

    reused = 0
    for query in queries:
        query.facts = {}
        previous = record.get(slug(query.name[:-3]), {})
        current_key = query.key(ontology_sum, fixture_sums)
        up_to_date = (previous.get("gsndesign:verificationKey") == current_key
                      and previous.get("gsndesign:verificationOutcome") == "passed")

        if args.check:
            if up_to_date:
                query.outcome, query.detail = "passed", "from the record"
            elif not previous:
                query.outcome = "unverified"
                query.detail = "not in the record - run development/dev_tools/query_check.py"
            elif previous.get("gsndesign:verificationKey") != current_key:
                query.outcome = "unverified"
                query.detail = "the query, the ontology or the fixture changed since it " \
                               "was last verified - run development/dev_tools/query_check.py"
            else:
                query.outcome = previous.get("gsndesign:verificationOutcome", "failed")
                query.detail = previous.get("skos:note", "recorded as not passing")
            continue

        if up_to_date and not args.all:
            # carry the previous run's finding forward - the record should say what the
            # query returned, not that it was skipped
            query.outcome, query.reused = "passed", True
            query.detail = previous.get("skos:note", "")
            for name in ("rowCount", "triplesAdded", "triplesRemoved"):
                if f"gsndesign:{name}" in previous:
                    query.facts[name] = int(previous[f"gsndesign:{name}"])
            engine_note = previous.get("gsndesign:verifiedWith")
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

    for problem in elsewhere:
        print(f"  FAIL  {problem}")

    if failed or unverified or elsewhere:
        sys.exit(1)
    if not args.check and not args.only:
        print(f"record: {rel(RECORD)}")


if __name__ == "__main__":
    main()
