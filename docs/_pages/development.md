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
Additional rule/constraint technologies (e.g. [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/) and [SHACL](https://www.w3.org/TR/shacl/)) are planned for a future release.

> **Note**  The assertion box (ABox) is created by the user; the repository currently contains only tutorial individuals.
