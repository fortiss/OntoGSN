# Changelog

The ontology-level view: what changed between two values of `owl:versionInfo` in
`ontology/serializations/ontogsn.ttl`, for a reader who downloaded the TTL and never looks at this
repository. Repository-level changes live in the commit log; each `v*` git tag marks the
**last commit at that version**, so `git diff v1.2.2 v1.2.3 -- serializations/ontogsn.ttl`
shows exactly what a version changed. Entries up to 1.3.0 are reconstructed by hand from the
commit log and `development/design/`; from the next release on, an entry is written when the version
number moves.

Each component of the repository has its own version number. Two components can have the same
number, for example ontology 1.3.0 and design record 1.3.0, and that does not make them one
release. These are the current versions:

| Component | Version | File |
| :--- | :--- | :--- |
| Ontology | 1.3.0 | `ontology/serializations/ontogsn.ttl` |
| SHACL shapes | 1.1.0 | `ontology/shapes/ontogsn-shapes_0_full.ttl` |
| Augmentation, and its shapes | 0.4.0 | `augmentation/ontogsn-augmentation.ttl` |
| Alignment | 0.1.0 | `alignments/ontogsn-align.ttl` |
| Design record | 1.3.0 | `development/design/ontogsn-design.ttl` |

The SHACL shapes (`ontology/shapes/`) version independently, but a shapes release is only meaningful
against an ontology version, so both are listed together.

| Ontology | Date | Shapes | Breaking |
| :--- | :--- | :--- | :--- |
| 1.3.0 | 2026-11-05 | 1.1.0 | yes — for reasoners |
| 1.2.3 | 2026-08-15 | 1.0.0 | no |
| 1.2.2 | 2026-08-05 | 1.0.0 (introduced 2026-08-06) | yes — for reasoners |
| 1.2.1 | 2026-01-23 | — | no |
| 1.2 | 2025-07-10 | — | first version in this repository |

Versions 1.0 and 1.1 predate this repository; no artefact of either survives here to diff.
The ontology as published is described in the paper (arXiv:2506.11023).

---

## Augmentation 0.4.0 (2026-11-05)

A mechanism now checks an artefact. Two properties and the label of one rule are renamed.
Their definitions, domains and ranges do not change.

| Old | New | Note |
| :--- | :--- | :--- |
| `gsnaug:verifiableWith` | `gsnaug:checkableWith` | The label is now "checkable with". The old label was "verified with", the same as the label of the other property. |
| `gsnaug:verifiedWith` | `gsnaug:checkedWith` | The label is now "checked with". |
| "Part Inherits Verifiable With" (the label of rule A4) | "Part Inherits Checkable With" | The rule is a blank node, so it has no IRI to rename. The SPARQL twin is now `augmentation/rules/a04_part_inherits_checkable_with.rq`. |

The definitions already said that the mechanism checks the truth or the appropriateness of the
artefact. Truth is `gsn:true`, and appropriateness is `gsn:valid`. "Verify" names only the
first of the two, so the properties now use the neutral verb "check".

- The old terms are gone, with no alias.
- New: `gsnaug:decides` on a mechanism, with the value `"truth"`, `"validity"` or both. It says
  whether a check tests that the evidence matches what the solution claims, or that the evidence
  is appropriate for the claim. A6a to A6d now read only a mechanism that decides truth. The new
  rules A7a to A7d set `gsn:valid` from a mechanism that decides validity. A mechanism that an
  artefact is checkable with and that decides nothing is a warning
  (`gsnaugsh:CheckingMechanismShape`). Add `gsnaug:decides "truth"` to your checking mechanisms
  to keep what A6 derived before.
- New: `gsnaug:implements`, from a shape, a rule, a query or another definition to the
  mechanism that it carries out. The definition is now a separate node, and it can be a blank
  node. A mechanism that is still typed as its own shape, rule or query is a warning
  (`gsnaugsh:MechanismSelfDefinitionShape`), and the derivations D1 to D3 and the query FC38
  read only the new link.
- The rules A4 and A6a to A6d, and the stored queries FC10, FC37 and FC38, read the new
  terms. The question of FC10 is now "Was this evidence checked, by whom, with what mechanism,
  and did it pass?".

*For case authors:* the rules and the queries do not see data that uses an old term. A solution
whose artefact names its mechanism with `gsnaug:verifiableWith` gets no truth value from A6a to
A6d. This update rewrites a graph to the new terms:

```sparql
PREFIX gsnaug: <https://w3id.org/OntoGSN/augmentation#>
DELETE { ?s gsnaug:verifiableWith ?m } INSERT { ?s gsnaug:checkableWith ?m }
WHERE  { ?s gsnaug:verifiableWith ?m } ;
DELETE { ?s gsnaug:verifiedWith ?m }   INSERT { ?s gsnaug:checkedWith ?m }
WHERE  { ?s gsnaug:verifiedWith ?m }
```

---

## Design record 1.3.0 (2026-10-16)

**Breaking for anyone who imported the record.** The record of design decisions moved from
`provenance/` to `development/design/`, and its IRIs moved with it. Nothing in the ontology,
the shapes or the queries changed.

| Old | New |
| :--- | :--- |
| `https://w3id.org/OntoGSN/provenance` (prefix `gsnprov`) | `https://w3id.org/OntoGSN/design` (prefix `gsndesign`) |
| `https://w3id.org/OntoGSN/provenance/{data,queries,augmentations}` | `https://w3id.org/OntoGSN/design/{data,queries,augmentations}` |
| `https://w3id.org/OntoGSN/alignment/provenance` (prefix `gsnalignprov`) | `https://w3id.org/OntoGSN/alignment/design` (prefix `gsnaligndesign`) |
| `https://w3id.org/OntoGSN/augmentation/provenance` (prefix `gsnaugprov`) | `https://w3id.org/OntoGSN/augmentation/design` (prefix `gsnaugdesign`) |

The word "provenance" was the problem. In an assurance case it means the origin of evidence,
and readers expected a module to import into their own case. The record is about how OntoGSN
was built, not about any case, and the new name says so. The maintenance scripts moved to
`development/dev_tools/` at the same time.

---

## Augmentation 0.3.2 — 2026-11-05 — first release

The augmentation (`augmentation/`) is released for the first time, together with ontology
1.3.0. It names `gsnaug:augmentedOntoGSNVersion "1.3.0"`.

- Its nine SWRL rules (A2a to A6d) are blank nodes, as the rules of the ontology are since
  1.3.0. Before this change, each rule had an IRI of its own, and Protégé read every one with
  an empty body and head. A rule is identified by its `rdfs:label`.
- `development/dev_tools/augmentation_check.py` no longer names a rule by IRI.

*For users:* if you open the augmentation in Protégé, the SWRL tab lists the nine rules.

---

## Ontology 1.3.0 — 2026-11-05 — shapes 1.1.0

Version 1.2.4 was never released. Its changes ship as 1.3.0, because they add terms and
change what a reasoner infers. Every reference to 1.2.4 in this repository now reads 1.3.0,
including the version IRI `https://w3id.org/OntoGSN/ontology/1.3.0`.

### Validity is not only a matter of syntax

**Not breaking.** Annotation only; no axiom changed. The `skos:definition` of `gsn:valid`
tied validity to the GSN argument syntax alone. It now names a rule or a manual evaluation
as the source of the mark, and consistency with the argument as one of its grounds.

*For case authors:* nothing to do.

Reasoning: `dd-1057` added, `dd-0976` retired, rationale `why-0225`.

### Protégé reads the SWRL rules again, and the rules that create nodes run

**Breaking for reasoners.** Since 1.2.2, Protégé read none of the SWRL rules from
`ontogsn.ttl` or `ontogsn.jsonld`. Eighteen rules also made the SWRLAPI Drools engine stop
the whole run.

- Every SWRL rule is a blank node again, as in 1.2.1. In 1.2.2 each rule got an IRI of its
  own. The OWL API, which Protégé uses, reads a rule that has an IRI with an empty body and
  head from Turtle and JSON-LD. Only `ontogsn.rdf` kept its rules. A rule is now identified by
  its `rdfs:label` alone, as the design record already did. `development/dev_tools/build.py`
  now fails if a rule has an IRI.
- The nine rules that create a node with `swrlx:makeOWLThing` now name the new node first,
  followed by both ends of the link that it stands for, for example
  `swrlx:makeOWLThing(?R, ?A, ?B)` in Support Relation Creation (S18). SWRLAPI binds the new
  node to the first argument. The old order made the Drools engine stop the whole run with
  the error that the built-in "returned with unbound arguments". The affected rules are S18,
  S19, S40, S42 to S45, S50 and S51.
- Twelve rules that tell two individuals apart now use a `differentFrom` atom in place of
  `swrlb:notEqual`, which compares literals only. The rules are S23, S24, S25, S30, S33 to
  S36, S41, S44, S45 and S51. OWL does not assume that two names stand for two individuals,
  so a `differentFrom` atom holds only for individuals that the case declares different.
  The SPARQL copies of the rules compare IRIs and do not need the declaration.
- Duplicate ACP Identifier Invalidation (S41) reads one identifier variable for both
  assurance claim points, in place of comparing two variables with `swrlb:equal`. SWRLAPI
  cannot compare untyped string literals with that built-in.

*For case authors:* if you open the ontology in Protégé, the SWRL tab now lists the rules.
Before you run the rules in Protégé, choose Edit, then Make all individuals different. That
adds one `owl:AllDifferent` for every individual of the case. Without it, the twelve rules
above draw no conclusion, but every other rule still runs. Choose it again after you add
individuals. If you refer to a rule by IRI, refer to it by its label.

Reasoning: `dd-1067` to `dd-1083` added, `dd-0302`, `dd-0304`, `dd-0496` to `dd-0499`,
`dd-0560`, `dd-0580`, `dd-0596` to `dd-0598`, `dd-0663`, `dd-0685`, `dd-0687`, `dd-0690`,
`dd-0692`, `dd-0742` and `dd-0746` retired, rationales `why-0228` and `why-0229`.

### A challenge can target a relationship, and created nodes are named after IRIs

**Breaking for reasoners.** One range is widened, and the SPARQL rules name their new nodes
differently.

- The `rdfs:range` of `gsn:challenges` gains `gsn:Relationship`, and so do the domain and
  the range of `gsn:transitivelyChallenges`. Rule S51 challenges a support link. Before
  this change, a reasoner inferred that each challenged relationship was a GSN element.
- The nine SPARQL rules that create a node (S18, S19, S40, S42 to S45, S50 and S51) now build
  its IRI from the IRIs of the elements, not from their `schema:identifier`. Two elements in
  different modules can share an identifier, and the old IRIs then merged their nodes into
  one. The `schema:identifier` of each new node is unchanged.

*For case authors:* if you stored the output of the SPARQL rules, run them again. A created
relationship or strategy can now have a different IRI.

Reasoning: `dd-1058`, `dd-1059` and `dd-1066` added, `dd-0713`, `dd-1022` and `dd-1038`
retired, rationale `why-0226`.

### Cycles of any length are found, and modules keep their class

**Breaking for reasoners.** Two rules are replaced by nine, and two domains are widened.

- Three object properties are added, one for each link type that can form a cycle. Each
  property is transitive, and a rule fills it. Nobody authors it.

  | Property | Extension | Filled by |
  | :--- | :--- | :--- |
  | `gsn:transitivelySupportedBy` | Core GSN | Support Closure (S55) |
  | `gsn:transitivelyInContextOf` | Modular Extension, modules only | Module Context Closure (S58) |
  | `gsn:transitivelyChallenges` | Dialectic Extension | Challenge Closure (S61) |

- For each property, one rule marks every element on a cycle as not valid (S56, S59, S62).
  A second rule marks every relationship on a cycle as not valid (S57, S60, S63).
- Predicate Conflict Invalidation (S7) and Circular Module Invalidation (S37) are removed.
  They found a cycle only when it had exactly three nodes.
- The `rdfs:domain` of `gsn:supportedBy` and of `gsn:inContextOf` gains `gsn:Module`. Rules
  S34, S35 and S36 write these links between modules. Before this change, a reasoner inferred
  that each such module was a goal or a strategy, and it reported no error.
- Shapes: the comment on `gsnsh:SupportedByPropertyShape` and on
  `gsnsh:InContextOfPropertyShape` is removed, because the OWL domain now names
  `gsn:Module` too. No constraint changed.

- `gsn:inferredOnly` is a new annotation property. It flags `gsn:inModule` and the three
  new properties as properties that a rule derives and that a case never asserts. The
  `pruned` and `skeletal` slices now drop the flagged properties together with the rules.

*For case authors:* a cycle of two or more links of one type now makes every element and
every reified relationship on it invalid. Before, only a cycle of exactly three did this. A
cycle of challenges also does this now.

Reasoning: `dd-1014`–`dd-1056` added, `dd-0211`, `dd-0222`, `dd-0226` and `dd-0604` retired,
rationales `why-0222` to `why-0224`.

### Two rules retired, one narrowed, one renamed

**Breaking for reasoners.** The rule set has two fewer rules, and one rule now applies to
fewer cases.

- Tri-Goal Conflict (S9) is removed. Contradictory Goal Truth (S8) matches every case that
  S9 matched and draws the same conclusion.
- Conflicting Support (False) (S13) is removed. It was disabled in 1.2.3, because Solution
  Propagation (False) (S11) draws the same conclusion.
- Duplicate Name Invalidation (S41) is replaced by Duplicate ACP Identifier Invalidation. The
  old rule marked any two nodes with the same `schema:identifier` as not valid. The new rule
  does this only for two assurance claim points. Within one module, Duplicate Identifier
  Invalidation (S25) still applies to all elements.
- Goal Inference (S5) is renamed to Inferential Relation (Goal). The rule logic did not
  change.

*For case authors:* an identifier that you reuse in two different modules no longer makes
either element invalid when you import the Confidence Argument Extension.

Reasoning: `dd-0240` and `dd-0665` retired, `dd-1013` added, rationale `why-0221`. `dd-0246`
was already retired.

### A view depicts a module

**Not breaking.** One object property is added and no existing axiom changed. The Modular
Extension had `gsn:View`, with `gsn:viewType` to tell an argument view from an architecture
view, but nothing related a view to the module whose argument it shows. The standard says
(1:4.2.1, p. 32): "The argument view depicts the argument inside an individual module."

- `gsn:depicts` has domain `gsn:View` and range `gsn:Module`. The property is authored, never
  inferred. No rule reads it.
- Two SHACL shapes, `gsnsh:DepictsPropertyShape` and `gsnsh:DepictsRangePropertyShape`,
  report a subject that is not a view or an object that is not a module.

*For case authors:* nothing to do. A case that already has views can now state which module
each view depicts.

Reasoning per axiom: `dd-1003` to `dd-1010`, rationale `why-0219`, passage `src-0142`.

### The header states what makes the release findable

**Not breaking.** Header metadata only; no term and no axiom changed. FOOPS!, the FAIR
assessor for ontologies, scored OntoGSN 75%: seven facts about the release were true but
written down nowhere a machine could read them.

- `owl:versionIRI` — `https://w3id.org/OntoGSN/ontology/1.3.0`. The ontology URI names the
  ontology; the version IRI names *this* release of it, and is what a consumer pins to.
- `vann:preferredNamespaceUri` — `https://w3id.org/OntoGSN/ontology#`. The prefix `gsn` was
  declared; the namespace it stands for was not.
- `bibo:doi` — the Zenodo **concept** DOI `10.5281/zenodo.17808330`, which resolves to the
  newest deposit, rather than a version DOI that would pin the first.
- `schema:includedInDataCatalog` — the same Zenodo deposit. This is the ontology's registry
  entry; it is not yet in Linked Open Vocabularies.
- `bibo:status`, `schema:logo` — published, and the project banner.
- `dcterms:issued` and `dcterms:modified` **replace `dc:issued` and `dc:modified`.** Dublin
  Core Elements 1.1 never defined either term — DCMI defines `issued` and `modified` only in
  DCMI Metadata Terms — so the two properties the header had been using resolved to nothing
  and no tool read them. The dates themselves are unchanged.

*For case authors:* nothing to do. Seven annotation properties are declared that were not
before (`bibo:doi`, `bibo:status`, `dcterms:issued`, `dcterms:modified`,
`schema:includedInDataCatalog`, `schema:logo`, `vann:preferredNamespaceUri`) and two are
gone (`dc:issued`, `dc:modified`); a case that annotated itself with either of those two —
none should have — would need to move to the `dcterms` spelling.

Reasoning: `dd-0996`–`dd-1002`, `dd-0019` and `dd-0032` retired, rationale `why-0218`.

### Twenty-four terms gain a definition

**Not breaking.** Annotations only; no axiom changed. Twenty-four classes and properties
carried an `rdfs:label` and nothing else — the reification class, the pattern cardinalities,
the decorators and the container properties. Every one of them now has a `skos:definition`.

A definition prefixed **`[OntoGSN]`** is this ontology's wording rather than the standard's.
Twenty-one are tagged; three — `gsn:GSNElement`, `gsn:toBeSupportedByContract` and
`gsn:uninstantiated` — are the standard's own sentence and are not. The convention is stated
in a `skos:note` on the ontology node, so a reader who never opens `development/design/` can still
decode it.

Every definition has a decision record naming the passage it was drawn from. One,
`gsn:Relationship`, cites none and says so with `gsndesign:noSourceRecorded`: GSN draws a link
as a line and gives it no identity, so there is no passage for a reified relationship to rest
on.

*For case authors:* nothing to do. Documentation generated from the ontology gains 24
definitions; OOPS! pitfall P08 drops from 26 elements to the two `schema.org` properties,
which are not this ontology's to annotate.

Reasoning per definition: `dd-0972`–`dd-0995`, rationales `why-0215`–`why-0217`.

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

- `gsnsh:DepictsPropertyShape` and `gsnsh:DepictsRangePropertyShape` added for the domain and
  range of `gsn:depicts`.
- `gsnsh:TopGoalHasNoParentShape` and `gsnsh:UnparentedGoalIsTopShape` rewritten from
  `sh:or` over an inverse-path count into SHACL-SPARQL constraints, for the top-goal scoping
  above. Retires `dd-0827`, `dd-0828`.
- `development/dev_tools/build_full.py` now reads `owl:versionInfo` from the section files instead of
  carrying its own copy, and fails if they disagree.

### SHACL shapes 1.0.2 → 1.0.3

- `gsnsh:SolutionShape` no longer requires `gsn:refersTo`; it still warns when the reference
  points at something that is not an artefact. The new `gsnsh:SolutionEvidenceShape` requires
  the reference only of a solution that is not flagged `gsn:uninstantiated true`, so a
  placeholder solution in a pattern, or an uninstantiated copy in an instantiated argument, is
  no longer warned about evidence it cannot have yet. Retires `dd-0798`; rationale `why-0220`.

### SHACL shapes 1.0.3 → 1.1.0

- `gsnsh:TrueClaimSolutionShape` (warning) reports a claim marked true that a solution not
  marked true supports. Rules S10 and S11 give such a claim both truth values, and this shape
  names the cause. Rationale `why-0227`.
- `gsnsh:ModuleContextCycleShape` reports a module on a cycle of context links between
  modules, and `gsnsh:ChallengeCycleShape` reports an element on a cycle of challenges. With
  `gsnsh:SupportCycleShape`, SHACL now reports every cycle that rules S56, S59 and S62 mark.
  Rationale `why-0222`.
- The comment on `gsnsh:ChallengesRangePropertyShape` is removed, because the OWL range now
  names `gsn:Relationship` too.

Decisions `dd-1060` to `dd-1065`. The version moves to 1.1.0 and not to 1.0.4, because new
shapes report findings that 1.0.0 did not.

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
  goals alone, every strategy-parented goal was a top goal. (Superseded again in 1.3.0 by
  the module scoping above.)
- `gsn:inModule` added: the module an element belongs to. Inferred, never authored.
- SWRL rule variables moved out of the published term namespace into `gsnswrl:`; they no
  longer appear in generated documentation beside real terms.

*For case authors:* nothing to do; previously ill-typed but intended assertions become
well-typed.

Reasoning per axiom: see the 1.2.3 decisions in `development/design/` (the commit
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
the design record (`development/design/`), SPARQL translations of all 51 SWRL
rules (`ontology/queries/rules/`), and the separated serializations. None of these changes the
ontology itself.

---

## Ontology 1.2.1 — 2026-01-23

**Not breaking.** Fixed an error in rule S9; added human-readable annotations.
`owl:versionInfo` becomes a string from this version on (1.2 was typed as a decimal).

---

## Ontology 1.2 — 2025-07-10

The earliest version whose artefact survives in this repository, added as
`ontology/serializations/ontogsn.ttl`. Changes from 1.0 and 1.1 were never recorded and cannot be
reconstructed here.
