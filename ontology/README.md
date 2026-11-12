# Ontology

The core of OntoGSN: the ontology of the GSN Community Standard v3, and what you need to use it
on an assurance case.

| Folder | Contents |
| :--- | :--- |
| [`serializations/`](serializations/) | The ontology. `ontogsn.ttl` is the source. The RDF/XML and JSON-LD files, and the files cut by section in [`separated/`](serializations/separated/), are generated from it. |
| [`shapes/`](shapes/) | SHACL shapes that validate the data of an assurance case. See [`shapes/README.md`](shapes/README.md). |
| [`queries/`](queries/) | Stored SPARQL queries, one for each competency question. See [`queries/README.md`](queries/README.md). |
| [`queries/rules/`](queries/rules/) | Each SWRL rule of the ontology as a SPARQL update, for a store with no reasoner. See [`queries/rules/README.md`](queries/rules/README.md). |
| [`example/`](example/) | An example case, an argument pattern, and `run_rules.py`, which applies the rules to a case. |

[`QUICK-START.md`](../QUICK-START.md) has the steps from an empty folder to a checked case.

## If you use the SWRL rules

The rules of the standard are in the ontology as SWRL rules, and in
[`queries/rules/`](queries/rules/) as SPARQL updates. Both forms state the same rules, and you
can use either. You need to know two things about the SWRL form, because SWRL only adds facts
and cannot test that a fact is absent:

1. A rule cannot replace a value. If an element has `gsn:valid true` and a rule concludes
   `gsn:valid false`, the element has both values. So do not assert a flag that a rule sets,
   and do not save inferred flags back into the case.
2. A few rules have a condition that only the SPARQL form can state. The SWRL rule then draws
   its conclusion in more cases than the update.

The table in [`queries/rules/README.md`](queries/rules/README.md#the-rules) lists each rule. It
says where the SWRL rule alone gives the same result, and where the SPARQL update does more.
