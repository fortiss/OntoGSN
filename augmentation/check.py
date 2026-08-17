# -*- coding: utf-8 -*-
"""Parse, run and validate the augmentation against its fixture.

    python augmentation/check.py

Three things, in the order they can fail:

    1. every file parses, and the SWRL rules are well-formed atom lists
    2. the SPARQL rules reach a fixpoint, and each SWRL rule has a SPARQL twin
    3. the SHACL shapes validate the fixture before and after the rules run

Deliberately standalone. tools/check_all.py globs serializations/, shapes/ and queries/, so it
never sees this directory - which is the point: the augmentation must not be able to break the
core checks.
"""
import glob
import os
import sys

from pyshacl import validate
from rdflib import Graph, Literal, Namespace, RDF, URIRef
from rdflib.namespace import RDFS

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

GSN = Namespace("https://w3id.org/OntoGSN/ontology#")
AUG = Namespace("https://w3id.org/OntoGSN/augmentation#")
SWRL = Namespace("http://www.w3.org/2003/11/swrl#")
SHACL = "http://www.w3.org/ns/shacl#"

ONTOLOGY = os.path.join(HERE, "ontogsn-augmentation.ttl")
SHAPES = os.path.join(HERE, "ontogsn-augmentation-shapes.ttl")
FIXTURE = os.path.join(HERE, "testdata", "example_issues.ttl")
CORE = os.path.join(REPO, "serializations", "ontogsn.ttl")
CORE_RULES = os.path.join(REPO, "queries", "rules")
AUG_RULES = os.path.join(HERE, "rules")

failures = []


def head(title):
    print(f"\n{'=' * 72}\n  {title}\n{'=' * 72}")


def check(condition, ok, bad):
    print(f"  {'OK  ' if condition else 'FAIL'}  {ok if condition else bad}")
    if not condition:
        failures.append(bad)


# --------------------------------------------------------------------------- parse

head("parse")

graphs = {}
for label, path in [("ontology", ONTOLOGY), ("shapes", SHAPES), ("fixture", FIXTURE)]:
    graph = Graph()
    graph.parse(path, format="turtle")
    graphs[label] = graph
    print(f"  {label:9} {len(graph):5} triples  {os.path.relpath(path, REPO)}")

ontology = graphs["ontology"]

# Every SWRL rule must have a body and a head, and every atom list must terminate.
rules = sorted(ontology.subjects(RDF.type, SWRL.Imp))
print()
for rule in rules:
    label = ontology.value(rule, RDFS.label)
    atoms = 0
    for part in (SWRL.body, SWRL.head):
        node = ontology.value(rule, part)
        while node and node != RDF.nil:
            atoms += 1
            node = ontology.value(node, RDF.rest)
    print(f"  {str(label):38} {atoms} atoms")
check(len(rules) == 6, f"{len(rules)} SWRL rules", f"expected 6 SWRL rules, found {len(rules)}")

# Each SWRL rule needs a SPARQL twin, so the two never drift.
sparql_rules = sorted(glob.glob(os.path.join(AUG_RULES, "*.rq")))
check(len(sparql_rules) == len(rules),
      f"{len(sparql_rules)} SPARQL rules, one per SWRL rule",
      f"{len(sparql_rules)} SPARQL rules but {len(rules)} SWRL rules")

# --------------------------------------------------------------------------- rules

head("rules to a fixpoint")

data = Graph()
data.parse(CORE, format="turtle")
data.parse(ONTOLOGY, format="turtle")
data.parse(FIXTURE, format="turtle")
before = len(data)

updates = []
for path in sorted(glob.glob(os.path.join(CORE_RULES, "*.rq"))) + sparql_rules:
    text = open(path, encoding="utf-8").read()
    upper = text.upper()
    if "INSERT" in upper or "DELETE" in upper:
        updates.append((os.path.basename(path), text))
check(len(updates) > len(sparql_rules),
      f"{len(updates)} update rules loaded ({len(sparql_rules)} of them augmentation)",
      "no core rules were loaded - the augmentation rules would run in isolation")

for round_number in range(1, 21):
    size = len(data)
    for name, text in updates:
        try:
            data.update(text)
        except Exception as error:                       # a rule that cannot run is a failure
            failures.append(f"{name}: {error}")
    if len(data) == size:
        print(f"  fixpoint after {round_number} round(s); {before} -> {len(data)} triples")
        break
else:
    failures.append("rules did not reach a fixpoint in 20 rounds")

print()
EX = Namespace("https://example.org/case#")
expected = [
    ("revise on a solution challenges it",  (EX.I3, GSN.challenges, EX.Sn1), True),
    ("resolve on a goal challenges it",     (EX.I4, GSN.challenges, EX.G1), True),
    ("clarify challenges nothing",          (EX.I1, GSN.challenges, None), False),
    ("revise on a context challenges nothing", (EX.I2, GSN.challenges, None), False),
    ("challenger is inferred a Defeater",   (EX.I3, RDF.type, GSN.Defeater), True),
    ("clarify issue is not a Defeater",     (EX.I1, RDF.type, GSN.Defeater), False),
    ("solution under a revise issue is in doubt", (EX.Sn1, GSN.inDoubt, Literal(True)), True),
    ("goal under a resolve issue is defeated",    (EX.G1, GSN.defeated, Literal(True)), True),
    ("context under a revise issue is untouched", (EX["C-object"], GSN.inDoubt, None), False),
    ("top object context yields assures",   (EX.G1, AUG.assures, EX["it-system"]), True),
    ("top subject context yields requiredBy", (EX.G1, AUG.requiredBy, EX.regulation), True),
]
for name, triple, wanted in expected:
    found = (triple in data) if triple[2] is not None else bool(list(data.triples(triple)))
    check(found == wanted, name, f"{name} - expected {wanted}, got {found}")

# --------------------------------------------------------------------------- shapes

head("shapes")

shapes = graphs["shapes"]
for label, target in [("as authored", None), ("after the rules", data)]:
    graph = Graph()
    graph.parse(CORE, format="turtle")
    graph.parse(ONTOLOGY, format="turtle")
    if target is None:
        graph.parse(FIXTURE, format="turtle")
    else:
        graph = target
    conforms, report, text = validate(graph, shacl_graph=shapes, advanced=True, inference="none")
    # A malformed shape makes pyshacl return a ValidationFailure rather than a report graph, and
    # a report with no results. Counting findings would read that as a clean pass.
    if not isinstance(report, Graph):
        check(False, "", f"{label}: the shapes themselves are invalid - {text}")
        continue
    findings = len(list(report.subjects(RDF.type, URIRef(SHACL + "ValidationResult"))))
    print(f"  {label:16} {'conforms' if conforms else str(findings) + ' finding(s)'}")
    for result in report.subjects(RDF.type, URIRef(SHACL + "ValidationResult")):
        print(f"      {report.value(result, URIRef(SHACL + 'focusNode'))}")
    check(conforms, f"{label}: no findings", f"{label}: {findings} unexpected finding(s)")

head("shapes reject what they are meant to reject")

# A shape that never fires constrains nothing, so each one is made to fire once.
violations = Graph()
violations.parse(ONTOLOGY, format="turtle")
violations.parse(os.path.join(HERE, "testdata", "example_violations.ttl"), format="turtle")
_, report, _ = validate(violations, shacl_graph=shapes, advanced=True, inference="none")

SH = Namespace(SHACL)
BAD = Namespace("https://example.org/bad#")
reported = {(str(report.value(result, SH.focusNode)), str(report.value(result, SH.sourceShape)))
            for result in report.subjects(RDF.type, SH.ValidationResult)}
focus_nodes = {node for node, _ in reported}

must_report = [
    ("an issue about two things",            BAD["I-two-targets"]),
    ("an issue with no type",                BAD["I-untyped"]),
    ("an issue with a type outside the three", BAD["I-bogus-type"]),
    ("an issue superseding itself",          BAD["I-self"]),
    ("an answer closing no issue",           BAD["A-no-issue"]),
    ("a Revision answering a clarify issue", BAD["A-mismatched"]),
    ("an artefact stored in a person",       BAD["artefact"]),
    ("provenance hung on a solution",        BAD["Sn1"]),
    ("a context and assures that disagree",  BAD["G1"]),
]
for name, node in must_report:
    check(str(node) in focus_nodes, f"reported: {name}", f"NOT reported: {name}")

check(str(BAD["G2"]) not in focus_nodes,
      "a top goal with no top-level context is not reported (the shape ships deactivated)",
      "TopContextCompletenessShape fired despite sh:deactivated")

head("result")
if failures:
    print(f"  {len(failures)} failure(s)")
    for failure in failures:
        print(f"    - {failure}")
    sys.exit(1)
print("  augmentation parses, runs to a fixpoint and validates")
