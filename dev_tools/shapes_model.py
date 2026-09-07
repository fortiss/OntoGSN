# -*- coding: utf-8 -*-
"""Read shapes/ontogsn-shapes_[1-5]*.ttl as a flat inventory of constraints.

The design workbook records one row per decision, so the shapes are flattened to the
same granularity: a named node shape, one `sh:property` block, or one `sh:sparql`
block. Each unit is rendered structurally (never by blank node identifier) so a row
keeps pointing at the same constraint when the file is reformatted.
"""
import glob
import os
import re

from rdflib import RDF, RDFS, BNode, Graph, Literal, Namespace, URIRef

SH = Namespace("http://www.w3.org/ns/shacl#")
GSN = Namespace("https://w3id.org/OntoGSN/ontology#")
GSNSH = Namespace("https://w3id.org/OntoGSN/shapes#")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHAPES_DIR = os.path.join(REPO, "shapes")
SOURCES = sorted(glob.glob(os.path.join(SHAPES_DIR, "ontogsn-shapes_[1-5]*.ttl")))

PREFIXES = {
    str(SH): "sh:", str(GSN): "gsn:", str(GSNSH): "gsnsh:",
    str(RDF): "rdf:", str(RDFS): "rdfs:",
    "http://www.w3.org/2002/07/owl#": "owl:",
    "http://www.w3.org/2001/XMLSchema#": "xsd:",
    "http://www.w3.org/2004/02/skos/core#": "skos:",
    "http://schema.org/": "schema:",
    "http://purl.org/dc/elements/1.1/": "dc:",
}

# rendered on the unit itself rather than inside it
SKIP_ON_NODE = {SH.property, SH.sparql}


def qname(term):
    for namespace, prefix in PREFIXES.items():
        if str(term).startswith(namespace):
            return prefix + str(term)[len(namespace):]
    return f"<{term}>"


def _literal(term):
    text = str(term).replace("\\", "\\\\").replace('"', '\\"')
    text = re.sub(r"\s+", " ", text).strip()
    if term.language:
        return f'"{text}"@{term.language}'
    if term.datatype is not None:
        return f'"{text}"^^{qname(term.datatype)}'
    return f'"{text}"'


def _rdf_list(graph, node):
    items = []
    while node and node != RDF.nil:
        items.append(graph.value(node, RDF.first))
        node = graph.value(node, RDF.rest)
    return items


def render(graph, node, depth=0, skip=()):
    """A blank-node-free Turtle rendering of `node` and everything under it."""
    if isinstance(node, Literal):
        return _literal(node)
    if isinstance(node, URIRef):
        return qname(node)
    if depth > 8:
        return "[ … ]"

    if graph.value(node, RDF.first) is not None:
        return "( " + " ".join(render(graph, i, depth + 1) for i in
                               _rdf_list(graph, node)) + " )"

    parts = []
    for predicate, obj in sorted(graph.predicate_objects(node),
                                 key=lambda po: (qname(po[0]), str(po[1]))):
        if predicate in skip:
            continue
        parts.append(f"{qname(predicate)} {render(graph, obj, depth + 1)}")
    return "[ " + " ; ".join(parts) + " ]"


def render_subject(graph, subject, skip=()):
    """`gsnsh:XShape a sh:NodeShape ; sh:targetClass gsn:X ; … .`"""
    parts = []
    for predicate, obj in sorted(graph.predicate_objects(subject),
                                 key=lambda po: (qname(po[0]), str(po[1]))):
        if predicate in skip:
            continue
        parts.append(f"{qname(predicate)} {render(graph, obj, 1)}")
    return f"{qname(subject)} " + " ;\n    ".join(parts) + " ."


def _section(graph, shape):
    value = graph.value(shape, GSN.coreOrExtension)
    return str(value) if value else ""


def inventory(paths=None):
    """-> (merged graph, [unit records])."""
    graph = Graph()
    per_file = {}
    for path in (paths or SOURCES):
        one = Graph()
        one.parse(path, format="turtle")
        graph += one
        for shape in one.subjects(RDF.type, SH.NodeShape):
            per_file[shape] = os.path.basename(path)

    units = []
    for shape in sorted(graph.subjects(RDF.type, SH.NodeShape), key=str):
        section = _section(graph, shape)
        source = per_file.get(shape, "")
        comment = graph.value(shape, RDFS.comment)
        message = graph.value(shape, SH.message)

        units.append({
            "key": (qname(shape), "node", ""),
            "shape": qname(shape), "unit": "node", "section": section,
            "file": source, "ttl": render_subject(graph, shape, skip=SKIP_ON_NODE),
            "message": str(message) if message else "",
            "comment": str(comment) if comment else "",
        })

        for kind, predicate in (("property", SH.property), ("sparql", SH.sparql)):
            for obj in graph.objects(shape, predicate):
                path = graph.value(obj, SH.path)
                name = graph.value(obj, SH.name)
                msg = graph.value(obj, SH.message)
                discriminator = qname(path) if isinstance(path, URIRef) else (
                    str(name) if name else str(msg or "")[:40])
                units.append({
                    "key": (qname(shape), kind, discriminator),
                    "shape": qname(shape), "unit": kind, "section": section,
                    "file": source,
                    "ttl": f"{qname(shape)} {qname(predicate)} {render(graph, obj)} .",
                    "message": str(msg) if msg else "",
                    "comment": "",
                })
    return graph, units


if __name__ == "__main__":
    g, units = inventory()
    print(f"{len(g)} triples -> {len(units)} units")
    import collections
    for kind, count in collections.Counter(u["unit"] for u in units).most_common():
        print(f"  {count:>4}  {kind}")
    for u in units[:3]:
        print("\n ", u["ttl"][:150])
