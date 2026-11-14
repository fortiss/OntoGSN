# Stored queries

CRUD SPARQL for a graph database holding an assurance case built on
[`ontology/serializations/ontogsn.ttl`](../serializations/ontogsn.ttl). One file per competency
question. The question and the other header fields of each file are in
[`QUERY-COMMENTS.md`](../../QUERY-COMMENTS.md), and the same set is tabulated in
[`development/design/Competency Questions.xlsx`](../../development/design/Competency%20Questions.xlsx) - on
the "Competency Questions" sheet where a compliance process asks the question, and on
"Extra" otherwise.

[`rules/`](rules/) holds all 60 SWRL rules of
[`ontology/serializations/ontogsn.ttl`](../serializations/ontogsn.ttl) as SPARQL updates, for stores
with no reasoner attached.

## Using them

Load the ontology **and** your case into the same graph — some queries walk
`rdfs:subClassOf*` and need the class hierarchy.

Parameters are literals in a `VALUES` block near the top of the query, addressed by
`schema:identifier` rather than IRI, so a query runs against any case unedited:

```sparql
VALUES ?goalId { "G1" }
?goal schema:identifier ?goalId .
```

[`QUERY-COMMENTS.md`](../../QUERY-COMMENTS.md) says what each parameter is.

The defaults point at [`ontology/example/example_case.ttl`](../example/example_case.ttl),
so every query runs as-is and returns something.

Boolean decorators are matched with `FILTER(STR(?flag) = "true")`, which works whether the
data carries `true`, `"true"^^xsd:boolean` or `"true"`.

## The catalogue

[count]: <> (read_queries)

### Read — 27 queries

| Query | Question |
| :--- | :--- |
| `read_assurance_case_inventory` | What cases are in the store, and what arguments does each contain? |
| `read_case_summary_counts` | How many elements of each GSN type? |
| `read_top_goals` | What is the top claim — both by decorator and by structure? |
| `read_element_by_identifier` | What does element X say, and what is it linked to? |
| `read_goal_support_tree` | The whole argument beneath a goal, with depth |
| `read_evidence_supporting_goal` | What evidence ultimately supports this claim? |
| `read_goals_resting_on_artefact` | If this evidence is withdrawn, what breaks? |
| `read_context_in_scope_for_goal` | What context and assumptions is this goal read under? |
| `read_undeveloped_elements` | Which promises are outstanding, and which decorators are stale? |
| `read_goals_without_support` | Unadmitted gaps: the argument stops and nothing says so |
| `read_solutions_without_artefact` | Evidence claimed but not identified |
| `read_elements_unreachable_from_top_goal` | Present in the store, part of no argument |
| `read_element_status_flags` | Every valid / true / inDoubt / defeated flag |
| `read_invalid_elements` | One worklist of everything invalid, doubted or defeated |
| `read_challenges_and_their_targets` | What has been challenged, and by what kind of defeater |
| `read_goals_affected_by_challenge` | What loses support if the challenge stands |
| `read_assurance_claim_points` | Claim points and the confidence argument behind each |
| `read_claim_points_without_confidence_argument` | Claim points with nothing behind them |
| `read_module_dependencies` | Which modules depend on which, through which elements |
| `read_away_elements` | Away references, and whether their home module is present |
| `read_public_elements_in_contract_modules` | Public elements where they must not be |
| `read_duplicate_identifiers` | Two elements sharing an identifier |
| `read_support_cycles` | Circular arguments |
| `read_pattern_instantiations` | Which pattern is instantiated where, and is it documented |
| `read_uninstantiated_elements` | Placeholders never filled in |
| `read_stale_evidence` | Artefacts older than a cutoff, and the claims on them |
| `read_relationship_decorators` | Optional / multiple / choice / cardinality |

[count]: <> (create_queries)

### Create — 7 queries

| Query | Question |
| :--- | :--- |
| `create_assurance_case_skeleton` | Start a new case |
| `create_goal_under_parent` | Add a sub-goal |
| `create_strategy_between_goals` | Insert a strategy, re-parenting the support links |
| `create_context_for_goal` | Attach context pointing at an artefact |
| `create_solution_with_artefact` | Add evidence — as a solution *and* an artefact |
| `create_solutions_for_unreferenced_artefacts` | Bulk-import evidence from a pipeline |
| `create_challenge_to_element` | Record a challenge against part of the argument |

[count]: <> (update_queries)

### Update — 3 queries

| Query | Question |
| :--- | :--- |
| `update_element_statement` | Correct the wording of a claim |
| `update_mark_element_invalid` | Mark one element invalid |
| `update_retarget_solution_to_new_artefact` | Re-baseline a solution onto new evidence |

Everything else that changes flags is a rule — see below.

[count]: <> (delete_queries)

### Delete — 6 queries

| Query | Question |
| :--- | :--- |
| `delete_element_and_its_links` | Remove an element without leaving dangling references |
| `delete_support_link` | Detach a branch, keeping both ends |
| `delete_challenge_and_its_effects` | Withdraw a challenge *and* the doubt it wrote |
| `delete_unreferenced_artefacts` | Collect evidence nothing cites |
| `delete_materialised_inferences` | Clear the conclusions the rules wrote |
| `delete_assurance_case` | Remove a case, sparing the artefacts |

## Rules

`rules/` has one file per SWRL rule, named `s<NN>_<rule_name>.rq`. Each file starts with the
rule number (`# rule:`) and the rule name (`# name:`). Its section and the original SWRL are
in [`QUERY-COMMENTS.md`](../../QUERY-COMMENTS.md), so the file and the workbook row can be
read side by side.

Run them with:

```bash
python ontology/example/run_rules.py mycase.ttl --out mycase-materialised.ttl
python ontology/example/run_rules.py mycase.ttl --dry-run           # what would each rule derive?
python ontology/example/run_rules.py mycase.ttl --only S1,S16,S47
python ontology/example/run_rules.py mycase.ttl --section "Dialectic Extension"
```

A SPARQL update can do two things that a SWRL rule cannot: it can replace an old value, and it can
test that a fact is absent. [`rules/README.md`](rules/README.md) lists each rule and says where its
update does more than the SWRL rule.

A rule that creates a node, for example S18, builds the IRI of the node from the IRIs of the two
elements that the node links. A second run builds the same IRI, so you can run the rules again
on a case that already holds their results, and the store gets no second copy of a node.

Each rule derives one step, so `run_rules.py` applies the whole set repeatedly until a pass
changes nothing. If two rules contradict each other on your case the passes will loop; the
driver detects that, stops, and names the rules involved.

## Verification

`development/dev_tools/query_check.py` runs each query against the ontology and the example ABox in
Oxigraph and records the outcome in `development/design/ontogsn-design-queries.ttl`. See
[`development/dev_tools/README.md`](../../development/dev_tools/README.md#stored-queries).
