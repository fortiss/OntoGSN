# Quick start

These steps take you from an empty folder to a checked assurance case. The [Tutorial](https://fortiss.github.io/OntoGSN/tutorial/) on the website does the same steps with a full example and its output.

## Setup

Any triple store works, and you do not need a reasoner. Choose one of these three paths:

| Path | What you install | How the rules run |
| :--- | :--- | :--- |
| Plain files and Python | Python 3, then `pip install rdflib pyshacl pyoxigraph` | `run_rules.py` applies the SPARQL form of the rules |
| A graph database, for example Ontotext GraphDB | the database | you run the SPARQL updates in `ontology/queries/rules/` |
| Stanford Protégé (v5.6.3) | Protégé, with the ROWL Protege 5.0+ Plugin and the Pellet Reasoner Plug-in | Pellet applies the SWRL form of the rules |

1. Clone this repository, or download `ontology/serializations/ontogsn.ttl` (or `ontogsn.rdf`).
2. If you use a database or an editor, import the file into it.

## Static assurance case

You can write the case as a Turtle file, in the user interface of your editor, or with the
CRUD queries in `ontology/queries/`.

1. Add each claim (for example a goal) and each piece of evidence (a solution) as an individual.
2. Give each element a `schema:identifier`, for example "G1", and its text as `gsn:statement`.
3. Link the elements with object properties, for example `gsn:supportedBy` and `gsn:inContextOf`.
4. Link each solution to its evidence with `gsn:refersTo`. The evidence is a `gsn:Artefact`.
5. Apply the rules:

   ```bash
   python ontology/example/run_rules.py my-case.ttl --out my-case-materialised.ttl
   ```

6. Validate the result with the SHACL shapes:

   ```bash
   pyshacl -s ontology/shapes/ontogsn-shapes_0_full.ttl \
           -e ontology/serializations/ontogsn.ttl \
           -a -f human \
           my-case-materialised.ttl
   ```

7. Ask questions with the stored queries in `ontology/queries/`. Each query has its parameters
   in a `VALUES` block near the top. See [`ontology/queries/README.md`](ontology/queries/README.md).

`ontology/example/example_case.ttl` is a case that uses every section of the standard. Its last
section has deliberate errors, so do not copy that section.

## Dynamic assurance case

A dynamic case keeps up with the system that it argues about. The augmentation in
[`augmentation/`](augmentation/) has the terms for this: who and what produced a piece of
evidence, which mechanism checks it, and what each check reported.

1. Do the steps of the static case.
2. Describe your system in its own ontology.
3. Link each claim to the system element that it is about. Use a property of your own or a term
   of the augmentation, because `gsn:refersTo` is only for artefacts.
4. Record each check of the evidence as a report in the graph. See
   [`augmentation/HOW-TO.md`](augmentation/HOW-TO.md).
5. Run the checks, then the rules, then the validation, in a script or a scheduled job.

This repository has no tool that does step 5 for you.
