# Contributing

Thank you for taking an interest in OntoGSN. This repository holds the core ontology in Turtle (TTL) format, and the tooling needed for automatically deriving other serializations (JSON-LD, RDF/XML) and versions (separated by section, and `pruned` and `skeletal` versions).

All contributions need to have an issue and a corresponding pull request (PR). 

We welcome the following contributions, ordered by priority:
1. Case-based augmentations and extensions of OntoGSN;
2. Non-normative augmentations and extensions from the GSN community papers;
3. Alignments with external ontologies and other assurance case standards;
4. Improvements or comments with respect to the interpretation of the GSN standard (v3) in OntoGSN. 

Any modifications to the URLs (e.g., W3ID permalink), the website (`./docs`), existing provenance information (`./provenance`) or the auto-generated files (e.g., `.jsonld`, `.rdf`) in underived ways, will be rejected.

## Setup

- **Prerequisite**: Install Python 3.12+
- Install the requirements: `pip install -r tools/requirements.txt -c tools/constraints.txt`
- Enable the pre-commit checks: `git config core.hooksPath tools/hooks`

Note: The pre-commit hook ensures that any change is also propagated to the derived files, by refusing commits where the derivations deviate. It runs only the checks your commit affects, so it usually costs a second or two. `git commit --no-verify` bypasses it.

## Augmenting the ontology

If you wish to add an augmentation to OntoGSN, please create a separate ontology under `./augmentations`. Make sure that the ontology imports OntoGSN and links to it.

## Adding or changing an axiom

The `serializations/ontogsn.ttl` is the core file containing the axioms. Every axiom in the ontology has a design decision recorded against it: which passage of the GSN Community Standard v3 it came from, and why it is interpreted in such a way in OntoGSN. Before making a change to any axiom, please review its provenance documentation. 

If you are adding an axiom, add the reasoning using `python tools/prov_add.py --write`. If you are modifying an existing axiom, add your comment to the design decision. If you are *removing* an axiom, retire its decision rather than deleting it.

## Run checks

```bash
python tools/check_all.py
```

Local checks ensure that everything is current and consistent: derived serializations, the full SHACL shapes file, the stored queries, and the provenance record. CI runs the same thing with `--strict` on every push and pull request; if it passes locally, it will pass there.

## How to generate derivations

| If you change... | ...regenerate with |
| :--- | :--- |
| `serializations/ontogsn.ttl` | `serializations/build.py` and `serializations/build_separated.py` |
| any of `shapes/ontogsn-shapes_[1-5]*.ttl` | `shapes/build_full.py` |
| anything in `queries/` | `tools/query_check.py` |
| `provenance/ontogsn-provenance-data.ttl` or `provenance/Competency Questions.xlsx` | `tools/prov_augment.py` |

Commit the regenerated files alongside your change. Never hand-edit a generated file.

## The website

[`docs/`](docs/) is the source of <https://fortiss.github.io/OntoGSN/>, hosted on Github Pages. Note: `docs/` is required by GitHub.

## Licensing

By contributing you agree that your contribution is licensed on the same terms as the rest of the repository: [CC BY 4.0](LICENSE) for the ontology, shapes, queries and provenance record, and [Apache 2.0](tools/LICENSE-CODE) for the Python. The Apache licence covers every script in the repository, not only the ones under `tools/` — `serializations/build.py`, `serializations/build_separated.py` and `shapes/build_full.py` are the same tooling, kept next to the files they generate.
