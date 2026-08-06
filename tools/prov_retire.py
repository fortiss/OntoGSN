# -*- coding: utf-8 -*-
"""Retire a design decision, or bring one back.

    python tools/prov_retire.py dd-0680 --reason "Superseded by dd-0646; same axiom, ..."
    python tools/prov_retire.py --undo dd-0680

Replaces archive_rows.py, which moved a row between sheets of a spreadsheet that no
longer exists. Retiring is now a change of type in the provenance graph: the decision
becomes a gsnprov:RetiredDecision and gains a gsnprov:retirementReason.

The decision is kept, not deleted. The ontology may have moved on, but the reasoning is
still the record of a real decision, and the passage of the standard it rests on is still
the reason someone once thought it was right.

Edits ontogsn-provenance-data.ttl in place, touching only the block it has to. The file
is hand-maintained, so a whole-file rewrite would reflow every other block and bury the
change in the diff.
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rdflib import Graph, Namespace, RDF

import prov_ttl

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(REPO, "provenance", "ontogsn-provenance-data.ttl")
TBOX = os.path.join(REPO, "provenance", "ontogsn-provenance.ttl")

P = Namespace("https://w3id.org/OntoGSN/provenance#")
PROV = Namespace("http://www.w3.org/ns/prov#")


def block(text, uid):
    """-> (start, end) of the `gsnprov:<uid> ... .` block, or None.

    Matched on the subject at the start of a line through to the terminating ' .', which
    is how prov_ttl writes every block.
    """
    match = re.search(rf"^gsnprov:{re.escape(uid)}\n(?:.*\n)*?.*? \.\n",
                      text, re.MULTILINE)
    return (match.start(), match.end()) if match else None


def retire(text, uid, reason, successor=None):
    span = block(text, uid)
    if not span:
        sys.exit(f"{uid} is not in {os.path.basename(DATA)}")
    body = text[span[0]:span[1]]
    if "gsnprov:RetiredDecision" in body:
        sys.exit(f"{uid} is already retired")
    if "gsnprov:DesignDecision" not in body:
        sys.exit(f"{uid} is not a design decision")

    body = body.replace("a gsnprov:DesignDecision ;", "a gsnprov:RetiredDecision ;", 1)
    added = f"    gsnprov:retirementReason {prov_ttl.literal(prov_ttl.Lit(reason, lang='en'))} ;\n"
    if successor:
        added += f"    gsnprov:supersededBy gsnprov:{successor} ;\n"
    # insert after the type line, so the reason reads next to what it explains
    body = body.replace("    a gsnprov:RetiredDecision ;\n",
                        "    a gsnprov:RetiredDecision ;\n" + added, 1)
    return text[:span[0]] + body + text[span[1]:]


def restore(text, uid):
    span = block(text, uid)
    if not span:
        sys.exit(f"{uid} is not in {os.path.basename(DATA)}")
    body = text[span[0]:span[1]]
    if "gsnprov:RetiredDecision" not in body:
        sys.exit(f"{uid} is not retired")
    body = body.replace("a gsnprov:RetiredDecision ;", "a gsnprov:DesignDecision ;", 1)
    body = re.sub(r"^    gsnprov:(retirementReason|supersededBy) .*?;\n", "", body,
                  flags=re.MULTILINE | re.DOTALL)
    return text[:span[0]] + body + text[span[1]:]


def describe(uid):
    graph = Graph()
    graph.parse(TBOX, format="turtle")
    graph.parse(DATA, format="turtle")
    node = P[uid]
    if (node, RDF.type, None) not in graph:
        return None
    statement = graph.value(node, PROV.generated)
    return {
        "position": graph.value(node, P.positionKey),
        "prose": graph.value(node, P.naturalLanguage),
        "statement": graph.value(statement, P.statementText) if statement else None,
        "retired": (node, RDF.type, P.RetiredDecision) in graph,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("uid", help="the decision's stable id, e.g. dd-0680")
    ap.add_argument("--reason", default="",
                    help="why it is being retired, and where its content went")
    ap.add_argument("--superseded-by", default=None, metavar="UID",
                    help="the decision that now carries what this one recorded")
    ap.add_argument("--undo", action="store_true", help="bring the decision back")
    args = ap.parse_args()

    uid = args.uid if args.uid.startswith("dd-") else f"dd-{args.uid}"
    before = describe(uid)
    if before is None:
        sys.exit(f"{uid} is not in the provenance graph")

    if not args.undo and not args.reason.strip():
        sys.exit("--reason is required: a retirement with no recorded reason is a "
                 "decision nobody can review later")

    with open(DATA, encoding="utf-8", newline="") as handle:
        text = handle.read()
    text = (restore(text, uid) if args.undo
            else retire(text, uid, args.reason.strip(), args.superseded_by))
    with open(DATA, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)

    # a file that no longer parses is worse than one that was never edited
    check = Graph()
    try:
        check.parse(DATA, format="turtle")
    except Exception as error:
        sys.exit(f"the edit left invalid Turtle, restore from git: {error}")

    verb = "restored" if args.undo else "retired"
    print(f"{verb} {uid}  ({before['position']})")
    if before["prose"]:
        print(f"  {str(before['prose'])[:88]}")
    if before["statement"]:
        print(f"  {str(before['statement'])[:88]}")
    if not args.undo:
        print("\nThe statement it produced is still in the ontology unless you removed it "
              "there too.\nRun tools/prov_check.py to see which.")


if __name__ == "__main__":
    main()
