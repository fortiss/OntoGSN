# OntoGSN Playground

This folder is the Playground of the OntoGSN website. It is a copy of the
[OntoGSN Workbench](https://github.com/Tomas-Bueno-Momcilovic/ontogsn_workbench) without its
experimental panes. `VENDOR.json` names the commit of the Workbench that the copy comes from.

Do not edit a copied file here. Change the Workbench, then run the sync script:

```bash
python development/dev_tools/playground_sync.py --workbench <path of the Workbench> --commit <rev>
```

The section "The Playground" in
[`development/dev_tools/README.md`](../../development/dev_tools/README.md) describes the
script and its check.

## What differs from the Workbench

| File | Difference |
| :--- | :--- |
| `index.html`, `assets/core/boot.js` | Playground versions. They do not have the Terminal, Audio, Video and Image panes, and the page has a link back to the website. |
| `assets/data/ontologies/ontogsn.ttl` | A copy of `ontology/serializations/ontogsn.ttl` of this repository |
| `assets/data/queries/*.sparql` | Without comments. [`QUERY-COMMENTS.md`](../../QUERY-COMMENTS.md) holds the comments. |
| `README.md`, `VENDOR.json` | Not in the Workbench |

## Run it on your computer

The page needs a web server, because a browser does not load modules from a file.

```bash
cd docs
python -m http.server 8000
```

Then open `http://localhost:8000/playground/`. The page loads Oxigraph and D3 from
`cdn.jsdelivr.net`, so it needs the network.

## The ASCE files

`assets/data/asce.ttl`, `assets/data/asce_ontogsn_mapping.ttl` and `assets/data/kettle.axml`
belong to the Converter pane, which turns an ASCE `.axml` export into Turtle
(`assets/panes/converter/converter.js`).

| File | Role |
| :--- | :--- |
| `asce.ttl` | A vocabulary for the ASCE file format: networks, nodes, links, layout. Each term has a `schema:identifier` that names the AXML attribute that it comes from. |
| `asce_ontogsn_mapping.ttl` | Maps that vocabulary onto OntoGSN, for example ASCE node types onto `gsn:Goal`. |
| `kettle.axml` | A sample ASCE export for the converter |

These are demo files, not published artefacts. Their terms are in the namespace of the
page (`https://fortiss.github.io/OntoGSN/ontology/asce#`), not under `w3id.org`. They have
no provenance record and no version numbers. A maintained alignment to another argument
ontology is in `alignments/` at the root of the repository.
