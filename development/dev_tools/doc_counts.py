# -*- coding: utf-8 -*-
"""Write the counts that the documents state, from the files that they count.

    python development/dev_tools/doc_counts.py            # rewrite the stale numbers
    python development/dev_tools/doc_counts.py --check    # exit 1 if a number is stale

Several READMEs and website pages state a count: the decisions of the design record, the
stored queries, the classes of the augmentation, the pitfalls of the last OOPS! report. A
person wrote those numbers, so they went stale. This script counts in the source of each
number and compares. Without --check, it replaces a stale number in place and changes
nothing else.

Each count has one definition and one name, in counts().

A Markdown file names its counts with a marker on a line of its own:

    [count]: <> (queries)

    `ontology/queries/` holds 43 CRUD SPARQL queries ...

Markdown reads the marker as a link definition that nothing uses, so GitHub shows nothing.
The marker applies to the next block: a paragraph, a heading, a table or a fenced code
block. The names bind to the whole numbers of that block, in order. A `_` skips a number:

    [count]: <> (_ _ ontology_classes)

    ARGO has 16 classes and 22 object properties. OntoGSN has 20 classes.

A whole number is a run of digits that is not part of a version, a date, an identifier or
a file name, so `1.3.1`, `2026-11-12`, `S17` and `v001` are not counted. A block with fewer
numbers than its marker names is an error. Keep a blank line before and after the marker.

A file that is not Markdown for GitHub cannot hold a marker: a Turtle header, and the
pages of the website, which Jekyll renders. For these, TEXTS holds the file, a regular
expression with one group per value, and the name of the count for each group. A pattern
that matches nothing is an error.

The number of SWRL rules and the version fields are not here. release_check.py compares
those, and it writes nothing, because a version is a decision and not a count.
"""
import argparse
import glob
import io
import json
import os
import re
import sys

from rdflib import OWL, RDF, Graph, Namespace, URIRef

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DESIGN = Namespace("https://w3id.org/OntoGSN/design#")
ALIGNMENT_DESIGN = Namespace("https://w3id.org/OntoGSN/alignment/design#")
SH = Namespace("http://www.w3.org/ns/shacl#")
SWRL = Namespace("http://www.w3.org/2003/11/swrl#")

GSN = "https://w3id.org/OntoGSN/ontology#"
GSNAUG = "https://w3id.org/OntoGSN/augmentation#"
GSNALIGN = "https://w3id.org/OntoGSN/alignment#"

ONTOLOGY = "ontology/serializations/ontogsn.ttl"
SEPARATED_DIR = "ontology/serializations/separated"
QUERY_DIR = "ontology/queries"
RECORD = "development/design/ontogsn-design-data.ttl"
GENERATED = "development/design/ontogsn-design-augmentations.ttl"
ALIGNMENT_RECORD = "development/design/ontogsn-align-design.ttl"
AUGMENTATION = "augmentation/ontogsn-augmentation.ttl"
AUGMENTATION_SHAPES = "augmentation/shapes/ontogsn-augmentation-shapes.ttl"
ALIGNMENT = "alignments/ontogsn-align.ttl"
OOPS_REPORT = "docs/evaluation/oops"
FOOPS_REPORT = "docs/evaluation/foops"

QUERY_README = "ontology/queries/README.md"
TUTORIAL = "docs/_pages/tutorial.md"
EVALUATION = "docs/evaluation/index.md"

# The marker of a count in a Markdown file, and a whole number in the block after it.
MARKER = re.compile(r"^\[count\]: <> \(([^)\r\n]*)\)[ \t]*\r?$", re.M)
NUMBER = re.compile(r"(?<![\w.,~/#:\-\[{])\d+(?![\w\-\]]|[.,]\d)")
# folders whose Markdown files are not read: Jekyll renders the website
SKIPPED_FOLDERS = {".git", "docs", "vendor", "node_modules", "__pycache__"}

VERSION = r"(\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.]+)?)"

# (file, pattern with one group per value, the count for each group), for the files that
# cannot hold a marker
TEXTS = (
    (RECORD, r"Why each of the (\d+) axioms, rules and constraints", ("decisions",)),
    (TUTORIAL, r"has (\d+) stored SPARQL queries", ("queries",)),
    (EVALUATION,
     r"\| " + VERSION + r" \| OOPS! " + VERSION
     + r" \| (\d+) important and (\d+) minor pitfalls, (\d+) critical \|",
     ("oops_ontology_version", "oops_tool_version", "oops_important", "oops_minor",
      "oops_critical")),
    (EVALUATION,
     r"\| " + VERSION + r" \| FOOPS! " + VERSION
     + r" \| (\d+) of (\d+) checks pass, score (\d+) %",
     ("foops_ontology_version", "foops_tool_version", "foops_passed", "foops_checks",
      "foops_score")),
)


def path_of(relative):
    return os.path.join(REPO, relative)


def load(relative):
    graph = Graph()
    graph.parse(path_of(relative))
    return graph


def load_json(relative):
    with io.open(path_of(relative), encoding="utf-8") as handle:
        return json.load(handle)


def instances(graph, cls, namespace=None):
    """The named instances of a class, or only those in one namespace."""
    return {s for s in graph.subjects(RDF.type, cls)
            if isinstance(s, URIRef) and (namespace is None or str(s).startswith(namespace))}


def query_files():
    return sorted(os.path.basename(p)[:-3] for p in glob.glob(path_of(QUERY_DIR + "/*.rq")))


def design_counts():
    record = load(RECORD)
    # A retired decision has the class RetiredDecision only, so it is not counted here.
    decisions = instances(record, DESIGN.DesignDecision)
    # A decision to represent nothing has the formalism NoFormalism. This is narrower than
    # "has no prov:generated": a decision about an RDF annotation also generates no
    # statement record, but it does represent something.
    for_nothing = {d for d in decisions
                   if (d, DESIGN.formalism, DESIGN.NoFormalism) in record}

    generated = load(GENERATED)
    # every query that the record describes: the core ones and those of the augmentation
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
        "recorded_queries": len(queries),
        "queries_resting": len(resting),
        "queries_resting_on_nothing": len(on_nothing),
        "augmentation_queries_resting_on_nothing": len(augmentation),
        "axioms_rested_on": len({o for q in queries
                                 for o in generated.objects(q, DESIGN.restsOnStatement)}),
        "alignment_decisions": len(instances(alignment, DESIGN.DesignDecision)),
        "alignment_passages": len(instances(alignment, ALIGNMENT_DESIGN.CitedPassage)),
        "alignment_rationales": len(instances(alignment, DESIGN.Rationale)),
    }


def file_counts():
    names = query_files()
    found = {"queries": len(names)}
    for operation in ("read", "create", "update", "delete"):
        found[operation + "_queries"] = len([n for n in names
                                             if n.startswith(operation + "_")])
    found["separated_files"] = len([p for p in glob.glob(path_of(SEPARATED_DIR + "/*"))
                                    if not p.endswith("README.md")])
    return found


def vocabulary_counts():
    """Terms that a vocabulary declares in its own namespace."""
    ontology = load(ONTOLOGY)
    augmentation = load(AUGMENTATION)
    shapes = load(AUGMENTATION_SHAPES)
    alignment = load(ALIGNMENT)
    properties = (OWL.ObjectProperty, OWL.DatatypeProperty, OWL.AnnotationProperty)
    return {
        "ontology_classes": len(instances(ontology, OWL.Class, GSN)),
        "ontology_object_properties": len(instances(ontology, OWL.ObjectProperty, GSN)),
        "ontology_datatype_properties": len(instances(ontology, OWL.DatatypeProperty, GSN)),
        "augmentation_classes": len(instances(augmentation, OWL.Class, GSNAUG)),
        "augmentation_properties": len(set().union(
            *(instances(augmentation, kind, GSNAUG) for kind in properties))),
        # the issue types are the named individuals of the vocabulary
        "augmentation_issue_types": len(instances(augmentation, OWL.NamedIndividual, GSNAUG)),
        "augmentation_rules": len(set(augmentation.subjects(RDF.type, SWRL.Imp))),
        "augmentation_shapes": len(instances(shapes, SH.NodeShape)),
        "alignment_classes": len(instances(alignment, OWL.Class, GSNALIGN)),
        # a bridge property links terms of the two ontologies, so the annotation
        # properties of the alignment are not counted
        "alignment_properties": len(instances(alignment, OWL.ObjectProperty, GSNALIGN)),
    }


def report_counts():
    """What the committed OOPS! and FOOPS! reports say, as reports.py wrote them."""
    oops_build = load_json(OOPS_REPORT + "/build.json")
    pitfalls = load_json(OOPS_REPORT + "/oops.json")["pitfalls"]
    foops_build = load_json(FOOPS_REPORT + "/build.json")
    foops = load_json(FOOPS_REPORT + "/foops.json")

    def importance(level):
        return len([p for p in pitfalls if p["importance"].upper() == level])

    checks = foops["checks"]
    return {
        "oops_ontology_version": oops_build["ontology_version"],
        "oops_tool_version": oops_build["tool_version"],
        "oops_important": importance("IMPORTANT"),
        "oops_minor": importance("MINOR"),
        "oops_critical": importance("CRITICAL"),
        "foops_ontology_version": foops_build["ontology_version"],
        "foops_tool_version": foops_build["tool_version"],
        "foops_passed": len([c for c in checks if c["status"] == "ok"]),
        "foops_checks": len(checks),
        "foops_score": int(round(float(foops["overall_score"]) * 100)),
    }


def counts():
    """Each value that a text states, by name."""
    found = {}
    for part in (design_counts, file_counts, vocabulary_counts, report_counts):
        found.update(part())
    return found


def read(relative):
    # newline="" keeps the line endings of the file, so a rewrite changes numbers only
    with io.open(path_of(relative), encoding="utf-8", newline="") as handle:
        return handle.read()


def catalogue_gaps():
    """Stored queries without a row in the catalogue, and rows without a query."""
    listed = set(re.findall(r"^\| `((?:read|create|update|delete)_\w+)` \|",
                            read(QUERY_README), re.M))
    files = set(query_files())
    return ([QUERY_README + ": no row for " + name + ".rq" for name in sorted(files - listed)]
            + [QUERY_README + ": the row " + name + " has no file in " + QUERY_DIR
               for name in sorted(listed - files)])


def markdown_files():
    found = []
    for folder, folders, files in os.walk(REPO):
        folders[:] = sorted(f for f in folders if f not in SKIPPED_FOLDERS)
        for name in sorted(files):
            if name.endswith(".md"):
                found.append(os.path.relpath(os.path.join(folder, name), REPO)
                             .replace(os.sep, "/"))
    return found


def block_after(text, start):
    """(start, end) of the block that follows a marker: up to the next blank line, or up
    to the closing fence of a code block."""
    lines = re.compile(r"[^\n]*\n?")
    position = start
    while position < len(text) and not lines.match(text, position).group().strip():
        position = lines.match(text, position).end()
    begin, fenced = position, text.startswith("```", position)
    while position < len(text):
        line = lines.match(text, position)
        inside = position > begin
        if not fenced and inside and (not line.group().strip()
                                      or MARKER.match(text, position)):
            break
        position = line.end()
        if fenced and inside and line.group().startswith("```"):
            break
    return begin, position


def marked_values(path, text, count, missing):
    """(start, end, name) for each number that a marker of this file binds to a count."""
    bound = []
    for marker in MARKER.finditer(text):
        names = marker.group(1).split()
        line = text.count("\n", 0, marker.start()) + 1
        unknown = [n for n in names if n != "_" and n not in count]
        if unknown or not names:
            missing.append("{} line {}: the marker names {}".format(
                path, line,
                "an unknown count: " + ", ".join(unknown) if unknown else "no count"))
            continue
        begin, end = block_after(text, marker.end())
        numbers = list(NUMBER.finditer(text, begin, end))
        if len(numbers) < len(names):
            missing.append("{} line {}: the marker names {} value(s), and the block after "
                           "it has {} number(s)".format(path, line, len(names), len(numbers)))
            continue
        bound += [(number.start(), number.end(), name)
                  for number, name in zip(numbers, names) if name != "_"]
    return bound


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="write nothing, and exit 1 if a number is stale")
    args = ap.parse_args()

    count = counts()
    texts, stale, agree = {}, [], 0
    missing = catalogue_gaps()

    def compare(path, name, found):
        nonlocal agree
        expected = str(count[name])
        if found == expected:
            agree += 1
        else:
            stale.append("{}: {} says {}, the source has {}".format(
                path, name.replace("_", " "), found, expected))
        return expected

    for path in markdown_files():
        text = read(path)
        bound = marked_values(path, text, count, missing)
        # from the end, so that a replacement does not move the positions before it
        for start, end, name in sorted(bound, reverse=True):
            text = text[:start] + compare(path, name, text[start:end]) + text[end:]
        if bound:
            texts[path] = text

    for path, pattern, names in TEXTS:
        text = texts.setdefault(path, read(path))
        if not re.search(pattern, text):
            missing.append("{}: no text matches {!r}".format(path, pattern))
            continue

        def correct(match, names=names, path=path):
            out, last = [], match.start()
            for index, name in enumerate(names, start=1):
                out.append(match.string[last:match.start(index)]
                           + compare(path, name, match.group(index)))
                last = match.end(index)
            return "".join(out) + match.string[last:match.end()]

        texts[path] = re.sub(pattern, correct, text)

    for line in missing:
        print("MISSING: " + line)
    for line in stale:
        print(("STALE: " if args.check else "corrected: ") + line)
    print("{} number(s) agree with their source, {} stale, {} missing".format(
        agree, len(stale), len(missing)))

    if not args.check:
        for path, text in texts.items():
            if text != read(path):
                with io.open(path_of(path), "w", encoding="utf-8", newline="") as handle:
                    handle.write(text)
                print("wrote " + path)
    if missing or (args.check and stale):
        sys.exit(1)


if __name__ == "__main__":
    main()
