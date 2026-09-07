# -*- coding: utf-8 -*-
"""Emit Turtle deterministically.

rdflib's Turtle writer orders subjects and predicates by store order, so an unchanged
graph serializes differently on every run - the same problem serializations/build.py
solves for the derived formats. This module writes the provenance data file instead,
sorting everything, so a re-run produces a byte-identical file and git shows only real
changes.
"""
import re

PREFIXES = [
    ("gsnprov", "https://w3id.org/OntoGSN/provenance#"),
    ("gsn", "https://w3id.org/OntoGSN/ontology#"),
    ("gsnsh", "https://w3id.org/OntoGSN/shapes#"),
    ("prov", "http://www.w3.org/ns/prov#"),
    ("dc", "http://purl.org/dc/elements/1.1/"),
    ("owl", "http://www.w3.org/2002/07/owl#"),
    ("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    ("rdfs", "http://www.w3.org/2000/01/rdf-schema#"),
    ("skos", "http://www.w3.org/2004/02/skos/core#"),
    ("xsd", "http://www.w3.org/2001/XMLSchema#"),
    # gsnprov:aboutTerm may name any term the ontology declares, so every prefix
    # ttl_model.qname() can produce has to be bound here too
    ("terms", "http://purl.org/dc/terms/"),
    ("schema", "http://schema.org/"),
    ("swrl", "http://www.w3.org/2003/11/swrl#"),
    ("swrla", "http://swrl.stanford.edu/ontologies/3.3/swrla.owl#"),
    ("vann", "http://purl.org/vocab/vann/"),
    ("cc", "http://creativecommons.org/ns#"),
    ("sh", "http://www.w3.org/ns/shacl#"),
]

# a bare name may follow a prefix only if Turtle would read it back as one token
PNAME_LOCAL = re.compile(r"^[A-Za-z_][A-Za-z0-9_.\-]*$")


class Lit(str):
    """A literal, distinguished from an IRI by type rather than by inspecting the text."""
    def __new__(cls, value, datatype=None, lang=None):
        self = super().__new__(cls, value)
        self.datatype, self.lang = datatype, lang
        return self


def escape(text):
    return (text.replace("\\", "\\\\").replace('"', '\\"')
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t"))


def literal(lit):
    """Multi-line prose stays readable as a long string; everything else is escaped.

    The long form is only safe when the text cannot terminate it early or introduce an
    escape of its own, so it is used only where those characters are absent.
    """
    text = str(lit)
    if ("\n" in text and '"""' not in text and "\\" not in text
            and not text.endswith('"')):
        body = '"""' + text + '"""'
    else:
        body = '"' + escape(text) + '"'
    if lit.lang:
        return body + "@" + lit.lang
    if lit.datatype:
        return body + "^^" + lit.datatype
    return body


def term(value):
    if isinstance(value, Lit):
        return literal(value)
    if value.startswith("<") or ":" not in value:
        return value
    prefix, _, local = value.partition(":")
    if any(prefix == p for p, _ in PREFIXES) and PNAME_LOCAL.match(local):
        return value
    return value                      # already a qname the caller vouched for


def header(title, note=""):
    line = "#" * 65
    out = f"\n{line}\n#    {title}\n"
    if note:
        out += "".join(f"#    {l}\n" for l in note.split("\n"))
    return out + line + "\n\n"


def write(path, blocks, preamble=""):
    """blocks: [(subject, [(predicate, [objects])])], emitted in the order given."""
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        for prefix, uri in PREFIXES:
            fh.write(f"@prefix {prefix}: <{uri}> .\n")
        fh.write("\n")
        if preamble:
            fh.write(preamble)
        for item in blocks:
            if isinstance(item, str):                      # a section banner
                fh.write(item)
                continue
            subject, pairs = item
            pairs = [(p, list(o)) for p, o in pairs if o]
            if not pairs:
                continue
            fh.write(term(subject))
            for i, (predicate, objects) in enumerate(pairs):
                joined = " ,\n" + " " * 8
                fh.write(f"\n    {predicate} " +
                         joined.join(term(o) for o in objects))
                fh.write(" ;" if i < len(pairs) - 1 else " .")
            fh.write("\n\n")
