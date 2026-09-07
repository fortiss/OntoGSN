# -*- coding: utf-8 -*-
"""Read serializations/ontogsn.ttl and expose it as a flat inventory of statements.

The design document records one row per *axiom*, so this module flattens the graph
to that same granularity:

  * simple triples on a named subject          -> gsn:Goal rdfs:subClassOf gsn:GSNElement .
  * class expressions hanging off a subject    -> gsn:Goal rdfs:subClassOf [ inContextOf only (...) ] .
  * owl:Axiom reifications                     -> <Argument subClassOf ...> coreOrExtension "..."
  * general class axioms (anonymous subject)   -> (Goal and not ...) EquivalentTo top value "true"
  * SWRL rules                                 -> Goal(?A) ^ supportedBy(?A, ?B) -> top(?A, false)

Blank-node identifiers (_:genid83) are never exposed: they are unstable across
re-serialization, so every expression is rendered structurally instead.
"""
import os
import re

from rdflib import Graph, RDF, RDFS, OWL, BNode, URIRef, Literal, Namespace

GSN = Namespace("https://w3id.org/OntoGSN/ontology#")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
SWRL = Namespace("http://www.w3.org/2003/11/swrl#")
SCHEMA = Namespace("http://schema.org/")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TTL = os.path.join(REPO, "serializations", "ontogsn.ttl")

QNAME_MAP = {
    str(GSN): "gsn:", str(RDFS): "rdfs:", str(OWL): "owl:", str(RDF): "rdf:",
    str(SKOS): "skos:", str(SCHEMA): "schema:", str(SWRL): "swrl:",
    "http://purl.org/dc/elements/1.1/": "dc:",
    "http://purl.org/dc/terms/": "terms:",
    "http://www.w3.org/2001/XMLSchema#": "xsd:",
    "http://purl.org/vocab/vann/": "vann:",
    "http://creativecommons.org/ns#": "cc:",
    "http://swrl.stanford.edu/ontologies/3.3/swrla.owl#": "swrla:",
}

PRED_KEY = {
    str(RDF.type): "a", str(RDFS.label): "label", str(RDFS.subClassOf): "subClassOf",
    str(RDFS.domain): "domain", str(RDFS.range): "range", str(RDFS.comment): "comment",
    str(SKOS.definition): "definition", str(SKOS.altLabel): "altLabel",
    str(SKOS.note): "note", str(SKOS.prefLabel): "prefLabel",
    str(GSN.coreOrExtension): "coreOrExtension", str(GSN.renderedAs): "renderedAs",
    str(OWL.equivalentClass): "EquivalentTo",
    str(OWL.propertyDisjointWith): "propertyDisjointWith",
    str(OWL.disjointWith): "disjointWith", str(OWL.inverseOf): "inverseOf",
    str(SCHEMA.description): "description", str(SCHEMA.identifier): "identifier",
}

RESTRICTION_RE = re.compile(r"^(\w+) (only|some|value|exactly|min|max) (.+)$")


def load(path=None):
    g = Graph()
    g.parse(path or DEFAULT_TTL, format="turtle")
    return g


def ln(node):
    s = str(node)
    for sep in ("#", "/"):
        if sep in s:
            s = s.rsplit(sep, 1)[-1]
    return s


def qname(term):
    for ns, pre in QNAME_MAP.items():
        if str(term).startswith(ns):
            return pre + ln(term)
    return f"<{term}>"


def rdf_list(g, node):
    out = []
    while node is not None and node != RDF.nil:
        first = g.value(node, RDF.first)
        if first is None:
            break
        out.append(first)
        node = g.value(node, RDF.rest)
    return out


def render_expr(g, node, depth=0):
    """Structural, blank-node-free rendering of a class expression."""
    if isinstance(node, Literal):
        return f'"{node}"'
    if isinstance(node, URIRef):
        return ln(node)
    if depth > 6:
        return "..."

    for prop, op in ((OWL.unionOf, " or "), (OWL.intersectionOf, " and ")):
        lst = g.value(node, prop)
        if lst is not None:
            return "(" + op.join(render_expr(g, m, depth + 1) for m in rdf_list(g, lst)) + ")"
    comp = g.value(node, OWL.complementOf)
    if comp is not None:
        return "not " + render_expr(g, comp, depth + 1)
    one = g.value(node, OWL.oneOf)
    if one is not None:
        return "{" + ", ".join(render_expr(g, m, depth + 1) for m in rdf_list(g, one)) + "}"

    prop = g.value(node, OWL.onProperty)
    if prop is not None:
        if isinstance(prop, BNode):
            inv = g.value(prop, OWL.inverseOf)
            name = f"inverse {ln(inv)}" if inv is not None else "?"
        else:
            name = ln(prop)
        for pred, kw in ((OWL.allValuesFrom, "only"), (OWL.someValuesFrom, "some"),
                         (OWL.hasValue, "value")):
            v = g.value(node, pred)
            if v is not None:
                return f"{name} {kw} {render_expr(g, v, depth + 1)}"
        for pred, kw in ((OWL.qualifiedCardinality, "exactly"),
                         (OWL.minQualifiedCardinality, "min"),
                         (OWL.maxQualifiedCardinality, "max"),
                         (OWL.cardinality, "exactly"), (OWL.minCardinality, "min"),
                         (OWL.maxCardinality, "max")):
            n = g.value(node, pred)
            if n is not None:
                filler = g.value(node, OWL.onClass) or g.value(node, OWL.onDataRange)
                tail = f" {render_expr(g, filler, depth + 1)}" if filler is not None else ""
                return f"{name} {kw} {int(n)}{tail}"
        return f"{name} ?"
    return "?"


def _term(g, t):
    if isinstance(t, Literal):
        v = str(t).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
        if len(v) > 400:
            v = v[:400] + "…"
        if t.language:
            return f'"{v}"@{t.language}'
        if t.datatype is not None and ln(t.datatype) != "string":
            return f'"{v}"^^{qname(t.datatype)}'
        return f'"{v}"'
    if isinstance(t, BNode):
        return "[ " + render_expr(g, t) + " ]"
    return qname(t)


def turtle(g, s, p, o):
    return f"{_term(g, s)} {qname(p)} {_term(g, o)} ."


def statements(g):
    """Every axiom the design document could plausibly have a row for."""
    out = []
    # a rule is one design decision, reported whole by rules(); its own triples
    # (label, comment, isRuleEnabled, coreOrExtension) are not separate axioms
    skip = set(g.subjects(RDF.type, SWRL.Variable)) | set(g.subjects(RDF.type, SWRL.Imp))

    for s, p, o in g:
        if not isinstance(s, URIRef) or s in skip:
            continue
        if str(p).startswith(str(SWRL)) or p in (OWL.annotatedSource,
                                                 OWL.annotatedProperty, OWL.annotatedTarget):
            continue
        if isinstance(o, BNode):
            if p not in (RDFS.subClassOf, RDFS.domain, RDFS.range, OWL.equivalentClass):
                continue
            expr = render_expr(g, o)
            m = RESTRICTION_RE.match(expr)
            # 'Goal subClassOf [inContextOf only X]' is written 'Goal inContextOf only X'
            if p == RDFS.subClassOf and m:
                key = (ln(s), m.group(1), f"{m.group(2)} {m.group(3)}")
            else:
                key = (ln(s), PRED_KEY.get(str(p), ln(p)), expr)
        else:
            key = (ln(s), PRED_KEY.get(str(p), ln(p)),
                   str(o) if isinstance(o, Literal) else ln(o))
        out.append({"key": key, "s": s, "p": p, "o": o, "ttl": turtle(g, s, p, o)})

    # general class axioms: an anonymous class expression as the subject
    for s in {x for x in g.subjects() if isinstance(x, BNode)}:
        for p, o in g.predicate_objects(s):
            if p in (OWL.equivalentClass, OWL.disjointWith):
                out.append({"key": (render_expr(g, s), PRED_KEY.get(str(p), ln(p)),
                                    render_expr(g, o)),
                            "s": s, "p": p, "o": o, "ttl": turtle(g, s, p, o)})
    return out


def axiom_annotations(g):
    """owl:Axiom reifications, keyed as '<subject predicate object> annotation'."""
    out = []
    for ax in g.subjects(RDF.type, OWL.Axiom):
        s = g.value(ax, OWL.annotatedSource)
        p = g.value(ax, OWL.annotatedProperty)
        o = g.value(ax, OWL.annotatedTarget)
        if s is None or p is None:
            continue
        tgt = render_expr(g, o) if isinstance(o, BNode) else (ln(o) if o is not None else "?")
        m = RESTRICTION_RE.match(tgt)
        base = (f"{ln(s)} {m.group(1)} {m.group(2)} {m.group(3)}"
                if (p == RDFS.subClassOf and m)
                else f"{ln(s)} {PRED_KEY.get(str(p), ln(p))} {tgt}")
        for ap, av in g.predicate_objects(ax):
            if ap in (RDF.type, OWL.annotatedSource, OWL.annotatedProperty, OWL.annotatedTarget):
                continue
            name = PRED_KEY.get(str(ap), ln(ap))
            out.append({"key": (f"<{base}>", name, str(av)), "s": ax, "p": ap, "o": av,
                        "ttl": (f"[ a owl:Axiom ; owl:annotatedSource {qname(s)} ; "
                                f"owl:annotatedProperty {qname(p)} ; "
                                f"owl:annotatedTarget {tgt} ; {name} {_term(g, av)} ] .")})
    return out


def _atom(g, atom):
    def arg(a):
        if a is None:
            return "?"
        if isinstance(a, Literal):
            return str(a).lower() if isinstance(a.value, bool) else f'"{a}"'
        return "?" + ln(a)
    cp = g.value(atom, SWRL.classPredicate)
    if cp is not None:
        return f"{ln(cp)}({arg(g.value(atom, SWRL.argument1))})"
    pp = g.value(atom, SWRL.propertyPredicate)
    if pp is not None:
        return f"{ln(pp)}({arg(g.value(atom, SWRL.argument1))}, {arg(g.value(atom, SWRL.argument2))})"
    b = g.value(atom, SWRL.builtin)
    if b is not None:
        return f"{ln(b)}({', '.join(arg(a) for a in rdf_list(g, g.value(atom, SWRL.arguments)))})"
    return "?"


def rules(g):
    out = []
    for imp in g.subjects(RDF.type, SWRL.Imp):
        body = [_atom(g, a) for a in rdf_list(g, g.value(imp, SWRL.body))]
        head = [_atom(g, a) for a in rdf_list(g, g.value(imp, SWRL.head))]
        label = g.value(imp, RDFS.label)
        out.append({"dl": " ^ ".join(body) + " -> " + " ^ ".join(head),
                    "body": frozenset(body), "head": frozenset(head),
                    "label": str(label) if label else "", "node": imp})
    return out


def inventory(path=None):
    g = load(path)
    return g, statements(g) + axiom_annotations(g), rules(g)


if __name__ == "__main__":
    g, st, ru = inventory()
    print(f"{len(g)} triples -> {len(st)} statements, {len(ru)} rules")
    for r in st[:5]:
        print("  ", r["ttl"][:110])
