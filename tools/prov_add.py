# -*- coding: utf-8 -*-
"""Draft a design decision for every axiom the provenance graph does not yet document.

    python tools/prov_add.py             # show the drafts
    python tools/prov_add.py --write     # append them to ontogsn-provenance-data.ttl

prov_check.py reports an undocumented axiom; this writes the record for it. Everything
that can be computed is computed - the statement text, its checksum, the structural key
that identifies it, the section, the formalism, and an English sentence from nl.py.

Two fields are deliberately left empty, because they are the two that cannot be derived
from the ontology and are the whole reason the provenance graph exists:

    prov:used             which passage of the GSN Community Standard this rests on
    gsnprov:hasRationale  why it was decided this way

A draft with neither is a decision nobody has justified yet. That is honest, and
prov_check.py can be taught to say so; inventing a rationale would not be.
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rdflib import Graph, Namespace, RDF
from rdflib.namespace import SKOS

import matching
import nl
import prov_check
import prov_ttl
import shapes_model
import ttl_model
from prov_ttl import Lit

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(REPO, "provenance", "ontogsn-provenance-data.ttl")

P = Namespace("https://w3id.org/OntoGSN/provenance#")
PROV = Namespace("http://www.w3.org/ns/prov#")

def next_free(existing, prefix, width):
    used = {int(m.group(1)) for value in existing
            for m in [re.fullmatch(rf"{prefix}(\d{{{width}}})", value)] if m}
    number = 1
    while number in used:
        number += 1
    return number


def orphans():
    """The axioms, shapes and rules with no design decision.

    Computed the same way prov_check.py computes it - by consuming the inventory against
    the statement texts already recorded - rather than by parsing prov_check's report.
    """
    graph = prov_check.load()
    _, statements, rules = ttl_model.inventory()
    _, shape_units = shapes_model.inventory()
    inventory = statements + shape_units

    by_text = {}
    for record in inventory:
        by_text.setdefault(record["ttl"], []).append(record)
    for rule in rules:
        prefix = "# " + rule["label"] + "\n" if rule["label"] else ""
        by_text.setdefault(prefix + rule["dl"], []).append(rule)

    used = set()
    for statement in graph.subjects(RDF.type, P.StatementRecord):
        text = str(graph.value(statement, P.statementText) or "")
        hit = next((c for c in by_text.get(text, []) if id(c) not in used), None)
        if hit is not None:
            used.add(id(hit))

    # ontology-file metadata is not a design decision (the same carve-out matching.py makes)
    out = [r for r in inventory if id(r) not in used
           and matching.nsubj(str(r["key"][0])) != matching.ONTOLOGY_NODE]
    out += [r for r in rules if id(r) not in used]
    return graph, out


def release_node(graph, path):
    """The gsnprov:FormalGraph recording the file at path, as a prefixed name."""
    for node in graph.subjects(RDF.type, P.FormalGraph):
        if str(graph.value(node, P.path)) == path:
            return "gsnprov:" + str(node).rsplit("#", 1)[-1]
    raise SystemExit("no release node recorded for " + path)


def draft(graph, record, labels, uid, position, section_iri, part_iri, known):
    text = record.get("ttl") or ("# " + record["label"] + "\n" + record["dl"]
                                 if record.get("label") else record.get("dl", ""))
    is_rule = "dl" in record
    is_shape = "unit" in record

    if is_rule:
        sentence = nl.rule_sentence(record["dl"], labels)
        formalism = "gsnprov:SWRL"
    elif is_shape:
        sentence = record.get("message") or ""
        formalism = "gsnprov:SHACL"
    else:
        try:
            sentence = nl.sentence(record["key"], labels)
        except Exception:
            sentence = ""
        formalism = "gsnprov:OWL"

    decision = f"gsnprov:{uid}"
    statement = "gsnprov:st-" + uid.split("-")[1]
    # the vocabulary is looked up as rdflib URIRefs; the writer needs qnames
    qname = lambda iri: "gsnprov:" + str(iri).rsplit("#", 1)[-1]
    pairs = [("a", ["gsnprov:DesignDecision"]),
             ("gsnprov:positionKey", [Lit(position)]),
             ("gsnprov:part", [qname(part_iri)]),
             ("gsnprov:section", [qname(section_iri)]),
             ("gsnprov:formalism", [formalism]),
             ("gsnprov:naturalLanguage", [Lit(sentence, lang="en")]),
             ("gsnprov:nlWrittenFor", [Lit(matching.checksum(text))]),
             ("prov:generated", [statement])]

    # Looked up, not hardcoded. The release node carries its version in its IRI, so it is
    # renamed at every release; a literal here goes stale silently and points new records at
    # a graph that no longer exists.
    in_graph = release_node(graph, "shapes/ontogsn-shapes_0_full.ttl"
                            if text.startswith("gsnsh:") else "serializations/ontogsn.ttl")
    st_pairs = [("a", ["gsnprov:StatementRecord"]),
                ("prov:wasGeneratedBy", [decision]),
                ("gsnprov:inGraph", [in_graph]),
                ("gsnprov:statementText", [Lit(text)]),
                ("gsnprov:statementChecksum", [Lit(matching.checksum(text))]),
                ("gsnprov:structuralKey",
                 [Lit(matching.structural_key(record))])]
    if is_rule and record.get("label"):
        st_pairs.append(("gsnprov:ruleName", [Lit(record["label"])]))
    if is_shape:
        st_pairs.append(("gsnprov:aboutTerm", [record["shape"]]))
    elif not is_rule and isinstance(record.get("s"), ttl_model.URIRef):
        st_pairs.append(("gsnprov:aboutTerm", [ttl_model.qname(record["s"])]))
    mentions = matching.terms_in(text, known)
    if mentions:
        st_pairs.append(("gsnprov:mentionsTerm", mentions))

    return [(decision, pairs), (statement, st_pairs)], sentence, text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help="append the drafts to ontogsn-provenance-data.ttl")
    args = ap.parse_args()

    graph, records = orphans()
    if not records:
        print("every axiom, rule and constraint already has a design decision")
        return

    onto = ttl_model.load()
    labels = nl.labels_of(onto)
    known = {ttl_model.ln(s) for s in onto.subjects()
             if str(s).startswith(str(ttl_model.GSN))}

    uids = {str(s).rsplit("#", 1)[-1] for s in graph.subjects(RDF.type, P.DesignDecision)}
    uids |= {str(s).rsplit("#", 1)[-1]
             for s in graph.subjects(RDF.type, P.RetiredDecision)}
    positions = {str(o) for o in graph.objects(None, P.positionKey)}

    # A new decision inherits the section of the term it is about, so it sorts into the
    # right place in the generated workbook instead of landing at the end. Both maps are
    # read out of the vocabulary rather than hardcoded, so adding a section needs no
    # change here.
    section_iri_by_label, code_by_iri, part_by_iri = {}, {}, {}
    for iri in graph.subjects(RDF.type, P.StandardSection):
        section_iri_by_label[str(graph.value(iri, SKOS.prefLabel))] = iri
        code_by_iri[iri] = str(graph.value(iri, P.sectionCode))
        holder = next(iter(graph.subjects(P.section, iri)), None)
        part_by_iri[iri] = graph.value(holder, P.part) if holder is not None else None

    def placement(record):
        """-> the StandardSection this record belongs in, from gsn:coreOrExtension."""
        value = record.get("section")                       # shapes carry it directly
        if not value:
            node = record.get("s") if "dl" not in record else record.get("node")
            if isinstance(node, ttl_model.URIRef):
                value = onto.value(node, ttl_model.GSN.coreOrExtension)
        return section_iri_by_label.get(str(value or ""), P["sec-core"])

    blocks, shown = [], []
    for record in records:
        uid = f"dd-{next_free(uids, 'dd-', 4):04d}"
        uids.add(uid)
        section_iri = placement(record)
        code = code_by_iri.get(section_iri, "S04")
        letter = "SH" if record.get("unit") else "R"
        number = next_free(positions, f"{code}.{letter}", 3)
        position = f"{code}.{letter}{number:03d}"
        positions.add(position)
        part_iri = part_by_iri.get(section_iri) or P["part-1"]

        made, sentence, text = draft(graph, record, labels, uid, position,
                                     section_iri, part_iri, known)
        blocks.extend(made)
        shown.append((uid, position, text, sentence))

    print(f"{len(shown)} axioms have no design decision:\n")
    for uid, position, text, sentence in shown:
        print(f"  {uid}  {position}")
        print(f"    {text[:96]}")
        print(f"    {sentence[:96] or '(no sentence could be generated - write one)'}")

    if not args.write:
        print("\nRe-run with --write to append these drafts, then fill in prov:used "
              "(the\nsource passage) and gsnprov:hasRationale (the reasoning) by hand.")
        return

    with open(DATA, encoding="utf-8", newline="") as handle:
        text = handle.read()
    addition = prov_ttl.header(f"Added by prov_add.py ({len(shown)} decisions)",
                               "Drafts. Each still needs a source passage and a "
                               "rationale written by hand.")
    scratch = os.path.join(REPO, "provenance", ".prov_add.tmp")
    prov_ttl.write(scratch, [addition] + blocks)
    with open(scratch, encoding="utf-8") as handle:
        body = handle.read().split("\n\n", 1)[1]      # drop the repeated @prefix header
    os.remove(scratch)

    merged = text.rstrip("\n") + "\n\n" + body

    # parse before overwriting, never after: a validation that runs on the file it has
    # already clobbered can only tell you what you lost
    probe = os.path.join(REPO, "provenance", ".prov_add.check.ttl")
    with open(probe, "w", encoding="utf-8", newline="") as handle:
        handle.write(merged)
    try:
        Graph().parse(probe, format="turtle")
    except Exception as error:
        os.remove(probe)
        sys.exit(f"the drafts would not parse, so nothing was written: {error}")
    os.remove(probe)

    with open(DATA, "w", encoding="utf-8", newline="") as handle:
        handle.write(merged)
    print(f"\nappended {len(shown)} decisions to "
          f"{os.path.relpath(DATA, REPO).replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
