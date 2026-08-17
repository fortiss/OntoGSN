# -*- coding: utf-8 -*-
"""Generate the human-readable design documentation from the provenance graph.

    python tools/prov_to_workbook.py     # write provenance/Design Documentation.xlsx

The provenance Turtle is the source of truth; this workbook is a view of it, for people
who would rather read a spreadsheet than a graph. Nothing reads it back.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rdflib import Graph, Namespace, RDF
from rdflib.namespace import SKOS

import workbook_io

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROV_DIR = os.path.join(REPO, "provenance")
TBOX = os.path.join(PROV_DIR, "ontogsn-provenance.ttl")
DATA = os.path.join(PROV_DIR, "ontogsn-provenance-data.ttl")
OUT = os.path.join(PROV_DIR, "Design Documentation.xlsx")

# Three records, three vocabularies. They share the gsnprov: backbone and are read into one
# graph each rather than one graph together, because each numbers its decisions from dd-0001
# and merging them would collide. The label goes into the sheet's first column, so a reader
# filtering on it sees one vocabulary at a time.
RECORDS = [
    ("OntoGSN", DATA),
    ("OntoGSN augmentation", os.path.join(REPO, "augmentation",
                                          "ontogsn-augmentation-provenance.ttl")),
    ("OntoGSN alignment", os.path.join(REPO, "alignments", "gsnalign-provenance.ttl")),
]

P = Namespace("https://w3id.org/OntoGSN/provenance#")
PROV = Namespace("http://www.w3.org/ns/prov#")

SRC = "Item in source"
PG = "Page(s) / locator"
RSN = "Reason(s) for in-/exclusion"
NL = "Item in Natural Language"
TTL = "Item in OntoGSN TTL"
NONE = "(none)"


def load(data=DATA):
    """The vocabulary and one record, in one graph - the concept labels live in the
    vocabulary, and rdflib does not follow owl:imports."""
    graph = Graph()
    graph.parse(TBOX, format="turtle")
    graph.parse(data, format="turtle")
    return graph


def locator(graph, passage):
    """Where the passage is. The core record cites the standard and gives a page; the
    augmentation and the alignment cite specifications, rules and a process model, and each
    declares its own locator property in its own namespace. Matched on the local name so
    this does not have to know either of them."""
    page = text(graph, passage, P.pageRef)
    if page:
        return page
    for predicate, value in graph.predicate_objects(passage):
        if str(predicate).rsplit("#", 1)[-1] == "locator":
            return str(value)
    return ""


def text(graph, subject, predicate):
    value = graph.value(subject, predicate)
    return "" if value is None else str(value)


def label(graph, node):
    return "" if node is None else str(graph.value(node, SKOS.prefLabel) or "")


def rows_from(graph, which="OntoGSN"):
    """-> (live rows, archived rows), each a dict keyed by workbook column."""
    live, archived = [], []
    # a retired decision is typed only as the subclass, and this graph is not reasoned over
    decisions = (set(graph.subjects(RDF.type, P.DesignDecision)) |
                 set(graph.subjects(RDF.type, P.RetiredDecision)))
    for decision in decisions:
        retired = (decision, RDF.type, P.RetiredDecision) in graph
        passage = graph.value(decision, PROV.used)
        rationale = graph.value(decision, P.hasRationale)
        statement = graph.value(decision, PROV.generated)

        no_source = graph.value(decision, P.noSourceRecorded)
        no_reason = graph.value(decision, P.noRationaleRecorded)

        row = {
            "graph": which,
            "uid": str(decision).rsplit("#dd-", 1)[-1],
            "row_key": text(graph, decision, P.positionKey),
            "part": label(graph, graph.value(decision, P.part)),
            "section": label(graph, graph.value(decision, P.section)),
            "language": label(graph, graph.value(decision, P.formalism)),
            SRC: NONE if no_source else text(graph, passage, P.quotedText),
            PG: NONE if no_source else locator(graph, passage),
            NL: text(graph, decision, P.naturalLanguage),
            RSN: NONE if no_reason else text(graph, rationale, P.rationaleText),
            TTL: text(graph, statement, P.statementText),
            "nl_checksum": text(graph, decision, P.nlWrittenFor),
        }
        row["uid"] = "dd-" + row["uid"]
        if retired:
            row["archived_because"] = text(graph, decision, P.retirementReason)
            archived.append(row)
        else:
            live.append(row)

    # the sheets read in the standard's order, which is what the position key encodes.
    # The augmentation and the alignment have no position key - neither is organised by
    # a passage of the standard - so those rows fall back to the decision number.
    live.sort(key=lambda r: (r["row_key"] or r["uid"]))
    archived.sort(key=lambda r: (r["row_key"] or r["uid"]))
    return live, archived


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    live, archived = [], []
    for which, path in RECORDS:
        if not os.path.exists(path):
            print(f"  {which:22} missing, skipped ({os.path.relpath(path, REPO)})")
            continue
        rows, retired = rows_from(load(path), which)
        live += rows
        archived += retired
        print(f"  {which:22} {len(rows):4} live + {len(retired):3} retired")
    print(f"{len(live)} live + {len(archived)} retired decisions")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    workbook_io.write(args.out, live, archived)
    print(f"wrote {args.out} ({os.path.getsize(args.out):,} bytes)")


if __name__ == "__main__":
    main()
