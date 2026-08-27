#!/usr/bin/env python3
"""Regenerate ontogsn-shapes_0_full.ttl from the five per-section shape modules.

The per-section files are the source of truth; the full file is a plain
concatenation of their shapes with a single ontology header. Run this after
editing any module:

    python shapes/build_full.py
"""

import argparse
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

MODULES = [
    ("ontogsn-shapes_1_core.ttl", "Core GSN"),
    ("ontogsn-shapes_2_pattern.ttl", "Argument Pattern Extension"),
    ("ontogsn-shapes_3_modular.ttl", "Modular Extension"),
    ("ontogsn-shapes_4_confidence.ttl", "Confidence Argument Extension"),
    ("ontogsn-shapes_5_dialectic.ttl", "Dialectic Extension"),
]

OUT = "ontogsn-shapes_0_full.ttl"

HEADER = '''@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix gsn:    <https://w3id.org/OntoGSN/ontology#> .
@prefix gsnsh:  <https://w3id.org/OntoGSN/shapes#> .
@prefix dc:     <http://purl.org/dc/elements/1.1/> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
@base <https://w3id.org/OntoGSN/shapes> .

# ###########################################################################
# GENERATED FILE - DO NOT EDIT BY HAND.
# Regenerate with:  python shapes/build_full.py
# Edit the per-section modules instead:
#   ontogsn-shapes_1_core.ttl        Core GSN
#   ontogsn-shapes_2_pattern.ttl     Argument Pattern Extension
#   ontogsn-shapes_3_modular.ttl     Modular Extension
#   ontogsn-shapes_4_confidence.ttl  Confidence Argument Extension
#   ontogsn-shapes_5_dialectic.ttl   Dialectic Extension
# ###########################################################################

<https://w3id.org/OntoGSN/shapes> rdf:type owl:Ontology ;
    dc:title "OntoGSN SHACL Shapes"@en ;
    dc:description "SHACL shapes for validating assurance-case data expressed with the OntoGSN ontology (https://w3id.org/OntoGSN/ontology). Every shape is annotated with gsn:coreOrExtension, so the graph can be sliced back into its GSN Community Standard v3 sections."@en ;
    dc:source "https://w3id.org/OntoGSN/ontology" ;
    owl:versionInfo "{version}" ;
    owl:imports <https://w3id.org/OntoGSN/shapes/core> ,
                <https://w3id.org/OntoGSN/shapes/pattern> ,
                <https://w3id.org/OntoGSN/shapes/modular> ,
                <https://w3id.org/OntoGSN/shapes/confidence> ,
                <https://w3id.org/OntoGSN/shapes/dialectic> .

# The sections whose shapes are inlined below. Slice the graph on
# gsn:coreOrExtension to recover any one of them.
<https://w3id.org/OntoGSN/shapes/core>
    rdf:type owl:Ontology ; dc:title "OntoGSN SHACL Shapes - Core GSN"@en ;
    gsn:coreOrExtension "Core GSN"@en .
<https://w3id.org/OntoGSN/shapes/pattern>
    rdf:type owl:Ontology ; dc:title "OntoGSN SHACL Shapes - Argument Pattern Extension"@en ;
    gsn:coreOrExtension "Argument Pattern Extension"@en .
<https://w3id.org/OntoGSN/shapes/modular>
    rdf:type owl:Ontology ; dc:title "OntoGSN SHACL Shapes - Modular Extension"@en ;
    gsn:coreOrExtension "Modular Extension"@en .
<https://w3id.org/OntoGSN/shapes/confidence>
    rdf:type owl:Ontology ; dc:title "OntoGSN SHACL Shapes - Confidence Argument Extension"@en ;
    gsn:coreOrExtension "Confidence Argument Extension"@en .
<https://w3id.org/OntoGSN/shapes/dialectic>
    rdf:type owl:Ontology ; dc:title "OntoGSN SHACL Shapes - Dialectic Extension"@en ;
    gsn:coreOrExtension "Dialectic Extension"@en .
'''


def version():
    """The version the five section files agree on.

    Kept out of the header template: hardcoded here it drifts from the sources it is
    generated from, which is the one thing this script exists to prevent.
    """
    found = set()
    for filename, _ in MODULES:
        text = io.open(os.path.join(HERE, filename), encoding="utf-8").read()
        match = re.search(r'owl:versionInfo\s+"([^"]+)"', text)
        if not match:
            sys.exit("{} declares no owl:versionInfo".format(filename))
        found.add(match.group(1))
    if len(found) > 1:
        sys.exit("the section files disagree on owl:versionInfo: {}".format(
            ", ".join(sorted(found))))
    return found.pop()


def body(path):
    """Everything after the module's own @prefix / @base / ontology header."""
    text = io.open(path, encoding="utf-8").read()
    marker = "#################################################################"
    idx = text.index(marker)
    return text[idx:].rstrip() + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="verify the generated file is current; write nothing")
    args = ap.parse_args()

    parts = [HEADER.format(version=version())]
    for filename, section in MODULES:
        parts.append(
            "\n\n"
            "# ###########################################################################\n"
            "# {}\n"
            "# from {}\n"
            "# ###########################################################################\n\n".format(section, filename)
        )
        parts.append(body(os.path.join(HERE, filename)))

    out_path = os.path.join(HERE, OUT)
    text = "".join(parts)

    current = None
    if os.path.exists(out_path):
        current = io.open(out_path, encoding="utf-8").read()
    if current == text:
        print("{} is current".format(OUT))
        return
    # without this the one derived file with no --check could drift from its five
    # sources unnoticed, which is exactly what happened to the separated serializations
    if args.check:
        sys.exit("{} is out of date - run python shapes/build_full.py".format(OUT))

    io.open(out_path, "w", encoding="utf-8", newline="\n").write(text)
    print("wrote {}".format(out_path))


if __name__ == "__main__":
    main()
