# Ontologies

This directory contains the ontology files (`.ttl`) that define the data models and instances for the OntoGSN application. These files provide the semantic backbone for the assurance cases, domain models, and evidence used throughout the demonstration.

| Ontology | Contents | Purpose |
| :--- | :--- | :--- |
| `ontogsn_lite.ttl` | Core GSN classes (Goal, Strategy, Solution), properties (supportedBy, inContextOf), and SWRL rules. | Provides the formal semantic structure for representing Goal Structuring Notation (GSN) assurance cases as an OWL ontology, enabling automated reasoning. |
| `example_ac.ttl` | Individuals for two assurance cases: one for LLM adversarial robustness (`ACT-FAST`) and one for the car's static load safety. | Serves as the primary instance data for the application demo, combining multiple assurance cases and linking them to other ontologies. |
| `car.ttl` | A `schema:Car` individual with detailed properties (VIN, dimensions, weight), a list of car parts, and custom properties for geometry and spatial relationships. | Provides a detailed, machine-readable model of the demo car and its components, which is used to drive the 3D visualization and as evidence in the assurance case. |
| `car_assurance.ttl` | GSN `Goal`, `Strategy`, `Context`, `Assumption`, and `Solution` individuals that form a specific assurance case about the car's static load safety. | Instantiates the OntoGSN model with a concrete assurance argument for the car demo, linking claims about safety back to the data in `car.ttl`. |
| `defence_in_depth.ttl` | OWL classes for `Layer` and `NISTFunction`, and individuals representing specific cybersecurity layers and NIST Cybersecurity Framework functions. | Models a Defence in Depth security architecture and allows its layers to be formally linked to elements within an assurance case. |
| `harmbench_targets_text.ttl`| A large set of `harmbench:TargetResponse` individuals, each describing a specific harmful LLM output from the HarmBench benchmark. | Provides a machine-readable dataset of harmful LLM behaviors that can be used as contextual evidence or as test targets in the LLM robustness assurance case. |
