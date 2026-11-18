# The rules as SPARQL updates

[count]: <> (rule_twins)

Each of the 60 SWRL rules of [`ontogsn.ttl`](../../serializations/ontogsn.ttl) has a twin in this
folder: one SPARQL update with the same name. The twins are for a store with no reasoner.
[`run_rules.py`](../../example/run_rules.py) applies them until no update changes the case. See
[`../README.md`](../README.md#rules) for the commands.

## The two forms state the same rule

A SWRL rule and its twin state the same rule of the GSN standard. Neither form is the lesser
one. The two languages differ in what they can do. SWRL only adds facts, and it cannot test
that a fact is absent. A SPARQL update can remove a fact, and it can test for absence. So some
twins do something that their rule cannot:

| Difference | What the twin does | What this means if you run the SWRL rule in a reasoner |
| :--- | :--- | :--- |
| Retraction | It deletes the old value of a flag, for example `gsn:true`, before it writes the new one. An element then has one value. | The rule adds its value next to a value that is already there. An element can then have `true` and `false` together. Do not assert a flag that a rule sets, and do not save inferred flags back into the case. To clear earlier results in a store, run [`delete_materialised_inferences.rq`](../delete_materialised_inferences.rq). |
| Guard | It draws its conclusion only if a stated fact is absent. For example, S10 makes a goal true only if no other solution under the goal is untrue. | The rule draws its conclusion in those cases too. Read the conclusion together with the other rules that set the same flag. For S10, rule S11 sets the goal to false in the same case, so the goal has both values. |

A twin can have both differences. A twin also tests that the fact it is about to insert is not
there yet, so that it writes no second copy. That test is not a difference, because a rule
cannot write a second copy.

[count]: <> (rule_twins_exact rule_twins_retracting rule_twins_guarding)

Of the twins, 19 draw exactly the conclusions of their rule, 41 have a retraction and 2 have a
guard.

The table below gives each twin a level:

| Level | Meaning |
| :--- | :--- |
| exact | The twin and the rule draw the same conclusions. SWRL alone is enough. |
| close | The twin has a retraction. The conclusions are the same on a case that has no earlier value for the flag. |
| narrower | The twin has a guard. It draws its conclusion in fewer cases than the rule. |

## Rules that follow a chain

A twin can also reach its conclusions in another number of steps than its rule. The
conclusions are the same, so the table below does not count this as a difference.

| Rules | What the SWRL rule does | What the twin does |
| :--- | :--- | :--- |
| S55, S58, S61 (the closure rules) | It states one step: a direct link is also a transitive link. The axiom `owl:TransitiveProperty` on the helper property gives the chain. | It has a property path, and it inserts the whole chain in one run. A store without a reasoner does not apply the axiom. The path of S58 runs through modules only. |
| S54 (nested module membership) | A reasoner applies it until it reaches every level of nesting. | One run moves the membership up one module. `run_rules.py` applies the rules until nothing changes, so it reaches every level. If you run the file alone, run it once for each level. |

## The rules

The design record states the differences of each twin with `gsndesign:differsBy`, and
`development/dev_tools/prov_inventory.py` derives them from the text of the update.
`development/dev_tools/doc_counts.py` writes this table from the record. Do not edit it by hand.

[table]: <> (core_rule_twins)

| Rule and its SPARQL update | Name | Section | Level | Differs by |
| :--- | :--- | :--- | :--- | :--- |
| [`RL-GSN-final_pattern_invalidation`](RL-GSN-final_pattern_invalidation.rq) | Final Pattern Invalidation | Argument Pattern Extension | close | retraction |
| [`RL-GSN-template_undeveloped_invalidation_a`](RL-GSN-template_undeveloped_invalidation_a.rq) | Template Undeveloped Invalidation (A) | Argument Pattern Extension | close | retraction |
| [`RL-GSN-template_undeveloped_invalidation_b`](RL-GSN-template_undeveloped_invalidation_b.rq) | Template Undeveloped Invalidation (B) | Argument Pattern Extension | close | retraction |
| [`RL-GSN-confidence_relation_creation`](RL-GSN-confidence_relation_creation.rq) | Confidence Relation Creation | Confidence Argument Extension | exact | none |
| [`RL-GSN-duplicate_acp_identifier_invalidation`](RL-GSN-duplicate_acp_identifier_invalidation.rq) | Duplicate ACP Identifier Invalidation | Confidence Argument Extension | close | retraction |
| [`RL-GSN-goal_confidence_relation`](RL-GSN-goal_confidence_relation.rq) | Goal Confidence Relation | Confidence Argument Extension | exact | none |
| [`RL-GSN-goal_strategy_confidence`](RL-GSN-goal_strategy_confidence.rq) | Goal-Strategy Confidence | Confidence Argument Extension | exact | none |
| [`RL-GSN-solution_confidence_relation`](RL-GSN-solution_confidence_relation.rq) | Solution Confidence Relation | Confidence Argument Extension | exact | none |
| [`RL-GSN-strategy_confidence_relation`](RL-GSN-strategy_confidence_relation.rq) | Strategy Confidence Relation | Confidence Argument Extension | exact | none |
| [`RL-GSN-assumption_false_propagation`](RL-GSN-assumption_false_propagation.rq) | Assumption False Propagation | Core GSN | close | retraction |
| [`RL-GSN-context_inheritance`](RL-GSN-context_inheritance.rq) | Context Inheritance | Core GSN | exact | none |
| [`RL-GSN-context_relation_creation`](RL-GSN-context_relation_creation.rq) | Context Relation Creation | Core GSN | exact | none |
| [`RL-GSN-contradictory_goal_truth`](RL-GSN-contradictory_goal_truth.rq) | Contradictory Goal Truth | Core GSN | close | retraction |
| [`RL-GSN-mixed_support_invalidation`](RL-GSN-mixed_support_invalidation.rq) | Mixed Support Invalidation | Core GSN | close | retraction |
| [`RL-GSN-relation_false_propagation`](RL-GSN-relation_false_propagation.rq) | Relation False Propagation | Core GSN | close | retraction |
| [`RL-GSN-solution_propagation_false`](RL-GSN-solution_propagation_false.rq) | Solution Propagation (False) | Core GSN | close | retraction |
| [`RL-GSN-solution_propagation_true`](RL-GSN-solution_propagation_true.rq) | Solution Propagation (True) | Core GSN | narrower | guard, retraction |
| [`RL-GSN-support_closure`](RL-GSN-support_closure.rq) | Support Closure | Core GSN | exact | none |
| [`RL-GSN-support_cycle_invalidation`](RL-GSN-support_cycle_invalidation.rq) | Support Cycle Invalidation | Core GSN | close | retraction |
| [`RL-GSN-support_cycle_relationship_invalidation`](RL-GSN-support_cycle_relationship_invalidation.rq) | Support Cycle Relationship Invalidation | Core GSN | close | retraction |
| [`RL-GSN-support_relation_creation`](RL-GSN-support_relation_creation.rq) | Support Relation Creation | Core GSN | exact | none |
| [`RL-GSN-challenge_chain_invalidation`](RL-GSN-challenge_chain_invalidation.rq) | Challenge Chain Invalidation | Dialectic Extension | close | retraction |
| [`RL-GSN-challenge_closure`](RL-GSN-challenge_closure.rq) | Challenge Closure | Dialectic Extension | exact | none |
| [`RL-GSN-challenge_cycle_invalidation`](RL-GSN-challenge_cycle_invalidation.rq) | Challenge Cycle Invalidation | Dialectic Extension | close | retraction |
| [`RL-GSN-challenge_cycle_relationship_invalidation`](RL-GSN-challenge_cycle_relationship_invalidation.rq) | Challenge Cycle Relationship Invalidation | Dialectic Extension | close | retraction |
| [`RL-GSN-challenge_defeat`](RL-GSN-challenge_defeat.rq) | Challenge Defeat | Dialectic Extension | close | retraction |
| [`RL-GSN-challenge_doubt`](RL-GSN-challenge_doubt.rq) | Challenge Doubt | Dialectic Extension | close | retraction |
| [`RL-GSN-challenge_relation_creation`](RL-GSN-challenge_relation_creation.rq) | Challenge Relation Creation | Dialectic Extension | exact | none |
| [`RL-GSN-context_doubt_propagation`](RL-GSN-context_doubt_propagation.rq) | Context Doubt Propagation | Dialectic Extension | close | retraction |
| [`RL-GSN-defeated_invalidation`](RL-GSN-defeated_invalidation.rq) | Defeated Invalidation | Dialectic Extension | close | retraction |
| [`RL-GSN-support_doubt_propagation`](RL-GSN-support_doubt_propagation.rq) | Support Doubt Propagation | Dialectic Extension | close | retraction |
| [`RL-GSN-undeveloped_defeat`](RL-GSN-undeveloped_defeat.rq) | Undeveloped Defeat | Dialectic Extension | close | retraction |
| [`RL-GSN-away_goal_invalidation`](RL-GSN-away_goal_invalidation.rq) | Away Goal Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-context_consistency`](RL-GSN-context_consistency.rq) | Context Consistency | Modular Extension | exact | none |
| [`RL-GSN-context_contract_invalidation`](RL-GSN-context_contract_invalidation.rq) | Context Contract Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-contract_activation`](RL-GSN-contract_activation.rq) | Contract Activation | Modular Extension | close | retraction |
| [`RL-GSN-contract_relation_invalidation`](RL-GSN-contract_relation_invalidation.rq) | Contract Relation Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-contract_support_invalidation`](RL-GSN-contract_support_invalidation.rq) | Contract Support Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-contract_violation_relation`](RL-GSN-contract_violation_relation.rq) | Contract Violation Relation | Modular Extension | close | retraction |
| [`RL-GSN-cross_module_away_context`](RL-GSN-cross_module_away_context.rq) | Cross-Module Away Context | Modular Extension | close | retraction |
| [`RL-GSN-cross_module_away_support`](RL-GSN-cross_module_away_support.rq) | Cross-Module Away Support | Modular Extension | close | retraction |
| [`RL-GSN-cross_module_support`](RL-GSN-cross_module_support.rq) | Cross-Module Support | Modular Extension | exact | none |
| [`RL-GSN-duplicate_identifier_invalidation`](RL-GSN-duplicate_identifier_invalidation.rq) | Duplicate Identifier Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-module_context_closure`](RL-GSN-module_context_closure.rq) | Module Context Closure | Modular Extension | exact | none |
| [`RL-GSN-module_context_cycle_invalidation`](RL-GSN-module_context_cycle_invalidation.rq) | Module Context Cycle Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-module_context_cycle_relationship_invalidation`](RL-GSN-module_context_cycle_relationship_invalidation.rq) | Module Context Cycle Relationship Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-module_context_propagation`](RL-GSN-module_context_propagation.rq) | Module Context Propagation | Modular Extension | exact | none |
| [`RL-GSN-module_membership`](RL-GSN-module_membership.rq) | Module Membership | Modular Extension | exact | none |
| [`RL-GSN-module_support_propagation`](RL-GSN-module_support_propagation.rq) | Module Support Propagation | Modular Extension | exact | none |
| [`RL-GSN-nested_module_membership`](RL-GSN-nested_module_membership.rq) | Nested Module Membership | Modular Extension | exact | none |
| [`RL-GSN-public_context_propagation`](RL-GSN-public_context_propagation.rq) | Public Context Propagation | Modular Extension | close | retraction |
| [`RL-GSN-public_contract_invalidation`](RL-GSN-public_contract_invalidation.rq) | Public Contract Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-substitution_invalidation`](RL-GSN-substitution_invalidation.rq) | Substitution Invalidation | Modular Extension | close | retraction |
| [`RL-GSN-assumption_invalidation`](RL-GSN-assumption_invalidation.rq) | Assumption Invalidation | Part 0, Glossary & Annex | close | retraction |
| [`RL-GSN-contextual_relation`](RL-GSN-contextual_relation.rq) | Contextual Relation | Part 0, Glossary & Annex | close | retraction |
| [`RL-GSN-evidential_relation`](RL-GSN-evidential_relation.rq) | Evidential Relation | Part 0, Glossary & Annex | close | retraction |
| [`RL-GSN-goal_top_flag`](RL-GSN-goal_top_flag.rq) | Goal Top Flag | Part 0, Glossary & Annex | narrower | guard, retraction |
| [`RL-GSN-inferential_relation`](RL-GSN-inferential_relation.rq) | Inferential Relation | Part 0, Glossary & Annex | close | retraction |
| [`RL-GSN-inferential_relation_goal`](RL-GSN-inferential_relation_goal.rq) | Inferential Relation (Goal) | Part 0, Glossary & Annex | close | retraction |
| [`RL-GSN-defeater_declaration`](RL-GSN-defeater_declaration.rq) | Defeater Declaration | Part 2 | exact | none |
