# -*- coding: utf-8 -*-
"""Run every consistency check in the repository.

    python dev_tools/check_all.py                     # report
    python dev_tools/check_all.py --strict            # exit 1 if a derived file is stale
    python dev_tools/check_all.py --strict --staged   # only the checks the commit affects

Nothing regenerates anything here. This answers one question: is what is committed
self-consistent? Three of the seven checks are about derived files being current, one is
about every stored query having been verified against what is committed, one is about the
provenance record still agreeing with the ontology, and the last two ask an OWL-DL reasoner
and the OOPS! pitfall scanner what they make of the ontology as it now stands.

Only the first four gate. The provenance report lists things a person has to judge - an
axiom nobody has documented, a sentence that needs rewriting - and a build should not fail
because a human decision is outstanding; pass --strict-provenance when you want it to. The
reasoner and OOPS! checks compare against a recorded baseline, and both baselines contain
findings that are correct and deliberate, so a difference there is a prompt to look, not a
verdict. Both also depend on something outside this repository - a JVM, somebody else's
server - and report SKIPPED when it is missing.

--staged exists because the full run takes about 25 seconds, almost all of it in
serializations/build.py, which re-serializes the whole ontology to two formats to compare
them. That is fine in CI and far too slow for a pre-commit hook, so the hook checks only
what the commit touches: editing a shape does not require re-verifying the RDF/XML. The
reasoner and OOPS! checks never run in the hook at all - eleven seconds and a network round
trip are not what a commit should cost - which is what "in_hook" below says.
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
     "command": ["dev_tools/query_check.py", "--check"],
     "gating": True,
     "triggers": ("queries/", "dev_tools/testdata/", "dev_tools/query_check.py",
                  "serializations/ontogsn.ttl",
                  "provenance/ontogsn-provenance-queries.ttl")},
    {"name": "provenance record",
     "command": ["dev_tools/prov_check.py"],
     "gating": False,
     # the record describes the ontology, the shapes and the stored queries, so a change
     # to any of them can invalidate it
     # "provenance/" also covers 'Competency Questions.xlsx', which lives there and is
     # the input prov_augment.py reads
     "triggers": ("provenance/", "serializations/ontogsn.ttl", "shapes/",
                  "queries/")},
    # The two below reach outside Python: one wants a JVM, the other wants oops.linkeddata.es
    # to be up. Both report SKIPPED and exit 0 when what they need is absent, and neither
    # gates - an ontology is not broken because a machine has no Java or a service is down.
    # Both stay out of the pre-commit hook: eleven seconds and a network round trip are not
    # what a commit should cost.
    {"name": "OWL-DL consistency (Pellet)",
     "command": ["dev_tools/reasoner_check.py", "--check"],
     "gating": False,
     "in_hook": False,
     "triggers": ("serializations/ontogsn.ttl", "dev_tools/testdata/",
                  "dev_tools/reasoner_check.py")},
    {"name": "OOPS! pitfall scan",
     "command": ["dev_tools/oops_check.py", "--check"],
     "gating": False,
     "in_hook": False,
     "triggers": ("serializations/ontogsn.rdf", "dev_tools/oops_check.py")},
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
                  if c.get("in_hook", True) and any(p.startswith(c["triggers"]) for p in paths)]
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
