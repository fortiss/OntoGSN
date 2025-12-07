# OntoGSN Serialization Files

This directory contains different serializations of the OntoGSN ontology, separated according to subsection (i.e., core or extension). The filenames are structured to indicate the content of each file. The purpose of the pruned files are for easier LLM prompting.

## Filename Structure

The filenames follow this pattern:

`ontogsn-[<scope>]_[<module>].<format>`

### Scope

The `<scope>` part of the filename indicates the completeness of the ontology definition.

| Scope      | Description                                                    |
| :--------- | :------------------------------------------------------------- |
| `complete` | Declarative OWL + Logical OWL + Annotations + SWRL rules       |
| `pruned`   | Declarative OWL + Logical OWL                                  |

### Module

The `<module>` part of the filename specifies which part of the OntoGSN model is included.

| Module       | Description                    |
| :----------- | :----------------------------- |
| `full`       | Everything                     |
| `core`       | Core GSN                       |
| `pattern`    | Argument Pattern Extension     |
| `modular`    | Modular Extension              |
| `confidence` | Confidence Argument Extension  |
| `dialectic`  | Dialectic Extension            |

### Format

The `<format>` part of the filename indicates the serialization format.

| Format   | Description       |
| :------- | :---------------- |
| `ttl`    | Turtle            |
| `jsonld` | JSON Linked Data  |

## Examples

-   `ontogsn-complete_full.ttl`: The complete ontology with all modules in Turtle format.
-   `ontogsn-pruned_core.jsonld`: The pruned ontology with only the Core GSN module in JSON-LD format.
