# -*- coding: utf-8 -*-
"""Write the counts of the design record into the texts that state them.

    python development/dev_tools/design_counts.py            # rewrite the stale numbers
    python development/dev_tools/design_counts.py --check    # exit 1 if a number is stale

Several texts state how many decisions, passages, rationales, statements and stored
queries the design record holds. A person wrote those numbers, so they went stale after
each new decision. This script counts in the record and compares each number with its
count. Without --check, it replaces a stale number in place and changes nothing else.

Each count has one definition, in counts(). Each place that states a count is one entry
of TEXTS: a file, a regular expression with one group per number, and the name of the
count that belongs to each group. A pattern that matches nothing is an error, because the
sentence then changed and the number in it is no longer covered.
"""
import argparse
import io
import os
import re
import sys

from rdflib import RDF, Graph, Namespace

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DESIGN = Namespace("https://w3id.org/OntoGSN/design#")
ALIGNMENT_DESIGN = Namespace("https://w3id.org/OntoGSN/alignment/design#")

RECORD = "development/design/ontogsn-design-data.ttl"
GENERATED = "development/design/ontogsn-design-augmentations.ttl"
ALIGNMENT_RECORD = "development/design/ontogsn-align-design.ttl"
README = "development/design/README.md"
ALIGNMENT_README = "alignments/README.md"

# (file, pattern with one group per number, the count for each group)
TEXTS = (
    (README, r"(\d+) decisions, (\d+) passages, (\d+) rationales, (\d+) statements",
     ("decisions", "passages", "rationales", "statements")),
    (README, r"The (\d+) stored queries are", ("queries",)),
    (README, r"\| (\d+) of (\d+) queries, (\d+) distinct axioms \|",
     ("queries_resting", "queries", "axioms_rested_on")),
    (README, r"(\d+) queries rest on nothing", ("queries_resting_on_nothing",)),
    (README, r"The other (\d+) are augmentation queries",
     ("augmentation_queries_resting_on_nothing",)),
    (README, r"(\d+) of the (\d+) decisions are", ("decisions_for_nothing", "decisions")),
    (RECORD, r"Why each of the (\d+) axioms, rules and constraints", ("decisions",)),
    (ALIGNMENT_README, r"(\d+) decisions, (\d+) cited passages, (\d+) rationales",
     ("alignment_decisions", "alignment_passages", "alignment_rationales")),
)


def load(path):
    graph = Graph()
    graph.parse(os.path.join(REPO, path))
    return graph


def instances(graph, cls):
    return set(graph.subjects(RDF.type, cls))


def counts():
    """Each count that a text states, by name."""
    record = load(RECORD)
    # A retired decision has the class RetiredDecision only, so it is not counted here.
    decisions = instances(record, DESIGN.DesignDecision)
    # A decision to represent nothing has the formalism NoFormalism. This is narrower than
    # "has no prov:generated": a decision about an RDF annotation also generates no
    # statement record, but it does represent something.
    for_nothing = {d for d in decisions
                   if (d, DESIGN.formalism, DESIGN.NoFormalism) in record}

    generated = load(GENERATED)
    queries = instances(generated, DESIGN.Query)
    resting = {q for q in queries if (q, DESIGN.restsOnStatement, None) in generated}
    on_nothing = queries - resting
    augmentation = {q for q in on_nothing
                    if str(generated.value(q, DESIGN.path)).startswith("augmentation/")}

    alignment = load(ALIGNMENT_RECORD)
    return {
        "decisions": len(decisions),
        "decisions_for_nothing": len(for_nothing),
        "passages": len(instances(record, DESIGN.SourcePassage)),
        "rationales": len(instances(record, DESIGN.Rationale)),
        "statements": len(instances(record, DESIGN.StatementRecord)),
        "queries": len(queries),
        "queries_resting": len(resting),
        "queries_resting_on_nothing": len(on_nothing),
        "augmentation_queries_resting_on_nothing": len(augmentation),
        "axioms_rested_on": len({o for q in queries
                                 for o in generated.objects(q, DESIGN.restsOnStatement)}),
        "alignment_decisions": len(instances(alignment, DESIGN.DesignDecision)),
        "alignment_passages": len(instances(alignment, ALIGNMENT_DESIGN.CitedPassage)),
        "alignment_rationales": len(instances(alignment, DESIGN.Rationale)),
    }


def read(path):
    # newline="" keeps the line endings of the file, so a rewrite changes numbers only
    with io.open(os.path.join(REPO, path), encoding="utf-8", newline="") as handle:
        return handle.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="write nothing, and exit 1 if a number is stale")
    args = ap.parse_args()

    count = counts()
    texts, stale, missing, agree = {}, [], [], 0

    for path, pattern, names in TEXTS:
        text = texts.setdefault(path, read(path))
        if not re.search(pattern, text):
            missing.append("{}: no text matches {!r}".format(path, pattern))
            continue

        def correct(match, names=names, path=path):
            nonlocal agree
            out, last = [], match.start()
            for index, name in enumerate(names, start=1):
                found, expected = int(match.group(index)), count[name]
                if found == expected:
                    agree += 1
                else:
                    stale.append("{}: {} says {}, the record has {}".format(
                        path, name.replace("_", " "), found, expected))
                out.append(match.string[last:match.start(index)] + str(expected))
                last = match.end(index)
            return "".join(out) + match.string[last:match.end()]

        texts[path] = re.sub(pattern, correct, text)

    for line in missing:
        print("MISSING: " + line)
    for line in stale:
        print(("STALE: " if args.check else "corrected: ") + line)
    print("{} number(s) agree with the design record, {} stale, {} pattern(s) without a "
          "match".format(agree, len(stale), len(missing)))

    if not args.check:
        for path, text in texts.items():
            if text != read(path):
                with io.open(os.path.join(REPO, path), "w", encoding="utf-8",
                             newline="") as handle:
                    handle.write(text)
                print("wrote " + path)
    if missing or (args.check and stale):
        sys.exit(1)


if __name__ == "__main__":
    main()
