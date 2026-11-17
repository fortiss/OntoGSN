# The stored queries of the Augmentation

Each file in this folder is one SPARQL query that answers one competency question of a
compliance process. The questions are on the "Competency Questions" sheet of
[`development/design/Competency Questions.xlsx`](../../development/design/Competency%20Questions.xlsx),
with the role that asks each one. A CQ number in a note below is the id of a question on that
sheet or on the "Extra" sheet. The questions CQ-01 to CQ-43 have their queries in
[`ontology/queries/`](../../ontology/queries/README.md).

## How to run a query

Load the OntoGSN ontology, the Augmentation and your case into one graph. Then run the file
in any SPARQL engine. Every query is a read, so it changes nothing.

Some queries read what a rule derives, for example `gsn:defeated`. Run the rules of the core
and of the Augmentation before such a query, see [`../README.md`](../README.md).

A parameter is a value in a `VALUES` block near the top of the file. Change the value before
the run. A query file holds no comment. The reasons for the choices in a query are in the
design record, `development/design/ontogsn-augmentation-design.ttl`.

## The catalogue

| Query | Question id | Role | Question | Parameters | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`fc01_requirement_source.rq`](fc01_requirement_source.rq) | CQ-44 | Auditor | What law or requirement source does the case answer to? | none | Any element can answer to a requirement, not only the top goal. A control claim usually names the clause that it implements. For a case that names no requirement, use CQ-07, which returns every context in scope. |
| [`fc02_assured_system.rq`](fc02_assured_system.rq) | CQ-45 | Auditor | What system and organisation is this case about? | none | The subject is an argument, an assurance case or a goal. |
| [`fc03_undeveloped_claims_for_system.rq`](fc03_undeveloped_claims_for_system.rq) | CQ-46 | Compliance Officer | Which low-level claims need development for each system? | `?system`: the name of the system, as a context states it | The query walks up the support chain to the context that names the system. It does not need a run of rule S17. |
| [`fc07_evidence_location.rq`](fc07_evidence_location.rq) | CQ-49 | Developer | Where is the requested evidence kept and how is it fetched? | none |  |
| [`fc08_evidence_production.rq`](fc08_evidence_production.rq) | CQ-50 | Developer | Does the evidence exist yet, and how was it produced - by whom, with what, from what? | none | A solution with no artefact is evidence that does not exist yet, so the artefact columns can be empty. |
| [`fc10_evidence_verification.rq`](fc10_evidence_verification.rq) | CQ-52 | Process/Software Owner | Was this evidence checked, by whom, with what mechanism, and did it pass? | none |  |
| [`fc11_controls_ready_for_review.rq`](fc11_controls_ready_for_review.rq) | CQ-53 | Auditor | Which controls are ready for review? | none | Ready means that the control is developed and has an artefact. CQ-54 says whether it passed. CQ-26 and CQ-16 say what is still missing. |
| [`fc13_case_compliance.rq`](fc13_case_compliance.rq) | CQ-55 | Auditor | Is the case fully compliant? | none | The case is compliant when all three counts are zero. The query computes the counts in each run, so the answer is the status now, not the status on a past date. |
| [`fc14_open_clarifications.rq`](fc14_open_clarifications.rq) | CQ-56 | Auditor | Which elements have an open clarification against them? | none | Open means that the issue has no outcome. |
| [`fc15_who_answers_for_element.rq`](fc15_who_answers_for_element.rq) | CQ-57 | Process/Software Owner | Who can answer for this element - its owner, or the author of its evidence? | none |  |
| [`fc16_clarification_answers.rq`](fc16_clarification_answers.rq) | CQ-58 | Auditor | What was said in reply to a clarification, and was the reply accepted? | none | A response does not close an ask. The outcome does: `resolved` means that the raiser accepted a response. An ask with no outcome is open, with or without responses. |
| [`fc17_rounds_per_element.rq`](fc17_rounds_per_element.rq) | CQ-59 | Auditor | How many rounds has this element taken, and of which kind? | none | Each round is one issue, so the answer is a count of issues. |
| [`fc18_superseded_asks.rq`](fc18_superseded_asks.rq) | CQ-60 | Auditor | Which pending ask was displaced by a newer one? | none |  |
| [`fc19_who_holds_the_ask.rq`](fc19_who_holds_the_ask.rq) | CQ-61 | Auditor | Who currently holds a relayed ask - where is it stuck? | none |  |
| [`fc20_escalation_count.rq`](fc20_escalation_count.rq) | CQ-62 | Auditor | How many times was an ask escalated because the holder could not answer? | none | An escalation is an ask whose predecessor was closed as cannot-answer. The query counts from the first ask in the chain, which supersedes nothing. |
| [`fc22_what_to_revise.rq`](fc22_what_to_revise.rq) | CQ-64 | Compliance Officer | What has to be revised, and by whom? | none | The class of the target says whether the claim or the evidence is at fault. A revise issue against a context is a remark about wording, and the query does not return it. |
| [`fc23_revision_rounds.rq`](fc23_revision_rounds.rq) | CQ-65 | Compliance Officer | How many revision rounds, and what was offered in reply to each ask? | none |  |
| [`fc24_revision_diff.rq`](fc24_revision_diff.rq) | CQ-66 | Developer | What did a revision actually change - which artefact replaced which? | none | A revision here is a new version of an artefact. A claim with new words is not in the answer. The issue column gives the revise or resolve issue that asked for the change. |
| [`fc26_unresolved_at_audit.rq`](fc26_unresolved_at_audit.rq) | CQ-68 | Auditor | What was left unresolved at the last audit, and what is due by the next one? | none | The query selects by audit cycle and not by date, because two audits can overlap in time. |
| [`fc27_resolution_state.rq`](fc27_resolution_state.rq) | CQ-69 | Auditor | Was a resolution implemented, declined, or infeasible? | none | The state is the outcome of the ask. The last column says whether a response is on record. A response that the auditor did not accept leaves the ask open. |
| [`fc28_manual_evidence.rq`](fc28_manual_evidence.rq) | CQ-70 | Developer | Which evidence needs to be generated manually? | none |  |
| [`fc29_automated_evidence.rq`](fc29_automated_evidence.rq) | CQ-71 | Developer | Which evidence is generated automatically, and how or where from can it be retrieved? | none | Evidence is an artefact that a solution refers to. Generated data that no solution refers to, for example the data of an instantiation, is not in the answer. |
| [`fc30_alternative_provision.rq`](fc30_alternative_provision.rq) | CQ-72 | Process/Software Owner | Which evidence needs an alternative provision mechanism - an interview, a call, paper? | none | The query returns the mechanisms that a person has to run. The kind of mechanism, for example an interview or a call, is a subclass of `gsnaug:Mechanism` in your domain ontology. |
| [`fc31_evidence_cannot_be_produced.rq`](fc31_evidence_cannot_be_produced.rq) | CQ-73 | Developer | Which evidence cannot be produced at all, as opposed to not yet produced? | none | Evidence that is not yet produced is `gsn:undeveloped` or `gsn:uninstantiated`, which CQ-26 and CQ-27 report. Evidence that cannot be produced is an ask that was closed as infeasible. |
| [`fc32_cannot_resolve.rq`](fc32_cannot_resolve.rq) | CQ-74 | Auditor | Which issue cannot be resolved at all, as opposed to not yet resolved? | none |  |
| [`fc33_instantiated_elements.rq`](fc33_instantiated_elements.rq) | CQ-75 | Compliance Officer | How is the interpretation instantiated into claims and evidence? | none | The reference says which data governs the part of the argument below it. `gsnaug:instantiatedFrom` says which row of the data produced the element. |
| [`fc34_who_retrieves_evidence.rq`](fc34_who_retrieves_evidence.rq) | CQ-76 | Compliance Officer | Who is responsible for retrieving the evidence for a particular system? | none | The query reads `gsnaug:assures`, which names a `gsnaug:System` directly. So the answer does not depend on a top-level context in the case. |
| [`fc35_artefacts_to_change.rq`](fc35_artefacts_to_change.rq) | CQ-77 | Developer | Which artefacts need changing, and who owns the change? | none | The last column is the impact of the change. CQ-15 gives the full impact for one artefact. |
| [`fc36_automation_feasibility.rq`](fc36_automation_feasibility.rq) | CQ-78 | Developer | Which evidence can be generated automatically, and which has been assessed as manual? | none | Evidence with no mechanism was not assessed. A mechanism with the flag `false` means that automation was assessed and rejected. |
| [`fc37_term_impact.rq`](fc37_term_impact.rq) | CQ-79 | Developer | If this domain term changes, which mechanisms, artefacts and claims are affected? | `?term`: the IRI of the domain term | You do not run a mechanism for the answer. A mechanism is in the answer only if it declares the terms that it reads. The derivations D1 to D3 derive the declaration for a shape or a rule in the graph. For a script, a person writes it. |
| [`fc38_inspectable_mechanisms.rq`](fc38_inspectable_mechanisms.rq) | CQ-80 | Compliance Officer | Which evidence rests on a mechanism that can be read without being run, and what does each mechanism declare? | none | Each mechanism has one of four states. In the graph: a shape, a rule or a query implements it, so you can read what it depends on. Script in the graph: a person can read it, but its terms are declared by hand. Declared by hand: terms are listed, but nothing in the graph says what the mechanism does. Opaque: only a run tells. The query knows SHACL shapes, SHACL-AF SPARQL executables, SWRL rules and SPIN queries. For a new formalism, add its type to the list in the query. |
| [`fc39_requirement_revised.rq`](fc39_requirement_revised.rq) | CQ-81 | Compliance Officer | Which elements answer to a requirement that has a newer revision? | none | A changed requirement is a new `gsnaug:Requirement` with `prov:wasRevisionOf` to the old one. An element that still has `gsnaug:requiredBy` to the old one, and not to the new one, is in the answer. If the change matters to the element, raise a revise issue on it. Rule A2 then makes the issue a challenge. |
| [`fc40_system_revised.rq`](fc40_system_revised.rq) | CQ-82 | Developer | Which evidence was drawn from a system, or a part of one, that has a newer revision? | none | A changed system, or a changed part of one, is a new individual with `prov:wasRevisionOf` to the old one. An artefact with `gsnaug:generatedFrom` to the old one is in the answer until a replacement from the new one exists. The last two columns are the solution that cites the artefact and the goals above it. If the change matters to them, raise a revise issue on the solution. |
| [`fc41_context_revised.rq`](fc41_context_revised.rq) | CQ-83 | Process Owner | Which goals sit under a context whose artefact has a newer revision? | none | The context refers to an artefact, for example a deployment list, and a newer artefact replaces it with `gsnaug:replaces` or `prov:wasRevisionOf`. A context applies to its element and to everything below it, so the query walks down the support chain. If the change matters to a goal, raise a revise issue on the goal. |
