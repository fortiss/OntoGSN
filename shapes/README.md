# OntoGSN SHACL Shapes

SHACL shapes for validating assurance-case *data* expressed with the [OntoGSN ontology](../serializations/ontogsn.ttl). They are derived from that file: class axioms, `rdfs:domain`/`rdfs:range`, `owl:oneOf` enumerations, property characteristics and the general class axioms.

Every shape carries `gsn:coreOrExtension`, exactly as the ontology terms do, so the graph can be sliced back into its GSN Community Standard v3 sections at any time.

## Where the rationale lives

The shapes carry no editorial comments. Why a constraint is written the way it is —
including the cases where a shape deliberately departs from the ontology — is recorded in
`OntoGSN Design Document.xlsx`, one row per constraint. Each row holds the constraint's
Turtle, its message in plain English, and the reasoning.

Shape rows carry the same `part` and `section` as the ontology terms they validate — all five
sections sit in Part 1 of the GSN Community Standard — and are keyed `…​.SH###`, so a section's
axioms and its shapes sort together (`S04.R135` then `S04.SH001`).

`#` comments in these files are section headings only. Prose belongs in the workbook, so the
executable shape stays executable.

## Files

| File | Section | Ontology IRI |
| :--- | :------ | :----------- |
| `ontogsn-shapes_0_full.ttl` | Everything (generated) | `https://w3id.org/OntoGSN/shapes` |
| `ontogsn-shapes_1_core.ttl` | Core GSN | `https://w3id.org/OntoGSN/shapes/core` |
| `ontogsn-shapes_2_pattern.ttl` | Argument Pattern Extension | `https://w3id.org/OntoGSN/shapes/pattern` |
| `ontogsn-shapes_3_modular.ttl` | Modular Extension | `https://w3id.org/OntoGSN/shapes/modular` |
| `ontogsn-shapes_4_confidence.ttl` | Confidence Argument Extension | `https://w3id.org/OntoGSN/shapes/confidence` |
| `ontogsn-shapes_5_dialectic.ttl` | Dialectic Extension | `https://w3id.org/OntoGSN/shapes/dialectic` |

The naming mirrors [`serializations/separated/`](../serializations/separated/README.md).

The five per-section files are the source of truth. `ontogsn-shapes_0_full.ttl` is **generated** by concatenating them — regenerate it after any edit:

```sh
python shapes/build_full.py
```

Each section file is a standalone, self-sufficient shapes graph: load only `ontogsn-shapes_1_core.ttl` to validate a core-only assurance case, or load any combination.

## Slicing by section

Because every shape is annotated, the full graph can also be split at query time:

```sparql
PREFIX gsn: <https://w3id.org/OntoGSN/ontology#>
PREFIX sh:  <http://www.w3.org/ns/shacl#>

DESCRIBE ?shape
WHERE {
    ?shape a sh:NodeShape ;
           gsn:coreOrExtension "Modular Extension"@en .
}
```

The five section values are `"Core GSN"`, `"Argument Pattern Extension"`, `"Modular Extension"`, `"Confidence Argument Extension"` and `"Dialectic Extension"`.

## Running the validation

The shapes use `sh:class`, which walks `rdfs:subClassOf*`. **The ontology must therefore be available alongside the data**, either merged into the data graph or supplied as an ontology graph. A few constraints (irreflexivity, asymmetry, acyclicity, symmetry of `gsn:consistentWith`, catalogue identifier uniqueness) are SHACL-SPARQL, so the engine needs its advanced features enabled.

With [pySHACL](https://github.com/RDFLib/pySHACL):

```sh
pyshacl -s shapes/ontogsn-shapes_0_full.ttl \
        -e serializations/ontogsn.ttl \
        -a -f human \
        my-assurance-case.ttl
```

* `-e` mixes the ontology into the data graph (needed for the class hierarchy).
* `-a` enables the SHACL advanced features (the SPARQL-based constraints).
* Add `--allow-warnings` to treat `sh:Warning` and `sh:Info` results as conforming.

In GraphDB, load a section file into a named graph under the SHACL shapes graph; in TopBraid, the `owl:imports` in `ontogsn-shapes_0_full.ttl` resolve the five sections.

## Severity policy

| Severity | Meaning |
| :------- | :------ |
| `sh:Violation` | Directly entailed by a declared OWL axiom — datatypes, `rdfs:domain`/`rdfs:range`, `owl:allValuesFrom`, `owl:qualifiedCardinality`, `owl:oneOf`, `owl:propertyDisjointWith`, `owl:hasValue`, irreflexivity and asymmetry. Data that violates one of these is logically inconsistent with the ontology. |
| `sh:Warning` | Mostly from `owl:someValuesFrom`. Under OWL's open-world assumption an existential can be satisfied by an individual that is not in the graph; when validating a finished assurance case closed-world it reads as "this should be present". Also used for GSN-standard guidance that is not an OWL axiom. |
| `sh:Info` | Advisory. Complements the SWRL rules rather than replacing them — e.g. a true challenge that has not (yet) been propagated to `gsn:inDoubt`. |

## Reading a validation result

The three pieces of information a result carries are deliberately kept in separate places, so neither audience has to read around the other:

| Where | What it holds | Example |
| :---- | :------------ | :------ |
| `sh:message` | Plain language, no prefixes, no OWL vocabulary. Safe to show to an assurance author with no Semantic Web background. | *"A goal may only be supported by another goal, a module, a solution or a strategy."* |
| `sh:name` | The human label of the constrained property, taken verbatim from the ontology's `rdfs:label`. Form generators and report tables use it as the field name. | *"supported by"* |
| The result's structured fields | The IRIs — `sh:focusNode`, `sh:resultPath`, `sh:sourceShape`, `sh:sourceConstraintComponent`, `sh:value`. | `gsn:supportedBy` |

The IRIs are deliberately **not** repeated inside `sh:message`. Every SHACL engine already reports them (pySHACL's `human` format prints `Focus Node` / `Result Path` / `Source Shape` next to the message), so duplicating them into prose only creates a copy that can drift out of step with `sh:path`.

Why a constraint exists — which OWL axiom it came from, whether it is a tightening or a widening — is recorded in `rdfs:comment` on the shape, where a maintainer reading the shapes file will find it, rather than in the error text an author sees.

All messages carry `@en`, so translations can be added as extra `sh:message` values without restructuring anything.

## Scope and deliberate deviations

**Not covered.** The 52 SWRL rules in the ontology are *inference* rules: they derive new facts (validity, doubt, defeat, propagation of `gsn:true`) rather than reject data. They are left to a rule engine. Run the reasoner first, then validate — the two are complementary, and a couple of `sh:Info` shapes flag where a reasoner would have filled a gap.

**Tightenings** — reasonable for data validation, but not stated in the ontology; each is marked with an `rdfs:comment` in place:

* `sh:maxCount 1` on the boolean decorators (`gsn:top`, `gsn:true`, `gsn:valid`, `gsn:away`, `gsn:undeveloped`, …). OWL does not declare them functional, but an element cannot be both valid and invalid.
* `gsn:statement` is split by severity: **at most one** is a Violation (the standard requires a single statement per element, and two competing statements is a defect), **at least one** is only a Warning (an element with no statement yet is unfinished, not incorrect — cases get validated while being authored). The "noun phrase + verb phrase" rule is documentation only: it lives in `sh:description`, where form generators and report tools surface it to the author, and is never enforced.
* `gsn:supportedBy` must be acyclic (a goal structure is a directed acyclic graph).
* `gsn:challenges` is irreflexive.
* A `gsn:Solution` should `gsn:refersTo` at least one `gsn:Artefact` (Warning).
* An element with `gsn:undeveloped true` should carry no `gsn:supportedBy` links (Warning).
* An element with `gsn:defeated true` cannot also carry `gsn:true true`.
* Pattern identifiers must be unique within a `gsn:Catalogue`.
* A `gsn:Pattern` should declare `gsn:intent` and `gsn:applicability` (Warning).

**Widenings** — places where a declared domain or range is narrower than the class axioms that use the same property, so validating the declaration literally would reject legitimate GSN. Each is documented with an `rdfs:comment` on the shape:

* `gsn:contains` — `rdfs:domain` is `Argument ⊔ AssuranceCase ⊔ Module`, but `gsn:Catalogue` carries `contains only Pattern`; `gsn:Catalogue` was added to the domain shape. The `rdfs:range` (`Argument ⊔ Artefact ⊔ Module`) excludes both `gsn:GSNElement` (required by `gsn:Argument`) and `gsn:Pattern` (required by `gsn:Catalogue`), so **no global range shape is emitted for `gsn:contains`** — the range is validated per containing class instead.
* `gsn:inContextOf` and `gsn:supportedBy` — `rdfs:domain` is `Goal ⊔ Strategy`, but `gsn:Module` carries `owl:allValuesFrom` restrictions on both properties; `gsn:Module` was added to the domain shapes.
* `gsn:challenges` — `rdfs:range` is `GSNElement`, but `gsn:Goal` and `gsn:Solution` both restrict it to `GSNElement ⊔ Relationship`, and the standard states that a challenge may be directed at any part of an argument; `gsn:Relationship` was added to the range shape.

**Placement note.** The axiom `Argument ⊑ (contains some ArtefactReference and contains some Goal) or (statement some string)` is asserted on the Core class `gsn:Argument` but annotated `coreOrExtension "Confidence Argument Extension"`. The annotation was honoured, so the shape lives in `ontogsn-shapes_4_confidence.ttl` as `gsnsh:ArgumentContentShape`.

## Namespaces

| Prefix | Namespace |
| :----- | :-------- |
| `gsnsh:` | `https://w3id.org/OntoGSN/shapes#` |
| `gsn:` | `https://w3id.org/OntoGSN/ontology#` |
| `sh:` | `http://www.w3.org/ns/shacl#` |
