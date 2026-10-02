---
layout: single          # one‑column page
title:  "Development Notes"
permalink: /development/
sidebar:
  nav: "primary"
---

## Methodology
Every element of *OntoGSN* is sourced directly from the [**GSN Community Standard v3**](https://scsc.uk/gsn?page=gsn%202standard) ([link to the PDF](https://scsc.uk/r141C:1)).  
This inevitably involves some degree of interpretation. Two activities were performed in many iterative cycles:

1. **Taxonomy (TBox)** – each sentence of the standard is parsed and mapped to OWL classes or properties, expressed as semantic triples (subject‑predicate‑object).  
2. **Rules** – sentences that impose conditions or restrictions are encoded as logical statements (SWRL rules and OWL axioms).

## Technical implementation
The ontology is authored in [Stanford Protégé 5.6.3](https://protege.stanford.edu/) and conforms to the [OWL 2](https://www.w3.org/TR/owl2-overview/) specification.  
It imports the foundational vocabularies [RDFS](https://www.w3.org/TR/rdf-schema/), [XSD](https://www.w3.org/TR/xmlschema11-1/),  
[Dublin Core](http://purl.org/dc/elements/1.1/), [Schema.org](https://www.schema.org) and [SKOS](https://www.w3.org/2004/02/skos/).

Reasoning is carried out with [SWRL](https://www.w3.org/submissions/SWRL/)‑capable engines such as  
[Pellet](https://www.w3.org/2001/sw/wiki/Pellet) or [Drools](https://www.drools.org/).  
Every SWRL rule is also available as a [SPARQL 1.1](https://www.w3.org/TR/sparql11-update/) update, for stores with no reasoner attached ([`queries/rules/`](https://github.com/fortiss/OntoGSN/tree/main/queries/rules)).  
[SHACL](https://www.w3.org/TR/shacl/) shapes validate assurance-case data against the ontology ([`shapes/`](https://github.com/fortiss/OntoGSN/tree/main/shapes)).

> **Note**  The assertion box (ABox) is created by the user. The repository contains only example individuals: a worked template argument in [`example/`](https://github.com/fortiss/OntoGSN/tree/main/example) and the test fixtures.
