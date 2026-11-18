# Stored queries

CRUD SPARQL for a graph database holding an assurance case built on
[`ontology/serializations/ontogsn.ttl`](../serializations/ontogsn.ttl). One file per competency
question. [`registry.csv`](registry.csv) gives the question of each file, and the IDs that
its ID replaced.

[`rules/`](rules/) holds all 60 SWRL rules of
[`ontology/serializations/ontogsn.ttl`](../serializations/ontogsn.ttl) as SPARQL updates, for stores
with no reasoner attached.

## File names

The name of each file is the ID of its query: `<KIND>-<SCOPE>-<slug>.rq`. `RQ` is a read, `WQ`
is a write, and `RL` is a rule. `GSN` says that the query needs OntoGSN alone, and `AUG` that it
needs the [Augmentation](../../augmentation/). The slug says what the query does, for example
`RQ-GSN-goal_support_tree`. To add a query, follow
[`development/dev_tools/README.md`](../../development/dev_tools/README.md#the-id-of-a-query-or-a-rule).

## Using them

Load the ontology **and** your case into the same graph — some queries walk
`rdfs:subClassOf*` and need the class hierarchy.

Parameters are literals in a `VALUES` block near the top of the query, addressed by
`schema:identifier` rather than IRI, so a query runs against any case unedited:

```sparql
VALUES ?goalId { "G1" }
?goal schema:identifier ?goalId .
```

The catalogue below names the parameters of each query.

The defaults point at [`ontology/example/example_case.ttl`](../example/example_case.ttl),
so every query runs as-is. A read of what only a rule derives returns nothing there until the
rules ran, and its line `# expect:` says `empty`.

Boolean decorators are matched with `FILTER(STR(?flag) = "true")`, which works whether the
data carries `true`, `"true"^^xsd:boolean` or `"true"`.

A query file holds no comment, except one line at the top: `# expect:`. The line says what a
run on the example case gives: `rows`, `empty`, `insert`, `delete`, `change` or `none`.
`development/dev_tools/query_check.py` reads the line and tests the run against it. The
reasons for the choices in a query are in the design record, see
[`development/design/README.md`](../../development/design/README.md#how-a-stored-query-reaches-the-ontology).

## The catalogue

[count]: <> (read_queries)

### Read — 34 queries

| Query | Question | Parameters | Notes |
| :--- | :--- | :--- | :--- |
| `RQ-GSN-assurance_case_inventory` | What cases are in the store, and what arguments does each contain? | none | Run it first on a store that you do not know. |
| `RQ-GSN-case_summary_counts` | How many elements of each GSN type? | none | It needs no reasoner, because it counts through the class hierarchy. |
| `RQ-GSN-top_goals` | What is the top claim — both by decorator and by structure? | none | One column says that the goal has the `gsn:top` decorator, and one says that no other element supports it. Look at a row where the two disagree. |
| `RQ-GSN-element_by_identifier` | What does element X say, and what is it linked to? | `?elementId`: the identifier to look up | |
| `RQ-GSN-goal_support_tree` | The whole argument beneath a goal, with depth | `?rootId`: the goal to expand | `?depth` is the length of the shortest support chain from the root. With it, you can read the result as a tree. |
| `RQ-GSN-evidence_supporting_goal` | What evidence ultimately supports this claim? | `?goalId`: the goal to trace | It returns each solution and the artefact that the solution refers to. The artefact is what an auditor asks to see. |
| `RQ-GSN-goals_resting_on_artefact` | If this evidence is withdrawn, what breaks? | `?artefactId`: the artefact in question | Run it before you replace an evidence item. |
| `RQ-GSN-context_in_scope_for_goal` | What context and assumptions is this goal read under? | `?goalId`: the goal being read | It includes the context of every element above the goal. Rule `RL-GSN-context_inheritance` inherits assumptions only, so the query walks the support chain itself. |
| `RQ-GSN-undeveloped_elements` | Which promises are outstanding, and which decorators are stale? | none | It finds the elements that are still undeveloped. It also finds the elements that are developed now, but still have the decorator. |
| `RQ-GSN-goals_without_support` | Unadmitted gaps: the argument stops and nothing says so | none | A row is a goal with no support and no `gsn:undeveloped` decorator. |
| `RQ-GSN-solutions_without_artefact` | Evidence claimed but not identified | none | |
| `RQ-GSN-elements_unreachable_from_top_goal` | Present in the store, part of no argument | none | It follows support links and context links together, because nothing supports a context element. |
| `RQ-GSN-element_status_flags` | Every valid / true / inDoubt / defeated flag | none | One row for each flag of an element, not one row for each element. |
| `RQ-GSN-invalid_elements` | One worklist of everything invalid, doubted or defeated | none | Each row gives the reason. |
| `RQ-GSN-challenges_and_their_targets` | What has been challenged, and by what kind of defeater | none | A challenge that is a goal puts its target in doubt. A challenge that is a solution cites evidence and defeats its target, so its row is more urgent. |
| `RQ-GSN-goals_affected_by_challenge` | What loses support if the challenge stands | none | It returns every goal that rests on the challenged element. |
| `RQ-GSN-assurance_claim_points` | Claim points and the confidence argument behind each | none | |
| `RQ-GSN-claim_points_without_confidence_argument` | Claim points with nothing behind them | none | An assurance claim point says that a confidence argument exists. A row is a claim point with no such argument. |
| `RQ-GSN-module_dependencies` | Which modules depend on which, through which elements | none | Each row names the elements that the dependency follows from. |
| `RQ-GSN-away_elements` | Away references, and whether their home module is present | none | An away element repeats an element of another module. If that module is not in the store, the argument is not complete. |
| `RQ-GSN-public_elements_in_contract_modules` | Public elements where they must not be | none | The same condition as rule `RL-GSN-public_contract_invalidation`, as a read. A contract module has no interface of its own, so it cannot hold a public element. |
| `RQ-GSN-duplicate_identifiers` | Two elements sharing an identifier | none | Every other query finds an element by its identifier, so run this query on a new case. Rules `RL-GSN-duplicate_identifier_invalidation` and `RL-GSN-duplicate_acp_identifier_invalidation` mark both elements as not valid. |
| `RQ-GSN-support_cycles` | Circular arguments | none | A reasoner reports only that the whole case is inconsistent. This query names the elements on the cycle. |
| `RQ-GSN-pattern_instantiations` | Which pattern is instantiated where, and is it documented | none | The standard asks a pattern to state its intent, its applicability and its consequences. The query reports which of them are missing. |
| `RQ-GSN-uninstantiated_elements` | Placeholders never filled in | none | A finished case has no row. |
| `RQ-GSN-stale_evidence` | Artefacts older than a cutoff, and the claims on them | `?cutoff`: every artefact older than this date | OntoGSN has no date property. The query reads `dcterms:created`. If your case dates an artefact with another property, change the property in the query. |
| `RQ-GSN-relationship_decorators` | Optional / multiple / choice / cardinality | none | The decorators say how to instantiate a pattern. They are often lost when a person copies a pattern into a case by hand. |
| `RQ-GSN-undeveloped_claims_for_system` | Which low-level claims need development for each system? | `?system`: the name of the system, as a context states it | The query walks up the support chain to the context that names the system. It does not need a run of rule `RL-GSN-context_inheritance`. |
| `RQ-GSN-controls_ready_for_review` | Which controls are ready for review? | none | Ready means that the control is developed and has an artefact. `RQ-GSN-validated_elements` says whether it passed. `RQ-GSN-undeveloped_elements` and `RQ-GSN-goals_without_support` say what is still missing. |
| `RQ-GSN-claims_awaiting_evidence` | Which controls still await evidence? | none | A row gives a goal and the reason: no support, undeveloped, a solution without an artefact, or a solution that is not instantiated. A goal that challenges another element is not in the answer. |
| `RQ-GSN-provided_evidence` | Which evidence has been provided? | none | A row is a solution that refers to an artefact, with the goal that it supports. `RQ-GSN-solutions_without_artefact` gives the evidence that is still missing. |
| `RQ-GSN-validated_elements` | Which controls and evidence have already been positively validated? | none | A row is a goal or a solution that is valid, and neither in doubt nor defeated. The last column is its truth value. |
| `RQ-GSN-elements_in_doubt` | Which elements are currently in doubt and why? | none | It reads `gsn:inDoubt`, which rules derive, so run the rules first. The last columns name the challenge that causes the doubt, if there is one. |
| `RQ-GSN-defeated_claims` | Which claims were determined to be insufficient by the report? | none | It reads `gsn:defeated`, which rules derive, so the example case gives no row until the rules ran. The last columns name the defeater. |

[count]: <> (create_queries)

### Create — 7 queries

A create query makes the IRI of the new element in the namespace of the element that it
attaches to. So you do not give the namespace of your case, except in
`WQ-GSN-create_assurance_case_skeleton`.

| Query | Question | Parameters | Notes |
| :--- | :--- | :--- | :--- |
| `WQ-GSN-create_assurance_case_skeleton` | Start a new case | none | Change the `case:` prefix before the run. It is the only query that names a namespace for the case. |
| `WQ-GSN-create_goal_under_parent` | Add a sub-goal | `?parentId`, `?newId`, `?newStatement` | The parent is a goal or a strategy. |
| `WQ-GSN-create_strategy_between_goals` | Insert a strategy, re-parenting the support links | `?parentId`, `?strategyId`, `?strategyStatement` | The query moves the support links of the parent to the strategy. Without the move, the argument has two routes to the same sub-goals. |
| `WQ-GSN-create_context_for_goal` | Attach context pointing at an artefact | `?elementId`, `?contextId`, `?contextStatement`, `?artefactId` | The element is a goal or a strategy. |
| `WQ-GSN-create_solution_with_artefact` | Add evidence — as a solution *and* an artefact | `?goalId`, `?solutionId`, `?solutionStatement`, `?artefactId`, `?artefactLabel`, `?created` | Evidence is two nodes. The artefact is the thing that exists, and the solution is the reference of the argument to it. |
| `WQ-GSN-create_solutions_for_unreferenced_artefacts` | Bulk-import evidence from a pipeline | none | For artefacts that are already in the store. The query makes one solution for each artefact that no solution refers to. A second run adds nothing. |
| `WQ-GSN-create_challenge_to_element` | Record a challenge against part of the argument | `?targetId`, `?challengeId`, `?challengeType`, `?challengeStatement` | Set `?challengeType` to `gsn:Goal` for a counter-claim, which puts the target in doubt. Set it to `gsn:Solution` for evidence, which defeats the target. Do not assert `gsn:Defeater`, because rule `RL-GSN-defeater_declaration` infers it. |

[count]: <> (update_queries)

### Update — 3 queries

| Query | Question | Parameters | Notes |
| :--- | :--- | :--- | :--- |
| `WQ-GSN-update_element_statement` | Correct the wording of a claim | `?elementId`, `?new` | The query deletes the old statement and inserts the new one in one operation, so the element never has both. |
| `WQ-GSN-update_mark_element_invalid` | Mark one element invalid | `?elementId` | The query changes nothing if the element is already marked. |
| `WQ-GSN-update_solution_artefact` | Re-baseline a solution onto new evidence | `?solutionId`, `?newArtefactId` | The solution stays and keeps its identifier. Only the artefact that it refers to changes. |

Everything else that changes flags is a rule — see below.

[count]: <> (delete_queries)

### Delete — 6 queries

| Query | Question | Parameters | Notes |
| :--- | :--- | :--- | :--- |
| `WQ-GSN-delete_element_and_its_links` | Remove an element without leaving dangling references | `?elementId` | It deletes the links in both directions and the reified relationships. If only the outgoing links go, the parents still point at a node with no type. |
| `WQ-GSN-delete_support_link` | Detach a branch, keeping both ends | `?fromId`, `?toId`, `?predicate` | `?predicate` is `gsn:supportedBy` or `gsn:inContextOf`. Both elements stay, so you can attach the branch to another parent. The reified relationship of the link goes with it. |
| `WQ-GSN-delete_challenge_and_its_effects` | Withdraw a challenge *and* the doubt it wrote | `?challengeId` | A rule wrote `gsn:inDoubt` and `gsn:defeated` on the target, and nothing removes them when the challenge goes. The query clears them. Run the rules again after it, so that the flags that still hold come back. |
| `WQ-GSN-delete_unreferenced_artefacts` | Collect evidence nothing cites | none | Run `RQ-GSN-solutions_without_artefact` first. An artefact can look unused because its solution was never linked, and then the fix is the link. |
| `WQ-GSN-delete_materialised_inferences` | Clear the conclusions the rules wrote | none | It clears only what nothing but a rule writes: `gsn:inDoubt`, `gsn:defeated`, `gsn:consistentWith`, `gsn:relationshipType` and the type `gsn:Defeater`. A person can also set the other flags, so they stay. To keep derived facts apart from asserted ones, run `run_rules.py` with `--out` on a copy. |
| `WQ-GSN-delete_assurance_case` | Remove a case, sparing the artefacts | `?caseId` | It deletes everything that it reaches from the case. A second case can cite the same artefacts, so they stay. Use `WQ-GSN-delete_unreferenced_artefacts` for them. |

## Rules

`rules/` has one file per SWRL rule, named `RL-GSN-<slug>.rq`, where the slug comes from the
name of the rule. Each file starts with two lines that tools read: the rule name (`# name:`)
and the expected result of a run (`# expect:`). The name is the `rdfs:label` of the SWRL rule
in the ontology, so the file and the rule can be read side by side. The section of a rule is on the SWRL rule
too, as `gsn:coreOrExtension`.

Run them with:

```bash
python ontology/example/run_rules.py mycase.ttl --out mycase-materialised.ttl
python ontology/example/run_rules.py mycase.ttl --dry-run           # what would each rule derive?
python ontology/example/run_rules.py mycase.ttl --only RL-GSN-assumption_invalidation,RL-GSN-defeated_invalidation
python ontology/example/run_rules.py mycase.ttl --section "Dialectic Extension"
```

A SPARQL update can do two things that a SWRL rule cannot: it can replace an old value, and it can
test that a fact is absent. [`rules/README.md`](rules/README.md) lists each rule and says where its
update does more than the SWRL rule.

A rule that creates a node, for example `RL-GSN-support_relation_creation`, builds the IRI of
the node from the IRIs of the two elements that the node links. A second run builds the same IRI, so you can run the rules again
on a case that already holds their results, and the store gets no second copy of a node.

Each rule derives one step, so `run_rules.py` applies the whole set repeatedly until a pass
changes nothing. If two rules contradict each other on your case the passes will loop; the
driver detects that, stops, and names the rules involved.

## Verification

`development/dev_tools/query_check.py` runs each query against the ontology and the example ABox in
Oxigraph and records the outcome in `development/design/ontogsn-design-queries.ttl`. See
[`development/dev_tools/README.md`](../../development/dev_tools/README.md#stored-queries).
