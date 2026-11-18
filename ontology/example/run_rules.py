# -*- coding: utf-8 -*-
"""Apply ontology/queries/rules/ to an assurance case until nothing more can be derived.

    python ontology/example/run_rules.py case.ttl --out case-materialised.ttl
    python ontology/example/run_rules.py case.ttl --dry-run          # what would each rule add?
    python ontology/example/run_rules.py case.ttl --only RL-GSN-assumption_invalidation,RL-GSN-defeated_invalidation
    python ontology/example/run_rules.py case.ttl --section "Dialectic Extension"

With no input file it runs over ontology/example/example_case.ttl and development/dev_tools/testdata/,
which is how the rule set is smoke-tested.

Each rule is one SPARQL update and derives one step. Running them once is not the same as
running a reasoner: a conclusion drawn by RL-GSN-defeated_invalidation may be the premise
that RL-GSN-mixed_support_invalidation needs. So the whole set is applied repeatedly until a
pass changes nothing.

That may not happen. Some rules disagree - RL-GSN-solution_propagation_true makes a claim
true because a solution supporting it is true, RL-GSN-solution_propagation_false makes it
false because another one is false - and on a case where both apply, each pass undoes the
last. A reasoner reports that as an inconsistency;
here it shows up as a loop, so the store is fingerprinted after every pass and a repeat is
reported as non-convergence, naming the rules still firing. That is a finding about the
case, not a bug in the driver: it means the case supports contradictory conclusions.
"""
import argparse
import csv
import glob
import hashlib
import io
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RULE_DIR = os.path.join(REPO, "ontology", "queries", "rules")
REGISTRY = os.path.join(REPO, "ontology", "queries", "registry.csv")
ONTOLOGY = os.path.join(REPO, "ontology", "serializations", "ontogsn.ttl")
EXAMPLE = os.path.join(REPO, "ontology", "example", "example_case.ttl")
TESTDATA = os.path.join(REPO, "development", "dev_tools", "testdata")

HEADER_RE = re.compile(r"(?m)^#\s+(name):\s+(.*)$")
SECTIONS = """
PREFIX gsn:  <https://w3id.org/OntoGSN/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX swrl: <http://www.w3.org/2003/11/swrl#>
SELECT ?name ?section WHERE { ?rule a swrl:Imp ; rdfs:label ?name ; gsn:coreOrExtension ?section }
"""


def rule_order():
    """A sort key: the column 'order' of the registry. The rules do not all reach the same
    result in every order, so they run in a fixed one. A file with no row comes last."""
    with open(REGISTRY, encoding="utf-8", newline="") as fh:
        order = {os.path.basename(row["file"]): int(row["order"])
                 for row in csv.DictReader(fh) if row["order"]}
    return lambda path: (order.get(os.path.basename(path), 10 ** 9), os.path.basename(path))


def load_rules(store):
    """Each rule file, with the section of the SWRL rule it translates.

    The file name is the ID of the rule, and '# name:' names its SWRL rule. The section is read from the
    ontology in the store, from the gsn:coreOrExtension of the SWRL rule with that name.
    """
    sections = {row["name"].value: row["section"].value for row in store.query(SECTIONS)}
    rules = []
    for path in sorted(glob.glob(os.path.join(RULE_DIR, "*.rq")), key=rule_order()):
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        header = {k.lower(): v.strip() for k, v in HEADER_RE.findall(text)}
        name = header.get("name", "")
        rules.append({"path": path,
                      "id": os.path.basename(path)[:-3],
                      "name": name,
                      "section": sections.get(name, ""),
                      "text": text})
    return rules


def fingerprint(store):
    """Order-independent hash of the store's contents."""
    digest = hashlib.sha256()
    for line in sorted(str(quad) for quad in store):
        digest.update(line.encode("utf-8"))
    return digest.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="*", help="Turtle files holding the case (ABox)")
    ap.add_argument("--out", help="write the materialised graph here")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what one pass would derive; change nothing")
    ap.add_argument("--only", help="comma-separated rule IDs, e.g. RL-GSN-assumption_invalidation")
    ap.add_argument("--section", help="only rules from this GSN section")
    ap.add_argument("--max-passes", type=int, default=20)
    ap.add_argument("--quiet", "-q", action="store_true", help="totals only")
    args = ap.parse_args()

    try:
        import pyoxigraph
    except ImportError:
        sys.exit("pyoxigraph is not installed - pip install -r development/dev_tools/requirements.txt")

    inputs = args.inputs or [EXAMPLE] + sorted(glob.glob(os.path.join(TESTDATA, "*.ttl")))
    if not inputs:
        sys.exit("no input files")

    store = pyoxigraph.Store()
    store.load(path=ONTOLOGY, format=pyoxigraph.RdfFormat.TURTLE)

    rules = load_rules(store)
    if args.only:
        wanted = {r.strip().upper() for r in args.only.split(",")}
        rules = [r for r in rules if r["id"].upper() in wanted]
    if args.section:
        rules = [r for r in rules if r["section"] == args.section]
    if not rules:
        sys.exit("no rules selected")

    for path in inputs:
        store.load(path=path, format=pyoxigraph.RdfFormat.TURTLE)
    start = len(store)
    print(f"{len(rules)} rules over {len(inputs)} file(s), {start:,} triples loaded\n")

    if args.dry_run:
        # each rule against the original store, so the report is per rule rather than
        # per rule-after-everything-before-it
        for rule in rules:
            probe = pyoxigraph.Store()
            for quad in store:
                probe.add(quad)
            before = set(probe)
            probe.update(rule["text"])
            added, removed = len(set(probe) - before), len(before - set(probe))
            if added or removed or not args.quiet:
                print(f"  {rule['id']:<54} +{added} -{removed}")
        return

    seen = {fingerprint(store)}
    fired = {}
    for pass_number in range(1, args.max_passes + 1):
        changed = 0
        this_pass = []
        for rule in rules:
            before = set(store)
            store.update(rule["text"])
            delta = len(set(store) ^ before)
            if delta:
                changed += delta
                fired[rule["id"]] = fired.get(rule["id"], 0) + 1
                this_pass.append(rule["id"])
        if not args.quiet:
            print(f"  pass {pass_number}: {changed:>5} triples changed by "
                  f"{len(this_pass)} rule(s)  {' '.join(this_pass[:12])}"
                  f"{' ...' if len(this_pass) > 12 else ''}")
        if not changed:
            print(f"\nreached a fixpoint after {pass_number} pass(es)")
            break
        mark = fingerprint(store)
        if mark in seen:
            print(f"\nDID NOT CONVERGE: pass {pass_number} returned the store to a state "
                  f"it was already in.\nThe rules still firing contradict each other on "
                  f"this case: {' '.join(this_pass)}\nInspect those claims before trusting "
                  f"anything derived here.")
            break
        seen.add(mark)
    else:
        print(f"\nDID NOT CONVERGE within {args.max_passes} passes")

    print(f"\n{len(fired)} of {len(rules)} rules fired; "
          f"{start:,} -> {len(store):,} triples")
    if not args.quiet and fired:
        for rule in rules:
            if rule["id"] in fired:
                print(f"  {rule['id']:<54} fired in {fired[rule['id']]} pass(es)")

    if args.out:
        with io.open(args.out, "wb") as fh:
            # from_graph is required: a Store is a dataset, and Turtle cannot carry one
            store.dump(fh, format=pyoxigraph.RdfFormat.TURTLE,
                       from_graph=pyoxigraph.DefaultGraph())
        print(f"\nwrote {args.out}")


if __name__ == "__main__":
    main()
