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

### Which number moves

Each component has its own number: the ontology, the SHACL shapes, the Augmentation and its
shapes, the alignment and the design record. The kind of change decides which part of that number
moves. The protocol follows Semantic Versioning 2.0.0. The public interface of a component is
its terms, what a reasoner derives from a case with its axioms and rules, and what its shapes
report on a case.

| Part | When | Example |
| :--- | :--- | :--- |
| Major | A term is removed or renamed, or a term changes its meaning. Or a case that was consistent and conformed becomes inconsistent, or fails a shape that it passed. | 2.0.0 |
| Minor | A term, an axiom, a rule or a shape is added. A domain or a range becomes wider. A rule derives other triples than before. | 1.4.0 |
| Patch | Only labels, definitions, notes or header metadata change. A reasoner derives the same triples, and the shapes report the same results. | 1.4.1 |
| None, a build suffix on the tag | The file of the component does not change, for example a change of the tooling or the documents. | `v1.4.0+1` |

These rules apply to the protocol:

- If one release holds changes of several parts, the highest part moves.
- While a component is at 0.x, a major change moves the minor number, as at Augmentation 0.4.0.
- A new shape of severity Violation is minor if it reports what the standard or the axioms
  already forbid. It is major if it rejects a use that an earlier version documented as valid.
- A change that alters what a reasoner derives keeps the label "Breaking for reasoners" in the
  CHANGELOG. The label describes the effect, and the part gives the number.
- The first line under the heading of each CHANGELOG entry states the part, for example
  `Version part: minor.` If shapes ship with an ontology release, the line also names their part:
  `Version part: minor. Shapes: minor.`
- `development/dev_tools/release_check.py` makes sure that each entry states its part, and that
  the part agrees with the step from the version before.

The protocol applies from ontology 1.4.0, shapes 1.3.0, Augmentation 0.7.0, alignment 0.1.1 and
design record 1.5.0 on. Earlier numbers do not follow it. For example, 1.2.2 and 1.3.1 are patch numbers, and
the protocol makes both minor versions.

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
