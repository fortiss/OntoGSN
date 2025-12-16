# SPARQL Queries

This directory contains all the SPARQL queries used by the frontend application to read from and write to the in-browser triplestore.

| Query | Purpose |
| :--- | :--- |
| `create_gsn_element.sparql` | A template query to **insert** a new GSN element (Goal, Strategy, etc.) into the triplestore with a given IRI, ID, label, and statement. |
| `delete_defeater_overloadedCar.sparql` | **Deletes** the specific `gsn:Defeater` that indicates the car roof is overloaded. This is the inverse of `write_defeater_overloadedCar.sparql`. |
| `list_modules.sparql` | **Selects** all `gsn:Module` instances and their labels, used to populate the module selection bar at the bottom of the UI. |
| `propagate_context.sparql` | **Selects** all nodes that are supported by (or are descendants of) a top-level element that is in the context of a specific IRI. Used for highlighting the graph. |
| `propagate_defeater.sparql` | **Selects** all nodes in the hierarchy that are affected by a specific `gsn:Defeater`, traversing up the `supportedBy` chain from the challenged goal. |
| `propagate_overloadedCar.sparql` | **Selects** all car part IRIs that are affected when the "overloaded car" rule is active. |
| `read_all_collections.sparql` | **Selects** all `prov:Collection` instances, the context they are about, and their members. |
| `read_all_nodes.sparql` | **Selects** and formats all GSN nodes with their type, ID, and statement into a single human-readable string for display. |
| `read_all_relations.sparql` | **Selects** all relationships between GSN nodes, showing the source, relationship type, and target(s). |
| `read_allowed_gsnElements.sparql` | **Selects** all classes that are subclasses of `gsn:GSNElement`. This populates the dropdown in the editor UI for creating new GSN nodes. |
| `read_carLoadWeight.sparql` | **Selects** and calculates the current total weight of "active" loads on the car roof and retrieves the maximum allowed roof load from the ontology. |
| `read_document.sparql` | **Selects** the URL of the Markdown document that is associated with the main assurance case for display in the "Document" tab. |
| `rule_assumptionInvalidation.sparql` | **Selects** GSN elements that should be considered invalid because they depend on an `gsn:Assumption` that has been marked as `gsn:valid false`. |
| `rule_checkLoadWeight.sparql` | **Selects** a boolean indicating if the current roof load is compliant with the maximum weight, and calculates the amount of overweight if applicable. |
| `rule_truthContradiction.sparql` | **Selects** nodes involved in a logical contradiction, such as when a `false` goal supports a `true` goal. |
| `rule_untrueSolution.sparql` | **Selects** all GSN elements that are supported by a `gsn:Solution` which has been marked as `gsn:true false`. |
| `update_box_off.sparql` | **Deletes** the `ex:isActiveLoad` property from the roof box part, marking it as inactive for weight calculations. |
| `update_box_on.sparql` | **Inserts** the `ex:isActiveLoad` property for the roof box part, marking it as active for weight calculations. |
| `update_luggage_off.sparql` | **Deletes** the `ex:isActiveLoad` property from the luggage part, marking it as inactive. |
| `update_luggage_on.sparql` | **Inserts** the `ex:isActiveLoad` property for the luggage part, marking it as active. |
| `visualize_graph_by_module.sparql` | A template query to **select** all visualizable triples (`?s ?p ?o`) that belong to a specific `gsn:Module`. |
| `visualize_graph.sparql` | **Selects** all core GSN triples (supportedBy, inContextOf, challenges) to render the entire assurance case graph. |
| `visualize_invalid_nodes.sparql` | **Selects** all nodes that are explicitly marked as `gsn:valid false` for highlighting. |
| `visualize_layers.sparql` | **Selects** nodes and their corresponding "defence-in-depth" layers for rendering the layered or swimlane visualization. |
| `visualize_undev_nodes.sparql` | **Selects** all nodes that are considered undeveloped, either by being explicitly marked or by being a Goal/Strategy with no further support. |
| `visualize_valid_nodes.sparql` | **Selects** all nodes that are explicitly marked as `gsn:valid true` for highlighting. |
| `write_defeater_overloadedCar.sparql` | **Inserts** a `gsn:Defeater` element to indicate that the car's roof load capacity is being challenged because the load is too heavy. |
