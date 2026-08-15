# -*- coding: utf-8 -*-
"""Validate tools/testdata/ against shapes/ and compare the result with a recorded baseline.

    python tools/shacl_check.py                    # compare against the baseline
    python tools/shacl_check.py --write-baseline   # record the current result
    python tools/shacl_check.py -v                 # list every violation

Two graphs are validated, and the second is the one that matters.

The first is the fixture as authored. The second is the fixture after queries/rules/ has been
applied to a fixpoint - the rules assert flags of their own, and a rule that writes a property
somewhere its rdfs:domain does not reach produces data the ontology rejects. That is not
hypothetical: it is how gsn:valid came to be asserted on gsn:Relationship, which is not a
gsn:GSNElement, by rule S29. Validating only what a person typed would never have found it.

Why a baseline rather than "no violations": the last section of example_case.ttl is deliberately
malformed - a support cycle, a duplicate identifier, a solution with no artefact - so that the
diagnostic queries have something to find. Zero is therefore the wrong expectation. The right one
is "exactly these, and nothing new", which is what a recorded baseline says and a bare count
cannot.

The ontology is mixed into the data graph because the shapes use sh:class, which walks
rdfs:subClassOf* and needs the hierarchy present. That means the ontology's own triples are
validated too; findings against them are real findings about the ontology and are kept.
"""
import argparse
import collections
import glob
import io
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHAPES = os.path.join(REPO, "shapes", "ontogsn-shapes_0_full.ttl")
ONTOLOGY = os.path.join(REPO, "serializations", "ontogsn.ttl")
TESTDATA = os.path.join(REPO, "tools", "testdata")
FIXTURE = os.path.join(TESTDATA, "example_case.ttl")
RULE_FIXTURE = os.path.join(TESTDATA, "rule_cases.ttl")
BASELINE = os.path.join(TESTDATA, "shacl_baseline.txt")

MAX_PASSES = 20

PREFIXES = [
    ("https://w3id.org/OntoGSN/ontology#", "gsn:"),
    ("https://w3id.org/OntoGSN/shapes#", "gsnsh:"),
    ("https://w3id.org/OntoGSN/example#", "ex:"),
    ("https://w3id.org/OntoGSN/example/rules#", "rc:"),
    ("http://www.w3.org/ns/shacl#", "sh:"),
    ("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:"),
    ("http://www.w3.org/2000/01/rdf-schema#", "rdfs:"),
    ("http://www.w3.org/2002/07/owl#", "owl:"),
    ("http://www.w3.org/2001/XMLSchema#", "xsd:"),
    ("http://schema.org/", "schema:"),
]


def shorten(term):
    """A stable, readable name for a term in a report line.

    Blank nodes are rendered as a constant. Their labels are regenerated on every parse, so
    keeping them would make the baseline differ from itself run to run; the shape and the
    constraint component still identify what was violated.
    """
    if term is None:
        return "-"
    import rdflib
    if isinstance(term, rdflib.BNode):
        return "_:anon"
    if isinstance(term, rdflib.Literal):
        return f'"{term}"'
    text = str(term)
    for namespace, prefix in PREFIXES:
        if text.startswith(namespace):
            return prefix + text[len(namespace):]
    return f"<{text}>"


def materialise(paths):
    """Load paths plus the ontology into a store and apply queries/rules/ to a fixpoint.

    Returns the Turtle serialisation. Reuses run_rules.py's loader so the two cannot disagree
    about what the rule set is.
    """
    import pyoxigraph
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from run_rules import load_rules, fingerprint

    store = pyoxigraph.Store()
    store.load(path=ONTOLOGY, format=pyoxigraph.RdfFormat.TURTLE)
    for path in paths:
        store.load(path=path, format=pyoxigraph.RdfFormat.TURTLE)

    # mirrors run_rules.py's loop: a pass that changes nothing is a fixpoint, and a pass that
    # returns the store to a state it has already been in is a contradiction between rules.
    # Counting triples is not enough - these rules DELETE the opposing flag before INSERT-ing
    # theirs, so a pass can flip a value while leaving the total unchanged.
    rules = load_rules()
    seen = {fingerprint(store)}
    converged = False
    for _ in range(MAX_PASSES):
        changed = 0
        for rule in rules:
            before = set(store)
            store.update(rule["text"])
            changed += len(set(store) ^ before)
        if not changed:
            converged = True
            break
        mark = fingerprint(store)
        if mark in seen:
            break
        seen.add(mark)

    # N-Triples, not Turtle, and the reason matters: pyoxigraph's Turtle writer emits
    # "0"^^xsd:nonNegativeInteger using Turtle's bare-number shorthand, as 0 - which re-parses
    # as xsd:integer. Handing that to pySHACL invents a datatype violation that is not in the
    # data. N-Triples has no shorthand, so every literal keeps its declared datatype.
    # from_graph is required either way: a Store is a dataset, and neither format carries one.
    buffer = io.BytesIO()
    store.dump(buffer, format=pyoxigraph.RdfFormat.N_TRIPLES,
               from_graph=pyoxigraph.DefaultGraph())
    return buffer.getvalue().decode("utf-8"), converged


def validate(data_source, is_text=False):
    """Run pySHACL and return the findings as sorted, counted report lines."""
    import rdflib
    from pyshacl import validate as pyshacl_validate

    data = rdflib.Graph()
    if is_text:
        data.parse(data=data_source, format="turtle")
    else:
        for path in data_source:
            data.parse(path, format="turtle")

    ontology = rdflib.Graph()
    ontology.parse(ONTOLOGY, format="turtle")
    shapes = rdflib.Graph()
    shapes.parse(SHAPES, format="turtle")

    _, results, _ = pyshacl_validate(
        data,
        shacl_graph=shapes,
        ont_graph=ontology,
        advanced=True,          # the SPARQL-based constraints (irreflexivity, cycles)
        inference="none",       # the SWRL rules are applied by materialise(), not here
        abort_on_first=False,
        allow_warnings=False,
    )

    SH = rdflib.Namespace("http://www.w3.org/ns/shacl#")
    lines = collections.Counter()
    for result in results.subjects(rdflib.RDF.type, SH.ValidationResult):
        severity = shorten(results.value(result, SH.resultSeverity)).replace("sh:", "")
        lines[(severity,
               shorten(results.value(result, SH.focusNode)),
               shorten(results.value(result, SH.resultPath)),
               shorten(results.value(result, SH.sourceShape)),
               shorten(results.value(result, SH.sourceConstraintComponent))
                   .replace("sh:", "").replace("ConstraintComponent", ""),
               shorten(results.value(result, SH.value)))] += 1

    report = []
    for fields, count in sorted(lines.items()):
        severity, focus, path, shape, component, value = fields
        prefix = f"{count}x " if count > 1 else ""
        report.append(f"{severity:<9} {prefix}{focus}  path={path}  "
                      f"shape={shape}  {component}  value={value}")
    return report


def render(authored, post_rules, converged):
    out = ["# Generated by tools/shacl_check.py. Do not edit by hand.",
           "#",
           "# The violations tools/testdata/ is known to produce. The last section of",
           "# example_case.ttl is deliberately malformed, so this is not expected to be empty -",
           "# it is expected not to change. A new line here is a regression; a line that",
           "# disappears is a fix, and both need the baseline rewritten deliberately.",
           "",
           f"## authored ({len(authored)} findings)",
           "## example_case.ttl as written",
           ""]
    out += authored or ["(none)"]
    out += ["",
            f"## post-rules ({len(post_rules)} findings)",
            "## example_case.ttl + rule_cases.ttl after queries/rules/ reaches a fixpoint",
            f"## rules converged: {'yes' if converged else 'NO'}",
            ""]
    out += post_rules or ["(none)"]
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-baseline", action="store_true",
                    help="record the current findings as the expected ones")
    ap.add_argument("--check", action="store_true",
                    help="compare against the baseline (the default)")
    ap.add_argument("-v", "--verbose", action="store_true", help="list every finding")
    args = ap.parse_args()

    try:
        import pyshacl  # noqa: F401
        import rdflib  # noqa: F401
    except ImportError:
        sys.exit("pyshacl is not installed - pip install -r tools/requirements.txt")

    print("validating example_case.ttl as authored ...")
    authored = validate([FIXTURE])
    print(f"  {len(authored)} finding(s)")

    print("applying queries/rules/ to a fixpoint and validating the result ...")
    materialised, converged = materialise([FIXTURE, RULE_FIXTURE])
    if not converged:
        print("  NOTE: the rule set did not converge; validating the state it stopped in")
    post_rules = validate(materialised, is_text=True)
    print(f"  {len(post_rules)} finding(s)")

    if args.verbose:
        for title, findings in (("authored", authored), ("post-rules", post_rules)):
            print(f"\n--- {title} ---")
            for line in findings:
                print(f"  {line}")

    current = render(authored, post_rules, converged)

    if args.write_baseline:
        with open(BASELINE, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(current)
        print(f"\nwrote {os.path.relpath(BASELINE, REPO)}")
        return

    if not os.path.exists(BASELINE):
        sys.exit(f"\nno baseline at {os.path.relpath(BASELINE, REPO)} - "
                 f"run with --write-baseline once and commit the result")

    with open(BASELINE, encoding="utf-8") as fh:
        expected = fh.read()
    if expected == current:
        print(f"\nSHACL findings match the baseline "
              f"({len(authored)} authored, {len(post_rules)} post-rules)")
        return

    import difflib
    print("\nSHACL findings differ from the baseline:\n")
    for line in difflib.unified_diff(expected.splitlines(), current.splitlines(),
                                     "baseline", "now", lineterm="", n=1):
        print(f"  {line}")
    sys.exit(1)


if __name__ == "__main__":
    main()
