# OntoGSN Serialization Files

The ontology cut along two axes: which section of the GSN Community Standard a term
belongs to, and how much of the ontology is carried with it.

**Generated. Do not edit by hand.**

```bash
python serializations/build_separated.py            # rewrite all 36 files
python serializations/build_separated.py --check    # verify they are current (CI)
```

## Filename structure

`ontogsn-<scope>_<n>_<module>.<format>`

### Scope

Three levels, with exactly one thing removed at each step, so that a comparison between
any two of them has a single variable in it.

| Scope | Contents | `0_full` size |
| :--- | :--- | ---: |
| `complete` | Declarations, logical axioms, annotations, SWRL rules | ~160 KB |
| `pruned` | **minus the SWRL rules** and the ontology's publication metadata | ~35 KB |
| `skeletal` | **minus all prose.** Declarations and logical axioms only | ~16 KB |

`pruned` removes the rule layer, not the documentation: `rdfs:label`, `skos:definition`,
`skos:note`, `skos:altLabel`, `gsn:renderedAs` and `gsn:coreOrExtension` all survive, so
the terms stay readable. What goes is the 51 SWRL rules with their atoms and variables,
and the licence/citation/disclaimer block on the ontology node.

`skeletal` then drops the words and keeps the logic. It is not an opaque file — `gsn:Goal`,
`gsn:Solution` and `gsn:supportedBy` say what they are, and every class expression survives
intact. What goes is the GSN Community Standard's own wording. `skos:definition` is about
two thirds of the prose by weight and is the only annotation with real mass;
`rdfs:label` costs well under a thousand characters across the whole ontology, so it is
dropped for consistency rather than for economy. `gsn:renderedAs` describes the diagram
notation, and `gsn:coreOrExtension` is the same value on every term inside a section file.

The three exist so that "does the rule layer help?" and "do the definitions earn their
tokens?" can be asked separately.

Every file, at every scope, declares its own IRI and `owl:versionInfo`, which is what lets
`prov_check.py` notice when it has gone stale. The previous pruned files carried no version
at all, so nothing could tell.

### Module

| Module | Section |
| :--- | :--- |
| `0_full` | Everything |
| `1_core` | Core GSN |
| `2_pattern` | Argument Pattern Extension |
| `3_modular` | Modular Extension |
| `4_confidence` | Confidence Argument Extension |
| `5_dialectic` | Dialectic Extension |

A term belongs to the module its `gsn:coreOrExtension` annotation names — the same
annotation the SHACL shapes are sliced by. Everything reachable from a term through blank
nodes travels with it, so a class keeps its restrictions and a rule keeps its atoms.

`0_full` is assembled from the five sections, and the build refuses to write anything
unless every named triple of `ontogsn.ttl` survives into it. That is what guarantees the
five modules between them account for the whole ontology.

### Format

`ttl` (Turtle) and `jsonld` (JSON-LD). Both are canonicalised the same way
`serializations/build.py` canonicalises `ontogsn.rdf` and `ontogsn.jsonld`: blank nodes are
relabelled from their own structure and the output is sorted, so an unchanged ontology
produces byte-identical files and git shows only real changes.

## Each file stands alone

A section that references a term it does not own — `gsn:Goal` in a Modular axiom, say —
gets a bare `rdf:type` declaration for it, and every external annotation property or
datatype the section actually uses is declared. So each file parses on its own with no
dangling references. The stub says what kind of thing the name is; for its definition, load
the section that owns it.

Section files carry their own ontology IRI (`https://w3id.org/OntoGSN/ontology/core` and so
on), mirroring [`shapes/`](../../shapes/README.md). Only `0_full` uses the ontology's own
IRI, because only `0_full` is the whole ontology.

## Three things the build reports

These are properties of `ontogsn.ttl`, not of the build, and are printed on every run
rather than silently patched:

* **`gsn:TriGoalConflict` carries no `gsn:coreOrExtension`.** It is the one SWRL rule of 51
  with no section; the other 50 are annotated. It lands in Core GSN by default.
* **The general class axiom** (the one defining a top goal as a goal that supports nothing)
  has an anonymous subject, so it cannot carry a section annotation at all. Also Core.
* **Five declarations are never referenced by any axiom** — `dc:created`, `terms:abstract`,
  `schema:citation`, `schema:license` and `xsd:date`. They are kept, in Core, rather than
  dropped, but they look vestigial.
