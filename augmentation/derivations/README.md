# The derivations of the Augmentation

A derivation is a SPARQL update that adds facts to a case, like a rule. It has no SWRL form,
because SWRL cannot express what it does. So a reasoner does not apply a derivation. You run
it as an update. The folder has four of them.

Each file starts with two lines that tools read: the number of the derivation (`# rule:`) and
its name (`# name:`). A file holds no other comment.

## What each derivation does

| File | What it derives | Why it has no SWRL form | What it does not derive |
| :--- | :--- | :--- | :--- |
| [`RL-AUG-shape_mechanism_reads.rq`](RL-AUG-shape_mechanism_reads.rq) | If a SHACL shape implements a mechanism, the mechanism reads every target class, every target property, every IRI in a property path and every `sh:class`. This holds for the shape and for every shape nested in it through `sh:property`, `sh:node`, `sh:not`, `sh:and`, `sh:or` and `sh:xone`. | A sequence path and an alternative path are RDF lists. SWRL cannot walk a list of unknown length, and it cannot test that a path is a blank node. | The terms inside `sh:sparql`, because that is text. `sh:datatype`, because a datatype is not a class or a property of a domain ontology. |
| [`RL-AUG-rule_mechanism_reads.rq`](RL-AUG-rule_mechanism_reads.rq) | If a SWRL rule implements a mechanism, the mechanism reads every class and every property in the body of the rule. | The body is an RDF list. | Built-in atoms, because they are not terms of a domain ontology. A class expression in a class atom, because it is a blank node. |
| [`RL-AUG-rule_mechanism_writes.rq`](RL-AUG-rule_mechanism_writes.rq) | If a SWRL rule implements a mechanism, the mechanism writes every class and every property in the head of the rule. A term in the body and in the head is read and written. | The head is an RDF list. | The same as `RL-AUG-rule_mechanism_reads`. |
| [`RL-AUG-current_report.rq`](RL-AUG-current_report.rq) | A report is the current report of its target if it is not struck, and no later report of the same mechanism over the same target is unstruck. A report without a timestamp is always current. The update also removes a link to a report that is no longer current. | The newest report needs negation as failure, which SWRL does not have. | |

A struck report is a report with `prov:invalidatedAtTime` or `prov:wasInvalidatedBy`.

## When to run a derivation

| Derivation | Run it |
| :--- | :--- |
| `RL-AUG-shape_mechanism_reads`, `RL-AUG-rule_mechanism_reads`, `RL-AUG-rule_mechanism_writes` | After you add or change a shape or a rule that implements a mechanism. The queries `RQ-AUG-term_impact` and `RQ-AUG-inspectable_mechanisms` read the result. |
| `RL-AUG-current_report` | After each new report, and before a reasoner reads the case. The SWRL forms of the groups `truth_from_report` and `validity_from_report` read `gsnaug:currentReport`, because they cannot find the newest report. The SPARQL twins of those rules do not read the link. A tool that writes reports can also set the link itself. |

`development/dev_tools/augmentation_check.py` runs the four derivations on the fixture of this
repository. The reasons for the derivations are in the design record,
`development/design/ontogsn-augmentation-design.ttl` (decisions `dd-0093` and `dd-0108`).
