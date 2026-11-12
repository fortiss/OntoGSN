# The rules as SPARQL updates

[count]: <> (rule_twins)

Each of the 58 SWRL rules of [`ontogsn.ttl`](../../serializations/ontogsn.ttl) has a twin in this
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

Of the twins, 19 draw exactly the conclusions of their rule, 39 have a retraction and 2 have a
guard.

The table below gives each twin a level:

| Level | Meaning |
| :--- | :--- |
| exact | The twin and the rule draw the same conclusions. SWRL alone is enough. |
| close | The twin has a retraction. The conclusions are the same on a case that has no earlier value for the flag. |
| narrower | The twin has a guard. It draws its conclusion in fewer cases than the rule. |

## The rules

The design record states the differences of each twin with `gsndesign:differsBy`, and
`development/dev_tools/prov_augment.py` derives them from the text of the update.
`development/dev_tools/doc_counts.py` writes this table from the record. Do not edit it by hand.

[table]: <> (core_rule_twins)

| Rule | Name | Section | SPARQL update | Level | Differs by |
| :--- | :--- | :--- | :--- | :--- | :--- |
| S1 | Assumption Invalidation | Part 0, Glossary & Annex | [`s01_assumption_invalidation.rq`](s01_assumption_invalidation.rq) | close | retraction |
| S2 | Contextual Relation | Part 0, Glossary & Annex | [`s02_contextual_relation.rq`](s02_contextual_relation.rq) | close | retraction |
| S3 | Evidential Relation | Part 0, Glossary & Annex | [`s03_evidential_relation.rq`](s03_evidential_relation.rq) | close | retraction |
| S4 | Inferential Relation | Part 0, Glossary & Annex | [`s04_inferential_relation.rq`](s04_inferential_relation.rq) | close | retraction |
| S5 | Inferential Relation (Goal) | Part 0, Glossary & Annex | [`s05_inferential_relation_goal.rq`](s05_inferential_relation_goal.rq) | close | retraction |
| S6 | Goal Top Flag | Part 0, Glossary & Annex | [`s06_goal_top_flag.rq`](s06_goal_top_flag.rq) | narrower | guard, retraction |
| S8 | Contradictory Goal Truth | Core GSN | [`s08_contradictory_goal_truth.rq`](s08_contradictory_goal_truth.rq) | close | retraction |
| S10 | Solution Propagation (True) | Core GSN | [`s10_solution_propagation_true.rq`](s10_solution_propagation_true.rq) | narrower | guard, retraction |
| S11 | Solution Propagation (False) | Core GSN | [`s11_solution_propagation_false.rq`](s11_solution_propagation_false.rq) | close | retraction |
| S12 | Mixed Support Invalidation | Core GSN | [`s12_mixed_support_invalidation.rq`](s12_mixed_support_invalidation.rq) | close | retraction |
| S14 | Relation False Propagation | Core GSN | [`s14_relation_false_propagation.rq`](s14_relation_false_propagation.rq) | close | retraction |
| S16 | Assumption False Propagation | Core GSN | [`s16_assumption_false_propagation.rq`](s16_assumption_false_propagation.rq) | close | retraction |
| S17 | Context Inheritance | Core GSN | [`s17_context_inheritance.rq`](s17_context_inheritance.rq) | exact | none |
| S18 | Support Relation Creation | Core GSN | [`s18_support_relation_creation.rq`](s18_support_relation_creation.rq) | exact | none |
| S19 | Context Relation Creation | Core GSN | [`s19_context_relation_creation.rq`](s19_context_relation_creation.rq) | exact | none |
| S20 | Final Pattern Invalidation | Argument Pattern Extension | [`s20_final_pattern_invalidation.rq`](s20_final_pattern_invalidation.rq) | close | retraction |
| S21 | Template Undeveloped Invalidation (A) | Argument Pattern Extension | [`s21_template_undeveloped_invalidation_a.rq`](s21_template_undeveloped_invalidation_a.rq) | close | retraction |
| S22 | Template Undeveloped Invalidation (B) | Argument Pattern Extension | [`s22_template_undeveloped_invalidation_b.rq`](s22_template_undeveloped_invalidation_b.rq) | close | retraction |
| S23 | Cross-Module Away Support | Modular Extension | [`s23_cross_module_away_support.rq`](s23_cross_module_away_support.rq) | close | retraction |
| S24 | Cross-Module Away Context | Modular Extension | [`s24_cross_module_away_context.rq`](s24_cross_module_away_context.rq) | close | retraction |
| S25 | Duplicate Identifier Invalidation | Modular Extension | [`s25_duplicate_identifier_invalidation.rq`](s25_duplicate_identifier_invalidation.rq) | close | retraction |
| S26 | Contract Violation Relation | Modular Extension | [`s26_contract_violation_relation.rq`](s26_contract_violation_relation.rq) | close | retraction |
| S27 | Context Contract Invalidation | Modular Extension | [`s27_context_contract_invalidation.rq`](s27_context_contract_invalidation.rq) | close | retraction |
| S28 | Contract Support Invalidation | Modular Extension | [`s28_contract_support_invalidation.rq`](s28_contract_support_invalidation.rq) | close | retraction |
| S29 | Away Goal Invalidation | Modular Extension | [`s29_away_goal_invalidation.rq`](s29_away_goal_invalidation.rq) | close | retraction |
| S30 | Contract Activation | Modular Extension | [`s30_contract_activation.rq`](s30_contract_activation.rq) | close | retraction |
| S31 | Contract Relation Invalidation | Modular Extension | [`s31_contract_relation_invalidation.rq`](s31_contract_relation_invalidation.rq) | close | retraction |
| S32 | Context Consistency | Modular Extension | [`s32_context_consistency.rq`](s32_context_consistency.rq) | exact | none |
| S33 | Substitution Invalidation | Modular Extension | [`s33_substitution_invalidation.rq`](s33_substitution_invalidation.rq) | close | retraction |
| S34 | Module Support Propagation | Modular Extension | [`s34_module_support_propagation.rq`](s34_module_support_propagation.rq) | exact | none |
| S35 | Module Context Propagation | Modular Extension | [`s35_module_context_propagation.rq`](s35_module_context_propagation.rq) | exact | none |
| S36 | Cross-Module Support | Modular Extension | [`s36_cross_module_support.rq`](s36_cross_module_support.rq) | exact | none |
| S38 | Public Context Propagation | Modular Extension | [`s38_public_context_propagation.rq`](s38_public_context_propagation.rq) | close | retraction |
| S39 | Public Contract Invalidation | Modular Extension | [`s39_public_contract_invalidation.rq`](s39_public_contract_invalidation.rq) | close | retraction |
| S40 | Confidence Relation Creation | Confidence Argument Extension | [`s40_confidence_relation_creation.rq`](s40_confidence_relation_creation.rq) | exact | none |
| S41 | Duplicate ACP Identifier Invalidation | Confidence Argument Extension | [`s41_duplicate_acp_identifier_invalidation.rq`](s41_duplicate_acp_identifier_invalidation.rq) | close | retraction |
| S42 | Strategy Confidence Relation | Confidence Argument Extension | [`s42_strategy_confidence_relation.rq`](s42_strategy_confidence_relation.rq) | exact | none |
| S43 | Goal-Strategy Confidence | Confidence Argument Extension | [`s43_goal_strategy_confidence.rq`](s43_goal_strategy_confidence.rq) | exact | none |
| S44 | Solution Confidence Relation | Confidence Argument Extension | [`s44_solution_confidence_relation.rq`](s44_solution_confidence_relation.rq) | exact | none |
| S45 | Goal Confidence Relation | Confidence Argument Extension | [`s45_goal_confidence_relation.rq`](s45_goal_confidence_relation.rq) | exact | none |
| S46 | Challenge Defeat | Dialectic Extension | [`s46_challenge_defeat.rq`](s46_challenge_defeat.rq) | close | retraction |
| S47 | Defeated Invalidation | Dialectic Extension | [`s47_defeated_invalidation.rq`](s47_defeated_invalidation.rq) | close | retraction |
| S48 | Challenge Doubt | Dialectic Extension | [`s48_challenge_doubt.rq`](s48_challenge_doubt.rq) | close | retraction |
| S49 | Undeveloped Defeat | Dialectic Extension | [`s49_undeveloped_defeat.rq`](s49_undeveloped_defeat.rq) | close | retraction |
| S50 | Challenge Relation Creation | Dialectic Extension | [`s50_challenge_relation_creation.rq`](s50_challenge_relation_creation.rq) | exact | none |
| S51 | Challenge Chain Invalidation | Dialectic Extension | [`s51_challenge_chain_invalidation.rq`](s51_challenge_chain_invalidation.rq) | close | retraction |
| S52 | Defeater Declaration | Part 2 | [`s52_defeater_declaration.rq`](s52_defeater_declaration.rq) | exact | none |
| S53 | Module Membership | Modular Extension | [`s53_module_membership.rq`](s53_module_membership.rq) | exact | none |
| S54 | Nested Module Membership | Modular Extension | [`s54_nested_module_membership.rq`](s54_nested_module_membership.rq) | exact | none |
| S55 | Support Closure | Core GSN | [`s55_support_closure.rq`](s55_support_closure.rq) | exact | none |
| S56 | Support Cycle Invalidation | Core GSN | [`s56_support_cycle_invalidation.rq`](s56_support_cycle_invalidation.rq) | close | retraction |
| S57 | Support Cycle Relationship Invalidation | Core GSN | [`s57_support_cycle_relationship_invalidation.rq`](s57_support_cycle_relationship_invalidation.rq) | close | retraction |
| S58 | Module Context Closure | Modular Extension | [`s58_module_context_closure.rq`](s58_module_context_closure.rq) | exact | none |
| S59 | Module Context Cycle Invalidation | Modular Extension | [`s59_module_context_cycle_invalidation.rq`](s59_module_context_cycle_invalidation.rq) | close | retraction |
| S60 | Module Context Cycle Relationship Invalidation | Modular Extension | [`s60_module_context_cycle_relationship_invalidation.rq`](s60_module_context_cycle_relationship_invalidation.rq) | close | retraction |
| S61 | Challenge Closure | Dialectic Extension | [`s61_challenge_closure.rq`](s61_challenge_closure.rq) | exact | none |
| S62 | Challenge Cycle Invalidation | Dialectic Extension | [`s62_challenge_cycle_invalidation.rq`](s62_challenge_cycle_invalidation.rq) | close | retraction |
| S63 | Challenge Cycle Relationship Invalidation | Dialectic Extension | [`s63_challenge_cycle_relationship_invalidation.rq`](s63_challenge_cycle_relationship_invalidation.rq) | close | retraction |
