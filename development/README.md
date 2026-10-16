# Development

Everything in this folder is for the people who maintain OntoGSN. You do not need any of
it to use the ontology, the shapes, the queries, the alignments or the augmentation.

| Folder | Contents |
| :--- | :--- |
| `design/` | The design record: why each axiom, shape, rule and query exists, as a PROV-O graph. See [`design/README.md`](design/README.md). |
| `dev_tools/` | The checks and generators that keep the repository consistent. See [`dev_tools/README.md`](dev_tools/README.md). |

The build scripts that generate derived files stay next to the files they generate:
`development/dev_tools/build.py`, `development/dev_tools/build_separated.py` and `development/dev_tools/build_full.py`.
