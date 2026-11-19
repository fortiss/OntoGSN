# -*- coding: utf-8 -*-
"""Record the rest of what OntoGSN is made of: requirements, competency questions,
stored queries, and the files that are generated from other files.

    python development/dev_tools/prov_inventory.py            # rebuild the file
    python development/dev_tools/prov_inventory.py --check    # is the committed file current? writes nothing

Writes development/design/ontogsn-design-inventory.ttl. Unlike the design decisions, all
of this is recoverable from the repository, so this file IS regenerated - re-run it after
adding a query or rebuilding a serialization. It reads the requirements from
development/design/requirements.csv, and each query and rule, with its ID, its question and
the IDs that it replaced, from the registries (see registry.py).

The point is to make the chains explicit and therefore checkable:

    requirement -> competency question -> query -> the ontology terms it names
                                               -> the axioms it rests on or translates
    ontogsn.ttl -> build.py -> ontogsn.rdf, ontogsn.jsonld

The second query chain reaches into the hand-maintained record: a query points at the
StatementRecord of an axiom, and that record carries the design decision, the rationale
and the passage of the standard behind it. So this script reads
ontogsn-design-data.ttl as well as the repository - it cannot point at a decision
without knowing which decisions exist.

The query chain is what this caught first: every stored query used to bind gsn: to a
namespace the ontology does not use, which returns nothing at all and says nothing about
it. The queries were rewritten; development/dev_tools/query_check.py now refuses that and several related
mistakes on every run, and records the result alongside what this script writes.
"""
import argparse
import csv
import glob
import hashlib
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matching
import prov_ttl
import registry
import ttl_model
from prov_ttl import Lit

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, "development", "design", "ontogsn-design-inventory.ttl")
RECORD = os.path.join(REPO, "development", "design", "ontogsn-design-data.ttl")
REQUIREMENTS = os.path.join(REPO, "development", "design", "requirements.csv")
CORE_RULE_DIR = "ontology/queries/rules/"

PROV_NS = "https://w3id.org/OntoGSN/design#"
# the structural keys that declare a term to exist, as opposed to constraining one that
# already does - see statement_index
DECLARING = ("Class", "ObjectProperty", "DatatypeProperty", "AnnotationProperty",
             "Datatype")

ONTOLOGY_NS = "https://w3id.org/OntoGSN/ontology#"
SHAPES_NS = "https://w3id.org/OntoGSN/shapes#"

PREFIX_RE = re.compile(r"PREFIX\s+(\w*):\s*<([^>]+)>", re.IGNORECASE)
VERSION_RE = re.compile(r"owl:versionInfo\s+\"?([0-9][0-9.]*)\"?")


def sha256(path):
    """Content fingerprint, line-ending independent - see matching.file_checksum."""
    return matching.file_checksum(path)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def rel(path):
    return os.path.relpath(path, REPO).replace("\\", "/")


def file_block(iri, path, extra=()):
    pairs = [("a", ["gsndesign:File"]),
             ("gsndesign:path", [Lit(rel(path))]),
             ("gsndesign:fileChecksum", [Lit(sha256(path))])]
    pairs.extend(extra)
    return (iri, pairs)


def _braced(text, start):
    """The text between the brace at `start - 1` and its closing brace, and the end position."""
    depth, position = 1, start
    while depth and position < len(text):
        depth += {"{": 1, "}": -1}.get(text[position], 0)
        position += 1
    return text[start:position - 1], position


def _triples(block):
    """The triple patterns of a plain block, or None if it holds more than triples."""
    if "{" in block or re.search(r"\b(FILTER|BIND|OPTIONAL|VALUES|UNION|MINUS)\b", block):
        return None
    tokens = re.sub(r"\s*([;,.])(?=\s|$)", r" \1 ", block).split()
    found, subject, predicate, current = set(), None, None, []
    for token in tokens + ["."]:
        if token in (";", ",", "."):
            if subject is None and len(current) == 3:
                subject, predicate = current[0], current[1]
                current = current[2:]
            elif predicate is None and len(current) == 2:
                predicate, current = current[0], current[1:]
            elif len(current) == 2:
                predicate, current = current[0], current[1:]
            if len(current) != 1 or subject is None or predicate is None:
                return None if current else found
            found.add((subject, "rdf:type" if predicate == "a" else predicate, current[0]))
            current = []
            if token == ";":
                predicate = None
            elif token == ".":
                subject, predicate = None, None
        else:
            current.append(token)
    return found


def _local(term):
    """The local name of a prefixed name or an IRI, as a SWRL atom writes it."""
    return re.split(r"[:#/]", term.strip("<>"))[-1]


def translation_differences(body, swrl=None):
    """How a SPARQL update differs from the SWRL rule that it re-expresses.

    SWRL only adds facts and cannot test that something is absent, so two things in an update
    have no counterpart in the rule. A DELETE clause is a retraction. A negated condition is a
    guard, with one exception: a NOT EXISTS that tests only for what the update is about to
    insert. That test keeps the update from writing a second copy, which a rule cannot do
    anyway, so it is not a difference. A test with a new variable for the node must name the
    class of the node, or it also matches a node that another rule made.

    With `swrl`, the text of the rule, two more differences show. A FILTER that compares two
    variables with != is a guard if the rule has fewer differentFrom atoms. A triple that the
    update writes on the node that it makes, and that the head of the rule does not write, is
    node content.
    """
    found = []
    if re.search(r"(?m)^\s*DELETE\b", body):
        found.append("gsndesign:Retraction")
    inserted = set()
    for match in re.finditer(r"\bINSERT\s*\{", body):
        inserted |= _triples(_braced(body, match.end())[0]) or set()
    guard, covered = bool(re.search(r"\bMINUS\b", body)), 0
    for match in re.finditer(r"\bNOT EXISTS\s*\{", body):
        if match.start() < covered:          # nested in a block that is already a guard
            continue
        block, covered = _braced(body, match.end())
        outside = body[:match.end()] + body[covered:]
        patterns = _triples(block)

        def fresh(s):
            return s.startswith("?") and not re.search(re.escape(s) + r"\b", outside)

        if patterns is None or not all(
                any(p == p2 and o == o2 and (s == s2 or fresh(s))
                    for s2, p2, o2 in inserted)
                for s, p, o in patterns):
            guard = True
            continue
        # a new variable stands for the node; the test must name each class the node gets
        for s in {s for s, _, _ in patterns if fresh(s)}:
            named = {o for s2, p, o in patterns if s2 == s and p == "rdf:type"}
            for s2, p, o in inserted:
                if p == "rdf:type" and o not in named and all(
                        (p3, o3) in {(p4, o4) for s4, p4, o4 in inserted if s4 == s2}
                        for s3, p3, o3 in patterns if s3 == s):
                    guard = True
    if swrl is not None:
        unequal = len(re.findall(r"FILTER\s*\(\s*\?\w+\s*!=\s*\?\w+\s*\)", body))
        if unequal > len(re.findall(r"\bdifferentFrom\(", swrl)):
            guard = True
    if guard:
        found.append("gsndesign:Guard")
    if swrl is not None and "->" in swrl:
        head = {name for name in re.findall(r"(\w+)\(", swrl.split("->", 1)[1])}
        minted = set(re.findall(r"BIND\s*\(\s*IRI\s*\(.*?\)\s*AS\s+(\?\w+)\s*\)", body, re.S))
        if any(s in minted and p != "rdf:type" and _local(p) not in head
               for s, p, o in inserted):
            found.append("gsndesign:NodeContent")
    return found


def declared_version(path):
    # The whole file, not a fixed window. owl:versionInfo sits wherever the ontology header
    # happens to put it, and adding one prefix line was enough to push it past a 4000-character
    # read - at which point every slice was reported as stale against an ontology of "unknown"
    # version, which reads as a real finding and is not one.
    with open(path, encoding="utf-8", errors="replace") as fh:
        match = VERSION_RE.search(fh.read())
    return match.group(1) if match else None


def read_csv(path):
    with open(path, encoding="utf-8", newline="") as handle:
        return [{k: (v or "").strip() for k, v in row.items()} for row in csv.DictReader(handle)]


def statement_index():
    """The record, indexed the two ways a query needs to reach into it.

    -> (rule name -> statement, term -> [statements declaring it], statement -> its text)

    Both are looked up in the hand-maintained record rather than recomputed from the
    ontology, because the point of the link is to reach a design decision. A statement
    record is what carries one; the axiom in ontogsn.ttl does not.

    The declaring axiom is the one that says a term exists at all - 'Goal a Class',
    'supportedBy a ObjectProperty'. Everything else said about a term constrains
    something already declared, and a query does not rest on those the same way: it
    rests on the term being a thing it can ask about.
    """
    from rdflib import Graph, Namespace

    P = Namespace(PROV_NS)
    graph = Graph()
    graph.parse(RECORD, format="turtle")

    def qname(iri):
        return "gsndesign:" + str(iri)[len(PROV_NS):]

    by_rule = {str(name): qname(st) for st, name in graph.subject_objects(P.ruleName)}

    by_term = {}
    for st, key in graph.subject_objects(P.structuralKey):
        parts = str(key).split("|")
        if len(parts) == 3 and parts[1] == "a" and parts[2] in DECLARING:
            by_term.setdefault(parts[0], []).append(qname(st))
    # two ontology terms can share a rendering, so a term may resolve to more than one
    # record; sorted, because this file has to come out the same way twice
    texts = {qname(st): str(text) for st, text in graph.subject_objects(P.statementText)}
    return by_rule, {term: sorted(set(sts)) for term, sts in by_term.items()}, texts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--check", action="store_true",
                    help="verify that the generated file is current; write nothing")
    args = ap.parse_args()

    graph = ttl_model.load()
    known = {ttl_model.ln(s) for s in graph.subjects()
             if str(s).startswith(ONTOLOGY_NS)}
    blocks = []

    # --- requirements and competency questions ------------------------------------
    # the registries list every query and rule; registry.problems() makes sure of it
    problems = registry.problems()
    if problems:
        sys.exit("the registries of the queries and rules:\n  " + "\n  ".join(problems))
    requirements = read_csv(REQUIREMENTS)
    rows = sorted(registry.load(), key=lambda row: row["id"])
    # the text of a read is the question that it answers, and the text of a write is the
    # operation that it carries out: both are recorded as the competency question of their
    # query. A rule answers none.
    questions = [row for row in rows if not row["id"].startswith("RL-")]

    blocks.append(prov_ttl.header(
        f"Requirements ({len(requirements)})",
        "What OntoGSN set out to do, before any of it was built."))
    for row in requirements:
        pairs = [("a", ["gsndesign:Requirement"]),
                 ("rdfs:label", [Lit(row["ID"], lang="en")]),
                 ("gsndesign:requirementText", [Lit(row["Requirement"], lang="en")])]
        applies = [p.strip() for p in row.get("refers to", "").split(",") if p.strip()]
        if applies:
            pairs.append(("gsndesign:appliesTo", [Lit(a) for a in applies]))
        source = row.get("source", "").strip()
        if source and source != "-":
            pairs.append(("dc:source", [Lit(source, lang="en")]))
        blocks.append((f"gsndesign:req-{row['ID']}", pairs))

    blocks.append(prov_ttl.header(
        f"Competency questions ({len(questions)})",
        "What the ontology has to be able to answer, and for whom. A question has the ID of\n"
        "the query that answers it."))
    by_query = {}
    for row in questions:
        iri = "gsndesign:cq-" + row["id"]
        pairs = [
            ("a", ["gsndesign:CompetencyQuestion"]),
            ("rdfs:label", [Lit(row["id"])]),
            ("gsndesign:questionText", [Lit(row["text"], lang="en")]),
        ]
        # only the questions of the audit procedure carry a role
        if row["role"]:
            pairs.insert(2, ("gsndesign:role", [Lit(row["role"], lang="en")]))
        blocks.append((iri, pairs))
        by_query[row["file"]] = [iri]

    # --- stored queries -------------------------------------------------------------
    by_rule, by_term, texts = statement_index()
    blocks.append(prov_ttl.header(
        f"Stored queries ({len(rows)})",
        "The IRI and the label of a query are its ID, which is also its file name.\n"
        "skos:hiddenLabel keeps each ID and file name that the ID replaced, so an old name\n"
        "still finds the query.\n\n"
        "gsndesign:declaresNamespace records what each file binds its prefixes to, which is\n"
        "how a query pointing at the wrong namespace becomes findable.\n\n"
        "gsndesign:queryText holds the query verbatim, so the record says what was asked at\n"
        "a given version without the file having to still exist. gsndesign:fileChecksum is\n"
        "what detects that it changed.\n\n"
        "Two links reach back into the ontology, and they are not the same strength.\n"
        "gsndesign:translatesStatement joins each file under ontology/queries/rules/ to the SWRL\n"
        "rule that it re-expresses for a store with no reasoner, and the join is the rule's\n"
        "name. gsndesign:differsBy says where the update does what the rule cannot: it\n"
        "retracts an old value, or it has a guard. gsndesign:restsOnStatement is weaker and derived: the\n"
        "axiom declaring each gsn: term the query names. Either way the target is a\n"
        "StatementRecord, so one hop further reaches why that axiom exists at all."))
    unanswered = dict(by_query)
    unjoined = []
    for row in rows:
        identifier, file = row["id"], row["file"]
        path = os.path.join(REPO, *file.split("/"))
        with open(path, encoding="utf-8", errors="replace") as fh:
            body = fh.read()
        namespaces = sorted({uri for _, uri in PREFIX_RE.findall(body)})
        mentions = sorted({f"gsn:{local}" for local in
                           re.findall(r"\bgsn:([A-Za-z][A-Za-z0-9_]*)", body)
                           if local in known})
        pairs = [("a", ["gsndesign:Query"]),
                 ("rdfs:label", [Lit(identifier)]),
                 ("gsndesign:formalism", ["gsndesign:SPARQL"]),
                 ("gsndesign:path", [Lit(file)]),
                 ("gsndesign:fileChecksum", [Lit(sha256(path))])]
        former = row["replaces"].split()
        if former:
            pairs.insert(2, ("skos:hiddenLabel", [Lit(name) for name in former]))
        if namespaces:
            pairs.append(("gsndesign:declaresNamespace", [Lit(n) for n in namespaces]))
        if mentions:
            pairs.append(("gsndesign:mentionsTerm", mentions))
        rule = re.search(r"(?m)^#\s+name:\s+(.*)$", body)
        if identifier.startswith("RL-") and rule:
            rule_name = rule.group(1).strip()
            pairs.append(("gsndesign:ruleName", [Lit(rule_name)]))
            # the core rule this file carries out, as the ontology states it. Missing only
            # if the rule was renamed on one side and not the other, which is worth seeing.
            # The record holds no statement of an Augmentation rule.
            if file.startswith(CORE_RULE_DIR):
                if rule_name in by_rule:
                    pairs.append(("gsndesign:translatesStatement", [by_rule[rule_name]]))
                else:
                    unjoined.append((identifier, rule_name))
                differences = translation_differences(
                    body, texts.get(by_rule.get(rule_name)))
                if differences:
                    pairs.append(("gsndesign:differsBy", differences))
        rests = sorted({st for term in mentions
                        for st in by_term.get(term.split(":", 1)[1], [])})
        if rests:
            pairs.append(("gsndesign:restsOnStatement", rests))
        for question in by_query.get(file, []):
            pairs.append(("gsndesign:answersQuestion", [question]))
        pairs.append(("gsndesign:queryText", [Lit(body)]))
        unanswered.pop(file, None)
        blocks.append((f"gsndesign:query-{identifier}", pairs))

    # --- generated files -------------------------------------------------------------
    blocks.append(prov_ttl.header(
        "Generated files and what generates them",
        "A derived file with no generating activity is one nobody knows how to rebuild.\n"
        "The slices under ontology/serializations/separated/ are exactly that, which is why they\n"
        "appear here with prov:wasDerivedFrom but no prov:wasGeneratedBy."))

    source_ttl = os.path.join(REPO, "ontology", "serializations", "ontogsn.ttl")
    blocks.append(file_block("gsndesign:file-ontogsn-ttl", source_ttl, [
        ("gsndesign:declaredVersion", [Lit(declared_version(source_ttl) or "unknown")]),
        ("prov:specializationOf", ["<https://w3id.org/OntoGSN/ontology>"]),
    ]))

    derived = []
    for name in ("ontogsn.rdf", "ontogsn.jsonld"):
        path = os.path.join(REPO, "ontology", "serializations", name)
        iri = "gsndesign:file-" + slug(name)
        derived.append(iri)
        blocks.append(file_block(iri, path, [
            ("prov:wasDerivedFrom", ["gsndesign:file-ontogsn-ttl"]),
            ("prov:specializationOf", ["<https://w3id.org/OntoGSN/ontology>"]),
            ("prov:wasGeneratedBy", ["gsndesign:build-serializations"]),
        ]))
    blocks.append(("gsndesign:build-serializations", [
        ("a", ["prov:Activity"]),
        ("rdfs:label", [Lit("development/dev_tools/build.py", lang="en")]),
        ("prov:used", ["gsndesign:file-ontogsn-ttl"]),
        ("prov:generated", derived),
        ("prov:wasAssociatedWith", ["gsndesign:agent-build-py"]),
    ]))
    blocks.append(("gsndesign:agent-build-py", [
        ("a", ["prov:SoftwareAgent", "prov:Plan"]),
        ("rdfs:label", [Lit("development/dev_tools/build.py", lang="en")]),
        ("gsndesign:path", [Lit("development/dev_tools/build.py")]),
    ]))

    sections = sorted(glob.glob(os.path.join(REPO, "ontology", "shapes",
                                             "ontogsn-shapes_[1-5]*.ttl")))
    section_iris = []
    for path in sections:
        iri = "gsndesign:file-" + slug(os.path.basename(path)[:-4])
        section_iris.append(iri)
        blocks.append(file_block(iri, path, [
            ("gsndesign:declaredVersion", [Lit(declared_version(path) or "unknown")]),
            ("prov:wasDerivedFrom", ["gsndesign:file-ontogsn-ttl"]),
        ]))
    full = os.path.join(REPO, "ontology", "shapes", "ontogsn-shapes_0_full.ttl")
    blocks.append(file_block("gsndesign:file-ontogsn-shapes-0-full", full, [
        ("gsndesign:declaredVersion", [Lit(declared_version(full) or "unknown")]),
        ("prov:wasDerivedFrom", section_iris),
        ("prov:wasGeneratedBy", ["gsndesign:build-shapes"]),
    ]))
    blocks.append(("gsndesign:build-shapes", [
        ("a", ["prov:Activity"]),
        ("rdfs:label", [Lit("development/dev_tools/build_full.py", lang="en")]),
        ("prov:used", section_iris),
        ("prov:generated", ["gsndesign:file-ontogsn-shapes-0-full"]),
        ("prov:wasAssociatedWith", ["gsndesign:agent-build-full-py"]),
    ]))
    blocks.append(("gsndesign:agent-build-full-py", [
        ("a", ["prov:SoftwareAgent", "prov:Plan"]),
        ("rdfs:label", [Lit("development/dev_tools/build_full.py", lang="en")]),
        ("gsndesign:path", [Lit("development/dev_tools/build_full.py")]),
    ]))

    # The slices are the ontology itself, cut into sections, so they are specializations
    # of it and owe it their version number. The shapes above are a different graph with
    # a version of their own, which is why they are derived from the ontology but not
    # specializations of it.
    slices = sorted(glob.glob(os.path.join(REPO, "ontology", "serializations", "separated",
                                           "*.ttl")) +
                    glob.glob(os.path.join(REPO, "ontology", "serializations", "separated",
                                           "*.jsonld")))
    slice_iris = []
    for path in slices:
        version = declared_version(path)
        iri = "gsndesign:file-" + slug(os.path.basename(path).rsplit(".", 1)[0] + "-" +
                                     path.rsplit(".", 1)[1])
        slice_iris.append(iri)
        extra = [("prov:wasDerivedFrom", ["gsndesign:file-ontogsn-ttl"]),
                 ("prov:specializationOf", ["<https://w3id.org/OntoGSN/ontology>"]),
                 ("prov:wasGeneratedBy", ["gsndesign:build-separated"])]
        if version:
            extra.append(("gsndesign:declaredVersion", [Lit(version)]))
        blocks.append(file_block(iri, path, extra))
    blocks.append(("gsndesign:build-separated", [
        ("a", ["prov:Activity"]),
        ("rdfs:label", [Lit("development/dev_tools/build_separated.py", lang="en")]),
        ("prov:used", ["gsndesign:file-ontogsn-ttl"]),
        ("prov:generated", slice_iris),
        ("prov:wasAssociatedWith", ["gsndesign:agent-build-separated-py"]),
    ]))
    blocks.append(("gsndesign:agent-build-separated-py", [
        ("a", ["prov:SoftwareAgent", "prov:Plan"]),
        ("rdfs:label", [Lit("development/dev_tools/build_separated.py", lang="en")]),
        ("gsndesign:path", [Lit("development/dev_tools/build_separated.py")]),
    ]))

    preamble = (
        "# GENERATED by development/dev_tools/prov_inventory.py. Everything here is recoverable from the\n"
        "# repository, so unlike ontogsn-design-data.ttl this file is rebuilt, not\n"
        "# edited. Re-run after adding a query or rebuilding a serialization.\n\n"
        "<https://w3id.org/OntoGSN/design/inventory> a owl:Ontology ;\n"
        "    owl:imports <https://w3id.org/OntoGSN/design> ;\n"
        "    dc:title \"OntoGSN Design Record - requirements, questions, queries and builds\"@en ;\n"
        "    owl:versionInfo \"1.0.0\" .\n\n")

    if args.check:
        # Build the file in a temporary folder and compare it with the committed one. Line
        # endings are ignored, because a Windows checkout can hold the file with CRLF.
        with tempfile.TemporaryDirectory() as folder:
            fresh = os.path.join(folder, os.path.basename(args.out))
            prov_ttl.write(fresh, blocks, preamble)
            with open(fresh, "rb") as handle:
                expected = handle.read().replace(b"\r\n", b"\n")
        current = b""
        if os.path.exists(args.out):
            with open(args.out, "rb") as handle:
                current = handle.read().replace(b"\r\n", b"\n")
        name = os.path.relpath(args.out, REPO).replace(os.sep, "/")
        if current != expected:
            sys.exit(f"{name} is out of date - run python development/dev_tools/prov_inventory.py")
        print(f"{name} is current")
        return

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    prov_ttl.write(args.out, blocks, preamble)

    print(f"{len(requirements)} requirements, {len(questions)} competency questions, "
          f"{len(rows)} queries")
    print(f"{len(sections) + len(slices) + 4} files with their derivation chains")
    if unanswered:
        print(f"\n{len(unanswered)} competency questions name a query file that does "
              f"not exist:")
        for name, who in sorted(unanswered.items()):
            print(f"  {name}  (cited by {', '.join(w.split(':')[-1] for w in who)})")
    if unjoined:
        # a rule with no record is either a rule nobody documented or a rename that
        # happened on one side only. Both need a person, so say so rather than dropping
        # the link silently.
        print(f"\n{len(unjoined)} rule queries name a rule with no statement record:")
        for name, rule_name in sorted(unjoined):
            print(f"  {name}  ->  {rule_name!r}")
    print(f"\nwrote {args.out} ({os.path.getsize(args.out):,} bytes)")


if __name__ == "__main__":
    main()
