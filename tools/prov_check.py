# -*- coding: utf-8 -*-
"""Does the provenance record still agree with what OntoGSN actually says?

    python tools/prov_check.py              # report
    python tools/prov_check.py --strict     # exit 1 on anything that needs a human

Replaces check_coverage.py's workbook-driven report with the same checks driven from the
graph, and adds the ones the workbook could not express: whether the stored queries name
the ontology correctly, and whether the generated files were actually generated.

Every finding is a review signal, not a failure. Drift in a *retired* decision is the
expected outcome and is not reported.
"""
import argparse
import hashlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rdflib import Graph, Namespace, RDF
from rdflib.namespace import OWL

import matching
import shapes_model
import ttl_model

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROV_DIR = os.path.join(REPO, "provenance")
FILES = ["ontogsn-provenance.ttl", "ontogsn-provenance-data.ttl",
         "ontogsn-provenance-augmentations.ttl"]

P = Namespace("https://w3id.org/OntoGSN/provenance#")
PROV = Namespace("http://www.w3.org/ns/prov#")

ONTOLOGY_NS = "https://w3id.org/OntoGSN/ontology#"
SHAPES_NS = "https://w3id.org/OntoGSN/shapes#"
KNOWN_NS = {ONTOLOGY_NS, SHAPES_NS}


def load():
    graph = Graph()
    for name in FILES:
        path = os.path.join(PROV_DIR, name)
        if os.path.exists(path):
            graph.parse(path, format="turtle")
    return graph


def value(graph, subject, predicate):
    found = graph.value(subject, predicate)
    return None if found is None else str(found)


def check_statements(graph, findings):
    """Each statement record against the graph it claims to live in."""
    _, statements, rules = ttl_model.inventory()
    _, shape_units = shapes_model.inventory()
    inventory = statements + shape_units

    by_text = {}
    for record in inventory:
        by_text.setdefault(record["ttl"], []).append(record)
    for rule in rules:
        prefix = "# " + rule["label"] + "\n" if rule["label"] else ""
        by_text.setdefault(prefix + rule["dl"], []).append(rule)
    by_key = {}
    for record in inventory + rules:
        by_key.setdefault(matching.structural_key(record), []).append(record)

    used, counts = set(), {}
    for statement in graph.subjects(RDF.type, P.StatementRecord):
        decision = graph.value(statement, PROV.wasGeneratedBy)
        retired = (decision, RDF.type, P.RetiredDecision) in graph
        text = value(graph, statement, P.statementText) or ""
        key = value(graph, statement, P.structuralKey)
        position = value(graph, decision, P.positionKey) or str(decision)

        candidates = by_text.get(text, [])
        hit = next((c for c in candidates if id(c) not in used), None)
        if hit is None and candidates:
            hit = candidates[0]
        if hit is not None:
            used.add(id(hit))
            counts["current"] = counts.get("current", 0) + 1
            stored_nl = value(graph, decision, P.nlWrittenFor)
            if stored_nl and stored_nl != matching.checksum(text) and not retired:
                findings.append(("nl-stale", position,
                                 "the axiom changed after the sentence was written; "
                                 "rewrite the sentence"))
            continue

        if retired:
            # a retired decision describing something the ontology no longer has is
            # exactly what retirement means
            counts["retired-not-in-graph"] = counts.get("retired-not-in-graph", 0) + 1
            continue

        moved = by_key.get(key or "", [])
        if moved:
            counts["changed"] = counts.get("changed", 0) + 1
            # a rule is rendered as DL syntax and has no 'ttl'; reporting a changed rule
            # used to raise KeyError, which is the one path this branch never took until
            # a CRLF checkout made every rule look changed at once
            now = moved[0].get("ttl") or moved[0].get("dl", "")
            findings.append(("statement-changed", position,
                             f"recorded as {text[:60]!r}, now {now[:60]!r}"))
        else:
            counts["unmatched"] = counts.get("unmatched", 0) + 1
            findings.append(("statement-unmatched", position,
                             f"{text[:80]!r} is not in the ontology or the shapes"))

    orphans = [r for r in inventory if id(r) not in used
               and matching.nsubj(str(r["key"][0])) != matching.ONTOLOGY_NODE]
    orphans += [r for r in rules if id(r) not in used]
    for record in orphans:
        findings.append(("undocumented", "-",
                         f"{record.get('ttl', record.get('dl', ''))[:80]!r} "
                         "has no design decision"))
    return counts, len(orphans)


def check_releases(graph, findings):
    """Has a released graph been edited in place?

    Every statement record was taken against a named release. If that release's file no
    longer hashes to what was recorded while owl:versionInfo has not moved, the release
    changed underneath the record - which is the one kind of drift the statement-level
    checks cannot see, because both sides moved together.
    """
    for release in sorted(graph.subjects(RDF.type, P.FormalGraph), key=str):
        path = value(graph, release, P.path)
        recorded = value(graph, release, P.fileChecksum)
        if not path or not recorded:
            continue
        full = os.path.join(REPO, path)
        if not os.path.exists(full):
            findings.append(("release-missing", path, "recorded as a release, but gone"))
            continue
        actual = matching.file_checksum(full)
        if actual != recorded:
            findings.append((
                "release-edited-in-place", path,
                f"contents changed but owl:versionInfo is still "
                f"{value(graph, release, OWL.versionInfo)} - bump the version, or "
                f"update gsnprov:fileChecksum if the change was editorial"))


def check_retired(graph, findings):
    """A retired decision that still describes a live axiom is legitimate only when
    something says why."""
    for decision in graph.subjects(RDF.type, P.RetiredDecision):
        if not value(graph, decision, P.retirementReason):
            findings.append(("retired-without-reason",
                             value(graph, decision, P.positionKey) or str(decision),
                             "retired with no reason recorded"))


def check_queries(graph, findings):
    """A query that binds gsn: to the wrong namespace returns nothing, silently."""
    total = 0
    for query in graph.subjects(RDF.type, P.Query):
        total += 1
        declared = {str(o) for o in graph.objects(query, P.declaresNamespace)}
        name = value(graph, query, P.path) or str(query)
        wrong = {n for n in declared
                 if n.lower() in {k.lower() for k in KNOWN_NS} and n not in KNOWN_NS}
        if wrong:
            findings.append(("query-namespace", name,
                             f"binds {sorted(wrong)[0]} - the ontology is {ONTOLOGY_NS}"))
        elif not declared & KNOWN_NS:
            findings.append(("query-namespace", name,
                             "declares no OntoGSN namespace at all"))

    answered = {o for _, o in graph.subject_objects(P.answersQuestion)}
    for question in graph.subjects(RDF.type, P.CompetencyQuestion):
        if question not in answered:
            findings.append(("unanswered-question",
                             value(graph, question, P.persona) or "-",
                             f"{value(graph, question, P.questionText)!r:.70} "
                             "has no query"))
    return total


def check_files(graph, findings):
    """Serializations of the ontology that nothing regenerates, or that state an older
    version than the ontology itself.

    Only files declared prov:specializationOf the ontology are checked. The SHACL shapes
    are derived from the ontology but are a separate graph carrying a version of their
    own, so neither question applies to them.
    """
    ontology = ttl_model.URIRef("https://w3id.org/OntoGSN/ontology")
    source_version = None
    for entity in set(graph.subjects(P.declaredVersion, None)):
        if value(graph, entity, P.path) == "serializations/ontogsn.ttl":
            source_version = value(graph, entity, P.declaredVersion)

    for entity in sorted(set(graph.subjects(PROV.specializationOf, ontology)), key=str):
        path = value(graph, entity, P.path)
        if path is None or path == "serializations/ontogsn.ttl":
            continue
        if graph.value(entity, PROV.wasGeneratedBy) is None:
            findings.append(("no-build-step", path,
                             "a slice of the ontology that nothing regenerates"))
        declared = value(graph, entity, P.declaredVersion)
        if declared and source_version and declared != source_version:
            findings.append(("stale-version", path,
                             f"states {declared}, the ontology is {source_version}"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--show", type=int, default=10)
    args = ap.parse_args()

    graph = load()
    if not len(graph):
        sys.exit(f"no provenance graph found in {PROV_DIR}")

    findings = []
    decisions = (len(set(graph.subjects(RDF.type, P.DesignDecision))) +
                 len(set(graph.subjects(RDF.type, P.RetiredDecision))))
    counts, orphans = check_statements(graph, findings)
    check_releases(graph, findings)
    check_retired(graph, findings)
    queries = check_queries(graph, findings)
    check_files(graph, findings)

    print(f"{decisions} design decisions, {sum(counts.values())} statement records, "
          f"{queries} queries\n")
    for name in sorted(counts):
        print(f"  {counts[name]:>4}  {name}")

    by_kind = {}
    for kind, where, detail in findings:
        by_kind.setdefault(kind, []).append((where, detail))

    if not findings:
        print("\nnothing needs review")
        return

    print(f"\n{len(findings)} findings")
    for kind in sorted(by_kind):
        items = by_kind[kind]
        print(f"\n--- {len(items)} {kind} ---")
        for where, detail in items[:args.show]:
            print(f"  {where:<34} {detail}")
        if len(items) > args.show:
            print(f"  ... and {len(items) - args.show} more")

    if args.strict:
        sys.exit(1)


if __name__ == "__main__":
    main()
