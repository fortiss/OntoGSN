[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

## Note For Potential Reviewers
If you are interested in reviewing the OntoGSN before we submit a paper on it (ETA: mid-May 2025), please provide your comments in the OntoGSN Design Document (PDF) and reach out to me directly at momcilovic [at] fortiss [dot] org. Thank you!

# Introduction
OntoGSN is an ontology for managing GSN assurance cases dynamically, using the advantages of the semantic technology stack. 

These advantages include: 1)	storing and querying graph data in a structure made for that purpose; 2) representing the domain or world in human-readable visual-izable format; 3) integrating references to data, documents or code easily and in the same store; 4) automating rules and verification of quality with logic-based reasoners; 5)	providing the basis for more advanced methods and extensions (e.g., GraphRAG); 6)	making use of a vibrant community and (mostly) free and open-source tools.

OntoGSN was created using Stanford Protégé (v5.6.3) ontology editor, and following the Web Ontology Language (OWL 2)  standard. Every element of the ontology is sourced directly from the Goal Structuring Notation Community Standard v3.

# Acknowledgements
Many thanks to Ingmar Kessler, Yannick Landeck, … for reviewing this work. Thanks to Damir Safin for tool suggestions. Thanks to Will Franks and Adelard (NCC Group) for providing the ASCE academic license.

# Dependencies
Existing objects and properties are imported from the following foundational ontologies: Resource Description Framework Schema (RDFS), XML Schema Definition Language (XSD), Dublin-Core (DC), Schema.org, and Simple Knowledge Organization System (SKOS). Reasoning is based on the Semantic Web Rule Language (SWRL)  rules and OWL axioms, which can be executed with supported rule engines (e.g., Pellet or Drools).

# How to use
## Setup
1. Install Stanford Protégé (v5.6.3), a similar ontology editor or a graph database (e.g., Ontotext GraphDB).
2. Download ontogsn.owl into your project folder.
3. Import the file into your chosen editor/database.
4. For Protégé, install the following plug-ins: ROWL Protege 5.0+ Plugin, Pellet Reasoner Plug-in.
## Simple Use: Static Assurance Case
Note: Depending on the chosen editor, you can edit the ontology manually in the user interface, via CRUD queries, or using plug-ins for importing from data files.
1. Add claims (e.g., goals) and evidence (e.g., solutions) as individuals using unique node identifiers.
2. Add the node header as a label and textual content as description.
3. Link the nodes with appropriate object properties (e.g., supportedBy).
4. Repeat the above until satisfied with the assurance case.
5. Run the reasoner (e.g., Pellet) to evaluate against rules.
## Advanced Use: Dynamic Assurance Case
1. Implement the steps above.
2. Represent elements of your domain in a "world model" ontology.
3. Link each element of the world model to the assurance case claims.
4. Create queries to "hook" the elements to runtime processes and data (i.e., actual evidence).
5. Define rules for evaluating evidence (e.g., exceptions, errors, failure).
6. Set up a script or a scheduled job to run the queries and the reasoner in sequence.
