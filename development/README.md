# Development

Everything in this folder is for the people who maintain OntoGSN. You do not need any of
it to use the ontology, the shapes, the queries, the alignments or the augmentation.

| Folder | Contents |
| :--- | :--- |
| `design/` | The design record: why each axiom, shape, rule and query exists, as a PROV-O graph. See [`design/README.md`](design/README.md). |
| `dev_tools/` | The checks and generators that keep the repository consistent. See [`dev_tools/README.md`](dev_tools/README.md). |
| `TODO.md` | Possible improvements to this folder, and known flaws that need a change outside it. |

The build scripts that generate derived files stay next to the files they generate:
`development/dev_tools/build.py`, `development/dev_tools/build_separated.py` and `development/dev_tools/build_full.py`.

## Releases

The version of the ontology is `owl:versionInfo` in `ontology/serializations/ontogsn.ttl`. The
kind of change decides the tag and the archive copy:

| Change | Example | Git tag | Zenodo |
| :--- | :--- | :--- | :--- |
| Major or minor version of the ontology | 1.3.0, 2.0.0 | `v1.3.0` | A new version of record 17808330 |
| Patch version of the ontology | 1.3.1 | `v1.3.1` | None |
| A change around an unchanged ontology version | header metadata, shapes, design record | `v1.3.0+1` | None |

The DOI `10.5281/zenodo.17808330` resolves to the newest Zenodo copy. After a patch, that copy
is older than the ontology in this repository. The git tag is then the archive of the patch.

## The w3id redirects

Every IRI under `https://w3id.org/OntoGSN` is a redirect. The rules are in the repository
[perma-id/w3id.org](https://github.com/perma-id/w3id.org), in `ids/OntoGSN/.htaccess`. With a
clone of that repository next to this one, the path from this folder is
`../../w3id.org/ids/OntoGSN/.htaccess`. `README.md` in the same folder lists the redirects.

Volunteers maintain that repository, so change the rules only in these two cases:

- You register a new ontology IRI, for example a new extension with its own `owl:Ontology`.
- You correct a defect in a rule.

A new version of the ontology is not such a case. The rule for `/ontology/{x.y.z}` redirects
to the file at the git tag `v{x.y.z}`, so the tag is the only step. A tag with a build suffix,
such as `v1.3.0+1`, has no IRI. A path without a rule answers 404.
