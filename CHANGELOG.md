# Changelog

The ontology-level view: what changed between two values of `owl:versionInfo` in
`ontology/serializations/ontogsn.ttl`, for a reader who downloaded the TTL and never looks at this
repository. Repository-level changes live in the commit log; each `v*` git tag marks the
**last commit at that version**, so `git diff v1.2.2 v1.2.3 -- serializations/ontogsn.ttl`
shows exactly what a version changed. A tag with a build suffix, such as `v1.3.0+1`, marks later
changes around an unchanged ontology version: the shapes, the augmentation, the design record or
the header metadata. Entries up to 1.3.0 are reconstructed by hand from the
commit log and `development/design/`; from the next release on, an entry is written when the version
number moves.

From ontology 1.4.0, shapes 1.3.0, Augmentation 0.7.0, alignment 0.1.1 and design record 1.5.0 on,
the kind of change decides which part of a number moves. The section "Which number moves" of
`development/README.md` gives the protocol. The first line under the heading of each such entry
states the part, for example `Version part: minor.`

Each component of the repository has its own version number. Two components can have the same
number, for example ontology 1.3.0 and design record 1.3.0, and that does not make them one
release. These are the current versions:

| Component | Version | File |
| :--- | :--- | :--- |
| Ontology | 1.4.0 | `ontology/serializations/ontogsn.ttl` |
| SHACL shapes | 1.3.0 | `ontology/shapes/ontogsn-shapes_0_full.ttl` |
| Augmentation, and its shapes | 0.7.0 | `augmentation/ontogsn-augmentation.ttl` |
| Alignment | 0.1.1 | `alignments/ontogsn-align.ttl` |
| Design record | 1.5.0 | `development/design/ontogsn-design.ttl` |

The SHACL shapes (`ontology/shapes/`) version independently, but a shapes release is only meaningful
against an ontology version, so both are listed together.

| Ontology | Date | Shapes | Breaking |
| :--- | :--- | :--- | :--- |
| 1.4.0 | 2026-11-19 | 1.3.0 | yes — for reasoners |
| 1.3.1 | 2026-11-17 | 1.2.0 | yes — for reasoners |
| 1.3.0 | 2026-11-05 | 1.1.0, 1.1.1 | yes — for reasoners |
| 1.2.3 | 2026-08-15 | 1.0.0 | no |
| 1.2.2 | 2026-08-05 | 1.0.0 (introduced 2026-08-06) | yes — for reasoners |
| 1.2.1 | 2026-01-23 | — | no |
| 1.2 | 2025-07-10 | — | first version in this repository |

Versions 1.0 and 1.1 predate this repository; no artefact of either survives here to diff.
The ontology as published is described in the paper (arXiv:2506.11023).

---

## Ontology 1.4.0 — 2026-11-19 — shapes 1.3.0

Version part: minor. Shapes: minor.

The first release under the version protocol of `development/README.md`. Two changes of the
axioms and the rules, and one of the shapes. Two of them change what a reasoner infers. The
ontology now has 61 SWRL rules. The RSC audit hub proposed all three. Decision `dd-1141` lists
the proposals that wait for a later release, with the reason for each.

### `gsn:instantiationOf` can point at an element of a pattern

**Breaking for reasoners.** The domain of `gsn:instantiationOf` already admitted an element, but
the range admitted only a pattern. A case that linked an element to the element of the pattern
that it copies made a reasoner type that template element as a pattern.

- The range is the union of `gsn:GSNElement` and `gsn:Pattern`. The definition names the
  element-level link.
- `gsnsh:InstantiationOfRangePropertyShape` takes the same union.
- `RL-GSN-final_pattern_invalidation` names `gsn:Pattern` in its own body, so it does not change.
- `RQ-GSN-uninstantiated_elements` names its last column `?instantiationOfId`, not `?patternId`,
  because the value can be an element.

*For case authors:* nothing to do. A reasoner derives fewer types than before, and a case that
was valid stays valid.

Reasoning: `dd-1133` to `dd-1135`, sources `src-0086` and `src-0127`, rationale `why-0264`.

### A goal that challenges is not a top goal, in SWRL too

**Breaking for reasoners.** The SPARQL form of `RL-GSN-goal_top_flag` took the top flag from a
goal that supports another element or that challenges one. The SWRL rule stated only the first.

| Rule | Reads | Writes |
| :--- | :--- | :--- |
| `RL-GSN-goal_top_flag_challenge` Goal Top Flag (Challenge), Dialectic Extension | a goal that challenges an element | `gsn:top false` on the goal |

- `RL-GSN-goal_top_flag` keeps the first case. Its SPARQL form loses the second branch, which the
  new SPARQL form `RL-GSN-goal_top_flag_challenge` has. Together they write what the one form
  wrote before.
- Over one witness of its body, the SWRLAPI, Openllet, HermiT, GraphDB and the SPARQL form each
  derive the head.

Reasoning: `dd-1138`, sources `src-0041` and `src-0269`, rationale `why-0267`.

### A goal is in the scope of a context above it

**Not breaking for a case.** The warning "A goal should be placed in at least one context" asked
each goal for a context of its own. A context constrains the scope of the argument below its goal
too, so the warning fired on each goal under a strategy.

- The property shape leaves `gsnsh:GoalShape`. The new `gsnsh:GoalInScopeOfContextShape` warns
  only if no element on the support chain above the goal, the goal included, is in the context of
  a `gsn:Context`.
- On the fixture, two warnings go before the rules and two after.

Reasoning: `dd-1139` and `dd-1140`, sources `src-0066` and `src-0218`, rationale `why-0268`.
Retires `dd-0786`, which had no source and no rationale.

## Alignment 0.1.1 (2026-11-19)

Version part: patch.

**Not breaking.** `gsnalign:alignedOntoGSNVersion` is 1.4.0. The alignment uses seven terms of
the ontology: `gsn:Goal`, `gsn:Strategy`, `gsn:Assumption`, `gsn:Argument`, `gsn:GSNElement`,
`gsn:supportedBy` and `gsn:challenges`. Release 1.4.0 changes no axiom of these terms, so every
axiom of the alignment still holds.

## Augmentation 0.7.0 (2026-11-19)

Version part: minor.

**Not breaking.** The Augmentation reuses two terms for gaps that the RSC audit hub found, and
it answers two more questions. No term is renamed or removed, and no rule changes.

- `schema:url` on an artefact names the place where its file is found, such as a path.
  `gsnaug:storedIn` names the system that keeps it. OntoGSN declares `schema:url` an annotation
  property, so the Augmentation reuses it as one, with no domain or range.
- A revised GSN element, for example a goal with new words, is `prov:wasRevisionOf` its earlier
  version. `gsnaug:replaces` stays for artefacts. A note on `gsnaug:replaces` says so.
- `RQ-AUG-revision_diff` finds the issue on a third path: an issue against an earlier version of
  a goal, or against the goal that revises it, when the earlier version rests on the older
  artefact. On the fixture it adds one row.
- Two new reads: `RQ-AUG-element_revisions` (which claims or solutions were revised, and what
  they said before) and `RQ-AUG-tagged_elements` (which elements carry a tag).
- `RQ-AUG-evidence_location` has the column `?location`, the `schema:url` of the artefact. Added
  after the merge of the release, on the same day, before the tag moved to the final commit.
- `augmentation/testdata/example_issues.ttl` has a revised control goal with an archived copy,
  for the three queries.
- The record of the Augmentation gives the reasons in `dd-0116` to `dd-0119`. `dd-0118`
  supersedes `dd-0114`.

## Design record 1.5.0 (2026-11-19)

Version part: minor.

**Not breaking.** The record finds more differences between a SPARQL rule and its SWRL rule. The
RSC audit hub found twins that the record called exact and that are not.

- `gsndesign:NodeContent` is a new member of `gsndesign:TranslationDifference`. The update writes
  a triple on the node that it makes, such as `schema:identifier` or `rdf:predicate`, and the
  head of the rule does not. A rule that reads that triple matches the node of the update only.
- `development/dev_tools/prov_inventory.py` reads the text of the SWRL rule too. A
  `FILTER(?a != ?b)` without a `differentFrom` atom in the rule is a guard. A test for an
  existing node that does not name the class of the node is a guard.
- Ten twins change their level. `RL-GSN-context_consistency` has a guard.
  `RL-GSN-support_relation_creation`, `RL-GSN-context_relation_creation` and
  `RL-GSN-challenge_relation_creation` have a guard and node content. The five rules of
  confidence relations and `RL-GSN-challenge_chain_invalidation` have node content. Of the 60
  twins, 10 are now exact.
- The SWRL rules do not change. Decisions `dd-1136` (the version protocol) and `dd-1137` (the
  differences) give the reasons.

## Query and rule IDs (2026-11-18)

**Breaking for users of the stored queries.** Each stored query and each rule has an ID, and
the ID is its file name: `<KIND>-<SCOPE>-<slug>.rq`, for example `RQ-GSN-goal_support_tree.rq`.
The old file names and the old IDs (CQ-01 to CQ-83, fc01 to fc41, S1 to S65, A2a to A8c and D1
to D4) are gone. The ontology, the shapes and the Augmentation keep their versions, because no
axiom and no SWRL rule changes.

- The column `replaces` of `ontology/queries/registry.csv` and `augmentation/registry.csv` gives
  the old IDs and the old file name of each query and rule. `ontogsn-design-inventory.ttl` keeps
  them as `skos:hiddenLabel`.
- The section "The ID of a query or a rule" of `development/dev_tools/README.md` gives the
  standard for a new query or rule.
- The two registries replace `development/design/Competency Questions.xlsx`. The requirements
  R1 to R7 move to `development/design/requirements.csv`.
- Two reads of the audit questions name no `gsnaug:` term, so they move to `ontology/queries/`:
  `RQ-GSN-undeveloped_claims_for_system` and `RQ-GSN-controls_ready_for_review`.
- Five new reads in `ontology/queries/` answer the audit questions that had no query of their
  own: `RQ-GSN-claims_awaiting_evidence`, `RQ-GSN-provided_evidence`,
  `RQ-GSN-validated_elements`, `RQ-GSN-elements_in_doubt` and `RQ-GSN-defeated_claims`.
- The names of the derivations `RL-AUG-shape_mechanism_reads`, `RL-AUG-rule_mechanism_reads`
  and `RL-AUG-rule_mechanism_writes` lose the word "Terms".
- A rule file holds no `# rule:` line. `run_rules.py --only` takes IDs.
- The rules run in the order of the column `order` of the registry, which keeps the order of
  before. The rules do not all reach the same result in every order.
- The design record gives the reasons in two new decisions, `dd-1131` (the ID) and `dd-1132`
  (the order of the rules). Its texts use the new IDs.

## Augmentation 0.6.0 (2026-11-17)

**Breaking for reasoners.** The SWRL forms of the eight rules that read a report now read only
the current report of an artefact. One property, one derivation and one shape are new. No term
is renamed or removed. The RSC audit hub proposed the property and the faster rule text.

- `gsnaug:currentReport` is a new object property, from an artefact or a part of one to the
  newest report of a mechanism over it that is not struck. An artefact has one current report
  for each mechanism. A report without a timestamp is always current.
- The SWRL forms of `RL-AUG-conforming_report_confirms_solution`, `RL-AUG-failing_report_refutes_solution`, `RL-AUG-conforming_report_validates_solution` and `RL-AUG-failing_report_invalidates_solution` have one more body atom, `currentReport(?A, ?R)`.
  `RL-AUG-conforming_part_report_confirms_solution`, `RL-AUG-failing_part_report_refutes_solution`, `RL-AUG-conforming_part_report_validates_solution` and `RL-AUG-failing_part_report_invalidates_solution` have `currentReport(?P, ?R)`. SWRL has no maximum and no negation, so
  before this change every report of a mechanism counted under a reasoner, also a retired one
  and a struck one.
- `augmentation/derivations/RL-AUG-current_report.rq` (`RL-AUG-current_report`) is new. It sets the link from the
  reports in the graph, and it removes a link that no longer holds. A writer of reports can
  also set the link itself.
- `gsnaugsh:CurrentReportShape` is new. It reports a current report that is not a
  `sh:ValidationReport`, or that is a report over another target.
- The SPARQL twins do not read the link. They find the newest report themselves, as before.
- The SPARQL twins of `RL-AUG-conforming_report_confirms_solution` and `RL-AUG-conforming_part_report_confirms_solution` have a new text. A subquery finds the current report of each
  mechanism and target once, and the composition guards are `MINUS` blocks. The results do not
  change. The text of 0.5.1 did not finish `RL-AUG-conforming_part_report_confirms_solution` on a case of 1000 solutions in Oxigraph in 300
  seconds. The new text takes 312 ms. Each of the two rules is about three times as long.

| Reports of one mechanism over one artefact | SWRL form in 0.5.1 | SWRL form in 0.6.0 | SPARQL twin |
| :--- | :--- | :--- | :--- |
| An old failing one, a new conforming one | the solution is true and not true | true | true |
| An old conforming one, a new failing one | the solution is true and not true | not true | not true |

*For case authors:* if you run the rules in a reasoner, run `RL-AUG-current_report` first, and after each new report.
A graph without `gsnaug:currentReport` gives no truth value and no validity value under the SWRL
forms. If you run the SPARQL twins, nothing changes, and `RL-AUG-current_report` runs with them without harm. If you
strike a report by hand, run `RL-AUG-current_report` again, so that the link moves back to the report before it.

Reasoning: `dd-0106` to `dd-0110`, rationales `why-0065` to `why-0067`. They retire `dd-0105`.

---

## Design record 1.4.0 (2026-11-12)

**Not breaking.** The record states how each SPARQL update in `ontology/queries/rules/`
differs from the SWRL rule that it re-expresses.

- `gsndesign:differsBy` is a new object property from a `gsndesign:Query` to a
  `gsndesign:TranslationDifference`. The class has two members. `gsndesign:Retraction`: the
  update deletes the old value before it writes the new one. `gsndesign:Guard`: the update
  draws its conclusion only if a stated fact is absent. SWRL can do neither.
- `development/dev_tools/prov_augment.py` derives the differences from the text of each
  update and writes them into `ontogsn-design-augmentations.ttl`. A test for the fact that
  the update is about to insert is not a guard.
- The note on `gsndesign:translatesStatement` no longer calls the link an exact
  correspondence. An update and its rule state the same rule, and `gsndesign:differsBy`
  says where the update does more.
- `ontology/queries/rules/README.md` is new. `development/dev_tools/doc_counts.py` writes
  its table of the rules from the record. `ontology/README.md` is new and points at it.
- The Provenance page of the Graffoo diagram does not draw the two new terms yet.
  `graffoo_check.py` accepts that difference.

---

## Ontology 1.3.1 — 2026-11-17 — shapes 1.2.0

Seven changes that waited for an ontology release. Four of them change what a reasoner infers.
The ontology now has 60 SWRL rules.

### Doubt on a link reaches the element that relies on it

**Breaking for reasoners.** Since 1.3.0, a goal can challenge a relationship, and the Challenge
Doubt rule (`RL-GSN-challenge_doubt`) puts that relationship in doubt. The element that rests on the link was not
affected. Two new rules in the Dialectic Extension carry the doubt to it.

| Rule | Reads | Writes |
| :--- | :--- | :--- |
| `RL-GSN-support_doubt_propagation` Support Doubt Propagation | a `gsn:supportedBy` relationship that is in doubt | `gsn:inDoubt true` on its subject, the parent |
| `RL-GSN-context_doubt_propagation` Context Doubt Propagation | a `gsn:inContextOf` relationship that is in doubt | `gsn:inDoubt true` on its subject |

- `RL-GSN-challenge_doubt` still decides when a challenge counts. The new rules only carry the doubt.
- A `gsn:challenges` relationship is not covered. Its subject is the challenger, and these
  rules never put a challenger in doubt.
- No rule clears the doubt, as with `RL-GSN-challenge_doubt`.
- Each rule is also a SPARQL update in `ontology/queries/rules/`. The run over the fixtures
  reaches a fixpoint after 4 passes, and 60 of 60 rules fire.

*For case authors:* a goal or a strategy can now be in doubt because a link below it is in
doubt. The rules read the `gsn:Relationship` node of the link. `RL-GSN-support_relation_creation` and `RL-GSN-context_relation_creation` create that node
for each support link and context link.

Reasoning: `dd-1099` and `dd-1100`, source `src-0282` (1:6.3.9), rationale `why-0239`. The
RSC audit hub proposed the rule.

### `gsn:relatedTo` is symmetric

**Breaking for reasoners.** `gsn:relatedTo` is an `owl:SymmetricProperty`. A reasoner adds the
reverse of each link between two patterns. The property is not transitive.

- New shape `gsnsh:RelatedToSelfShape` (shapes 1.2.0) reports a violation on a pattern that
  names itself as a related pattern. The property is not declared irreflexive, because one
  such triple then makes the whole case inconsistent.
- OOPS! no longer lists the property under P13. P13 goes from 14 to 13 cases.

*For case authors:* list a related pattern on one of the two patterns. A reasoner adds the
other direction. The shapes run without a reasoner and read only the direction that you wrote.

Reasoning: `dd-1096` (rationale `why-0237`), `dd-1097` and `dd-1098` (rationale `why-0238`),
source `src-0126` (1:3.4.12).

### `gsn:undeveloped` is a Core GSN term

**Not breaking for a case.** The standard defines the undeveloped decorator in Table 1:2-1,
Core GSN Elements. The term carried the tag of the Argument Pattern Extension.

- `gsn:coreOrExtension` of `gsn:undeveloped` is "Core GSN". The term moves from the pattern
  files to the core files in `ontology/serializations/separated/`.
- `gsnsh:UndevelopedPropertyShape` and `gsnsh:UndevelopedHasNoSupportShape` move from
  `ontogsn-shapes_2_pattern.ttl` to `ontogsn-shapes_1_core.ttl` (shapes 1.2.0), with the same
  tag. The constraints do not change.

*For case authors:* if you load the core files only, `gsn:undeveloped` and its two shapes are
now part of them. If you load the pattern files only, load the core files too.

Reasoning: `dd-1093` to `dd-1095`, rationale `why-0236`. Retires `dd-0202`, `dd-0881` and
`dd-0883`.

### `schema:description` is a data property only

**Not breaking for a case.** The ontology declared `schema:description` as an annotation
property and as a data property. OWL 2 DL does not allow one IRI to be both, and Protégé
reported an illegal redeclaration.

- The annotation property declaration is removed. The data property stays, because the
  restriction on `gsn:Pattern` uses it.
- The two annotation values, on `gsn:away` and `gsn:defeated`, are now `skos:note` values with
  the same wording.

*For case authors:* nothing to do. A `schema:description` on an argument, a pattern or an
artefact is a data property value, as before.

Reasoning: `dd-1091` and `dd-1092`, rationale `why-0235`. Retires `dd-0586`, `dd-0505`,
`dd-0719` and `dd-0720`.

### Six module rules read `gsn:inModule`

**Breaking for reasoners.** The SWRL form of six rules of the Modular Extension read
`gsn:contains` from a module to an element. A module contains arguments and other modules, and
not an element. So the SWRL form did not match a case with modules, arguments and elements,
and the SPARQL update of the same rule did.

| Rule | Body atoms before | Body atoms now |
| :--- | :--- | :--- |
| `RL-GSN-duplicate_identifier_invalidation` Duplicate Identifier Invalidation, `RL-GSN-contract_relation_invalidation` Contract Relation Invalidation | `contains(?M, ?A)`, `contains(?M, ?B)` | `inModule(?A, ?M)`, `inModule(?B, ?M)` |
| `RL-GSN-contract_violation_relation` Contract Violation Relation, `RL-GSN-context_contract_invalidation` Context Contract Invalidation | `contains(?M2, ?A)` | `inModule(?A, ?M2)` |
| `RL-GSN-contract_support_invalidation` Contract Support Invalidation | `contains(?M, ?A)` | `inModule(?A, ?M)` |
| `RL-GSN-public_contract_invalidation` Public Contract Invalidation | `contains(?C, ?E)` | `inModule(?E, ?C)` |

- The SPARQL updates do not change. They read `gsn:inModule` since 1.3.0.
- `RL-GSN-module_membership` and `RL-GSN-nested_module_membership` derive `gsn:inModule`. A reasoner runs them with the other rules.

*For case authors:* nothing to do. Do not state `gsn:inModule`, because the rules derive it.

Reasoning: `dd-1110` to `dd-1115`, rationale `why-0245`. Retires `dd-0523`, `dd-0524`,
`dd-0550`, `dd-0562`, `dd-0632` and `dd-1079`. The RSC audit hub found the difference.

### The four confidence rules stop at a node that a rule created

**Breaking for reasoners.** The rules of the group `confidence_relations` each create a relationship with confidence. The new node
matched the rule again. The SWRLAPI stops, because `swrlx:makeOWLThing` returns the same node
for the same arguments. An engine without that built-in creates a new node for each match and
does not stop. The RSC audit hub measured up to 597,165 derived triples from a case of 22 in
GraphDB 10.5.0.

- The body of `RL-GSN-strategy_confidence_relation`, `RL-GSN-goal_strategy_confidence`, `RL-GSN-solution_confidence_relation` and `RL-GSN-goal_confidence_relation` has one more atom, `schema:identifier(?R1, ?ID)`. A stated
  relationship has an identifier, and the head of a rule writes none. So a node that a rule
  created does not match a rule again.
- `RL-GSN-solution_confidence_relation` and `RL-GSN-goal_confidence_relation` give the same nodes as before.
- `RL-GSN-strategy_confidence_relation` and `RL-GSN-goal_strategy_confidence` no longer start each other. Under SWRL, a confidence moves one step from a
  stated relationship.
- The SPARQL updates of `RL-GSN-strategy_confidence_relation` and `RL-GSN-goal_strategy_confidence` do not change, and they do not have this limit. They write
  an identifier on the node that they create. On a strategy with two parent goals or two child
  goals, the SPARQL updates give a node for every link of the strategy, and the SWRL form does
  not.

*For case authors:* give each `gsn:RelationshipWithConfidence` that you state a
`schema:identifier`. `gsnsh:RelationshipWithConfidenceShape` already requires one. Without it,
The rules of the group `confidence_relations` do not read the relationship in a reasoner.

Reasoning: `dd-1106` to `dd-1109`, rationale `why-0246`. Retires `dd-1068`, `dd-1069`,
`dd-1071` and `dd-1072`.

### The SPARQL update of `RL-GSN-solution_propagation_true` does not make a defeated goal true

**Not breaking for reasoners.** `gsnsh:DefeatedElementIsNotTrueShape` says that a defeated
element cannot be true. The SPARQL update of `RL-GSN-solution_propagation_true` made a goal true when all its solutions were
true, also when the goal was defeated.

- `RL-GSN-solution_propagation_true.rq` has one more guard: the goal is not defeated.
- The SWRL form does not change, because SWRL has no negation. The design record already
  states that this update has a guard that the rule does not have.
- `rule_cases.ttl` has a defeated goal over a true solution. The goal stays without a truth
  value.

The RSC audit hub proposed the guard.

### The header names a square logo

**Not breaking.** `schema:logo` pointed at the wide banner, and the documentation page showed
it as a small white box. It now points at `ontogsn-logo.png`, a square image with the picture
of the banner.

---

## Design record 1.3.1 (2026-11-11)

**Not breaking.** The vocabulary of the design record declares `gsndesign:rationaleText`. The
record states this property on every rationale, but `ontogsn-design.ttl` did not declare it.

- `gsndesign:rationaleText` is a functional data property with the domain
  `gsndesign:Rationale`. The data of the record does not change.
- The Provenance page of the Graffoo diagram no longer has the note that the property is
  undeclared, and `graffoo_check.py` no longer accepts that difference.

---

## Augmentation 0.5.1 (2026-11-10)

A part of an artefact is an artefact, and one failing artefact of a solution outweighs a
conforming one. No term is added, renamed or removed. The RSC audit hub proposed both changes.

- `gsnaug:ArtefactPart rdfs:subClassOf gsn:Artefact`. The domains of the eight provenance
  properties, such as `gsnaug:checkableWith`, now name `gsn:Artefact` alone. The unions of
  `gsnaug:raisedAgainst`, `gsnaug:linksTo` and `gsnaug:tag` no longer name the part. Under a
  reasoner, every part is now an artefact. A query that counts artefacts then also counts parts,
  unless it leaves out the subjects of `gsnaug:partOf`.
- The composition guard of `RL-AUG-conforming_report_confirms_solution` and `RL-AUG-conforming_part_report_confirms_solution` reads every artefact that the solution refers to, and every
  part of one of them that counts for the solution. Before this change, it read one artefact and
  its parts. A solution that referred to one artefact with a conforming report and one with a
  failing report was made true by `RL-AUG-conforming_report_confirms_solution` and untrue by `RL-AUG-failing_report_refutes_solution` on every pass, and the last rule to run
  decided. Now the solution is untrue in every order. Only the SPARQL copies have the guard.

*For case authors:* a solution with a failing check over one of its artefacts is now untrue, even
when a check over another artefact passes. The SPARQL rules do no reasoning. So in a store without
a reasoner, still type a part that a solution refers to as a `gsn:Artefact` too.

Reasoning: `dd-0104` and `dd-0105`, rationales `why-0063` and `why-0064`. They retire `dd-0066`
and `dd-0083`.

---

## Augmentation 0.5.0 (2026-11-06)

The goal that an issue becomes gets a statement and a context, and a solution can name the parts
of an artefact that it relies on. No term is added, renamed or removed. The RSC audit hub proposed
these changes and used them first.

- New rules of the group `issue_goal`. The goal that a revise or a resolve issue becomes takes the issue's
  `schema:description` as its `gsn:statement` (`RL-AUG-issue_goal_statement`). It takes the contexts of the goal that it
  challenges (`RL-AUG-issue_goal_context`), or of the goal that the challenged solution supports (`RL-AUG-issue_goal_context_from_solution`). Before this
  change, the core shapes warned about every such goal, because it had no statement and no
  context. The SPARQL copies write a statement or a context only to a goal that has none. The
  SWRL rules have no such test, so they add the values next to the ones a person wrote.
- A solution can name the parts of an artefact that it relies on, with `gsn:refersTo` next to the
  artefact. A report over a part then counts for the solution only if the solution names that
  part, or names no part of the artefact. This applies to `RL-AUG-conforming_part_report_confirms_solution`, `RL-AUG-failing_part_report_refutes_solution`, `RL-AUG-conforming_part_report_validates_solution` and `RL-AUG-failing_part_report_invalidates_solution`, and to the
  composition guard of `RL-AUG-conforming_report_confirms_solution` and `RL-AUG-conforming_part_report_confirms_solution`. A part that a solution names is also a `gsn:Artefact`,
  because that is the range of `gsn:refersTo`. Only the SPARQL copies have this test.
- The SPARQL copies of `RL-AUG-conforming_report_confirms_solution` and `RL-AUG-conforming_part_report_confirms_solution` write their composition guard as two guards, one over the
  artefact and one over its parts. Each guard starts from the artefact, so an engine no longer
  walks every checkable target of the case for each solution. This alone changes no answer.
- `RQ-AUG-revision_diff` also reads resolve issues, because a resolution can replace an artefact too.
- `RQ-AUG-automated_evidence` lists only evidence: an artefact that a solution refers to. Data that a mechanism
  generates for an instantiation is no longer listed.

*For case authors:* if an issue that becomes a goal has a description, that text is now its
statement. Write a `gsn:statement` on the issue to use other words. If a solution refers to a
part, type the part as a `gsn:Artefact` too, or the core shapes report the reference.

Reasoning: `dd-0101` to `dd-0103`, rationales `why-0061` and `why-0062`, passage `src-0018`.

---

## SHACL shapes 1.1.1 (2026-11-05)

Four checks now report at the severity that they declare. Before this fix, a SHACL engine
reported each of them as a violation.

Each of the four checks put `sh:severity` on its SPARQL constraint. SHACL reads `sh:severity`
only on a shape. pyshacl ignored the value on the constraint and used the default,
`sh:Violation`. The value is now on the shape.

| Shape | Severity in 1.1.1 | Severity reported by 1.1.0 |
| :--- | :--- | :--- |
| `gsnsh:TrueClaimSolutionShape` | warning | violation |
| `gsnsh:ChallengesIrreflexiveShape` | warning | violation |
| `gsnsh:SuccessfulChallengeCastsDoubtShape` | info | violation |
| `gsnsh:ConsistentWithSymmetricShape` (new) | warning | violation, from `gsnsh:ConsistentWithPropertyShape` |

- `gsnsh:ConsistentWithPropertyShape` keeps only its domain check, at violation. A shape has
  one severity, so the symmetry check moved to the new `gsnsh:ConsistentWithSymmetricShape`.
  The symmetry check reports a `gsn:consistentWith` statement without its reverse. Retires
  `dd-0896`. Decisions `dd-1084` and `dd-1085`, rationale `why-0230`.
- The records of the other three shapes change only in where `sh:severity` stands.
- Six more shapes put `sh:severity sh:Violation` on a SPARQL constraint. The value moved to the
  shape on 2026-11-06, after the 1.1.1 release, and ships as part of 1.1.1. A SHACL engine
  reports these findings as violations before and after the move, so no result changes. The
  shapes are `gsnsh:SupportedByIrreflexiveShape`, `gsnsh:InContextOfIrreflexiveShape`,
  `gsnsh:SupportCycleShape`, `gsnsh:CatalogueShape`, `gsnsh:ModuleContextCycleShape` and
  `gsnsh:ChallengeCycleShape`.

*For case authors:* a report from shapes 1.1.0 lists these findings as violations. With 1.1.1,
the same findings are warnings or info. If you filter results by `sh:sourceShape`, the
symmetry finding now comes from `gsnsh:ConsistentWithSymmetricShape`.

---

## Augmentation 0.4.0 (2026-11-05)

A mechanism now checks an artefact. Two properties and the label of one rule are renamed.
Their definitions, domains and ranges do not change.

| Old | New | Note |
| :--- | :--- | :--- |
| `gsnaug:verifiableWith` | `gsnaug:checkableWith` | The label is now "checkable with". The old label was "verified with", the same as the label of the other property. |
| `gsnaug:verifiedWith` | `gsnaug:checkedWith` | The label is now "checked with". |
| "Part Inherits Verifiable With" (the label of rule `RL-AUG-part_inherits_checkable_with`) | "Part Inherits Checkable With" | The rule is a blank node, so it has no IRI to rename. The SPARQL twin is now `augmentation/rules/RL-AUG-part_inherits_checkable_with.rq`. |

The definitions already said that the mechanism checks the truth or the appropriateness of the
artefact. Truth is `gsn:true`, and appropriateness is `gsn:valid`. "Verify" names only the
first of the two, so the properties now use the neutral verb "check".

- The old terms are gone, with no alias.
- New: `gsnaug:decides` on a mechanism, with the value `"truth"`, `"validity"` or both. It says
  whether a check tests that the evidence matches what the solution claims, or that the evidence
  is appropriate for the claim. The rules of the group `truth_from_report` now read only a mechanism that decides truth. The new
  rules of the group `validity_from_report` set `gsn:valid` from a mechanism that decides validity. A mechanism that an
  artefact is checkable with and that decides nothing is a warning
  (`gsnaugsh:CheckingMechanismShape`). Add `gsnaug:decides "truth"` to your checking mechanisms
  to keep what the group `truth_from_report` derived before.
- New: `gsnaug:implements`, from a shape, a rule, a query or another definition to the
  mechanism that it carries out. The definition is now a separate node, and it can be a blank
  node. A mechanism that is still typed as its own shape, rule or query is a warning
  (`gsnaugsh:MechanismSelfDefinitionShape`), and the derivations of the group `mechanism_terms` and the query `RQ-AUG-inspectable_mechanisms`
  read only the new link.
- The rules `RL-AUG-part_inherits_checkable_with` and the rules of the group `truth_from_report`, and the stored queries `RQ-AUG-evidence_verification`, `RQ-AUG-term_impact` and `RQ-AUG-inspectable_mechanisms`, read the new
  terms. The question of `RQ-AUG-evidence_verification` is now "Was this evidence checked, by whom, with what mechanism,
  and did it pass?".
- `gsnaugsh:ReportConflictShape` has `sh:severity sh:Violation` on the shape, not on its SPARQL
  constraint. This change was made on 2026-11-06, after the 0.4.0 release, and ships as part
  of 0.4.0. The shape reports a violation before and after the change.

*For case authors:* the rules and the queries do not see data that uses an old term. A solution
whose artefact names its mechanism with `gsnaug:verifiableWith` gets no truth value from `RL-AUG-conforming_report_confirms_solution` to
`RL-AUG-failing_part_report_refutes_solution`. This update rewrites a graph to the new terms:

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

- Its nine SWRL rules are blank nodes, as the rules of the ontology are since
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
  `swrlx:makeOWLThing(?R, ?A, ?B)` in Support Relation Creation (`RL-GSN-support_relation_creation`). SWRLAPI binds the new
  node to the first argument. The old order made the Drools engine stop the whole run with
  the error that the built-in "returned with unbound arguments". The affected rules are `RL-GSN-support_relation_creation`,
  `RL-GSN-context_relation_creation`, `RL-GSN-confidence_relation_creation`, the rules of the group `confidence_relations`, `RL-GSN-challenge_relation_creation` and `RL-GSN-challenge_chain_invalidation`.
- Twelve rules that tell two individuals apart now use a `differentFrom` atom in place of
  `swrlb:notEqual`, which compares literals only. The rules are `RL-GSN-cross_module_away_support`, `RL-GSN-cross_module_away_context`, `RL-GSN-duplicate_identifier_invalidation`, `RL-GSN-contract_activation`, `RL-GSN-substitution_invalidation` to
  `RL-GSN-cross_module_support`, `RL-GSN-duplicate_acp_identifier_invalidation`, `RL-GSN-solution_confidence_relation`, `RL-GSN-goal_confidence_relation` and `RL-GSN-challenge_chain_invalidation`. OWL does not assume that two names stand for two individuals,
  so a `differentFrom` atom holds only for individuals that the case declares different.
  The SPARQL copies of the rules compare IRIs and do not need the declaration.
- Duplicate ACP Identifier Invalidation (`RL-GSN-duplicate_acp_identifier_invalidation`) reads one identifier variable for both
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
  the range of `gsn:transitivelyChallenges`. Rule `RL-GSN-challenge_chain_invalidation` challenges a support link. Before
  this change, a reasoner inferred that each challenged relationship was a GSN element.
- The nine SPARQL rules that create a node (`RL-GSN-support_relation_creation`, `RL-GSN-context_relation_creation`, `RL-GSN-confidence_relation_creation`, the rules of the group `confidence_relations`, `RL-GSN-challenge_relation_creation` and `RL-GSN-challenge_chain_invalidation`) now build
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
  | `gsn:transitivelySupportedBy` | Core GSN | Support Closure (`RL-GSN-support_closure`) |
  | `gsn:transitivelyInContextOf` | Modular Extension, modules only | Module Context Closure (`RL-GSN-module_context_closure`) |
  | `gsn:transitivelyChallenges` | Dialectic Extension | Challenge Closure (`RL-GSN-challenge_closure`) |

- For each property, one rule marks every element on a cycle as not valid (`RL-GSN-support_cycle_invalidation`, `RL-GSN-module_context_cycle_invalidation`, `RL-GSN-challenge_cycle_invalidation`).
  A second rule marks every relationship on a cycle as not valid (`RL-GSN-support_cycle_relationship_invalidation`, `RL-GSN-module_context_cycle_relationship_invalidation`, `RL-GSN-challenge_cycle_relationship_invalidation`).
- Predicate Conflict Invalidation and Circular Module Invalidation are removed.
  They found a cycle only when it had exactly three nodes.
- The `rdfs:domain` of `gsn:supportedBy` and of `gsn:inContextOf` gains `gsn:Module`. Rules
  `RL-GSN-module_support_propagation`, `RL-GSN-module_context_propagation` and `RL-GSN-cross_module_support` write these links between modules. Before this change, a reasoner inferred
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

- Tri-Goal Conflict is removed. Contradictory Goal Truth (`RL-GSN-contradictory_goal_truth`) matches every case that
  Tri-Goal Conflict matched and draws the same conclusion.
- Conflicting Support (False) is removed. It was disabled in 1.2.3, because Solution
  Propagation (False) (`RL-GSN-solution_propagation_false`) draws the same conclusion.
- Duplicate Name Invalidation (`RL-GSN-duplicate_acp_identifier_invalidation`) is replaced by Duplicate ACP Identifier Invalidation. The
  old rule marked any two nodes with the same `schema:identifier` as not valid. The new rule
  does this only for two assurance claim points. Within one module, Duplicate Identifier
  Invalidation (`RL-GSN-duplicate_identifier_invalidation`) still applies to all elements.
- Goal Inference (`RL-GSN-inferential_relation_goal`) is renamed to Inferential Relation (Goal). The rule logic did not
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
  and no tool read them. The values of the dates were corrected after the release, see
  [The header says what the documentation shows](#the-header-says-what-the-documentation-shows).

*For case authors:* nothing to do. Seven annotation properties are declared that were not
before (`bibo:doi`, `bibo:status`, `dcterms:issued`, `dcterms:modified`,
`schema:includedInDataCatalog`, `schema:logo`, `vann:preferredNamespaceUri`) and two are
gone (`dc:issued`, `dc:modified`); a case that annotated itself with either of those two —
none should have — would need to move to the `dcterms` spelling.

Reasoning: `dd-0996`–`dd-1002`, `dd-0019` and `dd-0032` retired, rationale `why-0218`.

### The header says what the documentation shows

**Not breaking.** Header metadata only. No term and no axiom changed. These corrections were
made on 2026-11-05, after the `v1.3.0` tag, and ship as part of 1.3.0. The WIDOCO
documentation copies each row from one header annotation, and in the tagged header nine of
those annotations had a wrong value or a wrong form.

| Annotation | Tagged 1.3.0 | Now |
| :--- | :--- | :--- |
| `dcterms:issued` | `2025-02-24`, the first issue of the ontology | `"2026-11-05"^^xsd:date`, the issue of this version |
| `dcterms:created` | the text `"20th February 2025"@en` | `"2025-02-20"^^xsd:date` |
| `dcterms:modified` | the string `"2026-11-05T00:00:00Z"` | `"2026-11-05"^^xsd:date` |
| `dc:contributor` | one value, `"Barbara Gallina, Dian Balta, Ingmar Kessler"` | one value per person, with Jule Hendricks added |
| `dc:publisher` | the string `"https://www.fortiss.org/"` | a node with `schema:name "fortiss GmbH"` and `schema:url <https://www.fortiss.org/>` |
| `dc:source` | the citation of the GSN Community Standard, as text | the IRI `<https://scsc.uk/SCSC-141C>` |
| `bibo:doi` | `"https://doi.org/10.5281/zenodo.17808330"`, so the DOI link had the resolver twice | `"10.5281/zenodo.17808330"` |
| `cc:license` | the string `"https://creativecommons.org/licenses/by/4.0/"` | the IRI `<https://creativecommons.org/licenses/by/4.0/>` |
| `dcterms:bibliographicCitation` | the citation of the paper | the citation of the ontology, with its version and DOI |

- The paper has its own link on the header, `rdfs:seeAlso
  <https://doi.org/10.48550/arXiv.2506.11023>`. `CITATION.cff` keeps the paper as the
  preferred citation.
- `owl:priorVersion <https://w3id.org/OntoGSN/ontology/1.2.3>` is new.
- The note that explains the `[OntoGSN]` prefix moves from `skos:note` to `skos:scopeNote`.
  WIDOCO reads `skos:note` as the ontology description, so the documentation showed the note
  in place of the `dc:description`.
- `dc:identifier "SCSC-141C"` and `schema:version 3.0` are gone. Both values belong to the GSN
  Community Standard, not to the ontology, and the header names the standard with
  `dc:source`.

*For case authors:* nothing to do, unless a tool reads `dc:identifier` or `schema:version` from
the ontology header. The declarations of `dc:created`, `dc:identifier` and `schema:version`
are gone, and `schema:name` and `skos:scopeNote` are new. `dc:created` was never a Dublin Core
Elements 1.1 term, and the ontology never used it.

Reasoning: `dd-0018`, `dd-0031`, `dd-0039`, `dd-0048`, `dd-0054`, `dd-0055`, `dd-0058`,
`dd-0060`, `dd-0061`, `dd-0063` and `dd-0065` retired. Decisions `dd-1089` and `dd-1090`,
rationale `why-0234`.

### Twenty-four terms gain a definition

**Not breaking.** Annotations only; no axiom changed. Twenty-four classes and properties
carried an `rdfs:label` and nothing else — the reification class, the pattern cardinalities,
the decorators and the container properties. Every one of them now has a `skos:definition`.

A definition prefixed **`[OntoGSN]`** is this ontology's wording rather than the standard's.
Twenty-one are tagged; three — `gsn:GSNElement`, `gsn:toBeSupportedByContract` and
`gsn:uninstantiated` — are the standard's own sentence and are not. The convention is stated
in a `skos:scopeNote` on the ontology node, so a reader who never opens `development/design/` can still
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
- Rule `RL-GSN-goal_top_flag` and the two SHACL shapes now carry the scoped definition. A parent is
  discounted exactly when some module contains the parent and not the goal, written as
  `gsn:contains+` so it does not depend on `RL-GSN-module_membership` and `RL-GSN-nested_module_membership` having run.
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
  marked true supports. Rules `RL-GSN-solution_propagation_true` and `RL-GSN-solution_propagation_false` give such a claim both truth values, and this shape
  names the cause. Rationale `why-0227`.
- `gsnsh:ModuleContextCycleShape` reports a module on a cycle of context links between
  modules, and `gsnsh:ChallengeCycleShape` reports an element on a cycle of challenges. With
  `gsnsh:SupportCycleShape`, SHACL now reports every cycle that rules `RL-GSN-support_cycle_invalidation`, `RL-GSN-module_context_cycle_invalidation` and `RL-GSN-challenge_cycle_invalidation` mark.
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
  object, and `"dialectic"` as a `gsn:relationshipType` value, matching the nodes that `RL-GSN-support_relation_creation`, `RL-GSN-context_relation_creation`
  and `RL-GSN-challenge_relation_creation` create.
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
which rendered rule `RL-GSN-defeater_declaration` (`challenges(?A,?B) → Defeater(?A)`) inert. Changed to
`rdfs:subClassOf`: every defeater is a goal or a solution, but not the reverse.

- Prefix migration `ontology:` → `gsn:`. Semantically neutral; the graph is identical in
  triple count.
- The empty `rdfs:comment` on every SWRL rule removed.

*For case authors:* `Defeater` membership now arrives only by `RL-GSN-defeater_declaration` inference or by assertion
— anything that relied on every goal being a defeater (nothing should have) changes.

Around this version the repository gained its checked artefacts: the SHACL shapes (1.0.0),
the design record (`development/design/`), SPARQL translations of all 51 SWRL
rules (`ontology/queries/rules/`), and the separated serializations. None of these changes the
ontology itself.

---

## Ontology 1.2.1 — 2026-01-23

**Not breaking.** Fixed an error in the rule Tri-Goal Conflict; added human-readable annotations.
`owl:versionInfo` becomes a string from this version on (1.2 was typed as a decimal).

---

## Ontology 1.2 — 2025-07-10

The earliest version whose artefact survives in this repository, added as
`ontology/serializations/ontogsn.ttl`. Changes from 1.0 and 1.1 were never recorded and cannot be
reconstructed here.
