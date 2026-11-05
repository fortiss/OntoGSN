---
layout: single
title: "Tutorial"
permalink: /tutorial/
classes: [wide, og-page]
toc: true
toc_label: "Steps"
toc_sticky: true
---

This tutorial builds a small assurance case for a kettle. You apply the rules of the GSN Community Standard to the case, validate the case, and ask questions about it. The output on this page comes from OntoGSN 1.3.0.

You need Python 3 and a copy of the [OntoGSN repository](https://github.com/fortiss/OntoGSN). Run the commands from the root folder of the repository.

## 1. Set up

1. Clone the repository.
2. Install the Python packages.

```sh
git clone https://github.com/fortiss/OntoGSN.git
cd OntoGSN
pip install rdflib pyshacl
```

The ontology is in `ontology/serializations/ontogsn.ttl`. Its permanent IRI is `https://w3id.org/OntoGSN/ontology`. The front page also has RDF/XML, JSON-LD, and one file for each section of the standard.

If you prefer an editor, open `ontogsn.ttl` in [Protégé](https://protege.stanford.edu/). If you prefer a graph store, load it into a store such as [GraphDB](https://graphdb.ontotext.com/). The steps below use plain files and Python, so that you can follow them without a store.

## 2. Write the case

An assurance case is a set of individuals. The ontology is the vocabulary (the TBox). Your case is the data (the ABox). The repository has no case of yours, only examples.

Save this file as `my-case.ttl`:

```turtle
@prefix ex:     <https://example.org/my-case#> .
@prefix gsn:    <https://w3id.org/OntoGSN/ontology#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .

ex:AC1 a gsn:AssuranceCase ;
    schema:identifier "AC1" ;
    gsn:statement "The kettle is acceptably safe to use at home." ;
    gsn:contains ex:Arg1 , ex:E1 .

ex:Arg1 a gsn:Argument ;
    schema:identifier "Arg1" ;
    gsn:contains ex:G1 , ex:S1 , ex:G2 , ex:G3 , ex:C1 , ex:Sn1 , ex:Sn2 .

ex:G1 a gsn:Goal ;
    schema:identifier "G1" ;
    gsn:statement "The kettle is acceptably safe to use at home." ;
    gsn:supportedBy ex:S1 ;
    gsn:inContextOf ex:C1 .

ex:C1 a gsn:Context ;
    schema:identifier "C1" ;
    gsn:statement "Home use as defined in the user manual." .

ex:S1 a gsn:Strategy ;
    schema:identifier "S1" ;
    gsn:statement "Argument over each identified hazard." ;
    gsn:supportedBy ex:G2 , ex:G3 .

ex:G2 a gsn:Goal ;
    schema:identifier "G2" ;
    gsn:statement "The kettle cannot boil dry." ;
    gsn:supportedBy ex:Sn1 .

ex:G3 a gsn:Goal ;
    schema:identifier "G3" ;
    gsn:statement "The kettle does not give an electric shock." ;
    gsn:supportedBy ex:Sn2 .

ex:Sn1 a gsn:Solution ;
    schema:identifier "Sn1" ;
    gsn:statement "Boil-dry test report." ;
    gsn:refersTo ex:E1 .

ex:Sn2 a gsn:Solution ;
    schema:identifier "Sn2" ;
    gsn:statement "Insulation test report." ;
    gsn:true false .

ex:E1 a gsn:Artefact ;
    schema:identifier "E1" ;
    rdfs:label "TEST-REPORT-017"@en .
```

The case uses these terms:

| Term | Meaning |
| :--- | :--- |
| `gsn:Goal`, `gsn:Strategy`, `gsn:Solution`, `gsn:Context` | The GSN element types |
| `schema:identifier` | The element identifier, for example "G1" |
| `gsn:statement` | The text of the element |
| `gsn:supportedBy` | The support link from a goal or strategy to the element below it |
| `gsn:inContextOf` | The link from a goal or strategy to its context |
| `gsn:refersTo` | The link from a solution to the artefact that is its evidence |
| `gsn:true false` | The insulation test failed |

## 3. Apply the rules

The ontology has 58 SWRL rules from the standard. Each rule is also a SPARQL update in `ontology/queries/rules/`, for stores with no reasoner. The script `run_rules.py` applies the updates until no rule adds a new fact.

```sh
python ontology/example/run_rules.py my-case.ttl --out my-case-materialised.ttl
```

The script reports which rules fired:

```text
reached a fixpoint after 3 pass(es)

9 of 58 rules fired; 4,008 -> 4,058 triples
    S6  Goal Top Flag
   S11  Solution Propagation (False)
   ...
```

Rule S11 found that the failed solution `Sn2` supports `G3`, so `G3` is now `gsn:true false`. Rule S6 found that `G2` and `G3` have a parent, so they are not top goals.

In Protégé, a reasoner that supports SWRL, for example Pellet, applies the SWRL form of the same rules.

## 4. Validate the case

The SHACL shapes in `ontology/shapes/` check the case against the standard. Run the validation on the output of step 3, because some shapes expect the facts that the rules add.

```sh
pyshacl -s ontology/shapes/ontogsn-shapes_0_full.ttl \
        -e ontology/serializations/ontogsn.ttl \
        -a -f human \
        my-case-materialised.ttl
```

The `-e` option adds the ontology to the data, so that the shapes see the class hierarchy. The `-a` option turns on the SPARQL-based constraints. The result has four warnings:

| Element | Problem | Fix |
| :--- | :--- | :--- |
| `Sn2` | The solution points at no artefact | Add `gsn:refersTo` to the insulation test report |
| `G1` | The goal has no parent, but it is not marked as the top goal | Add `gsn:top true` to `G1` |
| `G2`, `G3` | The goals have no context | Add `gsn:inContextOf`, or accept the warning |

A warning is not a violation. To accept the warnings, add `--allow-warnings`. A violation always makes the result fail.

## 5. Ask questions

The folder `ontology/queries/` has 43 stored SPARQL queries. Each query answers one question about a case. The question is in the header of the file. Parameters are in a `VALUES` block marked `# PARAMETER`.

Save this script as `query.py`:

```python
import sys, rdflib

g = rdflib.Graph()
for f in sys.argv[2:]:
    g.parse(f)
for row in g.query(open(sys.argv[1], encoding="utf-8").read()):
    print(*row)
```

Then run some queries:

```sh
python query.py ontology/queries/read_goal_support_tree.rq my-case-materialised.ttl
python query.py ontology/queries/read_element_status_flags.rq my-case-materialised.ttl
python query.py ontology/queries/read_solutions_without_artefact.rq my-case-materialised.ttl
```

| Query | Question | Result for the kettle |
| :--- | :--- | :--- |
| `read_goal_support_tree` | What is the whole argument below goal G1? | `S1`, `G2`, `G3`, `Sn1`, `Sn2`, with their depth |
| `read_element_status_flags` | What is the status of each element? | `G3` and `Sn2` are false |
| `read_solutions_without_artefact` | Which solutions cite no artefact? | `Sn2` |

In a graph store, paste the query into the SPARQL editor of the store. Load the ontology and the case into the same graph first, because some queries need the class hierarchy.

## 6. Connect the case to the system

A static case stops here. A dynamic case keeps up with the system that it argues about:

1. Describe the system in its own ontology, for example the parts of a car.
2. Link each claim to the system element that it is about, with a property of your own. `gsn:refersTo` is only for artefacts.
3. Write queries that write test results and runtime data into the store as artefacts.
4. Run the queries, then the rules, then the validation, in a scheduled job.

The [Playground]({{ '/playground/' | relative_url }}) shows this with a car and its roof load. See also the [OntoGSN Workbench](https://github.com/fortiss/ontogsn_workbench).

## More examples

| File | Contents |
| :--- | :--- |
| [`ontology/example/patterns/`](https://github.com/fortiss/OntoGSN/tree/main/ontology/example/patterns) | An argument pattern for control design and effectiveness |
| [`ontology/example/example_case.ttl`](https://github.com/fortiss/OntoGSN/blob/main/ontology/example/example_case.ttl) | A test case that uses every section of the standard. Its last section has deliberate errors. Do not copy that section. |

## How the ontology is built

Every term of OntoGSN comes from the [GSN Community Standard v3](https://scsc.uk/gsn?page=gsn%202standard) (SCSC-141C). The download of the standard needs an SCSC login. The ontology covers the five sections of the standard: core GSN, and the argument pattern, modular, confidence and dialectic extensions.

The work had two parts, done in many cycles:

| Part | What it gives |
| :--- | :--- |
| Vocabulary | Each sentence of the standard that names a concept became an OWL class or property |
| Rules | Each sentence that sets a condition became a SWRL rule or an OWL axiom |

The [design record](https://github.com/fortiss/OntoGSN/tree/main/development/design) links each axiom to the passage of the standard behind it, and records the decision and the reason.

| Artifact | Format | Folder |
| :--- | :--- | :--- |
| Ontology | [OWL 2](https://www.w3.org/TR/owl2-overview/), in Turtle, RDF/XML and JSON-LD | [`ontology/serializations/`](https://github.com/fortiss/OntoGSN/tree/main/ontology/serializations) |
| Rules | [SWRL](https://www.w3.org/submissions/SWRL/) in the ontology, and [SPARQL 1.1](https://www.w3.org/TR/sparql11-update/) updates | [`ontology/queries/rules/`](https://github.com/fortiss/OntoGSN/tree/main/ontology/queries/rules) |
| Shapes | [SHACL](https://www.w3.org/TR/shacl/) | [`ontology/shapes/`](https://github.com/fortiss/OntoGSN/tree/main/ontology/shapes) |
| Stored queries | SPARQL 1.1 | [`ontology/queries/`](https://github.com/fortiss/OntoGSN/tree/main/ontology/queries) |

The ontology imports no other ontology. It uses annotation terms from [Dublin Core](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/), [Schema.org](https://schema.org/), [SKOS](https://www.w3.org/2004/02/skos/), [VANN](https://vocab.org/vann/) and [BIBO](https://www.dublincore.org/specifications/bibo/).
