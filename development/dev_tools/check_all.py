# -*- coding: utf-8 -*-
"""Run every consistency check in the repository.

    python development/dev_tools/check_all.py                     # report
    python development/dev_tools/check_all.py --strict            # exit 1 if a derived file is stale
    python development/dev_tools/check_all.py --strict --staged   # only the checks the commit affects
    python development/dev_tools/check_all.py --fix               # regenerate the derived files, then check

Without --fix, nothing regenerates anything here. This answers one question: is what is
committed self-consistent? Three of the ten checks are about derived files being current, one is
about every stored query having been verified against what is committed, one is about
every file stating the same version and the same number of rules, one is about the
design record still agreeing with the ontology, one is about the generated part of the
design record being current, one is about the Graffoo diagrams still drawing the
ontologies, and the last two ask an OWL-DL reasoner and the OOPS! pitfall scanner what
they make of the ontology as it now stands.

Only the first five gate. The design-record report lists things a person has to judge - an
axiom nobody has documented, a sentence that needs rewriting - and a build should not fail
because a human decision is outstanding; pass --strict-design when you want it to. The
generated part of the record, ontogsn-design-augmentations.ttl, is rebuilt by
prov_augment.py, and a stale copy is reported but does not gate, like the record itself. A
diagram difference is the same kind of thing: somebody has to redraw a page. The
reasoner and OOPS! checks compare against a recorded baseline, and both baselines contain
findings that are correct and deliberate, so a difference there is a prompt to look, not a
verdict. Both also depend on something outside this repository - a JVM, somebody else's
server - and report SKIPPED when it is missing.

--staged exists because the full run takes about 25 seconds, almost all of it in
development/dev_tools/build.py, which re-serializes the whole ontology to two formats to compare
them. That is fine in CI and far too slow for a pre-commit hook, so the hook checks only
what the commit touches: editing a shape does not require re-verifying the RDF/XML. The
reasoner and OOPS! checks never run in the hook at all - eleven seconds and a network round
trip are not what a commit should cost - which is what "in_hook" below says.

--fix runs the three generators before the checks: build.py, build_separated.py and
build_full.py. Each one writes only the files that changed and refuses to write a file that
does not say what its source says. A person still starts it, and a person still stages the
result. CI never passes --fix. It does not run query_check.py, because that script executes
the stored queries and is a verification, not a build.
"""
import argparse
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# a check runs under --staged when a staged path starts with one of its triggers
CHECKS = [
    {"name": "derived serializations",
     "command": ["development/dev_tools/build.py", "--check"],
     "fix": ["development/dev_tools/build.py"],
     "gating": True,
     "triggers": ("ontology/serializations/ontogsn.ttl", "ontology/serializations/ontogsn.rdf",
                  "ontology/serializations/ontogsn.jsonld", "development/dev_tools/build.py")},
    {"name": "separated serializations",
     "command": ["development/dev_tools/build_separated.py", "--check"],
     "fix": ["development/dev_tools/build_separated.py"],
     "gating": True,
     "triggers": ("ontology/serializations/ontogsn.ttl", "ontology/serializations/separated/",
                  "development/dev_tools/build_separated.py")},
    {"name": "full SHACL shapes file",
     "command": ["development/dev_tools/build_full.py", "--check"],
     "fix": ["development/dev_tools/build_full.py"],
     "gating": True,
     "triggers": ("ontology/shapes/", "development/dev_tools/build_full.py")},
    # Executes nothing: it recomputes each query's verification key and compares it with
    # development/design/ontogsn-design-queries.ttl. A stale key means a query nobody has
    # re-run since it, the ontology or the fixture changed - so it gates, and the fix is
    # to run the script without --check and commit the record it writes.
    {"name": "stored queries verified",
     "command": ["development/dev_tools/query_check.py", "--check"],
     "gating": True,
     # It also fails on a comment in any SPARQL file, because the comments of the queries
     # are in QUERY-COMMENTS.md, and it reads the header fields from there.
     "triggers": ("ontology/queries/", "ontology/example/", "development/dev_tools/testdata/", "development/dev_tools/query_check.py",
                  "ontology/serializations/ontogsn.ttl",
                  "development/design/ontogsn-design-queries.ttl",
                  "QUERY-COMMENTS.md", "augmentation/queries/", "augmentation/rules/",
                  "augmentation/derivations/", "docs/assets/data/queries/")},
    # Reads header lines only, so it costs a fraction of a second. It gates because a
    # version that two files state differently is a mistake, not a judgement.
    {"name": "version fields and rule counts agree",
     "command": ["development/dev_tools/release_check.py", "--check"],
     "gating": True,
     "triggers": ("ontology/serializations/ontogsn.ttl", "ontology/shapes/",
                  "ontology/queries/rules/", "augmentation/ontogsn-augmentation.ttl",
                  "augmentation/shapes/", "augmentation/README.md", "alignments/",
                  "development/design/", "CITATION.cff", "CHANGELOG.md", "README.md",
                  "docs/_pages/", "docs/index.html", "docs/evaluation/index.md",
                  "ontology/queries/README.md", "ontology/serializations/separated/README.md",
                  "development/dev_tools/README.md",
                  "development/dev_tools/release_check.py")},
    {"name": "design record",
     "command": ["development/dev_tools/prov_check.py"],
     "gating": False,
     # the record describes the ontology, the shapes and the stored queries, so a change
     # to any of them can invalidate it
     # "development/design/" also covers 'Competency Questions.xlsx', which lives there and is
     # the input prov_augment.py reads
     "triggers": ("development/design/", "ontology/serializations/ontogsn.ttl", "ontology/shapes/",
                  "ontology/queries/")},
    # Rebuilds ontogsn-design-augmentations.ttl in a temporary folder and compares it with
    # the committed file. It writes nothing. A stale file means that a query, a
    # serialization or the record changed and nobody ran prov_augment.py afterwards.
    {"name": "generated design record",
     "command": ["development/dev_tools/prov_augment.py", "--check"],
     "gating": False,
     "triggers": ("development/design/", "ontology/serializations/", "ontology/shapes/",
                  "ontology/queries/", "augmentation/queries/", "augmentation/rules/",
                  "augmentation/derivations/", "development/dev_tools/prov_augment.py")},
    # The diagrams are drawn by hand, so a difference is a drawing job for a person, not a
    # broken build. It reads the drawio file and the ontologies, nothing else.
    {"name": "Graffoo diagrams",
     "command": ["development/dev_tools/graffoo_check.py", "--check"],
     "gating": False,
     "triggers": ("development/design/Graffoo Diagram.drawio", "ontology/serializations/ontogsn.ttl",
                  "alignments/ontogsn-align.ttl", "augmentation/ontogsn-augmentation.ttl",
                  "development/design/ontogsn-design.ttl", "development/dev_tools/graffoo_check.py")},
    # The two below reach outside Python: one wants a JVM, the other wants oops.linkeddata.es
    # to be up. Both report SKIPPED and exit 0 when what they need is absent, and neither
    # gates - an ontology is not broken because a machine has no Java or a service is down.
    # Both stay out of the pre-commit hook: eleven seconds and a network round trip are not
    # what a commit should cost.
    {"name": "OWL-DL consistency (Pellet)",
     "command": ["development/dev_tools/reasoner_check.py", "--check"],
     "gating": False,
     "in_hook": False,
     "triggers": ("ontology/serializations/ontogsn.ttl", "ontology/example/", "development/dev_tools/testdata/",
                  "development/dev_tools/reasoner_check.py")},
    {"name": "OOPS! pitfall scan",
     "command": ["development/dev_tools/oops_check.py", "--check"],
     "gating": False,
     "in_hook": False,
     "triggers": ("ontology/serializations/ontogsn.rdf", "development/dev_tools/oops_check.py")},
]


def staged_paths():
    result = subprocess.run(["git", "diff", "--cached", "--name-only"],
                            cwd=REPO, capture_output=True, text=True)
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 if any derived file is out of date")
    ap.add_argument("--strict-design", action="store_true",
                    help="also exit 1 when the design record needs attention")
    ap.add_argument("--staged", action="store_true",
                    help="only run the checks affected by the staged changes")
    ap.add_argument("--fix", action="store_true",
                    help="regenerate the derived files first: build.py, "
                         "build_separated.py and build_full.py")
    args = ap.parse_args()

    checks = CHECKS
    if args.staged:
        paths = staged_paths()
        checks = [c for c in CHECKS
                  if c.get("in_hook", True) and any(p.startswith(c["triggers"]) for p in paths)]
        if not checks:
            print(f"{len(paths)} staged file(s), none affecting a derived artefact")
            return

    if args.fix:
        for check in checks:
            if "fix" not in check:
                continue
            print(f"\n{'=' * 72}\n  regenerate: {check['name']}\n{'=' * 72}")
            result = subprocess.run([sys.executable] + check["fix"], cwd=REPO)
            if result.returncode != 0:
                # a generator that refuses to write has found a real problem in its source
                sys.exit(f"\n{check['fix'][0]} failed - nothing was checked")

    failures, stale = [], False
    for check in checks:
        command = list(check["command"])
        if args.strict_design and command[0].endswith("prov_check.py"):
            command.append("--strict")
        print(f"\n{'=' * 72}\n  {check['name']}\n{'=' * 72}")
        result = subprocess.run([sys.executable] + command, cwd=REPO)
        if result.returncode != 0:
            failures.append((check["name"],
                             check["gating"] or args.strict_design))
            stale = stale or "fix" in check

    print(f"\n{'=' * 72}")
    if args.fix:
        print("  --fix ran the generators. Stage any file that they rewrote.")
    if not failures:
        print(f"  {len(checks)} check(s) passed - everything is current and consistent")
        return
    for name, gating in failures:
        print(f"  {'FAILED  ' if gating else 'needs a look:  '}{name}")
    if stale and not args.fix:
        print("  To regenerate the derived files, run:\n"
              "      python development/dev_tools/check_all.py --fix")
    if args.strict and any(gating for _, gating in failures):
        sys.exit(1)


if __name__ == "__main__":
    main()
