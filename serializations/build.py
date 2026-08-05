#!/usr/bin/env python3
"""Regenerate the alternative serializations from ontogsn.ttl.

`ontogsn.ttl` is the maintained source. Everything else in this folder is derived:

    python serializations/build.py            # rewrite the derived files
    python serializations/build.py --check    # fail if they are out of date (CI)

Blank nodes are relabelled deterministically before writing. Turtle spells most of them
as anonymous `[ … ]` blocks, so a parser invents fresh identifiers on every run; without
canonicalisation each rebuild would produce a completely different file for an unchanged
ontology. Labels are derived from each blank node's own structure, so they stay put
unless that part of the graph actually changes.

OWL/XML (`ontogsn.owl`) is deprecated and no longer produced: it needs the OWL API, which
is not part of this toolchain. Use the Turtle, RDF/XML or JSON-LD files instead.
"""
import argparse
import hashlib
import json
import os
import sys
from xml.etree import ElementTree

from rdflib import RDF, BNode, Graph
from rdflib.compare import to_isomorphic

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "ontogsn.ttl")

# derived file -> rdflib serializer
TARGETS = {"ontogsn.rdf": "xml", "ontogsn.jsonld": "json-ld"}


def _signatures(graph, rounds=8):
    """A structure-derived fingerprint per blank node.

    Each node starts from the named terms around it, then absorbs its neighbours'
    fingerprints until they stop changing. rdflib's own to_canonical_graph is not stable
    across processes, which would make every rebuild look like a change.
    """
    blanks = {n for t in graph for n in t if isinstance(n, BNode)}
    sig = dict.fromkeys(blanks, "")
    for _ in range(rounds):
        nxt = {}
        for node in blanks:
            parts = [f">{p}|{sig[o] if isinstance(o, BNode) else o}"
                     for p, o in graph.predicate_objects(node)]
            parts += [f"<{p}|{sig[s] if isinstance(s, BNode) else s}"
                      for s, p in graph.subject_predicates(node)]
            nxt[node] = hashlib.sha1("".join(sorted(parts)).encode("utf-8")).hexdigest()
        if nxt == sig:
            break
        sig = nxt
    return sig


def canonical(graph):
    """A copy of `graph` with short, content-derived blank node labels."""
    sig = _signatures(graph)
    # ties are structurally interchangeable nodes, so either assignment yields the same
    # sorted triples; the secondary key only keeps the numbering total
    order = sorted(sig, key=lambda n: (sig[n], str(n)))
    rename = {str(node): BNode("genid%04d" % i) for i, node in enumerate(order, 1)}
    canon = graph

    renamed = [tuple(rename.get(str(t), t) if isinstance(t, BNode) else t for t in triple)
               for triple in canon]

    out = Graph()
    for prefix, namespace in graph.namespaces():
        out.bind(prefix, namespace)
    # inserted in sorted order: rdflib serializes in store order, so without this the
    # layout would shift from run to run even though the graph is identical
    for triple in sorted(renamed, key=lambda t: (str(t[0]), str(t[1]), str(t[2]))):
        out.add(triple)
    return out


def _stable_xml(text, namespaces):
    """Sort the RDF/XML document.

    rdflib does not emit subjects or properties in store order, so the layout shifts
    between runs. The output is flat and uses no rdf:parseType="Collection", so neither
    element order carries meaning and both can be sorted.
    """
    for prefix, uri in namespaces:
        ElementTree.register_namespace(prefix, str(uri))
    root = ElementTree.fromstring(text)

    def key(element):
        return (element.tag, tuple(sorted(element.attrib.items())), element.text or "")

    for description in root:
        description[:] = sorted(description, key=key)
    root[:] = sorted(root, key=key)
    ElementTree.indent(root, space="  ")
    return ElementTree.tostring(root, encoding="unicode", xml_declaration=True) + "\n"


def _stable_json(node, ordered=False):
    """Sort every array except @list, whose order is the list itself."""
    if isinstance(node, list):
        items = [_stable_json(x) for x in node]
        return items if ordered else sorted(
            items, key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
    if isinstance(node, dict):
        return {k: _stable_json(v, ordered=(k == "@list")) for k, v in node.items()}
    return node


def serialize(graph, fmt):
    kwargs = {"format": fmt}
    if fmt == "json-ld":
        kwargs.update(indent=2, auto_compact=False)
    data = graph.serialize(**kwargs)
    text = data if isinstance(data, str) else data.decode("utf-8")

    if fmt == "xml":
        return _stable_xml(text, list(graph.namespaces()))
    if fmt == "json-ld":
        return json.dumps(_stable_json(json.loads(text)), indent=2,
                          sort_keys=True, ensure_ascii=False) + "\n"
    return text


def _without_list_typing(graph):
    """JSON-LD writes a list as @list, which carries the structure without typing each
    cell rdf:List. Those assertions are redundant, so they are excluded from both sides
    of the comparison rather than treated as data loss."""
    out = Graph()
    for triple in graph:
        if not (triple[1] == RDF.type and triple[2] == RDF.List):
            out.add(triple)
    return out


def verify(source, rebuilt):
    """-> (ok, number of redundant rdf:List typings the format could not carry).

    Compared by isomorphism: a round-trip invents its own blank node names, so the
    triples cannot be matched literally.
    """
    dropped = (len(list(source.subjects(RDF.type, RDF.List)))
               - len(list(rebuilt.subjects(RDF.type, RDF.List))))
    ok = to_isomorphic(_without_list_typing(source)) == \
        to_isomorphic(_without_list_typing(rebuilt))
    return ok, dropped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="verify the derived files are current; write nothing")
    args = ap.parse_args()

    source = Graph()
    source.parse(SOURCE, format="turtle")
    print(f"{os.path.basename(SOURCE)}: {len(source)} triples")

    graph = canonical(source)
    if to_isomorphic(graph) != to_isomorphic(source):
        sys.exit("canonicalisation changed the graph - refusing to write")

    stale = []
    for name, fmt in sorted(TARGETS.items()):
        path = os.path.join(HERE, name)
        text = serialize(graph, fmt)

        current = None
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                current = fh.read()
        if current == text:
            print(f"  {name:<16} unchanged")
            continue
        if args.check:
            stale.append(name)
            print(f"  {name:<16} OUT OF DATE")
            continue

        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        # a derived file that does not say the same thing as the source is worse than none
        rebuilt = Graph()
        rebuilt.parse(path, format=fmt)
        ok, dropped = verify(graph, rebuilt)
        if not ok:
            sys.exit(f"{name} does not say the same thing as the source - not written")
        note = f", {dropped} redundant rdf:List typings dropped" if dropped else ""
        print(f"  {name:<16} written and verified ({len(text):,} bytes{note})")

    if args.check and stale:
        sys.exit(f"out of date: {', '.join(stale)} - run python serializations/build.py")


if __name__ == "__main__":
    main()
