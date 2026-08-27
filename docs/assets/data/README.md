# Application Data

This directory contains the data assets for the OntoGSN frontend application (the
Playground). It includes the ontologies that define the data models, the SPARQL queries used
to interact with the triplestore, and supporting markdown documents.

## File Tree

```
/assets/data/
├── README.md
├── report.md
├── welcome.md
├── code_example.py
├── asce.ttl
├── asce_ontogsn_mapping.ttl
├── kettle.axml
├── ontologies/
│   ├── README.md
│   ├── car_assurance.ttl
│   ├── car.ttl
│   ├── defence_in_depth.ttl
│   ├── example_ac.ttl
│   ├── example_python_code.ttl
│   ├── harmbench_targets_text.ttl
│   └── ontogsn_lite.ttl
└── queries/
    └── README.md, plus the *.sparql files the Playground buttons run
```

## The ASCE files

`asce.ttl`, `asce_ontogsn_mapping.ttl` and `kettle.axml` belong to the Playground's
**Converter** tab, which turns an ASCE `.axml` export into a Turtle ABox
(`/assets/js/converter.js`):

| File | Role |
| :--- | :--- |
| `asce.ttl` | a vocabulary for the ASCE file format itself — networks, nodes, links, layout. Each term carries a `schema:identifier` naming the AXML attribute it comes from |
| `asce_ontogsn_mapping.ttl` | maps that vocabulary onto OntoGSN: ASCE node/link type codes to `gsn:Goal`, `gsn:supportedBy`, etc. |
| `kettle.axml` | a sample ASCE export to try the converter on |

These are **demo assets, not published artefacts**. They exist to serve the Converter tab,
are minted under the page's own namespace (`https://fortiss.github.io/OntoGSN/ontology/asce#`)
rather than a `w3id.org` IRI, and are not held to the standard of `alignments/` — no
provenance record, no vendored upstream, no versioning discipline. A maintained alignment to
another argument ontology looks like `alignments/` at the repository root; this is not that.
References to OntoGSN terms use the canonical `https://w3id.org/OntoGSN/ontology#` namespace.
