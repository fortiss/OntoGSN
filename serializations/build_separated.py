#!/usr/bin/env python3
"""Regenerate serializations/separated/ from ontogsn.ttl.

    python serializations/build_separated.py            # rewrite the 36 derived files
    python serializations/build_separated.py --check    # fail if they are out of date (CI)

A full rewrite takes about a minute and a quarter, because every file written is re-parsed
and compared to its source by graph isomorphism, and blank-node canonicalisation is not
cheap on the two `0_full` graphs. `--check` writes nothing and returns in under two
seconds, so that is the one to put in CI.

Two axes: 6 modules x 3 scopes x 2 formats = 36 files.

SCOPE - what is included. Three levels, one thing removed at each step, so that a
comparison between any two of them has a single variable in it:

    complete   everything: declarations, logical axioms, annotations, SWRL rules
    pruned     complete minus the SWRL rules and minus the ontology node's own
               metadata. Term-level annotations (rdfs:label, skos:definition,
               skos:note, skos:altLabel, gsn:renderedAs, gsn:coreOrExtension) are
               KEPT - the point of pruning is to drop the rule layer and the
               publication boilerplate, not to make the terms unreadable.
    skeletal   pruned minus all prose. Declarations and logical axioms only.

`skeletal` is not an opaque file: gsn:Goal, gsn:Solution and gsn:supportedBy say what
they are, and the class expressions survive intact. What goes is the GSN Community
Standard's own wording - skos:definition carries about two thirds of the prose by
weight, and is the only annotation with real mass. rdfs:label costs well under a
thousand characters across the whole ontology, so `skeletal` drops it for consistency
rather than for economy.

MODULE - which section of the GSN Community Standard
    0_full     everything
    1_core     Core GSN                        4_confidence  Confidence Argument Extension
    2_pattern  Argument Pattern Extension      5_dialectic   Dialectic Extension
    3_modular  Modular Extension

A term belongs to the module its gsn:coreOrExtension annotation names. Everything
reachable from it through blank nodes travels with it, so a class keeps its
restrictions and a rule keeps its atoms. The five modules partition the ontology:
their union is exactly 0_full.

Each file is self-sufficient to parse. A section that references a term it does not
own gets a bare `rdf:type` declaration for it (a stub, not the definition), and every
external annotation property or datatype the section actually uses is declared. That
last rule fixes a real inconsistency in the previous files, where 1_core declared 27
annotation properties and 4_confidence declared none.

The previous files were generated from ontology version 1.2 and had drifted:
`pruned_0_full.jsonld` was a byte-for-byte copy of `pruned_1_core.jsonld`, and the SWRL
variables were declared under two namespaces at once (`gsn:A` and `urn:swrl:var#A`).
Neither survives regeneration.
"""
import argparse
import os
import sys

from rdflib import BNode, Graph, Literal, Namespace, RDF, RDFS, URIRef
from rdflib.namespace import OWL

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import build                                  # canonical(), serialize()

SOURCE = os.path.join(HERE, "ontogsn.ttl")
OUT_DIR = os.path.join(HERE, "separated")

GSN = Namespace("https://w3id.org/OntoGSN/ontology#")
SWRL = Namespace("http://www.w3.org/2003/11/swrl#")
SWRLA = Namespace("http://swrl.stanford.edu/ontologies/3.3/swrla.owl#")
DC = Namespace("http://purl.org/dc/elements/1.1/")
ONTOLOGY = URIRef("https://w3id.org/OntoGSN/ontology")

# module key -> (the gsn:coreOrExtension value, the section's ontology IRI suffix)
MODULES = [
    ("1_core", "Core GSN", "core"),
    ("2_pattern", "Argument Pattern Extension", "pattern"),
    ("3_modular", "Modular Extension", "modular"),
    ("4_confidence", "Confidence Argument Extension", "confidence"),
    ("5_dialectic", "Dialectic Extension", "dialectic"),
]

FORMATS = {"ttl": "turtle", "jsonld": "json-ld"}

SCOPES = ("complete", "pruned", "skeletal")

SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
SCHEMA = Namespace("http://schema.org/")

# everything `skeletal` drops: the words, as opposed to the logic. gsn:renderedAs is
# here because it describes the diagram notation, and gsn:coreOrExtension because inside
# a section file it is the same value on every term - neither says anything a reasoner
# or a reader of the axioms needs.
PROSE = {RDFS.label, RDFS.comment, SKOS.definition, SKOS.note, SKOS.altLabel,
         SKOS.prefLabel, SKOS.example, SCHEMA.description, DC.description,
         GSN.renderedAs, GSN.coreOrExtension}

DECLARATION = {OWL.Class, OWL.ObjectProperty, OWL.DatatypeProperty,
               OWL.AnnotationProperty, OWL.NamedIndividual, RDFS.Datatype}


def closure(graph, node, seen=None):
    """Every triple hanging off `node`, following blank nodes but never named terms.

    This is what keeps a class expression with its class, and a rule with its atoms:
    both are blank-node subgraphs. It stops at named terms so that a section does not
    drag in the definition of everything it happens to mention.
    """
    seen = seen if seen is not None else set()
    if node in seen:
        return set()
    seen.add(node)
    out = set()
    for predicate, obj in graph.predicate_objects(node):
        out.add((node, predicate, obj))
        if isinstance(obj, BNode):
            out |= closure(graph, obj, seen)
    return out


def is_swrl(graph, node):
    if (node, RDF.type, SWRL.Imp) in graph or (node, RDF.type, SWRL.Variable) in graph:
        return True
    return any(str(t).startswith(str(SWRL)) for t in graph.objects(node, RDF.type))


def assign(graph):
    """-> ({module value -> set of subject nodes}, [subjects with no module]).

    Section membership is read off gsn:coreOrExtension, which every term, rule and
    owl:Axiom reification is supposed to carry.
    """
    sections = {value: set() for _, value, _ in MODULES}
    unassigned = []
    for subject in set(graph.subjects()):
        if subject == ONTOLOGY:
            continue                              # replaced by a per-section header
        if isinstance(subject, URIRef) and not str(subject).startswith(str(GSN)):
            # imported vocabulary (rdf:, xsd:, dc:, skos:, schema: ...). It is not
            # OntoGSN's to place in a section; add_support() declares what is used.
            continue
        if isinstance(subject, URIRef) and (subject, RDF.type, SWRL.Variable) in graph:
            continue                              # travels with the rules that use it
        if isinstance(subject, BNode) and not set(graph.objects(subject, GSN.coreOrExtension)):
            # part of some other subject's expression; it arrives through the closure
            if not set(graph.objects(subject, OWL.equivalentClass)) and \
               not set(graph.objects(subject, OWL.disjointWith)):
                continue
        values = [str(v) for v in graph.objects(subject, GSN.coreOrExtension)]
        if not values:
            unassigned.append(subject)
            continue
        for value in values:
            if value in sections:
                sections[value].add(subject)
            else:
                unassigned.append(subject)
    return sections, unassigned


def prune(graph, triples):
    """Drop the rule layer. The ontology node's metadata is excluded separately, by
    never copying it into the section header."""
    kept = set()
    for triple in triples:
        subject, predicate, obj = triple
        if str(predicate).startswith(str(SWRL)) or predicate == SWRLA.isRuleEnabled:
            continue
        if is_swrl(graph, subject):
            continue
        if isinstance(obj, URIRef) and str(obj).startswith(str(SWRL)):
            continue
        kept.add(triple)
    # The rdf:List cells that carried a rule's body and head are typeless blank nodes,
    # so neither test above removes them and they are left pointing at variables that no
    # longer exist. Keep a blank node only when something NAMED still leads to it -
    # reachability from the kept triples alone would let an orphaned chain vouch for
    # itself.
    outgoing = {}
    for triple in kept:
        outgoing.setdefault(triple[0], []).append(triple[2])
    reachable, frontier = set(), [t[2] for t in kept if isinstance(t[0], URIRef)]
    while frontier:
        node = frontier.pop()
        if not isinstance(node, BNode) or node in reachable:
            continue
        reachable.add(node)
        frontier.extend(outgoing.get(node, ()))
    return {t for t in kept
            if not isinstance(t[0], BNode) or t[0] in reachable}


def strip_prose(triples):
    """Drop the words, keep the logic.

    Only whole triples go; nothing is rewritten. A term keeps its IRI, its declaration
    and every axiom it takes part in, and loses only what was written *about* it.
    """
    return {t for t in triples if t[1] not in PROSE}


def header(graph, module, value, suffix, scope, version):
    """The section's own owl:Ontology node.

    'complete' carries the full publication metadata; 'pruned' carries only what
    identifies the file - its IRI, what it came from and which version, which is the
    minimum that lets a checker notice the file has gone stale. The previous pruned
    files kept nothing at all, so nothing could tell they had.
    """
    iri = ONTOLOGY if module == "0_full" else URIRef(
        f"https://w3id.org/OntoGSN/ontology/{suffix}")
    out = {(iri, RDF.type, OWL.Ontology),
           (iri, OWL.versionInfo, Literal(version)),
           (iri, DC.source, Literal(str(ONTOLOGY)))}
    title = "OntoGSN" if module == "0_full" else f"OntoGSN — {value}"
    out.add((iri, DC.title, Literal(title, lang="en")))
    carries = {"complete": "Includes the SWRL rules and every annotation.",
               "pruned": "Excludes the SWRL rules; the term annotations are kept.",
               "skeletal": "Declarations and logical axioms only - no rules, no prose."}
    out.add((iri, DC.description, Literal(
        f"The {scope} "
        f"{'ontology' if module == '0_full' else value + ' section'} of OntoGSN. "
        f"Generated from ontogsn.ttl by serializations/build_separated.py. "
        f"{carries[scope]}", lang="en")))
    if module != "0_full":
        out.add((iri, GSN.coreOrExtension, Literal(value, lang="en")))
    if scope == "complete":
        for predicate, obj in graph.predicate_objects(ONTOLOGY):
            if predicate in (RDF.type, OWL.versionInfo, DC.title, DC.description,
                             DC.source):
                continue
            out.add((iri, predicate, obj))
    if module == "0_full":
        for _, section_value, section_suffix in MODULES:
            out.add((iri, RDFS.seeAlso,
                     URIRef(f"https://w3id.org/OntoGSN/ontology/{section_suffix}")))
    return out


def complete_section(graph, subjects):
    triples = set()
    for subject in subjects:
        triples |= closure(graph, subject)
    # a rule's atoms name variables; without their declarations the rule is unreadable
    for variable in graph.subjects(RDF.type, SWRL.Variable):
        if any(variable in (t[2],) for t in triples):
            triples.add((variable, RDF.type, SWRL.Variable))
    return triples


def add_support(graph, triples):
    """Declare what the section uses but does not own, so the file stands alone.

    Two kinds: a gsn: term referenced from an axiom that lives in another section, and
    an external annotation property or datatype. Both get a bare rdf:type - the stub
    says what kind of thing the name is, without copying its definition.
    """
    owned = {t[0] for t in triples}
    named = {x for t in triples for x in t if isinstance(x, URIRef)}
    used_predicates = {t[1] for t in triples}
    support = set()
    for term in named | used_predicates:
        if term in owned or term == RDF.type:
            continue
        for kind in graph.objects(term, RDF.type):
            if kind in DECLARATION:
                support.add((term, RDF.type, kind))
    return support


def build_all(graph, version):
    """-> {filename stem -> Graph}."""
    sections, unassigned = assign(graph)
    if unassigned:
        print(f"  {len(unassigned)} subjects carry no gsn:coreOrExtension and are "
              f"placed in Core GSN:")
        for subject in sorted(unassigned, key=str):
            name = str(subject).split("#")[-1] if isinstance(subject, URIRef) \
                else "a general class axiom"
            kinds = sorted(graph.qname(k) for k in graph.objects(subject, RDF.type))
            print(f"    {name:26} {', '.join(kinds) or 'no rdf:type'}")
        sections["Core GSN"] |= set(unassigned)

    out = {}
    for module, value, suffix in MODULES:
        out[module] = (complete_section(graph, sections[value]), value, suffix)
    everything = set()
    for module, _, _ in MODULES:
        everything |= out[module][0]

    # A declaration nothing references would otherwise vanish, because the sections are
    # assembled from what the axioms actually use. Vestigial or not, it is in the source,
    # so it travels with Core rather than being dropped on the floor.
    trial = everything | header(graph, "0_full", "", "", "complete", version)
    trial |= add_support(graph, trial)
    residual = {t for t in graph
                if not any(isinstance(x, BNode) for x in t) and t[0] != ONTOLOGY} - trial
    if residual:
        print(f"  {len(residual)} declarations are unused by any axiom and are kept in "
              f"Core GSN:")
        for triple in sorted(residual, key=str):
            print(f"    {graph.qname(triple[0]):26} declared "
                  f"{graph.qname(triple[2])}, referenced nowhere")
        core = out["1_core"]
        out["1_core"] = (core[0] | residual, core[1], core[2])
        everything |= residual

    out["0_full"] = (everything, "", "")

    graphs = {}
    for module, (triples, value, suffix) in out.items():
        for scope in SCOPES:
            body = triples if scope == "complete" else prune(graph, triples)
            if scope == "skeletal":
                body = strip_prose(body)
            # the header before the support declarations, so that a vocabulary used
            # only by the header (dc:contributor and the rest of the publication
            # metadata) still gets declared
            body = body | header(graph, module, value, suffix, scope, version)
            body = body | add_support(graph, body)
            section = Graph()
            # replace=True, or rdflib keeps its own reservation of `schema` for
            # https://schema.org/ and renames the ontology's binding to `schema1`
            for prefix, uri in graph.namespaces():
                section.bind(prefix, uri, override=True, replace=True)
            for triple in body:
                section.add(triple)
            graphs[f"ontogsn-{scope}_{module}"] = section
    return graphs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="verify the derived files are current; write nothing")
    args = ap.parse_args()

    source = Graph()
    source.parse(SOURCE, format="turtle")
    version = str(source.value(ONTOLOGY, OWL.versionInfo) or "unknown")
    print(f"ontogsn.ttl: {len(source)} triples, version {version}")

    graphs = build_all(source, version)

    # Nothing may be lost. Every named triple of ontogsn.ttl has to survive into
    # complete_0_full - which is itself assembled only from the five sections, so this
    # also proves the sections between them cover the whole ontology. The owl:Ontology
    # node is excluded because every file states a header of its own instead.
    def named(g):
        return {t for t in g if not any(isinstance(x, BNode) for x in t)}

    dropped = ({t for t in named(source) if t[0] != ONTOLOGY}
               - named(graphs["ontogsn-complete_0_full"]))
    if dropped:
        for triple in sorted(dropped, key=str)[:10]:
            print("    " + " ".join(source.qname(x) if isinstance(x, URIRef)
                                    else str(x)[:40] for x in triple))
        sys.exit(f"\n{len(dropped)} named triples of ontogsn.ttl reach no section - "
                 "refusing to write a partition that loses axioms")

    os.makedirs(OUT_DIR, exist_ok=True)
    stale, written = [], 0
    for stem in sorted(graphs):
        canonical = build.canonical(graphs[stem])
        # canonical() rebuilds the graph, and rdflib reserves `schema` for
        # https://schema.org/ - without this the files would say `schema1:` where the
        # rest of the repository says `schema:`
        canonical.bind("schema", "http://schema.org/", override=True, replace=True)
        for extension, fmt in sorted(FORMATS.items()):
            path = os.path.join(OUT_DIR, f"{stem}.{extension}")
            text = build.serialize(canonical, fmt)
            current = None
            if os.path.exists(path):
                with open(path, encoding="utf-8") as fh:
                    current = fh.read()
            if current == text:
                continue
            if args.check:
                stale.append(f"{stem}.{extension}")
                continue
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(text)
            # a derived file that does not say the same thing as its source is worse
            # than no file at all - the same check build.py makes
            rebuilt = Graph()
            rebuilt.parse(path, format=fmt)
            ok, _ = build.verify(canonical, rebuilt)
            if not ok:
                sys.exit(f"{stem}.{extension} does not say the same thing as "
                         "ontogsn.ttl - not written")
            written += 1

    counts = {stem: len(g) for stem, g in graphs.items()}
    print()
    for stem in sorted(counts):
        print(f"  {stem:28} {counts[stem]:>5} triples")

    print(f"\nevery axiom of ontogsn.ttl lands in a section; nothing dropped")

    if args.check:
        if stale:
            sys.exit(f"\nout of date: {', '.join(stale)}\n"
                     "run python serializations/build_separated.py")
        print(f"all {len(graphs) * len(FORMATS)} files are current")
    else:
        print(f"wrote {written} of {len(graphs) * len(FORMATS)} files to "
              f"{os.path.relpath(OUT_DIR, os.path.dirname(HERE))}/")


if __name__ == "__main__":
    main()
