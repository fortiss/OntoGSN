# Changelog

The ontology-level view: what changed between two values of `owl:versionInfo` in
`serializations/ontogsn.ttl`, for a reader who downloaded the TTL and never looks at this
repository. Repository-level changes live in the commit log; each `v*` git tag marks the
**last commit at that version**, so `git diff v1.2.2 v1.2.3 -- serializations/ontogsn.ttl`
shows exactly what a version changed. Entries up to 1.2.4 are reconstructed by hand from the
commit log and `provenance/`; from the next release on, an entry is written when the version
number moves.

The SHACL shapes (`shapes/`) version independently, but a shapes release is only meaningful
against an ontology version, so both are listed together.

| Ontology | Date | Shapes | Breaking |
| :--- | :--- | :--- | :--- |
| 1.2.4 | unreleased | 1.0.2 | yes — for reasoners |
| 1.2.3 | 2026-08-15 | 1.0.0 | no |
| 1.2.2 | 2026-08-05 | 1.0.0 (introduced 2026-08-06) | yes — for reasoners |
| 1.2.1 | 2026-01-23 | — | no |
| 1.2 | 2025-07-10 | — | first version in this repository |

Versions 1.0 and 1.1 predate this repository; no artefact of either survives here to diff.
The ontology as published is described in the paper (arXiv:2506.11023).

---

## Ontology 1.2.4 (unreleased) — shapes 1.0.2

### Top goals are scoped to the module

**Breaking for reasoners.** The general class axiom for `gsn:top` was an
`owl:equivalentClass`: a goal was top exactly when no goal or strategy *anywhere* supported
it. That disqualified every away goal — the top goal of its own module — by the very
reference that makes it an away goal, and it forced every challenge goal to be top, since
nothing supports a defeater.

- The axiom is now a one-way `rdfs:subClassOf`, and gains a `not (gsn:challenges some
  Thing)` conjunct. The converse cannot be stated in OWL: scoping the parent test to the
  module relates three individuals and is not a class expression.
- Rule **S06** and the two SHACL shapes now carry the scoped definition. A parent is
  discounted exactly when some module contains the parent and not the goal, written as
  `gsn:contains+` so it does not depend on S53/S54 having run.
- A goal that challenges something is never a top goal.
- **With no modules in the graph, nothing is discounted** — a core-only case is unaffected.

*For case authors:* re-check any asserted `gsn:top false`. An away goal that is the top goal
of its own module should now be `gsn:top true`; a challenge goal should be `false`.

Reasoning per axiom: `dd-0958` (retired), `dd-0968`–`dd-0971`, rationale `why-0213`.

### `refersTo` and `contains` widened to what the ontology's own axioms write

Two properties declared domains and ranges narrower than the class-level restrictions on the
same properties. Both are generative rather than restrictive, so neither rejected anything —
they retyped things. A reasoner no longer infers, for example, that a goal held by an
argument is an argument, an artefact or a module.

- `gsn:refersTo` domain widened beyond `gsn:ArtefactReference` to admit instantiation data
  references, without subsuming them under a class that would oblige an identifier.
- `gsn:contains` gains `gsn:Argument`, `gsn:Catalogue` and `gsn:Pattern` on the sides its
  own restrictions already used. What a container may hold is validated per containing class
  by the SHACL shape, not by one global range.

*For case authors:* nothing to do; spurious inferences disappear.

Reasoning per axiom: five decisions retired with supersession reasons, five added;
rationale `why-0211`, passage `src-0140`.

### SHACL shapes 1.0.1 → 1.0.2

- `gsnsh:TopGoalHasNoParentShape` and `gsnsh:UnparentedGoalIsTopShape` rewritten from
  `sh:or` over an inverse-path count into SHACL-SPARQL constraints, for the top-goal scoping
  above. Retires `dd-0827`, `dd-0828`.
- `shapes/build_full.py` now reads `owl:versionInfo` from the section files instead of
  carrying its own copy, and fails if they disagree.

---

## Ontology 1.2.3 — 2026-08-15 — shapes 1.0.0

**Not breaking**: every change is a widening. Building a real assurance case surfaced axioms
that contradicted the repository's own SWRL rules, queries and fixtures — the decorators and
reification restrictions were never extended when the Modular, Confidence and Dialectic
extensions added rules that write to them.

- Decorator domains widened to the classes the rules write them onto: `gsn:valid` gains
  `Argument`, `Pattern` and `Relationship`; `gsn:true` and `gsn:undeveloped` gain
  `Relationship`; `gsn:final` and `gsn:published` gain `Pattern`; `gsn:statement` gains
  `AssuranceCase`; `gsn:attachedTo` range gains `GSNElement`.
- Reified `gsn:Relationship` admits `Module` and `Pattern` as subject, `Relationship` as
  object, and `"dialectic"` as a `gsn:relationshipType` value, matching what rules S18–S21
  and S50 create.
- The top-goal axiom's inverse `supportedBy` test now reads over `Goal or Strategy` — over
  goals alone, every strategy-parented goal was a top goal. (Superseded again in 1.2.4 by
  the module scoping above.)
- `gsn:inModule` added: the module an element belongs to. Inferred, never authored.
- SWRL rule variables moved out of the published term namespace into `gsnswrl:`; they no
  longer appear in generated documentation beside real terms.

*For case authors:* nothing to do; previously ill-typed but intended assertions become
well-typed.

Reasoning per axiom: see the 1.2.3 decisions in `provenance/` (the commit
`602e870` lists every widening with its justification).

---

## Ontology 1.2.2 — 2026-08-05 — shapes 1.0.0 introduced 2026-08-06

**Breaking for reasoners.** `gsn:Defeater` was declared `owl:equivalentClass` of
`(Goal or Solution)`. As a biconditional that made every goal and every solution a defeater,
which rendered rule S52 (`challenges(?A,?B) → Defeater(?A)`) inert. Changed to
`rdfs:subClassOf`: every defeater is a goal or a solution, but not the reverse.

- Prefix migration `ontology:` → `gsn:`. Semantically neutral; the graph is identical in
  triple count.
- The empty `rdfs:comment` on every SWRL rule removed.

*For case authors:* `Defeater` membership now arrives only by S52 inference or by assertion
— anything that relied on every goal being a defeater (nothing should have) changes.

Around this version the repository gained its checked artefacts: the SHACL shapes (1.0.0),
the design-rationale provenance graph (`provenance/`), SPARQL translations of all 51 SWRL
rules (`queries/rules/`), and the separated serializations. None of these changes the
ontology itself.

---

## Ontology 1.2.1 — 2026-01-23

**Not breaking.** Fixed an error in rule S9; added human-readable annotations.
`owl:versionInfo` becomes a string from this version on (1.2 was typed as a decimal).

---

## Ontology 1.2 — 2025-07-10

The earliest version whose artefact survives in this repository, added as
`serializations/ontogsn.ttl`. Changes from 1.0 and 1.1 were never recorded and cannot be
reconstructed here.
