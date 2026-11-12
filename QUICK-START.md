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

A dynamic case keeps up with the system that it argues about. A check runs over the evidence,
the result of the check goes into the graph as a report, and the rules set the status of the
solution and of the goals above it from that report. Nobody sets `gsn:true` by hand.

The augmentation in [`augmentation/`](augmentation/) has the terms for this. The example below
uses four of them:

| Term | Meaning |
| :--- | :--- |
| `gsnaug:Mechanism` | A way to check a piece of evidence |
| `gsnaug:checkableWith` | The link from an artefact to the mechanism that can check it |
| `gsnaug:implements` | The link from a SHACL shape to the mechanism that it carries out |
| `gsnaug:decides "truth"` | The check tests whether the evidence matches what the solution claims |

### 1. Write the case, the check and the data

Save this file as `my-dynamic-case.ttl`. The goal claims that each entry of an access log has a
retention date. The check is a SHACL shape. The second entry of the log has no date.

```turtle
@prefix ex:     <https://example.org/my-case#> .
@prefix gsn:    <https://w3id.org/OntoGSN/ontology#> .
@prefix gsnaug: <https://w3id.org/OntoGSN/augmentation#> .
@prefix schema: <http://schema.org/> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .

ex:G1 a gsn:Goal ;
    schema:identifier "G1" ;
    gsn:statement "Each entry of the access log has a retention date." ;
    gsn:supportedBy ex:Sn1 .

ex:Sn1 a gsn:Solution ;
    schema:identifier "Sn1" ;
    gsn:statement "Check of the access log." ;
    gsn:refersTo ex:access-log .

ex:access-log a gsn:Artefact ;
    schema:identifier "E1" ;
    gsnaug:checkableWith ex:retention-check .

# The mechanism, and the SHACL shape that carries it out.
ex:retention-check a gsnaug:Mechanism ;
    gsnaug:automated true ;
    gsnaug:decides "truth" .

[] a sh:NodeShape ;
    gsnaug:implements ex:retention-check ;
    sh:targetClass ex:AccessLogEntry ;
    sh:property [ sh:path ex:retainedUntil ; sh:minCount 1 ] .

# The data of the system. The second entry has no retention date.
ex:entry-1 a ex:AccessLogEntry ; ex:retainedUntil "2027-01-01"^^xsd:date .
ex:entry-2 a ex:AccessLogEntry .
```

### 2. Run the check and the rules

Save this script as `run_checks.py`. It runs each check that a SHACL shape carries out, adds
the report to the graph, and applies the core rules and the augmentation rules.

```python
import glob, sys
from datetime import datetime, timezone
from pyshacl import validate
from rdflib import BNode, Graph, Literal, Namespace, RDF, XSD

AUG = Namespace("https://w3id.org/OntoGSN/augmentation#")
PROV = Namespace("http://www.w3.org/ns/prov#")
SH = Namespace("http://www.w3.org/ns/shacl#")

g = Graph()
for path in ["ontology/serializations/ontogsn.ttl",
             "augmentation/ontogsn-augmentation.ttl", sys.argv[1]]:
    g.parse(path)

def copy(node, target):
    """Copy a shape and its blank nodes, so that it runs alone."""
    for triple in g.triples((node, None, None)):
        if triple not in target:
            target.add(triple)
            if isinstance(triple[2], BNode):
                copy(triple[2], target)

# 1. Run each check that a SHACL shape carries out, and keep its report.
for artefact, mechanism in list(g.subject_objects(AUG.checkableWith)):
    shape = Graph()
    for definition in g.subjects(AUG.implements, mechanism):
        if (definition, RDF.type, SH.NodeShape) in g:
            copy(definition, shape)
    if len(shape) == 0:
        continue
    conforms, report, _ = validate(g, shacl_graph=shape, advanced=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for node in report.subjects(RDF.type, SH.ValidationReport):
        report.add((node, PROV.wasGeneratedBy, mechanism))
        report.add((node, PROV.used, artefact))
        report.add((node, PROV.generatedAtTime, Literal(now, datatype=XSD.dateTime)))
    g += report
    print(mechanism, "conforms" if conforms else "does not conform")

# 2. Apply the core rules and the augmentation rules until nothing changes.
rules = [open(path, encoding="utf-8").read()
         for folder in ("ontology/queries/rules", "augmentation/rules")
         for path in sorted(glob.glob(folder + "/*.rq"))]
for _ in range(20):
    before = set(g)
    for rule in rules:
        g.update(rule)
    if set(g) == before:
        break

g.serialize(sys.argv[2], format="turtle")
```

Run it from the root folder of the repository:

```bash
python run_checks.py my-dynamic-case.ttl my-dynamic-case-checked.ttl
```

The script reports that the check does not conform. The output file now holds the report, a
`sh:ValidationReport` with three links: the mechanism that wrote it (`prov:wasGeneratedBy`),
the artefact that it checked (`prov:used`) and the time (`prov:generatedAtTime`). Rule A6b
read the report and set `gsn:true false` on `Sn1`. The core rule S11 carried that to `G1`.

### 3. Change the system and run again

Give the second entry a retention date, and run the script again:

```turtle
ex:entry-2 a ex:AccessLogEntry ; ex:retainedUntil "2027-06-01"^^xsd:date .
```

The check now conforms, and `Sn1` and `G1` are `gsn:true true`. To keep the case current, run
the script in a scheduled job, or after each change to the system.

### What this example leaves out

- If you run the script on its own output, the old report stays in the graph as history. The
  rules read the newest report of each mechanism.
- A check that is a script, a query or an interview writes no report by itself. Write the
  report by hand in the same form, or let a wrapper around the script write it.
- A solution can also get `gsn:valid` from a check, and a part of an artefact can have its own
  report.

[`augmentation/HOW-TO.md`](augmentation/HOW-TO.md) explains each of these, and how to trace a
change in a requirement, in the system or in its environment.
