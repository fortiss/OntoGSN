# -*- coding: utf-8 -*-
"""Run every consistency check in the repository.

    python tools/check_all.py                     # report
    python tools/check_all.py --strict            # exit 1 if a derived file is stale
    python tools/check_all.py --strict --staged   # only the checks the commit affects

Nothing regenerates anything here. This answers one question: is what is committed
self-consistent? Three of the five checks are about derived files being current, one is
about every stored query having been verified against what is committed, and the last is
about the provenance record still agreeing with the ontology.

The provenance report is never fatal on its own. It lists things a person has to judge -
an axiom nobody has documented, a sentence that needs rewriting - and a build should not
fail because a human decision is outstanding. Pass --strict-provenance when you want it to.

--staged exists because the full run takes about 25 seconds, almost all of it in
serializations/build.py, which re-serializes the whole ontology to two formats to compare
them. That is fine in CI and far too slow for a pre-commit hook, so the hook checks only
what the commit touches: editing a shape does not require re-verifying the RDF/XML.
"""
import argparse
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# a check runs under --staged when a staged path starts with one of its triggers
CHECKS = [
    {"name": "derived serializations",
     "command": ["serializations/build.py", "--check"],
     "gating": True,
     "triggers": ("serializations/ontogsn.ttl", "serializations/ontogsn.rdf",
                  "serializations/ontogsn.jsonld", "serializations/build.py")},
    {"name": "separated serializations",
     "command": ["serializations/build_separated.py", "--check"],
     "gating": True,
     "triggers": ("serializations/ontogsn.ttl", "serializations/separated/",
                  "serializations/build_separated.py")},
    {"name": "full SHACL shapes file",
     "command": ["shapes/build_full.py", "--check"],
     "gating": True,
     "triggers": ("shapes/",)},
    # Executes nothing: it recomputes each query's verification key and compares it with
    # provenance/ontogsn-provenance-queries.ttl. A stale key means a query nobody has
    # re-run since it, the ontology or the fixture changed - so it gates, and the fix is
    # to run the script without --check and commit the record it writes.
    {"name": "stored queries verified",
     "command": ["tools/query_check.py", "--check"],
     "gating": True,
     "triggers": ("queries/", "tools/testdata/", "tools/query_check.py",
                  "serializations/ontogsn.ttl",
                  "provenance/ontogsn-provenance-queries.ttl")},
    {"name": "provenance record",
     "command": ["tools/prov_check.py"],
     "gating": False,
     # the record describes the ontology, the shapes and the stored queries, so a change
     # to any of them can invalidate it
     "triggers": ("provenance/", "serializations/ontogsn.ttl", "shapes/",
                  "queries/", "OntoGSN Competency Questions.xlsx")},
]


def staged_paths():
    result = subprocess.run(["git", "diff", "--cached", "--name-only"],
                            cwd=REPO, capture_output=True, text=True)
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 if any derived file is out of date")
    ap.add_argument("--strict-provenance", action="store_true",
                    help="also exit 1 when the provenance record needs attention")
    ap.add_argument("--staged", action="store_true",
                    help="only run the checks affected by the staged changes")
    args = ap.parse_args()

    checks = CHECKS
    if args.staged:
        paths = staged_paths()
        checks = [c for c in CHECKS
                  if any(p.startswith(c["triggers"]) for p in paths)]
        if not checks:
            print(f"{len(paths)} staged file(s), none affecting a derived artefact")
            return

    failures = []
    for check in checks:
        command = list(check["command"])
        if args.strict_provenance and command[0].endswith("prov_check.py"):
            command.append("--strict")
        print(f"\n{'=' * 72}\n  {check['name']}\n{'=' * 72}")
        result = subprocess.run([sys.executable] + command, cwd=REPO)
        if result.returncode != 0:
            failures.append((check["name"],
                             check["gating"] or args.strict_provenance))

    print(f"\n{'=' * 72}")
    if not failures:
        print(f"  {len(checks)} check(s) passed - everything is current and consistent")
        return
    for name, gating in failures:
        print(f"  {'FAILED  ' if gating else 'needs a look:  '}{name}")
    if args.strict and any(gating for _, gating in failures):
        sys.exit(1)


if __name__ == "__main__":
    main()
