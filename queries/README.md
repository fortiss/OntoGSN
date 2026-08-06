# Stored queries

CRUD SPARQL for a graph database holding an assurance case built on
[`serializations/ontogsn.ttl`](../serializations/ontogsn.ttl). One file per competency
question; the question itself is in the file's header, and the same set is tabulated in
`OntoGSN Competency Questions.xlsx`.

[`rules/`](rules/) holds all 51 SWRL rules from `OntoGSN SWRL Rules.xlsx` as SPARQL
updates, for stores with no reasoner attached.

## Using them

Load the ontology **and** your case into the same graph — some queries walk
`rdfs:subClassOf*` and need the class hierarchy.

Parameters are literals in a `VALUES` block marked `# PARAMETER`, addressed by
`schema:identifier` rather than IRI, so a query runs against any case unedited:

```sparql
VALUES ?goalId { "G1" }             # PARAMETER: the goal to trace
?goal schema:identifier ?goalId .
```

The defaults point at [`tools/testdata/example_case.ttl`](../tools/testdata/example_case.ttl),
so every query runs as-is and returns something.

Boolean decorators are matched with `FILTER(STR(?flag) = "true")`, which works whether the
data carries `true`, `"true"^^xsd:boolean` or `"true"`.

## The catalogue

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

### Update — 3 queries

| Query | Question |
| :--- | :--- |
| `update_element_statement` | Correct the wording of a claim |
| `update_mark_element_invalid` | Mark one element invalid |
| `update_retarget_solution_to_new_artefact` | Re-baseline a solution onto new evidence |

Everything else that changes flags is a rule — see below.

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

`rules/` has one file per SWRL rule, named `s<NN>_<rule_name>.rq`. Each header carries the
rule number, its name and section, and the original SWRL, so the file and the workbook row
can be read side by side.

Run them with:

```bash
python tools/run_rules.py mycase.ttl --out mycase-materialised.ttl
python tools/run_rules.py mycase.ttl --dry-run           # what would each rule derive?
python tools/run_rules.py mycase.ttl --only S1,S16,S47
python tools/run_rules.py mycase.ttl --section "Dialectic Extension"
```

Each rule derives one step, so `run_rules.py` applies the whole set repeatedly until a pass
changes nothing. If two rules contradict each other on your case the passes will loop; the
driver detects that, stops, and names the rules involved.

## Verification

`tools/query_check.py` runs each query against the ontology and the example ABox in
Oxigraph and records the outcome in `provenance/ontogsn-provenance-queries.ttl`. See
[`tools/README.md`](../tools/README.md#stored-queries).
