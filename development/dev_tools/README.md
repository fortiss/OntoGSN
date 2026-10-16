# Maintenance tooling

Keeps the ontology, the shapes, the derived serializations and the design record
honest against each other.

```bash
pip install -r development/dev_tools/requirements.txt -c development/dev_tools/constraints.txt
python development/dev_tools/check_all.py            # is everything current and consistent?
python development/dev_tools/check_all.py --strict   # exit 1 if any derived file is out of date
```

## Automation

`.github/workflows/checks.yml` runs `check_all.py --strict` on every push to `main` and
every pull request. It verifies; it never regenerates. Regeneration stays a deliberate act
by a person, because a build that silently rewrites the ontology's derived files would hide
exactly the drift this is meant to surface.

`.github/workflows/reports.yml` regenerates the reports that the website publishes about
the ontology. It runs when the ontology changes on `main`, and opens a pull request with the
new reports. A person merges it. See [The website reports](#the-website-reports).

A pre-commit hook catches the same thing before it is pushed. Enable it once per clone:

```bash
git config core.hooksPath development/dev_tools/hooks
```

`core.hooksPath` points git at the versioned `development/dev_tools/hooks/` rather than copying into
`.git/hooks/`, so everyone gets the same hook instead of a stale copy of it.

The hook runs `check_all.py --strict --staged`, which selects checks by what the commit
touches. The full run takes about 25 seconds, nearly all of it in `development/dev_tools/build.py`
re-serializing the ontology into two formats to compare them — fine in CI, far too slow for
a hook people would then disable. Editing a SHACL shape does not re-verify the RDF/XML, and
a commit touching no derived artefact costs about a quarter of a second.

`git commit --no-verify` bypasses it.

This is a build system, not a library. `nl.py` hardcodes 41 OntoGSN terms; `build_separated.py`
and `build_full.py` encode OntoGSN's section structure. None of it transfers to another
ontology without rewriting, which is why it lives here rather than in a repository of its
own — and why the design record, whose `gsndesign:structuralKey` values these scripts
produce and re-derive, would become unverifiable if they were separated from it.

## What is maintained by hand, and what is generated

| Hand-maintained | |
| :--- | :--- |
| `serializations/ontogsn.ttl` | the ontology |
| `shapes/ontogsn-shapes_[1-5]*.ttl` | the five SHACL sections |
| `development/design/ontogsn-design.ttl` | the design-record vocabulary |
| `development/design/ontogsn-design-data.ttl` | **the design record** — ~36,000 words of quoted standard passages, rationale and prose that exist nowhere else |
| `development/design/Competency Questions.xlsx` | the questions `queries/` and `augmentation/queries/` answer |
| `queries/*.rq` | the stored CRUD queries, one per competency question |
| `queries/rules/*.rq` | the 51 SWRL rules as SPARQL updates |
| `example/example_case.ttl` | the example ABox the queries and checks run against |
| `development/dev_tools/testdata/*.ttl` | one trigger per rule, and the recorded baselines |

| Generated | From | By |
| :--- | :--- | :--- |
| `serializations/ontogsn.{rdf,jsonld}` | `ontogsn.ttl` | `development/dev_tools/build.py` |
| `serializations/separated/*` (36 files) | `ontogsn.ttl` | `development/dev_tools/build_separated.py` |
| `shapes/ontogsn-shapes_0_full.ttl` | the five sections | `development/dev_tools/build_full.py` |
| `development/design/ontogsn-design-augmentations.ttl` | the repo, and the record it links into | `development/dev_tools/prov_augment.py` |
| `development/design/ontogsn-design-queries.ttl` | `queries/`, the ontology, the fixture | `development/dev_tools/query_check.py` |
| `development/design/Design Documentation.xlsx` | the design record | `development/dev_tools/prov_to_workbook.py` |
| `docs/documentation/` | `ontogsn.ttl` | WIDOCO, run by `development/dev_tools/reports.py` |
| `docs/evaluation/oops/` | `ontogsn.rdf` | OOPS!, run by `development/dev_tools/reports.py` |
| `docs/evaluation/foops/` | the published ontology | FOOPS!, run by `development/dev_tools/reports.py` |

Every generator has a `--check` mode. CI and the hook run those checks. They never run a
generator, with one exception: CI runs `reports.py` (see
[The website reports](#the-website-reports)). `check_all.py` is the one command to run
before committing.

## The scripts

```
check_all.py       every check, one command
query_check.py     the stored queries vs an actual SPARQL engine
example/run_rules.py   apply queries/rules/ to a case until nothing more is derived (user-facing, so it lives in example/)
shacl_check.py     the fixtures vs shapes/, before and after the rules run
reasoner_check.py  the ontology and the fixtures vs an OWL-DL reasoner (needs a JVM)
oops_check.py      the ontology vs the OOPS! pitfall scanner (needs the network)
reports.py         regenerate the WIDOCO, OOPS! and FOOPS! reports the website publishes
prov_check.py      the design record vs the ontology, the shapes and the queries
prov_add.py        draft a decision for an axiom nobody has documented
prov_retire.py     retire a decision, or bring it back
prov_augment.py    rebuild the requirements / questions / queries / build-chain graph
prov_to_workbook.py  rebuild the readable spreadsheet
prov_ttl.py        deterministic Turtle writer (rdflib's ordering is not stable)
ttl_model.py       ontogsn.ttl -> a flat inventory of statements and rules
shapes_model.py    shapes/*.ttl -> a flat inventory of constraints
matching.py        normalisation, checksums, structural keys, and which formalism a
                   statement is in
nl.py              a statement -> an English sentence
past_tense.py      recasts a sentence as history, for a retired decision
workbook_io.py     one definition of the spreadsheet's columns and styling
```

## The working loop

**Added an axiom to `ontogsn.ttl`?**

```bash
python development/dev_tools/build.py            # refresh the derived formats
python development/dev_tools/build_separated.py  # refresh the 36 slices
python development/dev_tools/prov_add.py                  # see what is undocumented
python development/dev_tools/prov_add.py --write          # draft the decisions
```

`prov_add.py` computes everything computable — statement text, checksum, structural key,
section, formalism, and an English sentence from `nl.py`. It deliberately leaves
`prov:used` (which passage of the standard) and `gsndesign:hasRationale` (why) empty. Those
two are the reason the design record exists, and inventing them would defeat it.

**Removed one?** Retire its decision rather than deleting it — the reasoning is still the
record of a real decision:

```bash
python development/dev_tools/prov_retire.py dd-0680 --reason "..." --superseded-by dd-0646
```

**Changed one?** `prov_check.py` reports it three ways: `statement-unmatched` (the recorded
axiom is gone), `undocumented` (the new one has no decision), and `release-edited-in-place`
(the file's checksum moved while `owl:versionInfo` did not). Fix the record, then update
`gsndesign:fileChecksum` on the `gsndesign:FormalGraph` node, or bump the ontology version.

## Stored queries

`queries/` holds one SPARQL file per competency question; `queries/rules/` holds the 51
SWRL rules as SPARQL updates. Both are verified by executing them against
`serializations/ontogsn.ttl` and the fixtures in `development/dev_tools/testdata/`, in Oxigraph:

```bash
python development/dev_tools/query_check.py            # verify what changed, update the record
python development/dev_tools/query_check.py --all      # re-verify everything
python development/dev_tools/query_check.py --check    # CI: is the record current? executes nothing
python development/dev_tools/query_check.py -v         # one line per query
```

It checks the header, the `gsn:` namespace, that every `gsn:` term named exists in the
ontology, and that the query does what its `expect:` line says when run.

`development/design/ontogsn-design-queries.ttl` records a `gsndesign:verificationKey` per query,
hashed over the query, the ontology, the fixtures and `CHECKER_VERSION`. Edit one query and
one query re-runs; edit the ontology and all of them do. `--check` only compares keys, so a
stale key means "not verified since it changed" — re-run without `--check` and commit the
record.

To apply the rules to a case:

```bash
python example/run_rules.py mycase.ttl --out mycase-materialised.ttl
```

## The two checks that leave the repository

Everything else here is pure Python over files in this repository. These two are not, and
both are recorded against a baseline rather than against zero findings — several of the
things they report are correct and deliberate, so the question is whether the answer
*changed*.

```bash
python development/dev_tools/reasoner_check.py            # is any of it inconsistent?
python development/dev_tools/oops_check.py                # what does OOPS! make of it?
python development/dev_tools/reasoner_check.py --check    # CI: exit 1 on any difference
python development/dev_tools/oops_check.py --write-baseline
```

| | `reasoner_check.py` | `oops_check.py` |
| :--- | :--- | :--- |
| Needs | a JVM on the `PATH`, and `owlready2`, which ships the Pellet it runs | `requests`, and `oops.linkeddata.es` to be up |
| Asks | is the ontology consistent, is any class unsatisfiable, does a real case still reason | does the pitfall scanner find anything new |
| Costs | about eleven seconds | one round trip |
| Baseline | `development/dev_tools/testdata/reasoner_baseline.txt` | `development/dev_tools/testdata/oops_baseline.txt` |
| When it cannot run | prints `SKIPPED`, exits 0 | prints `SKIPPED`, exits 0 |

Neither gates, and neither runs in the pre-commit hook. `check_all.py` runs both; an entry
marked `"in_hook": False` is skipped under `--staged`.

Two things are worth knowing before reading their output.

**One graph is meant to be inconsistent.** The tail of `example_case.ttl` is malformed on
purpose, and it closes a `gsn:supportedBy` cycle. That property is asymmetric and
irreflexive, so the cycle is an OWL contradiction rather than merely bad practice, and the
reasoner is right to reject it. `reasoner_check.py` therefore checks the file twice: cut at
the malformed banner, where the expectation is *consistent*, and whole, where it is
*inconsistent, for that reason*.

**Pellet does not run nine of the rules.** It has no `swrlx:makeOWLThing` builtin, so every
rule that mints an individual is dropped with a warning — `SupportRelationCreation`,
`ContextRelationCreation`, `ChallengeRelationCreation`, the four confidence-relation rules
and two others. Those are exactly the rules the SWRLAPI's Drools engine covered in Protégé,
and exactly the ones `queries/rules/` executes here. The baseline lists them so the gap is
visible; a rule joining or leaving that list is a finding about the rule set.

`oops_check.py` rewrites the ontology node as a typed `<owl:Ontology>` element before
submitting. rdflib writes it as an `<rdf:Description>` with an `rdf:type` child — the same
graph — which OOPS! does not recognise, and it then reports P39 (critical, "no ontology URI
declared") and P38 against an ontology that declares both. Fixing `development/dev_tools/build.py`
would work equally well and would change a published artefact, so the normalisation lives
in the check.

## The website reports

`reports.py` regenerates the three reports that the website publishes about the ontology.

| Report | Tool | Written to | Made from |
| :--- | :--- | :--- | :--- |
| Documentation | [WIDOCO](https://github.com/dgarijo/Widoco) 1.4.25 | `docs/documentation/` | `serializations/ontogsn.ttl` |
| Pitfall scan | [OOPS!](https://github.com/oeg-upm/OOPS) 0.3.0-SNAPSHOT | `docs/evaluation/oops/` | `serializations/ontogsn.rdf` |
| FAIR assessment | [FOOPS!](https://github.com/oeg-upm/fair_ontologies) 0.4.0 | `docs/evaluation/foops/` | the ontology at `https://w3id.org/OntoGSN/ontology` |

`.github/workflows/reports.yml` runs it when the ontology changes on `main`, and opens a
pull request with the result. To run it yourself, you need Java 17 or newer. OOPS! also
needs Maven, because it is built from source.

```bash
python development/dev_tools/reports.py --fetch          # regenerate every report that is stale
python development/dev_tools/reports.py --check          # exit 1 if a report is stale
python development/dev_tools/reports.py foops --force    # regenerate one report, even if it is current
```

`--fetch` gets a missing tool before it regenerates a report. It clones the tool next to
this repository, at the version that `reports.py` pins. For example, WIDOCO goes to
`../Widoco`. WIDOCO and FOOPS! run from the JAR of that release, which `--fetch` downloads
into the clone and verifies. OOPS! has no release JAR, so `--fetch` builds it in the clone
with Maven. Nothing is copied into this repository. `--tools-dir` puts the clones in a
different folder.

Each report folder has a `build.json` with the tool version and a checksum of the input. If
neither changed, the report is current, and `reports.py` does not regenerate it.

FOOPS! assesses the published ontology, which is the version on `main`. If the published
copy differs from your files, the run stops. `--wait SECONDS` waits for the published copy
to catch up. `--file` assesses your local `ontogsn.ttl` instead, with fewer checks.

To move to a newer version of a tool, change its entry in `TOOLS` in `reports.py`. The
next run with `--fetch` then regenerates every report that the tool makes. For a tool you
already cloned, check out the new version in the clone first.

## How an axiom is identified, and why not the obvious way

A decision points at its axiom through `gsndesign:structuralKey` — the blank-node-free
`(subject, predicate, object)` key from `ttl_model.py` and `shapes_model.py`. The verbatim
Turtle is stored too, as `gsndesign:statementText` plus a checksum, but as *evidence*, never
as identity.

Two approaches were rejected:

- **Quoting the triple** (RDF-star / `owl:Axiom` reification). Only ~62% of decisions are
  triple-shaped; 17% record a decision *not* to add anything, and ~20% are OWL restrictions
  or SWRL rules that are blank-node subgraphs. The ontology already shows the failure mode —
  its `owl:Axiom` blocks point at `owl:annotatedTarget _:genid83`, and blank-node ids are
  regenerated on every re-save.
- **Storing the verbatim RDF/XML** and diffing it. It was already stale: the design document
  still carried `http://www.semanticweb.org/momcilovic/ontologies/2024/1/gsn#` after the
  ontology moved to `https://w3id.org/OntoGSN/ontology#`, so every record would have failed.
  Serialized text also varies in whitespace, attribute order and nesting.

So axioms are compared **structurally** and rendered blank-node-free. Neither `ttl_model.py`
nor `shapes_model.py` ever emits a blank-node identifier, which is what lets a decision keep
pointing at the same axiom when a file is re-saved or reformatted.

## Two deliberate rules in `matching.py`

- **Ontology file metadata is out of scope.** Statements on the `owl:Ontology` node
  (`dc:modified`, `owl:versionInfo`, `schema:url`, …) are never reported as undocumented.
  They re-drift on every release, are recoverable from the ontology, and are not design
  decisions.
- **Several decisions may document one axiom, and several axioms may share a rendering.**
  A decision consumes an unclaimed statement before falling back to a claimed one, so
  `dc:description` and `schema:description` — which both render as
  `description a AnnotationProperty` — are each matched by their own record.
