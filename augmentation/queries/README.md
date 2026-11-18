# The stored queries of the Augmentation

Each file in this folder is one SPARQL query that answers one competency question of a
compliance process. [`../registry.csv`](../registry.csv) gives the question of each file, the
role that asks it, and the IDs that its ID replaced. The questions that OntoGSN alone can answer
have their queries in [`ontology/queries/`](../../ontology/queries/README.md), among them seven
questions of the same process.

## How to run a query

Load the OntoGSN ontology, the Augmentation and your case into one graph. Then run the file
in any SPARQL engine. Every query is a read, so it changes nothing.

Some queries read what a rule derives, for example `gsn:defeated`. Run the rules of the core
and of the Augmentation before such a query, see [`../README.md`](../README.md).

A parameter is a value in a `VALUES` block near the top of the file. Change the value before
the run. A query file holds no comment. The reasons for the choices in a query are in the
design record, `development/design/ontogsn-augmentation-design.ttl`.

## The catalogue

| Query | Role | Question | Parameters | Notes |
| :--- | :--- | :--- | :--- | :--- |
| [`RQ-AUG-requirement_source`](RQ-AUG-requirement_source.rq) | Auditor | What law or requirement source does the case answer to? | none | Any element can answer to a requirement, not only the top goal. A control claim usually names the clause that it implements. For a case that names no requirement, use `RQ-GSN-context_in_scope_for_goal`, which returns every context in scope. |
| [`RQ-AUG-assured_system`](RQ-AUG-assured_system.rq) | Auditor | What system and organisation is this case about? | none | The subject is an argument, an assurance case or a goal. |
| [`RQ-AUG-evidence_location`](RQ-AUG-evidence_location.rq) | Developer | Where is the requested evidence kept and how is it fetched? | none |  |
| [`RQ-AUG-evidence_production`](RQ-AUG-evidence_production.rq) | Developer | Does the evidence exist yet, and how was it produced - by whom, with what, from what? | none | A solution with no artefact is evidence that does not exist yet, so the artefact columns can be empty. |
| [`RQ-AUG-evidence_verification`](RQ-AUG-evidence_verification.rq) | Process/Software Owner | Was this evidence checked, by whom, with what mechanism, and did it pass? | none |  |
| [`RQ-AUG-case_compliance`](RQ-AUG-case_compliance.rq) | Auditor | Is the case fully compliant? | none | The case is compliant when all three counts are zero. The query computes the counts in each run, so the answer is the status now, not the status on a past date. |
| [`RQ-AUG-open_clarifications`](RQ-AUG-open_clarifications.rq) | Auditor | Which elements have an open clarification against them? | none | Open means that the issue has no outcome. |
| [`RQ-AUG-who_answers_for_element`](RQ-AUG-who_answers_for_element.rq) | Process/Software Owner | Who can answer for this element - its owner, or the author of its evidence? | none |  |
| [`RQ-AUG-clarification_answers`](RQ-AUG-clarification_answers.rq) | Auditor | What was said in reply to a clarification, and was the reply accepted? | none | A response does not close an ask. The outcome does: `resolved` means that the raiser accepted a response. An ask with no outcome is open, with or without responses. |
| [`RQ-AUG-rounds_per_element`](RQ-AUG-rounds_per_element.rq) | Auditor | How many rounds has this element taken, and of which kind? | none | Each round is one issue, so the answer is a count of issues. |
| [`RQ-AUG-superseded_asks`](RQ-AUG-superseded_asks.rq) | Auditor | Which pending ask was displaced by a newer one? | none |  |
| [`RQ-AUG-who_holds_the_ask`](RQ-AUG-who_holds_the_ask.rq) | Auditor | Who currently holds a relayed ask - where is it stuck? | none |  |
| [`RQ-AUG-escalation_count`](RQ-AUG-escalation_count.rq) | Auditor | How many times was an ask escalated because the holder could not answer? | none | An escalation is an ask whose predecessor was closed as cannot-answer. The query counts from the first ask in the chain, which supersedes nothing. |
| [`RQ-AUG-what_to_revise`](RQ-AUG-what_to_revise.rq) | Compliance Officer | What has to be revised, and by whom? | none | The class of the target says whether the claim or the evidence is at fault. A revise issue against a context is a remark about wording, and the query does not return it. |
| [`RQ-AUG-revision_rounds`](RQ-AUG-revision_rounds.rq) | Compliance Officer | How many revision rounds, and what was offered in reply to each ask? | none |  |
| [`RQ-AUG-revision_diff`](RQ-AUG-revision_diff.rq) | Developer | What did a revision actually change - which artefact replaced which? | none | A revision here is a new version of an artefact. A claim with new words is not in the answer. The issue column gives the revise or resolve issue that asked for the change. |
| [`RQ-AUG-unresolved_at_audit`](RQ-AUG-unresolved_at_audit.rq) | Auditor | What was left unresolved at the last audit, and what is due by the next one? | none | The query selects by audit cycle and not by date, because two audits can overlap in time. |
| [`RQ-AUG-resolution_state`](RQ-AUG-resolution_state.rq) | Auditor | Was a resolution implemented, declined, or infeasible? | none | The state is the outcome of the ask. The last column says whether a response is on record. A response that the auditor did not accept leaves the ask open. |
| [`RQ-AUG-manual_evidence`](RQ-AUG-manual_evidence.rq) | Developer | Which evidence needs to be generated manually? | none |  |
| [`RQ-AUG-automated_evidence`](RQ-AUG-automated_evidence.rq) | Developer | Which evidence is generated automatically, and how or where from can it be retrieved? | none | Evidence is an artefact that a solution refers to. Generated data that no solution refers to, for example the data of an instantiation, is not in the answer. |
| [`RQ-AUG-alternative_provision`](RQ-AUG-alternative_provision.rq) | Process/Software Owner | Which evidence needs an alternative provision mechanism - an interview, a call, paper? | none | The query returns the mechanisms that a person has to run. The kind of mechanism, for example an interview or a call, is a subclass of `gsnaug:Mechanism` in your domain ontology. |
| [`RQ-AUG-evidence_cannot_be_produced`](RQ-AUG-evidence_cannot_be_produced.rq) | Developer | Which evidence cannot be produced at all, as opposed to not yet produced? | none | Evidence that is not yet produced is `gsn:undeveloped` or `gsn:uninstantiated`, which `RQ-GSN-undeveloped_elements` and `RQ-GSN-uninstantiated_elements` report. Evidence that cannot be produced is an ask that was closed as infeasible. |
| [`RQ-AUG-cannot_resolve`](RQ-AUG-cannot_resolve.rq) | Auditor | Which issue cannot be resolved at all, as opposed to not yet resolved? | none |  |
| [`RQ-AUG-instantiated_elements`](RQ-AUG-instantiated_elements.rq) | Compliance Officer | How is the interpretation instantiated into claims and evidence? | none | The reference says which data governs the part of the argument below it. `gsnaug:instantiatedFrom` says which row of the data produced the element. |
| [`RQ-AUG-who_retrieves_evidence`](RQ-AUG-who_retrieves_evidence.rq) | Compliance Officer | Who is responsible for retrieving the evidence for a particular system? | none | The query reads `gsnaug:assures`, which names a `gsnaug:System` directly. So the answer does not depend on a top-level context in the case. |
| [`RQ-AUG-artefacts_to_change`](RQ-AUG-artefacts_to_change.rq) | Developer | Which artefacts need changing, and who owns the change? | none | The last column is the impact of the change. `RQ-GSN-goals_resting_on_artefact` gives the full impact for one artefact. |
| [`RQ-AUG-automation_feasibility`](RQ-AUG-automation_feasibility.rq) | Developer | Which evidence can be generated automatically, and which has been assessed as manual? | none | Evidence with no mechanism was not assessed. A mechanism with the flag `false` means that automation was assessed and rejected. |
| [`RQ-AUG-term_impact`](RQ-AUG-term_impact.rq) | Developer | If this domain term changes, which mechanisms, artefacts and claims are affected? | `?term`: the IRI of the domain term | You do not run a mechanism for the answer. A mechanism is in the answer only if it declares the terms that it reads. The derivations of the group `mechanism_terms` derive the declaration for a shape or a rule in the graph. For a script, a person writes it. |
| [`RQ-AUG-inspectable_mechanisms`](RQ-AUG-inspectable_mechanisms.rq) | Compliance Officer | Which evidence rests on a mechanism that can be read without being run, and what does each mechanism declare? | none | Each mechanism has one of four states. In the graph: a shape, a rule or a query implements it, so you can read what it depends on. Script in the graph: a person can read it, but its terms are declared by hand. Declared by hand: terms are listed, but nothing in the graph says what the mechanism does. Opaque: only a run tells. The query knows SHACL shapes, SHACL-AF SPARQL executables, SWRL rules and SPIN queries. For a new formalism, add its type to the list in the query. |
| [`RQ-AUG-requirement_revised`](RQ-AUG-requirement_revised.rq) | Compliance Officer | Which elements answer to a requirement that has a newer revision? | none | A changed requirement is a new `gsnaug:Requirement` with `prov:wasRevisionOf` to the old one. An element that still has `gsnaug:requiredBy` to the old one, and not to the new one, is in the answer. If the change matters to the element, raise a revise issue on it. The rules of the group `revise_issue_challenges` then makes the issue a challenge. |
| [`RQ-AUG-system_revised`](RQ-AUG-system_revised.rq) | Developer | Which evidence was drawn from a system, or a part of one, that has a newer revision? | none | A changed system, or a changed part of one, is a new individual with `prov:wasRevisionOf` to the old one. An artefact with `gsnaug:generatedFrom` to the old one is in the answer until a replacement from the new one exists. The last two columns are the solution that cites the artefact and the goals above it. If the change matters to them, raise a revise issue on the solution. |
| [`RQ-AUG-context_revised`](RQ-AUG-context_revised.rq) | Process Owner | Which goals sit under a context whose artefact has a newer revision? | none | The context refers to an artefact, for example a deployment list, and a newer artefact replaces it with `gsnaug:replaces` or `prov:wasRevisionOf`. A context applies to its element and to everything below it, so the query walks down the support chain. If the change matters to a goal, raise a revise issue on the goal. |
