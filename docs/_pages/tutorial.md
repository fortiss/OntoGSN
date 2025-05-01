---
layout: single          # one‑column page
title:  "Tutorial"
permalink: /tutorial/
sidebar:
  nav: "primary"
---

## Setup
1. Install Stanford Protégé (v5.6.3), a similar ontology editor or a graph database (e.g., Ontotext GraphDB).
2. Download ontogsn.owl into your project folder.
3. Import the file into your chosen editor/database.
4. For Protégé, install the following plug-ins: ROWL Protege 5.0+ Plugin, Pellet Reasoner Plug-in.

## Use Cases

## Simple: Evaluation of a Static Assurance Case
Note: Depending on the chosen editor, you can edit the ontology manually in the user interface, via CRUD queries, or using plug-ins for importing from data files.

1. Add claims (e.g., goals) and evidence (e.g., solutions) as individuals using unique node identifiers.
2. Add the node header as a label and textual content as description.
3. Link the nodes with appropriate object properties (e.g., supportedBy).
4. Repeat the above until satisfied with the assurance case.
5. Run the reasoner (e.g., Pellet) to evaluate against rules.

## Advanced: Dynamic Management of a Predefined Assurance Case
1. Implement the steps in the Simple use case.
2. Represent elements of your domain in a "world model" ontology.
3. Link each element of the world model to the corresponding assurance case claims by using a custom object property (e.g., refersTo).
4. Create queries to "hook" the elements to runtime processes and data (i.e., actual evidence).
5. Define custom rules for evaluating evidence (e.g., exceptions, errors, failure).
6. Set up a script or a scheduled job to run the queries and the reasoner in sequence.

## Complex: 
1. Implement the steps in the Simple and Advanced use cases.
2. 