# Maintenance tooling

Keeps the ontology, the shapes, the derived serializations and the provenance record
honest against each other.

```bash
pip install -r requirements.txt
python tools/check_all.py            # is everything current and consistent?
python tools/check_all.py --strict   # exit 1 if any derived file is out of date
```

## Automation

`.github/workflows/checks.yml` runs `check_all.py --strict` on every push to `main` and
every pull request. It verifies; it never regenerates. Regeneration stays a deliberate act
by a person, because a build that silently rewrites the ontology's derived files would hide
exactly the drift this is meant to surface.

A pre-commit hook catches the same thing before it is pushed. Enable it once per clone:

```bash
git config core.hooksPath tools/hooks
```

`core.hooksPath` points git at the versioned `tools/hooks/` rather than copying into
`.git/hooks/`, so everyone gets the same hook instead of a stale copy of it.

The hook runs `check_all.py --strict --staged`, which selects checks by what the commit
touches. The full run takes about 25 seconds, nearly all of it in `serializations/build.py`
re-serializing the ontology into two formats to compare them — fine in CI, far too slow for
a hook people would then disable. Editing a SHACL shape does not re-verify the RDF/XML, and
a commit touching no derived artefact costs about a quarter of a second.

`git commit --no-verify` bypasses it.

This is a build system, not a library. `nl.py` hardcodes 41 OntoGSN terms; `build_separated.py`
and `build_full.py` encode OntoGSN's section structure. None of it transfers to another
ontology without rewriting, which is why it lives here rather than in a repository of its
own — and why the provenance graph, whose `gsnprov:structuralKey` values these scripts
produce and re-derive, would become unverifiable if they were separated from it.

## What is maintained by hand, and what is generated

| Hand-maintained | |
| :--- | :--- |
| `serializations/ontogsn.ttl` | the ontology |
| `shapes/ontogsn-shapes_[1-5]*.ttl` | the five SHACL sections |
| `provenance/ontogsn-provenance.ttl` | the provenance vocabulary |
| `provenance/ontogsn-provenance-data.ttl` | **the design record** — ~36,000 words of quoted standard passages, rationale and prose that exist nowhere else |
| `queries/*.rq` | the stored CRUD queries, one per competency question |
| `queries/rules/*.rq` | the 51 SWRL rules as SPARQL updates |
| `tools/testdata/*.ttl` | the example ABox, and one trigger per rule |

| Generated | From | By |
| :--- | :--- | :--- |
| `serializations/ontogsn.{rdf,jsonld}` | `ontogsn.ttl` | `serializations/build.py` |
| `serializations/separated/*` (36 files) | `ontogsn.ttl` | `serializations/build_separated.py` |
| `shapes/ontogsn-shapes_0_full.ttl` | the five sections | `shapes/build_full.py` |
| `provenance/ontogsn-provenance-augmentations.ttl` | the repo | `tools/prov_augment.py` |
| `provenance/ontogsn-provenance-queries.ttl` | `queries/`, the ontology, the fixture | `tools/query_check.py` |
| `provenance/Design Documentation.xlsx` | the provenance graph | `tools/prov_to_workbook.py` |

Every generator has a `--check` mode. **Nothing runs them automatically** — no CI, no git
hooks. `check_all.py` is the one command to run before committing.

## The scripts

```
check_all.py       every check, one command
query_check.py     the stored queries vs an actual SPARQL engine
run_rules.py       apply queries/rules/ to a case until nothing more is derived
prov_check.py      the provenance record vs the ontology, the shapes and the queries
prov_add.py        draft a decision for an axiom nobody has documented
prov_retire.py     retire a decision, or bring it back
prov_augment.py    rebuild the requirements / questions / queries / build-chain graph
prov_to_workbook.py  rebuild the readable spreadsheet
prov_migrate.py    the one-off import from the old workbook. ALREADY RUN.
prov_ttl.py        deterministic Turtle writer (rdflib's ordering is not stable)
ttl_model.py       ontogsn.ttl -> a flat inventory of statements and rules
shapes_model.py    shapes/*.ttl -> a flat inventory of constraints
matching.py        normalisation, checksums, and which formalism a statement is in
nl.py              a statement -> an English sentence
past_tense.py      recasts a sentence as history, for a retired decision
workbook_io.py     one definition of the spreadsheet's columns and styling
```

## The working loop

**Added an axiom to `ontogsn.ttl`?**

```bash
python serializations/build.py            # refresh the derived formats
python serializations/build_separated.py  # refresh the 36 slices
python tools/prov_add.py                  # see what is undocumented
python tools/prov_add.py --write          # draft the decisions
```

`prov_add.py` computes everything computable — statement text, checksum, structural key,
section, formalism, and an English sentence from `nl.py`. It deliberately leaves
`prov:used` (which passage of the standard) and `gsnprov:hasRationale` (why) empty. Those
two are the reason the provenance graph exists, and inventing them would defeat it.

**Removed one?** Retire its decision rather than deleting it — the reasoning is still the
record of a real decision:

```bash
python tools/prov_retire.py dd-0680 --reason "..." --superseded-by dd-0646
```

**Changed one?** `prov_check.py` reports it three ways: `statement-unmatched` (the recorded
axiom is gone), `undocumented` (the new one has no decision), and `release-edited-in-place`
(the file's checksum moved while `owl:versionInfo` did not). Fix the record, then update
`gsnprov:fileChecksum` on the `gsnprov:FormalGraph` node, or bump the ontology version.

## Stored queries

`queries/` holds one SPARQL file per competency question; `queries/rules/` holds the 51
SWRL rules as SPARQL updates. Both are verified by executing them against
`serializations/ontogsn.ttl` and the fixtures in `tools/testdata/`, in Oxigraph:

```bash
python tools/query_check.py            # verify what changed, update the record
python tools/query_check.py --all      # re-verify everything
python tools/query_check.py --check    # CI: is the record current? executes nothing
python tools/query_check.py -v         # one line per query
```

It checks the header, the `gsn:` namespace, that every `gsn:` term named exists in the
ontology, and that the query does what its `expect:` line says when run.

`provenance/ontogsn-provenance-queries.ttl` records a `gsnprov:verificationKey` per query,
hashed over the query, the ontology, the fixtures and `CHECKER_VERSION`. Edit one query and
one query re-runs; edit the ontology and all of them do. `--check` only compares keys, so a
stale key means "not verified since it changed" — re-run without `--check` and commit the
record.

To apply the rules to a case:

```bash
python tools/run_rules.py mycase.ttl --out mycase-materialised.ttl
```

## How an axiom is identified, and why not the obvious way

A decision points at its axiom through `gsnprov:structuralKey` — the blank-node-free
`(subject, predicate, object)` key from `ttl_model.py` and `shapes_model.py`. The verbatim
Turtle is stored too, as `gsnprov:statementText` plus a checksum, but as *evidence*, never
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
