# -*- coding: utf-8 -*-
"""One-shot: turn 'OntoGSN Design Document.xlsx' into the provenance graph.

    python tools/prov_migrate.py

Reads the workbook and the two graphs it documents, and writes
provenance/ontogsn-provenance-data.ttl. The workbook is never modified.

Run this ONCE. Afterwards the Turtle is the source of truth and is edited directly - the
plan calls for that explicitly, and it is what keeps IRIs from churning: nothing is
re-minted, so nothing moves. Re-running against an unchanged workbook is safe (the output
is byte-identical), but re-running against an edited one would renumber the deduplicated
passages and rationales and orphan every reference made in the meantime.

What is deduplicated, and what is not:

  * source passages  - keyed by (quoted text, page reference). One passage justifies many
                       axioms, so these collapse ~700 citations into ~300 nodes.
  * rationales       - keyed by text, for the same reason.
  * statements       - NOT deduplicated. Distinct axioms can share a rendering
                       (dc:description and schema:description both render as
                       'description a AnnotationProperty'); merging them would lose the
                       distinction the workbook deliberately keeps.
"""
import argparse
import datetime
import hashlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matching
import prov_ttl
import shapes_model
import ttl_model
import workbook_io
from prov_ttl import Lit

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "provenance", "ontogsn-provenance-data.ttl")

SRC = "Item in GSN Community Standard"
PG = "Page(s)"
RSN = "Reason(s) for in-/exclusion"
NL = "Item in Natural Language"
TTL = "Item in OntoGSN TTL"
NONE = "(none)"

FORMALISM = {"OWL": "gsnprov:OWL", "SWRL": "gsnprov:SWRL", "SHACL": "gsnprov:SHACL",
             "RDF": "gsnprov:RDF", "(none)": "gsnprov:NoFormalism"}
PART = {"Part 0 etc.": "gsnprov:part-0", "Part 1": "gsnprov:part-1",
        "Part 2": "gsnprov:part-2"}
SECTION = {"Ontology-Specific Statements": "gsnprov:sec-ontology-specific",
           "Preamble": "gsnprov:sec-preamble",
           "Part 0, Glossary & Annex": "gsnprov:sec-part0-glossary",
           "Core GSN": "gsnprov:sec-core",
           "Argument Pattern Extension": "gsnprov:sec-pattern",
           "Modular Extension": "gsnprov:sec-modular",
           "Confidence Argument Extension": "gsnprov:sec-confidence",
           "Dialectic Extension": "gsnprov:sec-dialectic",
           "Part 2": "gsnprov:sec-part2"}

CLAUSE_RE = re.compile(r"\b(\d):(\d+(?:\.\d+)*)")
QNAME_RE = re.compile(r"\b(gsn|gsnsh):([A-Za-z][A-Za-z0-9_]*)")
PREDICATE_RE = re.compile(r"\b([A-Za-z][A-Za-z0-9_]*)\s*\(")


def sha256(path):
    """Content fingerprint, line-ending independent - see matching.file_checksum."""
    return matching.file_checksum(path)


def iso(timestamp):
    return datetime.datetime.fromtimestamp(
        timestamp, datetime.timezone.utc).replace(
        microsecond=0, tzinfo=None).isoformat() + "Z"


def structural_key(record):
    """The blank-node-free identity of whatever the row points at.

    Three shapes, because the three inventories key differently: an axiom by subject /
    predicate / object, a SHACL unit by shape / kind / discriminator, and a rule by its
    name (S1 ... S52), which is unique and already the join key to the SWRL workbook.
    """
    if "dl" in record:
        return "rule|" + (record.get("label") or record["dl"][:40])
    return "|".join(str(part) for part in record["key"])


def terms_in(text, known):
    """Every ontology or shapes term the statement names.

    Turtle spells them with a prefix; SWRL's DL syntax does not, so bare predicate names
    are admitted only when the ontology actually declares them - otherwise every variable
    and built-in would be reported as a term.
    """
    found = {f"{prefix}:{local}" for prefix, local in QNAME_RE.findall(text)}
    for name in PREDICATE_RE.findall(text):
        if name in known:
            found.add("gsn:" + name)
    return sorted(found)


def build_pool(statements, rules):
    """Row Turtle -> the inventory records it could be describing.

    Mirrors matching.match_rows so that a row consuming a shared rendering takes the same
    record here as it does there; otherwise the two would disagree about which axiom a row
    documents.
    """
    pool = {}
    for st in statements:
        pool.setdefault(st["ttl"], []).append(st)
    for rule in rules:
        prefix = "# " + rule["label"] + "\n" if rule["label"] else ""
        pool.setdefault(prefix + rule["dl"], []).append(rule)
    return pool


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workbook", default=workbook_io.WORKBOOK)
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    live, archived = workbook_io.read(args.workbook)
    for row in live:
        row["_archived"] = False
    for row in archived:
        row["_archived"] = True
    rows = sorted(live + archived, key=lambda r: r["uid"])
    print(f"{len(rows)} rows  ({len(live)} live, {len(archived)} retired)")

    graph, statements, rules = ttl_model.inventory()
    shapes_graph, shape_units = shapes_model.inventory()
    pool = build_pool(statements + shape_units, rules)
    known = {ttl_model.ln(s) for s in graph.subjects()
             if str(s).startswith(str(ttl_model.GSN))}

    # --- deduplicate the shared nodes ---------------------------------------------
    # numbered in uid order, so the assignment is reproducible from the workbook alone
    passages, rationales = {}, {}
    for row in rows:
        text, pages = row[SRC].strip(), row[PG].strip()
        if text and text != NONE:
            passages.setdefault((row[SRC], row[PG]), len(passages) + 1)
        reason = row[RSN].strip()
        if reason and reason != NONE:
            rationales.setdefault(row[RSN], len(rationales) + 1)
    print(f"{len(passages)} source passages, {len(rationales)} rationales")

    def passage_iri(row):
        return f"gsnprov:src-{passages[(row[SRC], row[PG])]:04d}"

    def rationale_iri(row):
        return f"gsnprov:why-{rationales[row[RSN]]:04d}"

    uid_of_key = {r["row_key"]: r["uid"] for r in rows}
    used, blocks, unresolved = set(), [], []

    # --- release entities ----------------------------------------------------------
    onto_path = os.path.join(REPO, "serializations", "ontogsn.ttl")
    shapes_path = os.path.join(REPO, "shapes", "ontogsn-shapes_0_full.ttl")
    onto_version = str(graph.value(
        ttl_model.URIRef("https://w3id.org/OntoGSN/ontology"),
        ttl_model.OWL.versionInfo) or "unknown")
    ONTO_GRAPH = f"gsnprov:ontology-{onto_version}"
    SHAPES_GRAPH = "gsnprov:shapes-1.0.0"
    workbook_time = iso(os.path.getmtime(args.workbook))

    blocks.append(prov_ttl.header(
        "The graphs this provenance describes",
        "Checksums are of the files as they stood when the record was taken."))
    blocks.append((ONTO_GRAPH, [
        ("a", ["gsnprov:FormalGraph"]),
        ("prov:specializationOf", ["<https://w3id.org/OntoGSN/ontology>"]),
        ("rdfs:label", [Lit(f"OntoGSN ontology {onto_version}", lang="en")]),
        ("owl:versionInfo", [Lit(onto_version)]),
        ("gsnprov:fileChecksum", [Lit(sha256(onto_path))]),
        ("prov:generatedAtTime", [Lit(iso(os.path.getmtime(onto_path)),
                                      datatype="xsd:dateTime")]),
    ]))
    blocks.append((SHAPES_GRAPH, [
        ("a", ["gsnprov:FormalGraph"]),
        ("prov:specializationOf", ["<https://w3id.org/OntoGSN/shapes>"]),
        ("rdfs:label", [Lit("OntoGSN SHACL shapes 1.0.0", lang="en")]),
        ("owl:versionInfo", [Lit("1.0.0")]),
        ("gsnprov:fileChecksum", [Lit(sha256(shapes_path))]),
        ("prov:generatedAtTime", [Lit(iso(os.path.getmtime(shapes_path)),
                                      datatype="xsd:dateTime")]),
    ]))

    blocks.append(prov_ttl.header(
        "Where this record came from",
        "The workbook was the record of these decisions until this migration; it is the\n"
        "entity every decision below was derived from, and the reason no decision carries\n"
        "a date or an agent of its own - the workbook never held either."))
    blocks.append(("gsnprov:design-document-xlsx", [
        ("a", ["prov:Entity"]),
        ("rdfs:label", [Lit("OntoGSN Design Document.xlsx", lang="en")]),
        ("gsnprov:fileChecksum", [Lit(sha256(args.workbook))]),
        ("prov:generatedAtTime", [Lit(workbook_time, datatype="xsd:dateTime")]),
    ]))
    blocks.append(("gsnprov:migration", [
        ("a", ["prov:Activity"]),
        ("rdfs:label", [Lit("Migration of the design workbook into PROV-O", lang="en")]),
        ("prov:used", ["gsnprov:design-document-xlsx"]),
        ("prov:endedAtTime", [Lit(workbook_time, datatype="xsd:dateTime")]),
        ("prov:wasAssociatedWith", ["gsnprov:prov-migrate-script"]),
    ]))
    blocks.append(("gsnprov:prov-migrate-script", [
        ("a", ["prov:SoftwareAgent", "prov:Plan"]),
        ("rdfs:label", [Lit("tools/prov_migrate.py", lang="en")]),
    ]))

    # --- source passages -----------------------------------------------------------
    blocks.append(prov_ttl.header(
        f"Source passages ({len(passages)})",
        "Deduplicated across decisions. gsnprov:pageRef reproduces the page reference as\n"
        "written; gsnprov:page is the same information split for querying."))
    for (text, pages), number in sorted(passages.items(), key=lambda kv: kv[1]):
        clauses = sorted({f"{a}:{b}" for a, b in CLAUSE_RE.findall(text)})
        split = [p.strip() for p in re.split(r"[;,]", pages) if p.strip()]
        pairs = [("a", ["gsnprov:SourcePassage"]),
                 ("prov:specializationOf", ["gsnprov:GSNCommunityStandardV3"]),
                 ("gsnprov:quotedText", [Lit(text, lang="en")])]
        if clauses:
            pairs.append(("gsnprov:clause", [Lit(c) for c in clauses]))
        if pages.strip():
            pairs.append(("gsnprov:pageRef", [Lit(pages)]))
            pairs.append(("gsnprov:page", [Lit(p) for p in split]))
        blocks.append((f"gsnprov:src-{number:04d}", pairs))

    # --- rationales ----------------------------------------------------------------
    blocks.append(prov_ttl.header(
        f"Rationales ({len(rationales)})",
        "The editorial record: why something was included, excluded or reshaped.\n"
        "Shared, because the same reasoning decided several axioms."))
    for text, number in sorted(rationales.items(), key=lambda kv: kv[1]):
        blocks.append((f"gsnprov:why-{number:04d}", [
            ("a", ["gsnprov:Rationale"]),
            ("gsnprov:rationaleText", [Lit(text, lang="en")]),
        ]))

    # --- decisions and their statements ---------------------------------------------
    blocks.append(prov_ttl.header(
        f"Design decisions ({len(rows)})",
        "Each decision prov:used the passages it rests on and prov:generated the statement\n"
        "it produced. A decision that produced nothing simply generated nothing - that is\n"
        "why a decision is an Activity and not an Entity."))
    statement_count = 0
    for row in rows:
        uid = row["uid"]
        decision = f"gsnprov:dd-{uid.split('-')[1]}"
        retired = row["_archived"]
        text = row[TTL].strip()

        pairs = [("a", ["gsnprov:RetiredDecision" if retired
                        else "gsnprov:DesignDecision"]),
                 ("gsnprov:positionKey", [Lit(row["row_key"])]),
                 ("gsnprov:part", [PART[row["part"]]]),
                 ("gsnprov:section", [SECTION[row["section"]]]),
                 ("gsnprov:formalism", [FORMALISM[row["language"]]]),
                 ("gsnprov:naturalLanguage", [Lit(row[NL], lang="en")])]

        if row.get("nl_checksum", "").strip():
            pairs.append(("gsnprov:nlWrittenFor", [Lit(row["nl_checksum"].strip())]))

        if row[SRC].strip() == NONE:
            pairs.append(("gsnprov:noSourceRecorded", [Lit("true", datatype="xsd:boolean")]))
        elif row[SRC].strip():
            pairs.append(("prov:used", [passage_iri(row)]))

        if row[RSN].strip() == NONE:
            pairs.append(("gsnprov:noRationaleRecorded",
                          [Lit("true", datatype="xsd:boolean")]))
        elif row[RSN].strip():
            pairs.append(("gsnprov:hasRationale", [rationale_iri(row)]))

        statement = None
        if text:
            statement = f"gsnprov:st-{uid.split('-')[1]}"
            pairs.append(("prov:generated", [statement]))

        if retired:
            reason = row.get("archived_because", "").strip()
            if reason:
                pairs.append(("gsnprov:retirementReason", [Lit(reason, lang="en")]))
            successor = re.search(r"dd-(\d{4})", reason)
            if successor:
                pairs.append(("gsnprov:supersededBy",
                              [f"gsnprov:dd-{successor.group(1)}"]))
            else:
                key = re.search(r"S\d\d\.(?:R|SH)\d+[a-z]?", reason)
                if key and key.group(0) in uid_of_key:
                    target = uid_of_key[key.group(0)].split("-")[1]
                    pairs.append(("gsnprov:supersededBy", [f"gsnprov:dd-{target}"]))

        blocks.append((decision, pairs))

        if not statement:
            continue
        statement_count += 1

        candidates = pool.get(text, [])
        hit = next((c for c in candidates if id(c) not in used), None)
        if hit is None and candidates:
            hit = candidates[0]
        if hit is not None:
            used.add(id(hit))
        else:
            # a retired decision describing something the ontology no longer has is the
            # expected outcome, not a gap; a live one means the record has drifted
            unresolved.append((row["row_key"], retired))

        in_graph = SHAPES_GRAPH if text.startswith("gsnsh:") else ONTO_GRAPH
        st_pairs = [("a", ["gsnprov:StatementRecord"]),
                    ("prov:wasGeneratedBy", [decision]),
                    ("gsnprov:inGraph", [in_graph]),
                    ("gsnprov:statementText", [Lit(text)]),
                    ("gsnprov:statementChecksum", [Lit(matching.checksum(text))])]
        if hit is not None:
            st_pairs.append(("gsnprov:structuralKey", [Lit(structural_key(hit))]))
            if "dl" in hit and hit.get("label"):
                st_pairs.append(("gsnprov:ruleName", [Lit(hit["label"])]))
            subject = hit.get("s")
            if "unit" in hit:
                st_pairs.append(("gsnprov:aboutTerm", [hit["shape"]]))
            elif subject is not None and isinstance(subject, ttl_model.URIRef):
                st_pairs.append(("gsnprov:aboutTerm", [ttl_model.qname(subject)]))

        mentions = terms_in(text, known)
        if mentions:
            st_pairs.append(("gsnprov:mentionsTerm", mentions))

        # the mapping itself, as a node: which passage this axiom came from, and the
        # decision - hence the rationale - that made the connection
        if row[SRC].strip() and row[SRC].strip() != NONE:
            st_pairs.append(("prov:wasDerivedFrom", [passage_iri(row)]))
            st_pairs.append(("prov:qualifiedDerivation", [
                f"[ a prov:Derivation ; prov:entity {passage_iri(row)} ; "
                f"prov:hadActivity {decision} ]"]))

        blocks.append((statement, st_pairs))

    preamble = (
        "# GENERATED by tools/prov_migrate.py from 'OntoGSN Design Document.xlsx'.\n"
        "# From here on this file is the source of truth and is edited by hand;\n"
        "# do not re-run the migration against an edited workbook.\n"
        "# The vocabulary is defined in ontogsn-provenance.ttl.\n\n"
        "<https://w3id.org/OntoGSN/provenance/data> a owl:Ontology ;\n"
        "    owl:imports <https://w3id.org/OntoGSN/provenance> ;\n"
        "    dc:title \"OntoGSN Provenance - the record\"@en ;\n"
        f"    dc:description \"Why each of the {len(rows)} axioms, rules and constraints "
        "of OntoGSN exists.\"@en ;\n"
        "    owl:versionInfo \"1.0.0\" .\n\n")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    prov_ttl.write(args.out, blocks, preamble)

    print(f"{statement_count} statement records")
    retired_gaps = [k for k, r in unresolved if r]
    live_gaps = [k for k, r in unresolved if not r]
    if retired_gaps:
        print(f"\n{len(retired_gaps)} retired decisions describe something the ontology "
              f"no longer has, so they carry evidence but no structural key. This is the "
              f"correct outcome for a retired decision:")
        for key in retired_gaps[:15]:
            print(f"  {key}")
    if live_gaps:
        print(f"\n{len(live_gaps)} LIVE decisions point at Turtle that is not in the "
              f"current graphs - the record has drifted and needs review:")
        for key in live_gaps[:15]:
            print(f"  {key}")
    print(f"\nwrote {args.out} ({os.path.getsize(args.out):,} bytes)")


if __name__ == "__main__":
    main()
