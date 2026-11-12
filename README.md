# OntoGSN Ontology

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![Format: RDF/XML](https://img.shields.io/badge/Format-RDF%2FXML-blue.svg)](https://raw.githubusercontent.com/fortiss/OntoGSN/main/ontology/serializations/ontogsn.rdf)
[![Format: TTL](https://img.shields.io/badge/Format-Turtle-blue.svg)](https://raw.githubusercontent.com/fortiss/OntoGSN/main/ontology/serializations/ontogsn.ttl)
[![Format: JSON-LD](https://img.shields.io/badge/Format-JSON--LD-blue.svg)](https://raw.githubusercontent.com/fortiss/OntoGSN/main/ontology/serializations/ontogsn.jsonld)

- **Workbench**: https://github.com/fortiss/ontogsn_workbench
- **Website**: https://fortiss.github.io/OntoGSN/
- **Playground**: https://fortiss.github.io/OntoGSN/playground
- **Documentation** (WIDOCO): https://fortiss.github.io/OntoGSN/documentation/
- **Evaluation** (OOPS! and FOOPS!): https://fortiss.github.io/OntoGSN/evaluation/

## Introduction
This repository contains the OntoGSN ontology for managing and extending GSN assurance cases *semantically*. It also contains the SHACL shapes, the SPARQL queries and rules, an augmentation, an alignment, the design record, and the code for the website.

The advantages of adding semantics - and the support of Semantic Web technologies - to assurance cases include: 1) storing and querying graph data in a structure made for that purpose; 2) representing the domain or world in human-readable visualizable format; 3) integrating references to data, documents or code easily and in the same store; 4) automating rules and verification of quality with logic-based reasoners; 5) providing the basis for more advanced methods and extensions (e.g., GraphRAG); 6) making use of a vibrant community and (mostly) free and open-source tools.

OntoGSN was first built in the Stanford Protégé (v5.6.3) ontology editor, and follows the Web Ontology Language (OWL 2) standard. The ontology closely follows the Goal Structuring Notation Community Standard v3.

## Acknowledgements
Many thanks to: 
- Ingmar Kessler, Jule Hendricks, Prof. Barbara Gallina and Dian Balta for contributions to the ontology and the paper;
- Yannick Landeck, Radouane Bouchekir, Tewodros Beyene, Carmen Carlan, and Laure Millet for reviewing various iterations of work;
- Will Franks (Adelard / NCC Group) and Ewen Denney (NASA Ames) for providing access to the tools of their respective organizations.

See our website for more information: https://fortiss.github.io/OntoGSN/

## Serializations
`ontology/serializations/ontogsn.ttl` is the full ontology. The RDF/XML and JSON-LD serializations are generated from the TTL file:

```bash
python development/dev_tools/build.py
```

`ontology/serializations/separated/` holds the ontology cut by GSN section (`core`, `pattern`,
`modular`, `confidence`, `dialectic`) and by scope (`complete` with the SWRL rules,
`pruned` without them, `skeletal` without the prose either). Those 36 files are generated too.

## Queries

`ontology/queries/` holds 43 CRUD SPARQL queries — one per competency question, covering all five
GSN sections — and `ontology/queries/rules/` holds all 58 SWRL rules as SPARQL updates, for stores
with no reasoner attached. Each query runs as-is against the example ABox in
`ontology/example/example_case.ttl`, and is parameterised by element identifier so it can be pointed at a
real case without editing a namespace into it.

```bash
python development/dev_tools/query_check.py                                   # verify every query executes
python ontology/example/run_rules.py mycase.ttl --out mycase-derived.ttl # apply the rules to a case
```

See [`ontology/queries/README.md`](ontology/queries/README.md).

## Shapes, augmentation and alignment

| Folder | Contents | Read more |
| :--- | :--- | :--- |
| `ontology/shapes/` | SHACL shapes that validate the data of an assurance case against the ontology. One file for each GSN section, and one file with all of them. | [`ontology/shapes/README.md`](ontology/shapes/README.md) |
| `augmentation/` | Terms that link a case to the things that GSN does not model: people and roles, the tool that produced a piece of evidence, review issues, and regulatory requirements. It has its own shapes, rules and queries. | [`augmentation/README.md`](augmentation/README.md), [`augmentation/HOW-TO.md`](augmentation/HOW-TO.md) |
| `alignments/` | A mapping from OntoGSN to the Arguments Ontology (ARGO). | [`alignments/README.md`](alignments/README.md) |
| `development/` | The design record, which gives the reason for each axiom, shape, rule and query, and the checks and build scripts. | [`development/README.md`](development/README.md) |

## Dependencies
To remain lightweight, OntoGSN does not import ontologies. It reuses `schema:identifier` and `schema:description` from Schema.org, and annotation terms from the Resource Description Framework Schema (RDFS) and the Simple Knowledge Organization System (SKOS). The header of the ontology also uses terms from Dublin Core, the Bibliographic Ontology (BIBO), VANN and Creative Commons for its metadata. Reasoning is based on the Semantic Web Rule Language (SWRL) rules and OWL axioms, which can be executed with supported rule engines (e.g., Pellet or Drools). The same rules exist as SPARQL updates in `ontology/queries/rules/`, for stores with no reasoner.

## How to use
[`QUICK-START.md`](QUICK-START.md) has the steps: set up, write a case, apply the rules, validate the case and ask questions. The [Tutorial](https://fortiss.github.io/OntoGSN/tutorial/) on the website does the same steps with a full example and its output.

## Documentation and evaluation

| Report | Tool | Link |
| :--- | :--- | :--- |
| Reference documentation of every class and property | [WIDOCO](https://github.com/dgarijo/Widoco) | https://fortiss.github.io/OntoGSN/documentation/ |
| Pitfalls in the ontology | [OOPS!](https://oops.linkeddata.es/) | https://fortiss.github.io/OntoGSN/evaluation/ |
| FAIR score of the ontology | [FOOPS!](https://foops.linkeddata.es/) | https://fortiss.github.io/OntoGSN/evaluation/ |

## How to cite
If you use OntoGSN, please cite the paper:

> T. Bueno Momčilović, B. Gallina, I. Kessler, J. Hendricks and D. Balta, "OntoGSN: An Ontology-Based Framework for Semantic Management and Extension of Assurance Cases", arXiv:2506.11023, 2025. https://arxiv.org/abs/2506.11023

To cite the ontology itself, use the Zenodo DOI [10.5281/zenodo.17808330](https://doi.org/10.5281/zenodo.17808330). [`CITATION.cff`](CITATION.cff) has both citations in a machine-readable form.

## License
The ontology and the other artefacts are under [CC BY 4.0](LICENSE). The Python code is under [Apache 2.0](development/dev_tools/LICENSE-CODE). `docs/LICENSE` is the license of the Jekyll theme of the website.

## Contributing
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the kinds of contribution that are welcome, the setup and the checks to run before a pull request.
