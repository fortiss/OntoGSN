# -*- coding: utf-8 -*-
"""Parse, run and validate the augmentation against its fixture.

    python development/dev_tools/augmentation_check.py

Three things, in the order they can fail:

    1. every file parses, and the SWRL rules are well-formed atom lists
    2. the SPARQL rules reach a fixpoint, and each SWRL rule has a SPARQL twin
    3. the SHACL shapes validate the fixture before and after the rules run

Before the rules run, every mechanism in the fixture that is a SHACL shape is run over the data,
and the report it produces is kept in the graph, linked to the mechanism and the artefact. That
is what A6a and A6b read: the status of a solution is derived from a report, not asserted.
A6c and A6d read the same kind of report over a part of the artefact; the fixture carries two of
those by hand.

The derivations in derivations/ run with the rules but are not twinned: they walk RDF lists,
which SWRL cannot, so they exist in SPARQL only and are kept out of the twin count.

Deliberately standalone. development/dev_tools/check_all.py globs serializations/, shapes/ and queries/, so it
never sees this directory - which is the point: the augmentation must not be able to break the
core checks.
"""
import glob
import os
import sys
from datetime import datetime, timezone

from pyshacl import validate
from rdflib import BNode, Graph, Literal, Namespace, RDF, URIRef
from rdflib.namespace import RDFS, XSD

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.join(REPO, "augmentation")

GSN = Namespace("https://w3id.org/OntoGSN/ontology#")
AUG = Namespace("https://w3id.org/OntoGSN/augmentation#")
EX = Namespace("https://example.org/case#")
SWRL = Namespace("http://www.w3.org/2003/11/swrl#")
SHACL = "http://www.w3.org/ns/shacl#"
SH = Namespace(SHACL)
PROV = Namespace("http://www.w3.org/ns/prov#")

ONTOLOGY = os.path.join(HERE, "ontogsn-augmentation.ttl")
SHAPES = os.path.join(HERE, "ontogsn-augmentation-shapes.ttl")
FIXTURE = os.path.join(HERE, "testdata", "example_issues.ttl")
CORE = os.path.join(REPO, "serializations", "ontogsn.ttl")
CORE_RULES = os.path.join(REPO, "queries", "rules")
AUG_RULES = os.path.join(HERE, "rules")
DERIVATIONS = os.path.join(HERE, "derivations")

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
check(len(rules) == 9, f"{len(rules)} SWRL rules", f"expected 9 SWRL rules, found {len(rules)}")

# Each SWRL rule needs a SPARQL twin, so the two never drift.
sparql_rules = sorted(glob.glob(os.path.join(AUG_RULES, "*.rq")))
check(len(sparql_rules) == len(rules),
      f"{len(sparql_rules)} SPARQL rules, one per SWRL rule",
      f"{len(sparql_rules)} SPARQL rules but {len(rules)} SWRL rules")

# --------------------------------------------------------------------------- rules

data = Graph()
data.parse(CORE, format="turtle")
data.parse(ONTOLOGY, format="turtle")
data.parse(FIXTURE, format="turtle")


def closure(source, node, target):
    """Copy the node's triples into target, following blank nodes, so the shape runs on its own."""
    for triple in source.triples((node, None, None)):
        if triple in target:
            continue
        target.add(triple)
        if isinstance(triple[2], BNode):
            closure(source, triple[2], target)


def run_shape_mechanisms(graph):
    """Run each mechanism that is a shape over the artefact it verifies; keep the report.

    pyshacl returns the report as a graph. Three triples are added to it - which mechanism
    produced it, which artefact it looked at, and when - and the result is merged into the data.
    Those three lines are the whole adapter between an engine and rules A6a/A6b."""
    runs = 0
    for artefact, mechanism in graph.subject_objects(AUG.verifiableWith):
        if (mechanism, RDF.type, SH.NodeShape) not in graph:
            continue
        shape = Graph()
        closure(graph, mechanism, shape)
        conforms, report, text = validate(graph, shacl_graph=shape, advanced=True, inference="none")
        if not isinstance(report, Graph):
            failures.append(f"{mechanism} could not run: {text}")
            continue
        for node in report.subjects(RDF.type, SH.ValidationReport):
            report.add((node, PROV.wasGeneratedBy, mechanism))
            report.add((node, PROV.used, artefact))
            report.add((node, PROV.generatedAtTime,
                        Literal(datetime.now(timezone.utc).isoformat(timespec="seconds"), datatype=XSD.dateTime)))
        graph += report
        runs += 1
        print(f"  {str(mechanism).split('#')[-1]:20} over {str(artefact).split('#')[-1]:14} "
              f"{'conforms' if conforms else 'does not conform'}; report kept")
    return runs


head("shape mechanisms leave their report in the graph")

check(run_shape_mechanisms(data) == 1, "one shape mechanism ran", "expected exactly one shape mechanism to run")
check(bool(list(data.triples((None, PROV.wasGeneratedBy, EX["retention-shape"])))),
      "the retention shape's report is in the graph", "no report is linked to the retention shape")

head("rules to a fixpoint")

before = len(data)

updates = []
derivations = sorted(glob.glob(os.path.join(DERIVATIONS, "*.rq")))
for path in sorted(glob.glob(os.path.join(CORE_RULES, "*.rq"))) + sparql_rules + derivations:
    text = open(path, encoding="utf-8").read()
    upper = text.upper()
    if "INSERT" in upper or "DELETE" in upper:
        updates.append((os.path.basename(path), text))
check(len(updates) > len(sparql_rules) + len(derivations),
      f"{len(updates)} update rules loaded ({len(sparql_rules)} augmentation rules, {len(derivations)} derivations)",
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
expected = [
    ("revise on a solution challenges it",  (EX.I3, GSN.challenges, EX.Sn1), True),
    ("resolve on a goal challenges it",     (EX.I4, GSN.challenges, EX.G1), True),
    # I4 and I7 both resolve against G1. Both must become challenges: a rule that writes the
    # defeat and the challenge in one guarded operation drops whichever of the two the store
    # returns second, and which one that is varies from run to run.
    ("a second resolve on the same goal challenges it too",
                                            (EX.I7, GSN.challenges, EX.G1), True),
    ("clarify challenges nothing",          (EX.I1, GSN.challenges, None), False),
    ("revise on a context challenges nothing", (EX.I2, GSN.challenges, None), False),
    ("challenger is inferred a Defeater",   (EX.I3, RDF.type, GSN.Defeater), True),
    ("clarify issue is not a Defeater",     (EX.I1, RDF.type, GSN.Defeater), False),
    ("solution under a revise issue is in doubt", (EX.Sn1, GSN.inDoubt, Literal(True)), True),
    ("goal under a resolve issue is defeated",    (EX.G1, GSN.defeated, Literal(True)), True),
    ("context under a revise issue is untouched", (EX["C-object"], GSN.inDoubt, None), False),
    ("the case names the system it assures", (EX.G1, AUG.assures, EX["it-system"]), True),
    ("the case names what requires it",      (EX.G1, AUG.requiredBy, EX.regulation), True),
    # derivations: a mechanism that is a shape or a rule gets its terms read off the node
    ("a shape mechanism reads its target class",   (EX["retention-shape"], AUG.readsTerm, EX.AccessLogEntry), True),
    ("a shape mechanism reads a plain path",       (EX["retention-shape"], AUG.readsTerm, EX.retainedUntil), True),
    ("a shape mechanism reads a sh:class",         (EX["retention-shape"], AUG.readsTerm, EX.AccessLog), True),
    ("a shape mechanism reads a sequence path",    (EX["retention-shape"], AUG.readsTerm, EX.retentionPolicy), True),
    ("a shape mechanism writes nothing",           (EX["retention-shape"], AUG.writesTerm, None), False),
    ("a rule mechanism reads its body",            (EX["expiry-rule"], AUG.readsTerm, EX.retainedUntil), True),
    ("a rule mechanism writes its head",           (EX["expiry-rule"], AUG.writesTerm, EX.Expiring), True),
    ("a rule mechanism does not read its head",    (EX["expiry-rule"], AUG.readsTerm, EX.Expiring), False),
    ("a rule that is not a mechanism derives nothing",
                                                   (AUG.ReviseIssueChallengesGoal, AUG.readsTerm, None), False),
    ("a query mechanism derives nothing",          (EX["log-query"], AUG.readsTerm, EX.AccessLogEntry), True),
    # A4: a part is verifiable with whatever verifies its artefact, and inherits nothing else
    ("a part is verifiable with what checks its artefact",   (EX["access-log-row-42"], AUG.verifiableWith, EX["retention-rule"]), True),
    ("a part inherits every verifier, not just one",         (EX["access-log-row-42"], AUG.verifiableWith, EX["expiry-rule"]), True),
    ("a part does not inherit what verified its artefact",   (EX["access-log-row-42"], AUG.verifiedWith, None), False),
    ("a part does not inherit how its artefact is fetched",  (EX["access-log-row-42"], AUG.retrievableWith, None), False),
    ("a part of an artefact with no provenance inherits none", (EX["ctrl-row-7"], AUG.verifiableWith, None), False),
    ("inheritance does not retype the part as an artefact",  (EX["access-log-row-42"], RDF.type, GSN.Artefact), False),
    # A6: a solution's truth is read off the report its artefact's mechanism left behind
    ("a conforming engine report makes the solution true",     (EX.Sn1, GSN.true, Literal(True)), True),
    # G1 rests on both. The core rules compose support, so one failing solution makes the goal
    # untrue (S11), and the passing sibling does not lift it back (S10 guards on siblings).
    ("one failing solution under the goal makes it untrue",    (EX.G1, GSN.true, Literal(False)), True),
    ("the passing sibling does not lift the goal back",        (EX.G1, GSN.true, Literal(True)), False),
    ("a failing hand-written report makes the solution untrue", (EX.Sn2, GSN.true, Literal(False)), True),
    ("a failing report does not also confirm",                 (EX.Sn2, GSN.true, Literal(True)), False),
    ("a conforming report does not also refute",               (EX.Sn1, GSN.true, Literal(False)), False),
    ("a goal with no checked solution under it is untouched",  (EX.G2, GSN.true, None), False),
    # A6c/A6d: a report over a part reaches the solution through the artefact it refers to.
    # The key's verifier is inherited by A4, so the chain A4 -> A6c needs a second round.
    ("a conforming report over a part makes the solution true",  (EX.Sn3, GSN.true, Literal(True)), True),
    ("a conforming part report does not also refute",            (EX.Sn3, GSN.true, Literal(False)), False),
    ("a failing report over a part makes the solution untrue",   (EX.Sn4, GSN.true, Literal(False)), True),
    ("a failing part report does not also confirm",              (EX.Sn4, GSN.true, Literal(True)), False),
    ("a part report leaves the whole artefact's status alone",   (EX["config-export"], GSN.true, None), False),
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
violations.parse(CORE, format="turtle")
violations.parse(ONTOLOGY, format="turtle")
violations.parse(os.path.join(HERE, "testdata", "example_violations.ttl"), format="turtle")
_, report, _ = validate(violations, shacl_graph=shapes, advanced=True, inference="none")

BAD = Namespace("https://example.org/bad#")
reported = {(str(report.value(result, SH.focusNode)), str(report.value(result, SH.sourceShape)))
            for result in report.subjects(RDF.type, SH.ValidationResult)}
focus_nodes = {node for node, _ in reported}

must_report = [
    ("an issue about two things",            BAD["I-two-targets"]),
    ("an issue with no type",                BAD["I-untyped"]),
    ("an issue with a type outside the three", BAD["I-bogus-type"]),
    ("an issue superseding itself",          BAD["I-self"]),
    ("a response to no issue",               BAD["A-no-issue"]),
    ("a response to two issues",             BAD["A-two-issues"]),
    ("an artefact stored in a person",       BAD["artefact"]),
    ("an artefact part that is part of a person", BAD["part"]),
    ("provenance hung on a solution",        BAD["Sn1"]),
    ("a goal assuring something that is not a system", BAD["G1"]),
    ("an element required by, instantiated from and owned by the wrong kinds of thing",
                                             BAD["G2"]),
    ("a role-holder that is not an agent, holding something that is not a role",
                                             BAD["not-an-agent"]),
    ("a bare note that is owned, reviewed and linked from", BAD["a-sticky-note"]),
    ("something other than a case covered in an audit cycle",   BAD["case-1"]),
    ("an issue raised against something outside the case",      BAD["I-off-target"]),
    ("an outcome outside the four",          BAD["I-bogus-outcome"]),
    ("an issue held by two agents at once",  BAD["I-two-holders"]),
    ("an audit cycle that is not one, and a raiser that is not an agent", BAD["I-bad-cycle"]),
    ("an issue resolved with no response",   BAD["I-resolved-unanswered"]),
    ("an artefact replacing a person",       BAD["artefact-revision"]),
    ("a mechanism automated by a word",      BAD["mechanism"]),
    ("a mechanism reading a literal",        BAD["mechanism-literal-term"]),
    ("an artefact that reads a term",        BAD["artefact-that-reads"]),
    ("a mechanism with two scripts",         BAD["mechanism-two-scripts"]),
    ("a mechanism that requires a word",     BAD["mechanism-needs-a-word"]),
    ("an element reviewed by its own owner", BAD["G3"]),
]
for name, node in must_report:
    check(str(node) in focus_nodes, f"reported: {name}", f"NOT reported: {name}")

head("result")
if failures:
    print(f"  {len(failures)} failure(s)")
    for failure in failures:
        print(f"    - {failure}")
    sys.exit(1)
print("  augmentation parses, runs to a fixpoint and validates")
