# -*- coding: utf-8 -*-
"""Run every consistency check in the repository.

    python tools/check_all.py            # report
    python tools/check_all.py --strict   # exit 1 if any derived file is out of date

Nothing regenerates anything here. This answers one question: is what is committed
self-consistent? Three of the four checks are about derived files being current; the
fourth is about the provenance record still agreeing with the ontology.

The provenance report is never fatal on its own. It lists things a person has to judge -
an axiom nobody has documented, a sentence that needs rewriting - and a build should not
fail because a human decision is outstanding. Pass --strict-provenance when you want it to.
"""
import argparse
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CHECKS = [
    ("derived serializations", ["serializations/build.py", "--check"], True),
    ("separated serializations", ["serializations/build_separated.py", "--check"], True),
    ("full SHACL shapes file", ["shapes/build_full.py", "--check"], True),
    ("provenance record", ["tools/prov_check.py"], False),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 if any derived file is out of date")
    ap.add_argument("--strict-provenance", action="store_true",
                    help="also exit 1 when the provenance record needs attention")
    args = ap.parse_args()

    failures = []
    for name, command, gating in CHECKS:
        if args.strict_provenance and command[0].endswith("prov_check.py"):
            command = command + ["--strict"]
        print(f"\n{'=' * 72}\n  {name}\n{'=' * 72}")
        result = subprocess.run([sys.executable] + command, cwd=REPO)
        if result.returncode != 0:
            failures.append((name, gating or args.strict_provenance))

    print(f"\n{'=' * 72}")
    if not failures:
        print("  everything is current and consistent")
        return
    for name, gating in failures:
        print(f"  {'FAILED  ' if gating else 'needs a look: '}{name}")
    if args.strict and any(gating for _, gating in failures):
        sys.exit(1)


if __name__ == "__main__":
    main()
