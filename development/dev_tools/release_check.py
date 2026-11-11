# -*- coding: utf-8 -*-
"""Make sure that every place that states a version or a rule count agrees.

    python development/dev_tools/release_check.py            # report, exit 1 on a disagreement
    python development/dev_tools/release_check.py --check    # the same, the form check_all.py calls

A release writes the same number into many files: the ontology header, CITATION.cff, the
CHANGELOG tables, the release nodes of the design records, the augmentation, the website.
This script reads those places and compares them. It writes nothing.

A disagreement fails the check. A note does not: it marks a place that legitimately lags
behind a release, such as the alignment, which a person checks again after each ontology
release, and the website pages that show the output of a report.

The fields are single header lines, so the script reads them with regular expressions, as
build_full.py does for the shapes version. It parses no graph, so it costs well under a second
in the pre-commit hook.
"""
import argparse
import glob
import io
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ONTOLOGY = "ontology/serializations/ontogsn.ttl"
SHAPES_FULL = "ontology/shapes/ontogsn-shapes_0_full.ttl"
SHAPES = sorted("ontology/shapes/" + name for name in (
    "ontogsn-shapes_0_full.ttl", "ontogsn-shapes_1_core.ttl", "ontogsn-shapes_2_pattern.ttl",
    "ontogsn-shapes_3_modular.ttl", "ontogsn-shapes_4_confidence.ttl",
    "ontogsn-shapes_5_dialectic.ttl"))
AUGMENTATION = "augmentation/ontogsn-augmentation.ttl"
AUGMENTATION_SHAPES = "augmentation/shapes/ontogsn-augmentation-shapes.ttl"
AUGMENTATION_README = "augmentation/README.md"
ALIGNMENT = "alignments/ontogsn-align.ttl"
CITATION = "CITATION.cff"
CHANGELOG = "CHANGELOG.md"
RELEASES_PAGE = "docs/_pages/releases.md"
FRONT_PAGE = "docs/index.html"
RULES_DIR = "ontology/queries/rules"

# the design records that hold a gsndesign:FormalGraph node per described file
DESIGN_RECORDS = (
    "development/design/ontogsn-design-data.ttl",
    "development/design/ontogsn-augmentation-design.ttl",
    "development/design/ontogsn-align-design.ttl",
)

# The files that state the number of SWRL rules of the core ontology. The augmentation
# README is not here: it counts the augmentation's own rules.
RULE_COUNT_FILES = (
    "README.md",
    "alignments/README.md",
    "development/design/README.md",
    "development/dev_tools/README.md",
    "docs/_pages/tutorial.md",
    "ontology/queries/README.md",
    "ontology/serializations/separated/README.md",
    "ontology/shapes/README.md",
)
RULE_COUNT_PATTERNS = (r"\b(\d+)\s+SWRL rules\b", r"\bof (\d+) rules fired\b",
                       r"\bthe (\d+) rule queries\b")

# Pages that show the output of a report or of a run. They follow a release, so a
# difference here is a note.
LAGGING_PAGES = (
    ("docs/evaluation/index.md", r"\|\s*(\d+\.\d+(?:\.\d+)?)\s*\|\s*(?:OOPS!|FOOPS!)"),
    ("docs/_pages/tutorial.md", r"comes from OntoGSN (\d+\.\d+(?:\.\d+)?)"),
)

# the component rows of the CHANGELOG that have a "## <name> <version>" heading
CHANGELOG_HEADINGS = {
    "Ontology": "Ontology",
    "SHACL shapes": "SHACL shapes",
    "Augmentation, and its shapes": "Augmentation",
    "Design record": "Design record",
}


def read(path):
    return io.open(os.path.join(REPO, path), encoding="utf-8").read()


def first(pattern, text, flags=0):
    match = re.search(pattern, text, flags)
    return match.group(1) if match else None


def version_info(path):
    """The first owl:versionInfo of a file, which is the one in its ontology header."""
    return first(r'owl:versionInfo\s+"([^"]+)"', read(path))


def formal_graphs(path):
    """(node, version, described path) for each gsndesign:FormalGraph node of a record."""
    found = []
    blocks = re.split(r"\n(?=\S+\s*\n\s+a gsndesign:FormalGraph\b)", read(path))
    for block in blocks[1:]:
        block = block.split("\n\n")[0]
        found.append((block.split()[0],
                      first(r'owl:versionInfo\s+"([^"]+)"', block),
                      first(r'gsndesign:path\s+"([^"]+)"', block),
                      first(r'rdfs:label\s+"([^"]+)"', block)))
    return found


def table_rows(text, header):
    """The cell lists of the Markdown table whose header row starts with `header`."""
    rows, inside = [], False
    for line in text.splitlines():
        if line.startswith(header):
            inside = True
            continue
        if inside:
            if not line.startswith("|"):
                break
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if not set(cells[0]) <= set(":- "):
                rows.append(cells)
    return rows


class Report:
    def __init__(self):
        self.errors, self.notes, self.passed = [], [], 0

    def same(self, what, found, expected, where, note=False):
        if found == expected:
            self.passed += 1
            return
        line = "{}: {} says {}, expected {}".format(
            where, what, "nothing" if found is None else repr(found), repr(expected))
        (self.notes if note else self.errors).append(line)

    def holds(self, condition, line):
        if condition:
            self.passed += 1
        else:
            self.errors.append(line)


def check_ontology(report):
    text = read(ONTOLOGY)
    header = text.split("#################################################################")[0]
    version = first(r'owl:versionInfo\s+"([^"]+)"', header)
    issued = first(r'terms:issued\s+"([^"]+)"', header)
    modified = first(r'terms:modified\s+"([^"]+)"', header)
    report.holds(version is not None, ONTOLOGY + ": the header has no owl:versionInfo")
    if version is None:
        return None, None

    report.same("owl:versionIRI", first(r"owl:versionIRI\s+<([^>]+)>", header),
                "https://w3id.org/OntoGSN/ontology/" + version, ONTOLOGY)
    report.same("the version in terms:bibliographicCitation",
                first(r'terms:bibliographicCitation\s+"[^"]*\(Version ([^)]+)\)', header),
                version, ONTOLOGY)
    prior = first(r"owl:priorVersion\s+<([^>]+)>", header)
    report.holds(prior is not None and not prior.endswith("/" + version),
                 "{}: owl:priorVersion is {}, which is not an earlier version than {}".format(
                     ONTOLOGY, prior, version))
    report.holds(issued is not None and modified is not None and modified >= issued,
                 "{}: terms:modified {} is before terms:issued {}".format(
                     ONTOLOGY, modified, issued))

    cff = read(CITATION)
    report.same("version", first(r'^version:\s*"?([^"\n]+)"?', cff, re.M), version, CITATION)
    report.same("date-released", first(r'^date-released:\s*"?([^"\n]+)"?', cff, re.M),
                issued, CITATION)

    report.same("gsnaug:augmentedOntoGSNVersion",
                first(r'gsnaug:augmentedOntoGSNVersion\s+"([^"]+)"', read(AUGMENTATION)),
                version, AUGMENTATION)
    report.same('"Written against OntoGSN"',
                first(r"Written against \*\*OntoGSN ([^*]+)\*\*", read(AUGMENTATION_README)),
                version, AUGMENTATION_README)
    report.same("the version in the citation",
                first(r"OntoGSN \(Version ([^)]+)\)", read(FRONT_PAGE)), version, FRONT_PAGE)
    report.holds(re.search(r"\|\s*Ontology\s*\|\s*\[" + re.escape(version) + r"\]",
                           read(RELEASES_PAGE)) is not None,
                 "{}: no row for ontology {}".format(RELEASES_PAGE, version))

    # The alignment is checked by a person after each ontology release, and the annotation
    # records the release of the last check. A difference is the signal to check again.
    report.same("gsnalign:alignedOntoGSNVersion",
                first(r'gsnalign:alignedOntoGSNVersion\s+"([^"]+)"', read(ALIGNMENT)),
                version, ALIGNMENT, note=True)
    for path, pattern in LAGGING_PAGES:
        for found in re.findall(pattern, read(path)):
            report.same("the ontology version", found, version, path, note=True)
    return version, issued


def check_components(report):
    versions = {path: version_info(path) for path in SHAPES}
    for path in SHAPES:
        report.same("owl:versionInfo", versions[path], versions[SHAPES_FULL], path)
    report.same("owl:versionInfo", version_info(AUGMENTATION_SHAPES),
                version_info(AUGMENTATION), AUGMENTATION_SHAPES)


def check_changelog(report, version, issued):
    text = read(CHANGELOG)
    components = table_rows(text, "| Component | Version | File |")
    report.holds(bool(components), CHANGELOG + ": no component table")
    for name, stated, path in components:
        path = path.strip("`")
        report.same("the component table, row " + name, stated, version_info(path), CHANGELOG)
        heading = CHANGELOG_HEADINGS.get(name)
        if heading:
            report.holds(
                re.search(r"^## " + re.escape(heading) + " " + re.escape(stated) + r"\b",
                          text, re.M) is not None,
                '{}: no "## {} {}" entry'.format(CHANGELOG, heading, stated))

    releases = table_rows(text, "| Ontology | Date | Shapes | Breaking |")
    report.holds(bool(releases), CHANGELOG + ": no release table")
    if releases and version:
        newest = releases[0]
        report.same("the first row of the release table", newest[0], version, CHANGELOG)
        report.same("the date of that row", newest[1], issued, CHANGELOG)
        shapes = version_info(SHAPES_FULL)
        report.holds(shapes in re.findall(r"\d+\.\d+(?:\.\d+)?", newest[2]),
                     "{}: the release table row {} does not name shapes {}".format(
                         CHANGELOG, newest[0], shapes))


def check_design_records(report):
    for record in DESIGN_RECORDS:
        nodes = formal_graphs(record)
        report.holds(bool(nodes), record + ": no gsndesign:FormalGraph node")
        described = {}
        for node, stated, path, label in nodes:
            # a vendored copy of somebody else's ontology carries their version scheme
            if path and "/vendor/" in path:
                continue
            report.holds(stated is not None and node.endswith("-" + stated),
                         "{}: {} has owl:versionInfo {}".format(record, node, stated))
            report.holds(stated is not None and label is not None and label.endswith(stated),
                         '{}: {} has the label "{}" and owl:versionInfo {}'.format(
                             record, node, label, stated))
            if path:
                described.setdefault(path, set()).add(stated)
        # one node per file is the current release; older ones stay for retired decisions
        for path, stated in sorted(described.items()):
            if os.path.isfile(os.path.join(REPO, path)):
                current = version_info(path)
                report.holds(current in stated,
                             "{}: no release node for {} at its version {} (found {})".format(
                                 record, path, current,
                                 ", ".join(sorted(str(s) for s in stated))))


def check_rule_counts(report):
    rules = len(re.findall(r"\brdf:type\s+swrl:Imp\b", read(ONTOLOGY)))
    files = len(glob.glob(os.path.join(REPO, RULES_DIR, "*.rq")))
    report.same("the number of *.rq files", files, rules, RULES_DIR)
    for path in RULE_COUNT_FILES:
        text = read(path)
        for pattern in RULE_COUNT_PATTERNS:
            for found in re.findall(pattern, text):
                report.same("the number of SWRL rules", int(found), rules, path)
    return rules


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="accepted for symmetry with the other checks; the script never writes")
    ap.parse_args()

    report = Report()
    version, issued = check_ontology(report)
    check_components(report)
    check_changelog(report, version, issued)
    check_design_records(report)
    rules = check_rule_counts(report)

    for line in report.notes:
        print("note: " + line)
    for line in report.errors:
        print("DISAGREES: " + line)
    print("ontology {}, {} SWRL rules: {} comparison(s) agree, {} disagree, {} note(s)".format(
        version, rules, report.passed, len(report.errors), len(report.notes)))
    if report.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
