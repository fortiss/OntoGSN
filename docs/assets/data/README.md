# Application Data

This directory contains the data assets for the OntoGSN frontend application. It includes the ontologies that define the data models, the SPARQL queries used to interact with the triplestore, and supporting markdown documents.

## File Tree

```
/assets/data/
├── report.md
├── ontologies/
│   ├── car_assurance.ttl
│   ├── car.ttl
│   ├── defence_in_depth.ttl
│   ├── example_ac.ttl
│   ├── harmbench_targets_text.ttl
│   └── ontogsn_lite.ttl
└── queries/
    ├── create_gsn_element.sparql
    ├── delete_defeater_overloadedCar.sparql
    ├── list_modules.sparql
    ├── propagate_context.sparql
    ├── propagate_defeater.sparql
    ├── propagate_overloadedCar.sparql
    ├── read_all_collections.sparql
    ├── read_all_nodes.sparql
    ├── read_all_relations.sparql
    ├── read_allowed_gsnElements.sparql
    ├── read_carLoadWeight.sparql
    ├── read_document.sparql
    ├── rule_assumptionInvalidation.sparql
    ├── rule_checkLoadWeight.sparql
    ├── rule_truthContradiction.sparql
    ├── rule_untrueSolution.sparql
    ├── update_box_off.sparql
    ├── update_box_on.sparql
    ├── update_luggage_off.sparql
    ├── update_luggage_on.sparql
    ├── visualize_graph_by_module.sparql
    ├── visualize_graph.sparql
    ├── visualize_invalid_nodes.sparql
    ├── visualize_layers.sparql
    ├── visualize_undev_nodes.sparql
    ├── visualize_valid_nodes.sparql
    └── write_defeater_overloadedCar.sparql
```
