# Comments of the SPARQL queries

The SPARQL files of this repository (`*.rq` and `*.sparql`) contain no comments. This file
holds the text that the files held until 2026-11-10: the header of each query and every
comment in its body. It has one section per file, grouped by folder.

A query file holds only what an engine or a tool needs to run it. The rule files keep two
comment lines at the top, because tools read them to select and match a rule:

| Line | What reads it | Why |
| :--- | :--- | :--- |
| `# rule:` | `ontology/example/run_rules.py`, `development/dev_tools/query_check.py`, the FinComp hub | The rule id. `run_rules.py --only` and the hub select a rule by it. `query_check.py` makes sure that no two files translate the same rule. |
| `# name:` | `development/dev_tools/query_check.py`, `development/dev_tools/prov_augment.py`, the FinComp hub | The name of the SWRL rule that the file translates, as its `rdfs:label` in the ontology. It joins the file to that rule. |

The header fields are in a table in each section. `development/dev_tools/query_check.py`
reads the table of each query under `ontology/queries/`:

| Field | What it gives | Used by `query_check.py` |
| :--- | :--- | :--- |
| `id` | The competency question that the query answers, for example `CQ-13`. | Must be unique. |
| `role` | Who asks the question (augmentation queries only). | No |
| `operation` | `create`, `read`, `update`, `delete` or `rule`. | Must agree with the file name, or be `rule` in `rules/`. |
| `question` | The question in words. | Must be present. |
| `expect` | What a run against the example case gives: `rows`, `empty`, `insert`, `delete`, `change` or `none`. | The test of each run. |
| `section` | The GSN section of the rule. | Must equal the `gsn:coreOrExtension` of the SWRL rule. |
| `swrl` | The SWRL rule that the file translates. | Must be present. |
| `reads` | The rule in words. | No |

After the table, a section gives the note and the prose of the header, then each comment of
the body. A body comment names the line of the current file that it stood before, or the line
at whose end it stood, with the text of that line.

When you add or change a query, write its header and its explanation here, not in the query.
`python development/dev_tools/query_check.py` fails when a SPARQL file holds any other comment,
and when a query under `ontology/queries/` has no section here.


## `ontology/queries/`

### `ontology/queries/create_assurance_case_skeleton.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-28 |
| operation | create |
| question | How is a new, empty assurance case started? |
| expect | insert |

Header text:

```text
# The only query in the set that names a case namespace of its own, because there is no
# existing element to derive one from. Change the case: prefix below before running it.
```

### `ontology/queries/create_challenge_to_element.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-29 |
| operation | create |
| question | How is a challenge recorded against part of the argument? |
| expect | insert |

Header text:

```text
# A challenge shaped as a goal asserts a counter-claim and puts its target in doubt; one
# shaped as a solution cites evidence and defeats it. Change ?challengeType to pick.
# gsn:Defeater is inferred from gsn:challenges, never asserted - see the class's note.
```

At the end of line 14, `VALUES (?targetId ?challengeId ?challengeType ?challengeStatement) {`:

```text
# PARAMETERS
```

### `ontology/queries/create_context_for_goal.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-30 |
| operation | create |
| question | How is a context element added to a goal or strategy, pointing at an artefact? |
| expect | insert |

At the end of line 14, `VALUES (?elementId ?contextId ?contextStatement ?artefactId) {`:

```text
# PARAMETERS
```

### `ontology/queries/create_goal_under_parent.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-31 |
| operation | create |
| question | How is a sub-goal added beneath an existing goal or strategy? |
| expect | insert |

Header text:

```text
# The new element's IRI is minted in the parent's own namespace, so the query never has
# to know which case it is being run against. Every create query below does the same.
```

At the end of line 15, `VALUES (?parentId ?newId ?newStatement) {`:

```text
# PARAMETERS
```

### `ontology/queries/create_solution_with_artefact.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-32 |
| operation | create |
| question | How is a new piece of evidence attached to a goal? |
| expect | insert |

Header text:

```text
# Evidence enters as two nodes, not one: the artefact is the thing that exists, the
# solution is the argument's reference to it. Conflating them is the commonest ABox error.
```

At the end of line 23, `"Ev7" "ARBITRATION-TEST-2026-07" "2026-07-14"^^xsd:date)`:

```text
# PARAMETERS
```

### `ontology/queries/create_solutions_for_unreferenced_artefacts.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-33 |
| operation | create |
| question | How are artefacts already in the store turned into solutions in bulk? |
| expect | insert |

Header text:

```text
# The import case: evidence arrives from a test pipeline as artefacts, and each one needs
# a solution before the argument can cite it. The identifier is derived from the artefact's,
# so re-running the query adds nothing the second time.
```

### `ontology/queries/create_strategy_between_goals.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-34 |
| operation | create |
| question | How is a strategy inserted between a goal and the sub-goals it already has? |
| expect | change |

Header text:

```text
# Inserting a strategy is a re-parenting, not an addition: the parent's existing support
# links move onto the strategy, or the argument ends up with two routes to the same place.
```

At the end of line 18, `VALUES (?parentId ?strategyId ?strategyStatement) {`:

```text
# PARAMETERS
```

### `ontology/queries/delete_assurance_case.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-38 |
| operation | delete |
| question | How is a whole assurance case and everything under it removed? |
| expect | delete |

Header text:

```text
# Follows reachability, not gsn:contains alone, which misses elements reached only through
# supportedBy. Artefacts are spared - another case may cite them; use
# delete_unreferenced_artefacts.rq for those.
```

At the end of line 9, `VALUES ?caseId { "AC1" }`:

```text
# PARAMETER
```

### `ontology/queries/delete_challenge_and_its_effects.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-39 |
| operation | delete |
| question | How is a challenge withdrawn, together with the doubt and defeat it caused? |
| expect | delete |

Header text:

```text
# Withdrawing the challenge is not enough on its own: gsn:inDoubt and gsn:defeated were
# written onto the target by a rule, and nothing retracts them when the reason goes away.
# Clear them here, then re-run the dialectic updates to re-derive what still holds.
```

At the end of line 13, `VALUES ?challengeId { "CG1" }`:

```text
# PARAMETER
```

### `ontology/queries/delete_element_and_its_links.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-40 |
| operation | delete |
| question | How is an element removed without leaving dangling references to it? |
| expect | delete |

Header text:

```text
# Both directions and the reifications. Deleting only the outgoing triples leaves the
# element's identifier gone but its parents still pointing at a node with no type.
```

At the end of line 11, `VALUES ?elementId { "G1.2" }`:

```text
# PARAMETER
```

### `ontology/queries/delete_materialised_inferences.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-41 |
| operation | delete |
| question | How are the conclusions written by ontology/queries/rules/ cleared before re-running them? |
| expect | delete |

Header text:

```text
# Only the four things nothing but a rule ever writes. gsn:valid, gsn:true, gsn:away,
# gsn:top, gsn:public and gsn:contract are also set by hand, so clearing them would destroy
# assertions; the reified relationships the rules mint cannot be told from hand-drawn ones.
#
# To keep derived and asserted apart, run ontology/example/run_rules.py --out on a copy instead of
# materialising in place.
```

### `ontology/queries/delete_support_link.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-42 |
| operation | delete |
| question | How is one support or context link removed, leaving both elements in place? |
| expect | delete |

Header text:

```text
# Detaching a branch rather than deleting it - the sub-argument survives and can be
# re-parented. The reification of the link goes with it, or it outlives what it describes.
```

At the end of line 10, `VALUES (?fromId ?toId ?predicate) {`:

```text
# PARAMETERS
```

### `ontology/queries/delete_unreferenced_artefacts.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-43 |
| operation | delete |
| question | How are artefacts no solution or context cites any more cleared out? |
| expect | delete |

Header text:

```text
# Run read_solutions_without_artefact first. An artefact that looks unreferenced because
# the solution meant to cite it was never linked is not rubbish, it is a broken link.
```

### `ontology/queries/read_assurance_case_inventory.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-01 |
| operation | read |
| question | What assurance cases are in the store, and what arguments does each contain? |
| expect | rows |

Header text:

```text
# The orientation query: run this first against an unfamiliar store.
```

### `ontology/queries/read_assurance_claim_points.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-02 |
| operation | read |
| question | Where are the assurance claim points, and what confidence argument backs each? |
| expect | rows |

### `ontology/queries/read_away_elements.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-03 |
| operation | read |
| question | Which away elements are referenced, and does the module they come from exist? |
| expect | rows |

Header text:

```text
# An away element repeats something declared elsewhere. If the elsewhere is not in the
# store, the reference is dangling and the argument is not self-contained.
```

### `ontology/queries/read_case_summary_counts.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-04 |
| operation | read |
| question | How many elements of each GSN type does the case contain? |
| expect | rows |

Header text:

```text
# rdfs:subClassOf* walks the TBox, so a Solution is counted as a Solution and the query
# still knows it is a GSN element. Nothing here needs a reasoner to have run first.
```

### `ontology/queries/read_challenges_and_their_targets.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-05 |
| operation | read |
| question | What challenges have been raised, against what, and by what kind of defeater? |
| expect | rows |

Header text:

```text
# A goal-shaped challenge puts its target in doubt; a solution-shaped one cites evidence
# and defeats it. The distinction decides how urgent the row is.
```

### `ontology/queries/read_claim_points_without_confidence_argument.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-06 |
| operation | read |
| question | Which assurance claim points have no confidence argument behind them? |
| expect | rows |

Header text:

```text
# An assurance claim point is a promise that confidence in this step has been argued
# somewhere. One with nothing associated is the promise unkept.
```

### `ontology/queries/read_context_in_scope_for_goal.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-07 |
| operation | read |
| question | What context, assumptions and justifications are in scope for a given goal? |
| expect | rows |

Header text:

```text
# The query walks the support chain itself, so a goal is read in the context declared
# on it AND on everything above it. The SWRL rule "Context Inheritance" (S17) inherits
# assumptions only.
```

At the end of line 7, `VALUES ?goalId { "G1.1" }`:

```text
# PARAMETER: the goal being read
```

### `ontology/queries/read_duplicate_identifiers.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-08 |
| operation | read |
| question | Do two distinct elements share a schema:identifier? |
| expect | rows |

Header text:

```text
# The ontology requires exactly one identifier per element and the SWRL rules invalidate
# both parties to a clash (S25, S41), because every other query addresses elements by it.
```

### `ontology/queries/read_element_by_identifier.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-09 |
| operation | read |
| question | What does the element with a given identifier say, and what is it linked to? |
| expect | rows |

Header text:

```text
# The addressing primitive. Every GSN element carries exactly one schema:identifier, so
# that - not the IRI - is how a person refers to an element.
```

At the end of line 7, `VALUES ?elementId { "G1" }`:

```text
# PARAMETER: the identifier to look up
```

### `ontology/queries/read_element_status_flags.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-10 |
| operation | read |
| question | What is the current status of every element - valid, true, in doubt, defeated? |
| expect | rows |

Header text:

```text
# One row per flag rather than one row per element, because the flags are set by different
# rules at different times and the useful question is usually about one of them.
```

### `ontology/queries/read_elements_unreachable_from_top_goal.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-11 |
| operation | read |
| question | Which elements are not reachable from any top goal - present but unargued? |
| expect | rows |

Header text:

```text
# Reachability is over support and context together, since a context element is part of
# the argument without ever being supported by anything.
```

### `ontology/queries/read_evidence_supporting_goal.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-12 |
| operation | read |
| question | What evidence ultimately supports a given goal? |
| expect | rows |

Header text:

```text
# Solutions are references to evidence; the artefact behind the reference is what an
# auditor actually asks to see, so both are returned.
```

At the end of line 7, `VALUES ?goalId { "G1" }`:

```text
# PARAMETER: the goal to trace
```

### `ontology/queries/read_goal_support_tree.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-13 |
| operation | read |
| question | What is the whole argument beneath a given goal? |
| expect | rows |

Header text:

```text
# ?depth is the length of the shortest support chain from the root, which is what makes
# the result readable as a tree rather than a bag of elements.
```

At the end of line 6, `VALUES ?rootId { "G1" }`:

```text
# PARAMETER: the goal to expand
```

### `ontology/queries/read_goals_affected_by_challenge.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-14 |
| operation | read |
| question | Which claims above a challenged element lose support if the challenge stands? |
| expect | rows |

Header text:

```text
# The challenge is levied at one element; what matters is everything resting on it.
```

### `ontology/queries/read_goals_resting_on_artefact.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-15 |
| operation | read |
| question | If a given artefact is withdrawn or superseded, which claims are affected? |
| expect | rows |

Header text:

```text
# The impact analysis that has to be run before any evidence item is replaced.
```

At the end of line 6, `VALUES ?artefactId { "Ev2" }`:

```text
# PARAMETER: the artefact in question
```

### `ontology/queries/read_goals_without_support.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-16 |
| operation | read |
| question | Which goals have no support at all and are not admitted to be undeveloped? |
| expect | rows |

Header text:

```text
# An unadmitted gap: the argument stops, and nothing on the diagram says so. This is the
# single most useful completeness check in the set.
```

### `ontology/queries/read_invalid_elements.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-17 |
| operation | read |
| question | Which elements or relationships are currently invalid, in doubt or defeated? |
| expect | rows |

Header text:

```text
# The three dialectic and validity flags collapsed into one worklist, with the reason.
```

### `ontology/queries/read_module_dependencies.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-18 |
| operation | read |
| question | Which modules depend on which, and through which elements? |
| expect | rows |

Header text:

```text
# The module-level edge is derived from the element-level one, so the witness element is
# returned with it: a dependency nobody can point at an element for is a modelling error.
```

### `ontology/queries/read_pattern_instantiations.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-19 |
| operation | read |
| question | Which elements instantiate which argument pattern, and is the pattern's own documentation complete? |
| expect | rows |

Header text:

```text
# The standard asks a pattern to state its intent, applicability and consequences before
# anyone reuses it. Missing sections are how a pattern gets applied out of context.
```

### `ontology/queries/read_public_elements_in_contract_modules.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-20 |
| operation | read |
| question | Which public elements sit inside a contract module, where they must not? |
| expect | rows |

Header text:

```text
# SWRL rule "Public Contract Invalidation" (S39) as a read: a contract module mediates
# between interfaces and has no interface of its own to publish through.
```

### `ontology/queries/read_relationship_decorators.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-21 |
| operation | read |
| question | Which relationships carry pattern decorators - optional, multiple, cardinality? |
| expect | rows |

Header text:

```text
# These say how a pattern is to be instantiated, and are the part most often lost when a
# pattern is copied into a concrete case by hand.
```

### `ontology/queries/read_solutions_without_artefact.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-22 |
| operation | read |
| question | Which solutions cite no artefact - evidence claimed but not identified? |
| expect | rows |

### `ontology/queries/read_stale_evidence.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-23 |
| operation | read |
| question | Which artefacts predate a given date, and which claims still rest on them? |
| expect | rows |

Header text:

```text
# OntoGSN dates nothing itself - an artefact is dated by whatever the ABox uses, here
# dcterms:created. Change the property below if your case records it differently.
```

At the end of line 9, `VALUES ?cutoff { "2025-01-01"^^xsd:date }`:

```text
# PARAMETER: anything older than this
```

### `ontology/queries/read_support_cycles.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-24 |
| operation | read |
| question | Does any element support itself through a chain - a circular argument? |
| expect | rows |

Header text:

```text
# gsn:supportedBy is asymmetric and irreflexive, so a cycle is a contradiction rather
# than a warning; an OWL reasoner would report the whole ABox inconsistent instead of
# telling you where. This says where.
```

### `ontology/queries/read_top_goals.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-25 |
| operation | read |
| question | What is the top goal of each argument - the claim everything else supports? |
| expect | rows |

Header text:

```text
# Two ways of being top are accepted: the gsn:top decorator, and being a goal that no
# other element supports. A case where the two disagree is worth looking at.
```

### `ontology/queries/read_undeveloped_elements.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-26 |
| operation | read |
| question | Which lines of argument are declared undeveloped, and are still undeveloped? |
| expect | rows |

Header text:

```text
# The decorator is a promise. This finds the ones still outstanding, and separately the
# ones that have since been developed and whose decorator nobody cleared.
```

### `ontology/queries/read_uninstantiated_elements.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-27 |
| operation | read |
| question | Which elements are still uninstantiated placeholders from a pattern? |
| expect | rows |

Header text:

```text
# The hollow triangle. A published case carrying one is a case that was never finished.
```

### `ontology/queries/update_element_statement.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-35 |
| operation | update |
| question | How is the wording of a claim, strategy or context corrected? |
| expect | change |

Header text:

```text
# DELETE then INSERT in one operation, not two: gsn:statement is single-valued in
# practice, and a bare INSERT would leave the element asserting both wordings at once.
```

At the end of line 7, `VALUES (?elementId ?new) {`:

```text
# PARAMETERS
```

### `ontology/queries/update_mark_element_invalid.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-36 |
| operation | update |
| question | How is a single element marked invalid? |
| expect | change |

Header text:

```text
# The flag-setting idiom used by every update below: delete whatever value is there,
# insert the new one, and skip the row entirely if it already says what you want.
```

At the end of line 7, `VALUES ?elementId { "G1.1" }`:

```text
# PARAMETER
```

### `ontology/queries/update_retarget_solution_to_new_artefact.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-37 |
| operation | update |
| question | How is a solution repointed when its evidence is superseded by a new version? |
| expect | change |

Header text:

```text
# The re-baselining operation. The solution - the argument's reference - stays put and
# keeps its identifier; only the artefact behind it moves.
```

At the end of line 7, `VALUES (?solutionId ?newArtefactId) {`:

```text
# PARAMETERS
```


## `ontology/queries/rules/`

### `ontology/queries/rules/s01_assumption_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | Assumption(?A) ^ valid(?A, false) ^ 'in context of'(?B, ?A) -> valid(?B, false) |
| reads | IF A is an Assumption AND A is NOT valid AND B is in context of A THEN B is NOT valid |

### `ontology/queries/rules/s02_contextual_relation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | rdf:subject(?R, ?A) ^ 'in context of'(?A, ?B) ^ rdf:object(?R, ?B) -> 'relationship type'(?R, "contextual") |
| reads | IF R has subject A AND A is in context of B AND R has object B THEN R is a contextual relationship |

### `ontology/queries/rules/s03_evidential_relation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | Solution(?B) ^ 'supported by'(?A, ?B) ^ rdf:subject(?R, ?A) ^ rdf:object(?R, ?B) -> 'relationship type'(?R, "evidential") |
| reads | IF B is a Solution AND A is supported by B AND R has subject A AND R has object B THEN R is an evidential relationship |

### `ontology/queries/rules/s04_inferential_relation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | Strategy(?B) ^ 'supported by'(?A, ?B) ^ rdf:subject(?R, ?A) ^ rdf:object(?R, ?B) -> 'relationship type'(?R, "inferential") |
| reads | IF B is a Strategy AND A is supported by B AND R has subject A AND R has object B THEN R is an inferential relationship |

### `ontology/queries/rules/s05_inferential_relation_goal.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | 'supported by'(?A, ?B) ^ rdf:subject(?R, ?A) ^ rdf:object(?R, ?B) ^ Goal(?B) -> 'relationship type'(?R, "inferential") |
| reads | IF B is a Goal AND A is supported by B AND R has subject A AND R has object B THEN R is an inferential relationship |

### `ontology/queries/rules/s06_goal_top_flag.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | change |
| section | Core GSN |
| swrl | 'supported by'(?X, ?A) ^ Goal(?A) -> 'top (goal)'(?A, false) |
| reads | IF X is supported by A AND A is a Goal AND X is in scope for A THEN A is NOT a top-level goal; likewise IF A challenges anything THEN A is NOT a top-level goal |

Before line 6, `DELETE { ?A gsn:top ?old }`:

```text
# ?X is a Goal or a Strategy without saying so: those are the rdfs:domain of gsn:supportedBy.
# A strategy parent counts, which is the whole point - a goal reached through a strategy is
# not the pinnacle claim, and the earlier form of this rule missed every one of them.
#
# A parent counts only when it is IN SCOPE. The top goal is the pinnacle claim of an
# argument, not of the whole store, so an away goal reached from another module stays the top
# goal of its own module: a parent is discounted exactly when some module holds the parent and
# not the goal. Written as containment rather than gsn:inModule so that the rule does not
# depend on S53 and S54 having run first. With no modules in the graph nothing is ever
# discounted, which is the unscoped reading this rule used to have.
#
# A goal that challenges something is never a top goal either. It is the root of a dialectic
# structure, not the overall claim the author is asserting, and nothing supports it precisely
# because it is levied against the argument rather than part of it.
```

### `ontology/queries/rules/s08_contradictory_goal_truth.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | true(?A, false) ^ true(?B, true) ^ 'supported by'(?B, ?A) ^ Goal(?A) -> valid(?B, false) |
| reads | IF A is NOT true AND B is true AND B is supported by A AND A is a Goal THEN B is NOT valid |

### `ontology/queries/rules/s10_solution_propagation_true.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | Solution(?A) ^ 'supported by'(?B, ?A) ^ true(?A, true) -> true(?B, true) |
| reads | IF A is a Solution AND B is supported by A AND A is true AND no other solution supporting B is untrue or undetermined AND no assumption B sits in the context of is untrue THEN B becomes true |

Note:

```text
# note:      THE GUARD BELOW IS NOT IN THE SWRL. Support in GSN is a composition: a claim
#            follows only when everything supporting it holds. Expressing "and nothing else
#            supporting it fails" needs negation as failure, which SWRL does not have, so the
#            source rule states the positive half and this translation adds the guard. See
#            the rationale why-0227 in the design record (decision dd-1064). Without it S10
#            and S11/S16 alternate forever on any claim with mixed support.
```

Before line 14, `FILTER NOT EXISTS {`:

```text
  # no sibling solution that is untrue, or that has no truth value yet
```

Before line 19, `FILTER NOT EXISTS {`:

```text
  # and nothing S16 would turn false underneath us
```

### `ontology/queries/rules/s11_solution_propagation_false.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | Solution(?A) ^ true(?A, false) ^ 'supported by'(?B, ?A) -> true(?B, false) |
| reads | IF A is a Solution AND A is NOT true AND B is supported by A THEN B becomes NOT true |

### `ontology/queries/rules/s12_mixed_support_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | valid(?B, false) ^ valid(?A, true) ^ 'supported by'(?C, ?B) ^ 'supported by'(?C, ?A) -> valid(?C, false) |
| reads | IF B is NOT valid AND A is valid AND C is supported by B and A THEN C is NOT valid |

### `ontology/queries/rules/s14_relation_false_propagation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | true(?R, false) ^ rdf:subject(?R, ?A) ^ 'in context of'(?A, ?B) ^ Relationship(?R) ^ rdf:object(?R, ?B) -> true(?A, false) |
| reads | IF R is NOT true AND R has subject A and object B AND A is in context of B AND R is a Relationship THEN A is NOT true |

### `ontology/queries/rules/s16_assumption_false_propagation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | Assumption(?A) ^ true(?A, false) ^ 'in context of'(?B, ?A) -> true(?B, false) |
| reads | IF A is an Assumption AND A is NOT true AND B is in context of A THEN B is NOT true |

### `ontology/queries/rules/s17_context_inheritance.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | 'supported by'(?B, ?C) ^ 'in context of'(?B, ?A) ^ Assumption(?A) ^ Goal(?C) -> 'in context of'(?C, ?A) |
| reads | IF B is supported by C AND B is in context of A AND A is an Assumption AND C is a Goal THEN C is in context of A |

### `ontology/queries/rules/s18_support_relation_creation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | 'supported by'(?A, ?B) ^ swrlx:makeOWLThing(?R, ?A, ?B) -> rdf:subject(?R, ?A) ^ Relationship(?R) ^ rdf:object(?R, ?B) |
| reads | IF A is supported by B THEN Create R AND R has subject A and object B |

Before line 20, `BIND(CONCAT("R-", REPLACE(STR(?A), "^.*[#/]", ""), "-supportedBy-", REPLACE(STR(?B), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s19_context_relation_creation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | 'in context of'(?A, ?B) ^ swrlx:makeOWLThing(?R, ?A, ?B) -> rdf:subject(?R, ?A) ^ Relationship(?R) ^ rdf:object(?R, ?B) |
| reads | IF A is in context of B THEN Create R AND R has subject A and object B |

Before line 20, `BIND(CONCAT("R-", REPLACE(STR(?A), "^.*[#/]", ""), "-inContextOf-", REPLACE(STR(?B), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s20_final_pattern_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Argument Pattern Extension |
| swrl | 'instantiation of'(?B, ?C) ^ final(?A, true) ^ Pattern(?C) ^ contains(?A, ?B) ^ contains(?A, ?C) -> valid(?A, false) |
| reads | IF B is an instantiation of Pattern C inside container A AND A is marked final AND A contains both B and C AND C is a Pattern THEN A is NOT valid |

### `ontology/queries/rules/s21_template_undeveloped_invalidation_a.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Argument Pattern Extension |
| swrl | Template(?A) ^ undeveloped(?R, true) ^ rdf:subject(?R, ?A) ^ published(?A, true) -> valid(?A, false) ^ valid(?R, false) |
| reads | IF A is a Template AND there is an undeveloped Relation R whose subject is A AND A is published THEN A is NOT valid AND R is NOT valid |

### `ontology/queries/rules/s22_template_undeveloped_invalidation_b.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Argument Pattern Extension |
| swrl | Template(?A) ^ undeveloped(?R, true) ^ rdf:subject(?R, ?B) ^ published(?A, true) ^ contains(?A, ?B) -> valid(?A, false) ^ valid(?R, false) |
| reads | IF A is a Template AND there is an undeveloped Relation R whose subject is B AND A is published and contains B THEN A is NOT valid AND R is NOT valid |

### `ontology/queries/rules/s23_cross_module_away_support.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'in module'(?A, ?M) ^ 'in module'(?B, ?N) ^ 'supported by'(?A, ?B) ^ Module(?N) ^ Module(?M) ^ differentFrom(?M, ?N) -> away(?B, true) |
| reads | IF M is a Module AND M contains A AND N is a Module AND N contains B AND A is supported by B AND M and N are distinct THEN B is away (in another Module) |

### `ontology/queries/rules/s24_cross_module_away_context.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'in module'(?A, ?M) ^ 'in module'(?B, ?N) ^ Module(?N) ^ 'in context of'(?A, ?B) ^ Module(?M) ^ differentFrom(?M, ?N) -> away(?B, true) |
| reads | IF Module M contains A AND Module N contains B AND A is in context of B AND M and N are distinct Modules THEN B is away (in another Module) |

### `ontology/queries/rules/s25_duplicate_identifier_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'in module'(?B, ?M) ^ 'in module'(?A, ?M) ^ schema:identifier(?A, ?ID) ^ Module(?M) ^ differentFrom(?A, ?B) ^ schema:identifier(?B, ?ID) -> valid(?A, false) ^ valid(?B, false) |
| reads | IF Module M contains both A and B AND A and B share the same schema identifier ID AND A and B are distinct THEN A is NOT valid AND B is NOT valid |

### `ontology/queries/rules/s26_contract_violation_relation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | rdf:object(?R, ?M1) ^ Module(?M1) ^ Module(?M2) ^ 'in module'(?A, ?M2) ^ 'supported by'(?A, ?M1) ^ rdf:subject(?R, ?A) ^ contract(?M2, true) -> valid(?R, false) |
| reads | IF Relationship R has object Module M1 AND M1 and M2 are Modules AND M2 contains A AND A is supported by M1 AND R has subject A AND M2 is under contract THEN R is NOT valid |

### `ontology/queries/rules/s27_context_contract_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'in context of'(?A, ?M1) ^ rdf:object(?R, ?M1) ^ Module(?M1) ^ Module(?M2) ^ 'in module'(?A, ?M2) ^ rdf:subject(?R, ?A) ^ contract(?M2, true) -> valid(?R, false) |
| reads | IF A is in context of Module M1 AND Relationship R has object M1 AND M1 and M2 are Modules AND M2 contains A AND R has subject A AND M2 is under contract THEN R is NOT valid |

### `ontology/queries/rules/s28_contract_support_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'in module'(?A, ?M) ^ 'to be supported by contract'(?A, true) ^ contract(?M, true) ^ Module(?M) -> valid(?A, false) |
| reads | IF Module M contains A AND A is to be supported by contract AND M is under contract THEN A is NOT valid |

### `ontology/queries/rules/s29_away_goal_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | rdf:subject(?R, ?G1) ^ Module(?M1) ^ Goal(?G1) ^ rdf:object(?R, ?G2) ^ Module(?M2) ^ 'supported by'(?G1, ?G2) ^ away(?G1, true) ^ 'in module'(?G1, ?M1) ^ 'in module'(?G2, ?M2) -> valid(?R, false) |
| reads | IF Relationship R links Goal G1 to Goal G2 AND M1 and M2 are Modules AND G1 is a Goal contained in M1 AND G2 is a Goal contained in M2 AND G1 is away and supported by G2 THEN R is NOT valid |

### `ontology/queries/rules/s30_contract_activation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | away(?A, true) ^ 'to be supported by contract'(?A, true) ^ Module(?M1) ^ Module(?M2) ^ 'in module'(?A, ?M1) ^ 'in module'(?B, ?M2) ^ 'supported by'(?A, ?B) ^ differentFrom(?M1, ?M2) -> contract(?M2, true) |
| reads | IF A is away and must be supported by contract AND M1 and M2 are Modules AND A is in M1 AND B is in M2 AND A is supported by B AND M1 and M2 are distinct THEN M2 becomes a contract Module |

### `ontology/queries/rules/s31_contract_relation_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'in module'(?B, ?M) ^ 'in module'(?A, ?M) ^ 'to be supported by contract'(?A, true) ^ 'supported by'(?A, ?B) ^ rdf:subject(?R, ?A) ^ Module(?M) ^ rdf:object(?R, ?B) -> valid(?R, false) |
| reads | IF Module M contains both A and B AND A is to be supported by contract and is supported by B AND Relationship R links A to B THEN R is NOT valid |

### `ontology/queries/rules/s32_context_consistency.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'in context of'(?G1, ?C1) ^ 'in context of'(?G2, ?C2) ^ Goal(?G1) ^ Goal(?G2) ^ away(?G2, true) ^ 'supported by'(?G1, ?G2) ^ Context(?C2) -> 'consistent with'(?C1, ?C2) |
| reads | IF G1 is in context of C1 AND G2 is in context of C2 AND G1 and G2 are Goals AND G2 is away AND G1 is supported by G2 AND C2 is a Context THEN C1 is consistent with C2 |

### `ontology/queries/rules/s33_substitution_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | contains(?M2, ?G) ^ Module(?M1) ^ Module(?M2) ^ 'substituted by'(?J, ?G) ^ contains(?M1, ?J) ^ Justification(?J) ^ 'in context of'(?E, ?J) ^ differentFrom(?M1, ?M2) -> valid(?J, false) |
| reads | IF Module M2 contains Goal G AND M1 and M2 are Modules AND Justification J is substituted by G AND M1 contains J AND J is a Justification AND some element E is in context of J AND M1 and M2 are distinct THEN J is NOT valid |

### `ontology/queries/rules/s34_module_support_propagation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | Module(?M1) ^ Module(?M2) ^ 'supported by'(?E1, ?E2) ^ 'in module'(?E1, ?M1) ^ contains(?M2, ?E2) ^ differentFrom(?M1, ?M2) -> 'supported by'(?M1, ?M2) |
| reads | IF M1 and M2 are Modules AND E1 in M1 is supported by E2 in M2 AND M1 and M2 are distinct THEN M1 is supported by M2 |

### `ontology/queries/rules/s35_module_context_propagation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | Module(?M1) ^ Module(?M2) ^ 'in module'(?E1, ?M1) ^ 'in module'(?E2, ?M2) ^ 'in context of'(?E1, ?E2) ^ differentFrom(?M1, ?M2) -> 'in context of'(?M1, ?M2) |
| reads | IF M1 and M2 are Modules AND E1 in M1 is in context of E2 in M2 AND M1 and M2 are distinct THEN M1 is in context of M2 |

### `ontology/queries/rules/s36_cross_module_support.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'supported by'(?E1, ?M2) ^ Module(?M1) ^ Module(?M2) ^ 'in module'(?E1, ?M1) ^ differentFrom(?M1, ?M2) -> 'supported by'(?M1, ?M2) |
| reads | IF E1 is supported by Module M2 AND M1 and M2 are Modules AND M1 contains E1 AND M1 and M2 are distinct THEN M1 is supported by M2 |

### `ontology/queries/rules/s38_public_context_propagation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | public(?G, true) ^ 'in context of'(?G, ?C) ^ Goal(?G) -> public(?C, true) |
| reads | IF G is a public Goal AND G is in context of C THEN C is public |

### `ontology/queries/rules/s39_public_contract_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | contract(?C, true) ^ public(?E, true) ^ 'in module'(?E, ?C) -> valid(?E, false) |
| reads | IF C is a contract AND E is public AND C contains E THEN E is NOT valid |

### `ontology/queries/rules/s40_confidence_relation_creation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Confidence Argument Extension |
| swrl | 'assurance claim point'(?A, true) ^ 'Artefact Reference'(?A) ^ swrlx:makeOWLThing(?R, ?A) -> 'Relationship with Confidence'(?R) ^ rdf:subject(?R, ?A) ^ 'assurance claim point'(?R, true) |
| reads | IF A is an Artefact Reference marked as an assurance claim point AND we introduce a reified confidence Relationship R for A THEN R is a Relationship with Confidence whose subject is A and which is itself an assurance claim point |

Before line 21, `BIND(CONCAT("RC-", REPLACE(STR(?A), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s41_duplicate_acp_identifier_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Confidence Argument Extension |
| swrl | 'assurance claim point'(?A, true) ^ 'assurance claim point'(?B, true) ^ schema:identifier(?A, ?N) ^ schema:identifier(?B, ?N) ^ differentFrom(?A, ?B) -> valid(?A, false) ^ valid(?B, false) |
| reads | IF A and B are assurance claim points AND A and B have the same schema identifier N AND A and B are distinct THEN A is NOT valid AND B is NOT valid |

### `ontology/queries/rules/s42_strategy_confidence_relation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Confidence Argument Extension |
| swrl | 'supported by'(?G1, ?S) ^ 'supported by'(?S, ?G2) ^ 'Relationship with Confidence'(?R1) ^ swrlx:makeOWLThing(?R2, ?S, ?G2) ^ Strategy(?S) ^ Goal(?G1) ^ Goal(?G2) ^ rdf:object(?R1, ?S) ^ 'associated with'(?R1, ?A) ^ rdf:subject(?R1, ?G1) -> rdf:subject(?R2, ?S) ^ 'Relationship with Confidence'(?R2) ^ rdf:object(?R2, ?G2) ^ 'associated with'(?R2, ?A) ^ 'assurance claim point'(?R2, true) |
| reads | IF Goal G1 is supported by Strategy S AND S is supported by Goal G2 AND there is a Relationship with Confidence R1 from G1 to S associated with A THEN we create a Relationship with Confidence R2 from S to G2 associated with the same A AND mark R2 as an assurance claim point |

Before line 30, `BIND(CONCAT("RC-", REPLACE(STR(?S), "^.*[#/]", ""), "-", REPLACE(STR(?G2), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s43_goal_strategy_confidence.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Confidence Argument Extension |
| swrl | 'supported by'(?G2, ?S) ^ 'Relationship with Confidence'(?R1) ^ rdf:subject(?R1, ?S) ^ 'supported by'(?S, ?G1) ^ swrlx:makeOWLThing(?R2, ?G2, ?S) ^ rdf:object(?R1, ?G1) ^ Strategy(?S) ^ Goal(?G1) ^ Goal(?G2) ^ 'associated with'(?R1, ?A) -> 'Relationship with Confidence'(?R2) ^ 'associated with'(?R2, ?A) ^ 'assurance claim point'(?R2, true) ^ rdf:subject(?R2, ?G2) ^ rdf:object(?R2, ?S) |
| reads | IF Goal G2 is supported by Strategy S AND S is supported by Goal G1 AND there is a Relationship with Confidence R1 from S to G1 associated with A THEN we create a Relationship with Confidence R2 from G2 to S associated with the same A AND mark R2 as an assurance claim point |

Before line 30, `BIND(CONCAT("RC-", REPLACE(STR(?G2), "^.*[#/]", ""), "-", REPLACE(STR(?S), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s44_solution_confidence_relation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Confidence Argument Extension |
| swrl | 'supported by'(?G, ?S2) ^ Solution(?S1) ^ rdf:object(?R1, ?S1) ^ 'Relationship with Confidence'(?R1) ^ swrlx:makeOWLThing(?R2, ?G, ?S2) ^ 'supported by'(?G, ?S1) ^ Goal(?G) ^ differentFrom(?S1, ?S2) ^ 'associated with'(?R1, ?A) ^ rdf:subject(?R1, ?G) ^ Solution(?S2) -> rdf:object(?R2, ?S2) ^ 'Relationship with Confidence'(?R2) ^ rdf:subject(?R2, ?G) ^ 'associated with'(?R2, ?A) ^ 'assurance claim point'(?R2, true) |
| reads | IF Goal G is supported by two distinct Solutions S1 and S2 AND there is a Relationship with Confidence R1 from G to S1 associated with A THEN we create a Relationship with Confidence R2 from G to S2 associated with the same A AND mark R2 as an assurance claim point |

Before line 30, `BIND(CONCAT("RC-", REPLACE(STR(?G), "^.*[#/]", ""), "-", REPLACE(STR(?S2), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s45_goal_confidence_relation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Confidence Argument Extension |
| swrl | 'supported by'(?G, ?S2) ^ Goal(?S1) ^ rdf:object(?R1, ?S1) ^ 'Relationship with Confidence'(?R1) ^ swrlx:makeOWLThing(?R2, ?G, ?S2) ^ 'supported by'(?G, ?S1) ^ Goal(?S2) ^ Goal(?G) ^ differentFrom(?S1, ?S2) ^ 'associated with'(?R1, ?A) ^ rdf:subject(?R1, ?G) -> rdf:object(?R2, ?S2) ^ 'Relationship with Confidence'(?R2) ^ rdf:subject(?R2, ?G) ^ 'associated with'(?R2, ?A) ^ 'assurance claim point'(?R2, true) |
| reads | IF Goal G is supported by two distinct Goals S1 and S2 AND there is a Relationship with Confidence R1 from G to S1 associated with A THEN we create a Relationship with Confidence R2 from G to S2 associated with the same A AND mark R2 as an assurance claim point |

Before line 30, `BIND(CONCAT("RC-", REPLACE(STR(?G), "^.*[#/]", ""), "-", REPLACE(STR(?S2), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s46_challenge_defeat.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | valid(?S, true) ^ challenges(?S, ?E) ^ Solution(?S) -> defeated(?E, true) |
| reads | IF S is a valid Solution AND S challenges E THEN E is defeated |

### `ontology/queries/rules/s47_defeated_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | defeated(?E, true) -> valid(?E, false) |
| reads | IF E is defeated THEN E is NOT valid |

### `ontology/queries/rules/s48_challenge_doubt.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | challenges(?G, ?E) ^ true(?G, true) ^ Goal(?G) -> 'in doubt'(?E, true) |
| reads | IF Goal G challenges E AND G is true THEN E is in doubt |

### `ontology/queries/rules/s49_undeveloped_defeat.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | undeveloped(?G, false) ^ challenges(?G, ?E) ^ Goal(?G) ^ 'in doubt'(?E, true) -> defeated(?E, true) |
| reads | IF Goal G challenges E AND G is NOT undeveloped AND E is in doubt THEN E is defeated |

### `ontology/queries/rules/s50_challenge_relation_creation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | challenges(?A, ?B) ^ swrlx:makeOWLThing(?R, ?A, ?B) -> rdf:subject(?R, ?A) ^ Relationship(?R) ^ rdf:object(?R, ?B) ^ 'relationship type'(?R, dialectic) |
| reads | IF A challenges B AND we reify this challenge as a Relationship R THEN R is a reified Relationship with subject A, object B and the dialectic type |

Before line 21, `BIND(CONCAT("R-", REPLACE(STR(?A), "^.*[#/]", ""), "-challenges-", REPLACE(STR(?B), "^.*[#/]", "")) AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s51_challenge_chain_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | challenges(?D, ?R) ^ rdf:subject(?R, ?G3) ^ rdf:object(?R, ?G1) ^ Goal(?G1) ^ Goal(?G3) ^ swrlx:makeOWLThing(?S, ?G3) ^ Goal(?G2) ^ 'supported by'(?G3, ?G1) ^ 'supported by'(?G3, ?G2) ^ differentFrom(?G1, ?G2) -> 'supported by'(?S, ?G2) ^ 'supported by'(?G3, ?S) ^ valid(?D, false) ^ 'supported by'(?S, ?G1) ^ challenges(?D, ?S) ^ valid(?S, false) ^ valid(?R, false) ^ Strategy(?S) |
| reads | IF Defeater D challenges Relationship R between Goals G3 (subject) and G1 (object) AND G3 is ALSO supported by a second Goal G2 distinct from G1 AND we introduce a Strategy S for G3 THEN Strategy S is supported by G1 and G2 AND G3 is supported by S AND D now challenges S AND D, S and R are all marked NOT valid |

Header text:

```text
# The inference between a goal and its supporting goals is indivisible, so a challenge aimed at
# one SupportedBy link where the goal has several is not a challenge that can be made; the
# standard says such a challenge requires a strategy to be inserted (1:6.3.12, page 54). ?G2 is
# therefore a sibling supporter of ?G3, not any goal in the store. Without the supportedBy(?G3,
# ?G2) atom it was unconstrained, and the rule attached the new strategy to every other goal.
```

Before line 34, `BIND(CONCAT("St-", REPLACE(STR(?G3), "^.*[#/]", ""), "-rebutted") AS ?iriKey)`:

```text
  # the IRI is built from the IRIs of the elements, not from their identifiers,
  # because two elements in different modules may share an identifier
```

### `ontology/queries/rules/s52_defeater_declaration.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | challenges(?A, ?B) -> Defeater(?A) |
| reads | IF A challenges B THEN A is a Defeater |

### `ontology/queries/rules/s53_module_membership.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | Module(?M) ^ contains(?M, ?Arg) ^ Argument(?Arg) ^ contains(?Arg, ?E) ^ GSNElement(?E) -> 'in module'(?E, ?M) |
| reads | IF M is a Module AND M contains Argument Arg AND Arg contains GSN element E THEN E is in module M |

Before line 7, `INSERT { ?E gsn:inModule ?M }`:

```text
# A module contains arguments and other modules, never elements directly, so the module an
# element belongs to is always two steps away. Every rule of the Modular Extension needs that
# traversal, so it is derived once here and stated in one atom everywhere else.
```

### `ontology/queries/rules/s54_nested_module_membership.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | Module(?M) ^ contains(?M, ?N) ^ Module(?N) ^ 'in module'(?E, ?N) -> 'in module'(?E, ?M) |
| reads | IF M is a Module AND M contains Module N AND E is in module N THEN E is also in module M |

Before line 6, `INSERT { ?E gsn:inModule ?M }`:

```text
# A module may contain other modules, so membership carries upward. Applied to a fixpoint by
# ontology/example/run_rules.py this reaches any depth of nesting; on its own it advances one level, which
# is why its trigger in rule_cases.ttl states the inner membership S53 would otherwise derive.
```

### `ontology/queries/rules/s55_support_closure.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | 'supported by'(?A, ?B) -> 'transitively supported by'(?A, ?B) |
| reads | IF A is supported by B THEN A is transitively supported by B |

Note:

```text
# note:      The SWRL rule states one step and leaves the chain to owl:TransitiveProperty.
#            SPARQL has no such axiom, so the property path inserts the whole chain at once.
```

### `ontology/queries/rules/s56_support_cycle_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | 'transitively supported by'(?E, ?E) -> valid(?E, false) |
| reads | IF E is transitively supported by itself THEN E is NOT valid |

### `ontology/queries/rules/s57_support_cycle_relationship_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Core GSN |
| swrl | Relationship(?R) ^ rdf:subject(?R, ?A) ^ rdf:object(?R, ?B) ^ 'supported by'(?A, ?B) ^ 'transitively supported by'(?B, ?A) -> valid(?R, false) |
| reads | IF R is a Relationship from A to B AND A is supported by B AND B is transitively supported by A THEN R is NOT valid |

### `ontology/queries/rules/s58_module_context_closure.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | Module(?A) ^ Module(?B) ^ 'in context of'(?A, ?B) -> 'transitively in context of'(?A, ?B) |
| reads | IF A and B are Modules AND A is in the context of B THEN A is transitively in the context of B |

Note:

```text
# note:      The SWRL rule states one step and leaves the chain to owl:TransitiveProperty.
#            SPARQL has no such axiom, so the property path inserts the whole chain at
#            once. The path runs through modules only. A module is the only class in both
#            the domain and the range of gsn:inContextOf, so every node inside a chain of
#            in-context-of links between two modules is a module.
```

### `ontology/queries/rules/s59_module_context_cycle_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | 'transitively in context of'(?M, ?M) -> valid(?M, false) |
| reads | IF M is transitively in the context of itself THEN M is NOT valid |

### `ontology/queries/rules/s60_module_context_cycle_relationship_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Modular Extension |
| swrl | Relationship(?R) ^ rdf:subject(?R, ?A) ^ rdf:object(?R, ?B) ^ 'in context of'(?A, ?B) ^ 'transitively in context of'(?B, ?A) -> valid(?R, false) |
| reads | IF R is a Relationship from A to B AND A is in the context of B AND B is transitively in the context of A THEN R is NOT valid |

### `ontology/queries/rules/s61_challenge_closure.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | challenges(?A, ?B) -> 'transitively challenges'(?A, ?B) |
| reads | IF A challenges B THEN A transitively challenges B |

Note:

```text
# note:      The SWRL rule states one step and leaves the chain to owl:TransitiveProperty.
#            SPARQL has no such axiom, so the property path inserts the whole chain at once.
```

### `ontology/queries/rules/s62_challenge_cycle_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | 'transitively challenges'(?E, ?E) -> valid(?E, false) |
| reads | IF E transitively challenges itself THEN E is NOT valid |

### `ontology/queries/rules/s63_challenge_cycle_relationship_invalidation.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Dialectic Extension |
| swrl | Relationship(?R) ^ rdf:subject(?R, ?A) ^ rdf:object(?R, ?B) ^ challenges(?A, ?B) ^ 'transitively challenges'(?B, ?A) -> valid(?R, false) |
| reads | IF R is a Relationship from A to B AND A challenges B AND B transitively challenges A THEN R is NOT valid |


## `augmentation/queries/`

### `augmentation/queries/fc01_requirement_source.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-44 |
| role | Auditor |
| operation | read |
| question | What law or requirement source does the case answer to? |
| expect | rows |

Header text:

```text
# Any element may answer to a requirement, not only the top goal: a control claim usually names
# the clause it implements. A case that names none reads through CQ-07 instead, which returns
# every context in scope without saying which of them is the requirement.
```

### `augmentation/queries/fc02_assured_system.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-45 |
| role | Auditor |
| operation | read |
| question | What system and organisation is this case about? |
| expect | rows |

Header text:

```text
# The subject is an argument, an assurance case or a goal - the three granularities at which a
# reader would say the case is about something.
```

### `augmentation/queries/fc03_undeveloped_claims_for_system.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-46 |
| role | Compliance Officer |
| operation | read |
| question | Which low-level claims need development for each system? |
| expect | rows |

Header text:

```text
# The inverse-path walk does the context inheritance in the query, so the answer does not depend
# on S17 having been run first.
```

At the end of line 6, `VALUES ?system { "IT system" }`:

```text
# PARAMETER
```

### `augmentation/queries/fc07_evidence_location.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-49 |
| role | Developer |
| operation | read |
| question | Where is the requested evidence kept and how is it fetched? |
| expect | rows |

### `augmentation/queries/fc08_evidence_production.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-50 |
| role | Developer |
| operation | read |
| question | Does the evidence exist yet, and how was it produced - by whom, with what, from what? |
| expect | rows |

Header text:

```text
# A solution with no artefact is evidence that does not exist yet, so the artefact is optional.
```

### `augmentation/queries/fc10_evidence_verification.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-52 |
| role | Process/Software Owner |
| operation | read |
| question | Was this evidence checked, by whom, with what mechanism, and did it pass? |
| expect | rows |

### `augmentation/queries/fc11_controls_ready_for_review.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-53 |
| role | Auditor |
| operation | read |
| question | Which controls are ready for review? |
| expect | rows |

Header text:

```text
# Ready means developed and backed by an artefact. Whether it passed is CQ-54; what is still
# missing is CQ-26 and CQ-16.
```

### `augmentation/queries/fc13_case_compliance.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-55 |
| role | Auditor |
| operation | read |
| question | Is the case fully compliant? |
| expect | rows |

Header text:

```text
# Compliant is all three counts at zero. The status is derived on every run rather than stored,
# so it cannot go stale; the price is that it cannot be reproduced for a past report entry.
```

### `augmentation/queries/fc14_open_clarifications.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-56 |
| role | Auditor |
| operation | read |
| question | Which elements have an open clarification against them? |
| expect | rows |

Header text:

```text
# Open means neither ended by an outcome nor closed by an answer.
```

### `augmentation/queries/fc15_who_answers_for_element.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-57 |
| role | Process/Software Owner |
| operation | read |
| question | Who can answer for this element - its owner, or the author of its evidence? |
| expect | rows |

### `augmentation/queries/fc16_clarification_answers.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-58 |
| role | Auditor |
| operation | read |
| question | What was said in reply to a clarification, and was the reply accepted? |
| expect | rows |

Header text:

```text
# A response does not close an ask. The outcome does: "resolved" means the raiser accepted a
# response; no outcome means the ask is still open, replies or not.
```

### `augmentation/queries/fc17_rounds_per_element.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-59 |
| role | Auditor |
| operation | read |
| question | How many rounds has this element taken, and of which kind? |
| expect | rows |

Header text:

```text
# One issue per round is what makes this a COUNT. A flag on the target would report one.
```

### `augmentation/queries/fc18_superseded_asks.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-60 |
| role | Auditor |
| operation | read |
| question | Which pending ask was displaced by a newer one? |
| expect | rows |

### `augmentation/queries/fc19_who_holds_the_ask.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-61 |
| role | Auditor |
| operation | read |
| question | Who currently holds a relayed ask - where is it stuck? |
| expect | rows |

### `augmentation/queries/fc20_escalation_count.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-62 |
| role | Auditor |
| operation | read |
| question | How many times was an ask escalated because the holder could not answer? |
| expect | rows |

Header text:

```text
# An escalation is a hop whose predecessor was closed as cannot-answer, counted from the first
# ask in the chain - the one that supersedes nothing.
```

### `augmentation/queries/fc22_what_to_revise.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-64 |
| role | Compliance Officer |
| operation | read |
| question | What has to be revised, and by whom? |
| expect | rows |

Header text:

```text
# The class of the target says whether the claim or the evidence is at fault. A revise issue
# against a context is a remark about wording and is deliberately not returned here.
```

### `augmentation/queries/fc23_revision_rounds.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-65 |
| role | Compliance Officer |
| operation | read |
| question | How many revision rounds, and what was offered in reply to each ask? |
| expect | rows |

### `augmentation/queries/fc24_revision_diff.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-66 |
| role | Developer |
| operation | read |
| question | What did a revision actually change - which artefact replaced which? |
| expect | rows |

Header text:

```text
# Artefact versions only. A reworded claim is not a revision in this sense.
#
# The issue is a revise or a resolve issue, because a resolution can also replace an artefact.
# It is raised against an element that still refers to the older artefact, or it is in
# context of one that does. A case that points the revised solution at the newer artefact
# can keep the older one in the context of the issue.
```

### `augmentation/queries/fc26_unresolved_at_audit.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-68 |
| role | Auditor |
| operation | read |
| question | What was left unresolved at the last audit, and what is due by the next one? |
| expect | rows |

Header text:

```text
# Scoped by cycle rather than by date, because two audits may overlap in time and the question
# asked is always which round.
```

### `augmentation/queries/fc27_resolution_state.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-69 |
| role | Auditor |
| operation | read |
| question | Was a resolution implemented, declined, or infeasible? |
| expect | rows |

Header text:

```text
# The state is the outcome. A response that the auditor has not accepted leaves the ask open,
# and the last column says whether one is on record.
```

### `augmentation/queries/fc28_manual_evidence.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-70 |
| role | Developer |
| operation | read |
| question | Which evidence needs to be generated manually? |
| expect | rows |

### `augmentation/queries/fc29_automated_evidence.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-71 |
| role | Developer |
| operation | read |
| question | Which evidence is generated automatically, and how or where from can it be retrieved? |
| expect | rows |

Header text:

```text
# Evidence is an artefact that a solution refers to. Generated data that no solution refers
# to, such as the data of an instantiation, is not listed.
```

### `augmentation/queries/fc30_alternative_provision.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-72 |
| role | Process/Software Owner |
| operation | read |
| question | Which evidence needs an alternative provision mechanism - an interview, a call, paper? |
| expect | rows |

Header text:

```text
# Which mechanism it is - interview, paper, call - is a subclass of gsnaug:Mechanism in the
# domain ontology; this returns the ones a person has to run.
```

### `augmentation/queries/fc31_evidence_cannot_be_produced.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-73 |
| role | Developer |
| operation | read |
| question | Which evidence cannot be produced at all, as opposed to not yet produced? |
| expect | rows |

Header text:

```text
# Not yet produced is gsn:undeveloped and gsn:uninstantiated, which CQ-26 and CQ-27 report.
# Cannot be produced is an ask closed as infeasible, which is a different answer.
```

### `augmentation/queries/fc32_cannot_resolve.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-74 |
| role | Auditor |
| operation | read |
| question | Which issue cannot be resolved at all, as opposed to not yet resolved? |
| expect | rows |

### `augmentation/queries/fc33_instantiated_elements.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-75 |
| role | Compliance Officer |
| operation | read |
| question | How is the interpretation instantiated into claims and evidence? |
| expect | rows |

Header text:

```text
# The reference says which data governs the subtree; gsnaug:instantiatedFrom says which row of it
# produced this element.
```

### `augmentation/queries/fc34_who_retrieves_evidence.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-76 |
| role | Compliance Officer |
| operation | read |
| question | Who is responsible for retrieving the evidence for a particular system? |
| expect | rows |

Header text:

```text
# gsnaug:assures is asserted, not derived. It names a gsnaug:System directly, so the answer does
# not depend on how - or whether - the case draws its top-level context.
```

### `augmentation/queries/fc35_artefacts_to_change.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-77 |
| role | Developer |
| operation | read |
| question | Which artefacts need changing, and who owns the change? |
| expect | rows |

Header text:

```text
# The last column is the impact of the change, which CQ-15 answers in full for a given artefact.
```

### `augmentation/queries/fc36_automation_feasibility.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-78 |
| role | Developer |
| operation | read |
| question | Which evidence can be generated automatically, and which has been assessed as manual? |
| expect | rows |

Header text:

```text
# No mechanism at all means nobody has looked; a mechanism flagged false means automation was
# assessed and rejected. The two are different answers.
```

### `augmentation/queries/fc37_term_impact.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-79 |
| role | Developer |
| operation | read |
| question | If this domain term changes, which mechanisms, artefacts and claims are affected? |
| expect | rows |

Header text:

```text
# Answerable without running anything, for every mechanism that declares what it reads. A
# mechanism that declares nothing is absent from the answer, so the answer is only as complete
# as the declarations are. For a mechanism that is a shape, a rule or a query in the graph the
# declaration can be derived from the node itself; for a script it has to be written by hand.
```

At the end of line 7, `VALUES ?term { <https://example.org/case#retainedUntil> }`:

```text
# PARAMETER
```

### `augmentation/queries/fc38_inspectable_mechanisms.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-80 |
| role | Compliance Officer |
| operation | read |
| question | Which evidence rests on a mechanism that can be read without being run, and what does each mechanism declare? |
| expect | rows |

Header text:

```text
# Four states per mechanism. In the graph: a shape, a rule or a query implements the mechanism,
# so what it depends on can be read off that node. Script in the graph: a person can read what it does,
# but no tool derives the terms, so any listed are declared by hand. Declared by hand: terms are
# listed but nothing in the graph says what the mechanism does, so the list has to be trusted.
# Opaque: none of the above, so only a run tells.
#
# "In the graph" is read off the type of the node that implements the mechanism. The list below is what this query knows: SHACL shapes,
# SHACL-AF SPARQL executables, SWRL rules and SPIN queries. A new formalism is a line here.
```

### `augmentation/queries/fc39_requirement_revised.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-81 |
| role | Compliance Officer |
| operation | read |
| question | Which elements answer to a requirement that has a newer revision? |
| expect | rows |

Header text:

```text
# A changed requirement is a new gsnaug:Requirement that is prov:wasRevisionOf the old one. An
# element still linked to the old one by gsnaug:requiredBy, and not yet to the new one, is in the
# answer. Whether the change matters to the element is a judgement: whoever makes it raises a
# revise issue on the element, and rule A2 takes it from there.
```

### `augmentation/queries/fc40_system_revised.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-82 |
| role | Developer |
| operation | read |
| question | Which evidence was drawn from a system, or a part of one, that has a newer revision? |
| expect | rows |

Header text:

```text
# A changed system, or a changed part of one, is a new individual that is prov:wasRevisionOf the
# old one; how fine the parts are is the domain ontology's choice. An artefact drawn from the old
# one by gsnaug:generatedFrom is in the answer until a replacement drawn from the new one exists.
# The last two columns are the solution that cites the artefact and the goals above it, which
# is the reach of the change. Whether the change matters to them is a judgement: whoever makes
# it raises a revise issue on the solution, and rule A2 takes it from there.
```

### `augmentation/queries/fc41_context_revised.rq`

| Field | Value |
| :--- | :--- |
| id | CQ-83 |
| role | Process Owner |
| operation | read |
| question | Which goals sit under a context whose artefact has a newer revision? |
| expect | rows |

Header text:

```text
# The environment of a claim is what GSN puts in a context. A context that gsn:refersTo an
# artefact - a deployment list, an operating design domain, a configuration - is the hook: the
# artefact is revised with gsnaug:replaces or prov:wasRevisionOf, and the context still refers
# to the old one. A context applies to the element it is attached to and to everything that
# element supports, so the query walks gsn:supportedBy down from the holder of the context; the
# core rules do not materialise that for contexts, only for assumptions. Whether the change
# matters to a goal is a judgement: whoever makes it raises a revise issue on the goal, and rule
# A2 takes it from there.
```


## `augmentation/rules/`

### `augmentation/rules/a02a_revise_issue_challenges_goal.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Issue(?I) ^ issueType(?I, revise) ^ raisedAgainst(?I, ?E) ^ Goal(?E) -> Goal(?I) ^ true(?I, true) ^ challenges(?I, ?E) |
| reads | IF Issue I is of type revise AND is raised against Goal E THEN I is a true goal that challenges E |

### `augmentation/rules/a02b_revise_issue_challenges_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Issue(?I) ^ issueType(?I, revise) ^ raisedAgainst(?I, ?E) ^ Solution(?E) -> Goal(?I) ^ true(?I, true) ^ challenges(?I, ?E) |
| reads | IF Issue I is of type revise AND is raised against Solution E THEN I is a true goal that challenges E |

### `augmentation/rules/a03a_resolve_issue_defeats_goal.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Issue(?I) ^ issueType(?I, resolve) ^ raisedAgainst(?I, ?E) ^ Goal(?E) -> Goal(?I) ^ challenges(?I, ?E) ^ defeated(?E, true) |
| reads | IF Issue I is of type resolve AND is raised against Goal E THEN I is a goal challenging E, and E is defeated |

Before line 18, `INSERT {`:

```text
# A second operation, not a second rule. Written separately because the guard above is on the
# target and this one is on the pair: one issue's challenge must not suppress another's when
# both are raised against the same element.
```

### `augmentation/rules/a03b_resolve_issue_defeats_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Issue(?I) ^ issueType(?I, resolve) ^ raisedAgainst(?I, ?E) ^ Solution(?E) -> Goal(?I) ^ challenges(?I, ?E) ^ defeated(?E, true) |
| reads | IF Issue I is of type resolve AND is raised against Solution E THEN I is a goal challenging E, and E is defeated |

Before line 18, `INSERT {`:

```text
# A second operation, not a second rule. Written separately because the guard above is on the
# target and this one is on the pair: one issue's challenge must not suppress another's when
# both are raised against the same element.
```

### `augmentation/rules/a04_part_inherits_checkable_with.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | ArtefactPart(?P) ^ partOf(?P, ?A) ^ Artefact(?A) ^ checkableWith(?A, ?X) -> checkableWith(?P, ?X) |
| reads | IF ArtefactPart P is part of Artefact A AND A is checkable with X THEN P is checkable with X |

### `augmentation/rules/a06a_conforming_report_confirms_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ checkableWith(?A, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?A) ^ conforms(?R, true) ^ decides(?M, "truth") -> true(?S, true) |
| reads | IF Solution S refers to Artefact A AND A is checkable with Mechanism M, which decides truth, AND the newest unstruck report R generated by M over A conforms AND no current report over an artefact that S refers to, or over a part of one that counts for S, fails THEN S is true |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The source rule states the positive half,
#            as S10 and S11 in the core do, and this translation adds guards that need
#            negation as failure, which SWRL does not have. The struck-report guard: a report
#            with prov:invalidatedAtTime or prov:wasInvalidatedBy is struck; it never counts
#            and retires nothing, so the report before it counts again. The newest-report
#            guard: a report counts only while no unstruck report from the same mechanism
#            over the same target carries a later prov:generatedAtTime. A report without a
#            timestamp is never retired and retires nothing; two such reports that disagree
#            are what gsnaugsh:ReportConflictShape reports.
#            The composition guard: support in GSN is a composition, so a conforming report
#            confirms the solution only while no current report over any artefact that the
#            solution refers to, or over a part of one, fails. A6b and A6d need no such guard: a failing report refutes
#            regardless, and without the guard A6a and A6b would alternate forever on an
#            artefact whose mechanisms disagree.
#            The old truth value is deleted before the new one is written, as S10 does, so
#            that a status flips rather than accumulates.
#            The composition guard counts a part only when the part counts for the
#            solution: the solution refers to it, or refers to no part of the artefact.
```

Before line 26, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 27, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

Before line 36, `FILTER NOT EXISTS {`:

```text
  # composition guard: no current failing report, from a mechanism that decides truth, over any
  # artefact the solution refers to, or over a part of one that counts for it. Written as two
  # guards, each starting from the artefacts of the solution (?S gsn:refersTo ?A2) instead of
  # walking every checkable target of the case.
  # ... over an artefact the solution refers to
```

Before line 56, `FILTER NOT EXISTS {`:

```text
  # ... over a part of one of them that counts for the solution
```

### `augmentation/rules/a06b_failing_report_refutes_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ checkableWith(?A, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?A) ^ conforms(?R, false) ^ decides(?M, "truth") -> true(?S, false) |
| reads | IF Solution S refers to Artefact A AND A is checkable with Mechanism M, which decides truth, AND the newest unstruck report R generated by M over A does not conform THEN S is not true |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The source rule states the positive half,
#            as S10 and S11 in the core do, and this translation adds guards that need
#            negation as failure, which SWRL does not have. The struck-report guard: a report
#            with prov:invalidatedAtTime or prov:wasInvalidatedBy is struck; it never counts
#            and retires nothing, so the report before it counts again. The newest-report
#            guard: a report counts only while no unstruck report from the same mechanism
#            over the same target carries a later prov:generatedAtTime. A report without a
#            timestamp is never retired and retires nothing; two such reports that disagree
#            are what gsnaugsh:ReportConflictShape reports.
#            A failing report refutes regardless of what other reports say, so this rule
#            carries no composition guard.
#            The old truth value is deleted before the new one is written, as S10 does, so
#            that a status flips rather than accumulates.
```

Before line 26, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 27, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

### `augmentation/rules/a06c_conforming_part_report_confirms_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ ArtefactPart(?P) ^ partOf(?P, ?A) ^ checkableWith(?P, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?P) ^ conforms(?R, true) ^ decides(?M, "truth") -> true(?S, true) |
| reads | IF Solution S refers to Artefact A AND ArtefactPart P is part of A AND P is checkable with Mechanism M, which decides truth, AND the newest unstruck report R generated by M over P conforms AND no current report over an artefact that S refers to, or over a part of one that counts for S, fails THEN S is true |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The source rule states the positive half,
#            as S10 and S11 in the core do, and this translation adds guards that need
#            negation as failure, which SWRL does not have. The struck-report guard: a report
#            with prov:invalidatedAtTime or prov:wasInvalidatedBy is struck; it never counts
#            and retires nothing, so the report before it counts again. The newest-report
#            guard: a report counts only while no unstruck report from the same mechanism
#            over the same target carries a later prov:generatedAtTime. A report without a
#            timestamp is never retired and retires nothing; two such reports that disagree
#            are what gsnaugsh:ReportConflictShape reports.
#            The composition guard: support in GSN is a composition, so a conforming report
#            confirms the solution only while no current report over any artefact that the
#            solution refers to, or over a part of one, fails. A6b and A6d need no such guard: a failing report refutes
#            regardless, and without the guard A6a and A6b would alternate forever on an
#            artefact whose mechanisms disagree.
#            The old truth value is deleted before the new one is written, as S10 does, so
#            that a status flips rather than accumulates.
#            The part guard: a part counts for a solution that refers to it, or that refers
#            to no part of the artefact. A solution that names the parts it relies on is
#            not decided by a part that it does not use.
```

Before line 28, `FILTER(EXISTS { ?S gsn:refersTo ?P } || NOT EXISTS { ?S gsn:refersTo ?namedPart . ?namedPart gsnaug:partOf ?A })`:

```text
  # part guard: the part counts for the solution when the solution refers to it, or refers
  # to no part of the artefact
```

Before line 29, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 30, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

Before line 39, `FILTER NOT EXISTS {`:

```text
  # composition guard: no current failing report, from a mechanism that decides truth, over any
  # artefact the solution refers to, or over a part of one that counts for it. Written as two
  # guards, each starting from the artefacts of the solution (?S gsn:refersTo ?A2) instead of
  # walking every checkable target of the case.
  # ... over an artefact the solution refers to
```

Before line 59, `FILTER NOT EXISTS {`:

```text
  # ... over a part of one of them that counts for the solution
```

### `augmentation/rules/a06d_failing_part_report_refutes_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ ArtefactPart(?P) ^ partOf(?P, ?A) ^ checkableWith(?P, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?P) ^ conforms(?R, false) ^ decides(?M, "truth") -> true(?S, false) |
| reads | IF Solution S refers to Artefact A AND ArtefactPart P is part of A AND P is checkable with Mechanism M, which decides truth, AND the newest unstruck report R generated by M over P does not conform THEN S is not true |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The source rule states the positive half,
#            as S10 and S11 in the core do, and this translation adds guards that need
#            negation as failure, which SWRL does not have. The struck-report guard: a report
#            with prov:invalidatedAtTime or prov:wasInvalidatedBy is struck; it never counts
#            and retires nothing, so the report before it counts again. The newest-report
#            guard: a report counts only while no unstruck report from the same mechanism
#            over the same target carries a later prov:generatedAtTime. A report without a
#            timestamp is never retired and retires nothing; two such reports that disagree
#            are what gsnaugsh:ReportConflictShape reports.
#            A failing report refutes regardless of what other reports say, so this rule
#            carries no composition guard.
#            The old truth value is deleted before the new one is written, as S10 does, so
#            that a status flips rather than accumulates.
#            The part guard: a part counts for a solution that refers to it, or that refers
#            to no part of the artefact. A solution that names the parts it relies on is
#            not decided by a part that it does not use.
```

Before line 28, `FILTER(EXISTS { ?S gsn:refersTo ?P } || NOT EXISTS { ?S gsn:refersTo ?namedPart . ?namedPart gsnaug:partOf ?A })`:

```text
  # part guard: the part counts for the solution when the solution refers to it, or refers
  # to no part of the artefact
```

Before line 29, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 30, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

### `augmentation/rules/a07a_conforming_report_validates_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ checkableWith(?A, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?A) ^ conforms(?R, true) ^ decides(?M, "validity") -> valid(?S, true) |
| reads | IF Solution S refers to Artefact A AND A is checkable with Mechanism M, which decides validity, AND the newest unstruck report R generated by M over A conforms THEN S is valid |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The struck-report guard and the
#            newest-report guard are those of A6a. A7a has no composition guard and
#            deletes nothing. The core rules only ever write gsn:valid false, and a false is
#            never lifted, so A7a writes true only where the solution has no validity
#            value. It cannot alternate with a core rule, or with A7b and A7d, which
#            overwrite its true with false.
```

Before line 23, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 24, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

Before line 33, `FILTER NOT EXISTS { ?S gsn:valid ?any }`:

```text
  # no validity value yet: a false from any rule stays
```

### `augmentation/rules/a07b_failing_report_invalidates_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ checkableWith(?A, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?A) ^ conforms(?R, false) ^ decides(?M, "validity") -> valid(?S, false) |
| reads | IF Solution S refers to Artefact A AND A is checkable with Mechanism M, which decides validity, AND the newest unstruck report R generated by M over A does not conform THEN S is not valid |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The struck-report guard and the
#            newest-report guard are those of A6b. The old validity value is deleted before
#            false is written, as the core rules do.
```

Before line 26, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 27, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

### `augmentation/rules/a07c_conforming_part_report_validates_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ ArtefactPart(?P) ^ partOf(?P, ?A) ^ checkableWith(?P, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?P) ^ conforms(?R, true) ^ decides(?M, "validity") -> valid(?S, true) |
| reads | IF Solution S refers to Artefact A AND ArtefactPart P is part of A AND P is checkable with Mechanism M, which decides validity, AND the newest unstruck report R generated by M over P conforms THEN S is valid |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The struck-report guard and the
#            newest-report guard are those of A6c. A7c has no composition guard and
#            deletes nothing. The core rules only ever write gsn:valid false, and a false is
#            never lifted, so A7c writes true only where the solution has no validity
#            value. It cannot alternate with a core rule, or with A7b and A7d, which
#            overwrite its true with false.
#            The part guard: a part counts for a solution that refers to it, or that refers
#            to no part of the artefact. A solution that names the parts it relies on is
#            not decided by a part that it does not use.
```

Before line 25, `FILTER(EXISTS { ?S gsn:refersTo ?P } || NOT EXISTS { ?S gsn:refersTo ?namedPart . ?namedPart gsnaug:partOf ?A })`:

```text
  # part guard: the part counts for the solution when the solution refers to it, or refers
  # to no part of the artefact
```

Before line 26, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 27, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

Before line 36, `FILTER NOT EXISTS { ?S gsn:valid ?any }`:

```text
  # no validity value yet: a false from any rule stays
```

### `augmentation/rules/a07d_failing_part_report_invalidates_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Solution(?S) ^ refersTo(?S, ?A) ^ Artefact(?A) ^ ArtefactPart(?P) ^ partOf(?P, ?A) ^ checkableWith(?P, ?M) ^ ValidationReport(?R) ^ wasGeneratedBy(?R, ?M) ^ used(?R, ?P) ^ conforms(?R, false) ^ decides(?M, "validity") -> valid(?S, false) |
| reads | IF Solution S refers to Artefact A AND ArtefactPart P is part of A AND P is checkable with Mechanism M, which decides validity, AND the newest unstruck report R generated by M over P does not conform THEN S is not valid |

Note:

```text
# note:      THE GUARDS BELOW ARE NOT IN THE SWRL. The struck-report guard and the
#            newest-report guard are those of A6d. The old validity value is deleted before
#            false is written, as the core rules do.
#            The part guard: a part counts for a solution that refers to it, or that refers
#            to no part of the artefact. A solution that names the parts it relies on is
#            not decided by a part that it does not use.
```

Before line 28, `FILTER(EXISTS { ?S gsn:refersTo ?P } || NOT EXISTS { ?S gsn:refersTo ?namedPart . ?namedPart gsnaug:partOf ?A })`:

```text
  # part guard: the part counts for the solution when the solution refers to it, or refers
  # to no part of the artefact
```

Before line 29, `FILTER NOT EXISTS { ?R prov:invalidatedAtTime|prov:wasInvalidatedBy ?struck }`:

```text
  # struck-report guard: a struck report never counts
```

Before line 30, `OPTIONAL { ?R prov:generatedAtTime ?t }`:

```text
  # newest-report guard: no later unstruck report from the same mechanism over the same target
```

### `augmentation/rules/a08a_issue_goal_statement.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Issue(?I) ^ Goal(?I) ^ description(?I, ?D) -> statement(?I, ?D) |
| reads | IF Issue I is a goal AND has a description D THEN D is the statement of I |

Note:

```text
# note:      THE GUARD BELOW IS NOT IN THE SWRL. The translation writes the statement only
#            when the goal has none, which needs negation as failure. The SWRL adds the
#            description as one more statement next to one that a person wrote.
#            The nested SELECT makes the engine finish the WHERE clause before it inserts.
#            rdflib otherwise tests the guard again after the first insert, and copies only
#            one value.
```

### `augmentation/rules/a08b_issue_goal_context.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Issue(?I) ^ Goal(?I) ^ challenges(?I, ?E) ^ Goal(?E) ^ inContextOf(?E, ?C) -> inContextOf(?I, ?C) |
| reads | IF Issue I is a goal AND challenges Goal E AND E is in context of C THEN I is in context of C |

Note:

```text
# note:      THE GUARD BELOW IS NOT IN THE SWRL. The translation copies the contexts only to
#            a goal that has none, which needs negation as failure. The SWRL adds them next
#            to the contexts that a person gave the issue.
#            The nested SELECT makes the engine finish the WHERE clause before it inserts.
#            rdflib otherwise tests the guard again after the first insert, and copies only
#            one value.
```

### `augmentation/rules/a08c_issue_goal_context_from_solution.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation |
| swrl | Issue(?I) ^ Goal(?I) ^ challenges(?I, ?E) ^ Solution(?E) ^ supportedBy(?P, ?E) ^ inContextOf(?P, ?C) -> inContextOf(?I, ?C) |
| reads | IF Issue I is a goal AND challenges Solution E AND E supports P AND P is in context of C THEN I is in context of C |

Note:

```text
# note:      A solution has no context of its own, so the contexts come from the goal that it
#            supports. THE GUARD BELOW IS NOT IN THE SWRL, as in A8b.
#            The nested SELECT makes the engine finish the WHERE clause before it inserts.
#            rdflib otherwise tests the guard again after the first insert, and copies only
#            one value.
```


## `augmentation/derivations/`

### `augmentation/derivations/d01_shape_mechanism_reads.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation derivations |
| swrl | none. Sequence and alternative paths are RDF lists, walked with rdf:rest*, which SWRL cannot express, and a blank-node path has to be skipped, which SWRL cannot test. |
| reads | IF a SHACL shape implements a mechanism THEN the mechanism reads every target class, target property, IRI property path (also inside inverse, repeated, alternative and sequence paths) and sh:class, on the shape and on every shape nested in it |

Header text:

```text
# What is not derived: anything inside sh:sparql, which is text, and sh:datatype, which is a
# datatype rather than a class or property of a domain ontology.
```

Before line 15, `?definition ( sh:property | sh:node | sh:not | (sh:and|sh:or|sh:xone)/rdf:rest*/rdf:first )* ?shape .`:

```text
  # the shape itself, and every shape reached from it through property, node, not, and, or, xone
```

### `augmentation/derivations/d02_rule_mechanism_reads.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation derivations |
| swrl | none. The body is an RDF list, walked with rdf:rest*, which SWRL cannot express. |
| reads | IF a SWRL rule implements a mechanism THEN the mechanism reads every class predicate and property predicate in the body of the rule |

Header text:

```text
# Built-in atoms are not terms of a domain ontology and are left out. A class expression in a
# class atom is a blank node and is left out.
```

### `augmentation/derivations/d03_rule_mechanism_writes.rq`

| Field | Value |
| :--- | :--- |
| operation | rule |
| expect | insert |
| section | Augmentation derivations |
| swrl | none. The head is an RDF list, walked with rdf:rest*, which SWRL cannot express. |
| reads | IF a SWRL rule implements a mechanism THEN the mechanism writes every class predicate and property predicate in the head of the rule |

Header text:

```text
# The twin of D2: what a rule concludes is what it writes. A term in both body and head is read
# and written, which is the case for every rule that narrows a class it also tests.
```


## `docs/playground/assets/data/queries/`

The queries of the Playground are copies of the queries of the OntoGSN Workbench.
`development/dev_tools/playground_sync.py` removes the comments when it copies a query.
This section holds the comments of the Workbench at commit `287c591`.

### `docs/playground/assets/data/queries/read_goalParentsForChecklist.sparql`

Before line 15, `FILTER NOT EXISTS {`:

```text
    # Ensure ?parent is the nearest GOAL ancestor of ?child
```

### `docs/playground/assets/data/queries/read_goalsForChecklist.sparql`

Before line 20, `BIND(COALESCE(STRAFTER(STR(?type), "#"), REPLACE(STR(?type), "^.*/", "")) AS ?kind)`:

```text
  # "Goal" / "Solution" for UI (works for #... and /... style IRIs)
```

### `docs/playground/assets/data/queries/read_solutionWithCode.sparql`

Before line 8, `?sol py:providedByCode ?code .`:

```text
    # Case 1: Solution → code
```

Before line 12, `?code py:implements ?sol .`:

```text
    # Case 2: Code → solution
```

### `docs/playground/assets/data/queries/rule_assumptionInvalidation.sparql`

Before line 17, `}`:

```text
    #{BIND(?B AS ?s)}
    #UNION
    #{BIND(?A AS ?s)}
```

### `docs/playground/assets/data/queries/visualize_layers.sparql`

Before line 9, `{`:

```text
  # 1) Direct layer membership
```

Before line 13, `{`:

```text
  # 2) Inherited membership: parent covers -> child inherits
```

Before line 19, `?l a did:Layer .`:

```text
  # Ensure lane universe is actual layers
```
