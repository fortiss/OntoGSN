# -*- coding: utf-8 -*-
"""Compare the Graffoo diagrams with the ontologies they draw.

    python development/dev_tools/graffoo_check.py            # report every difference
    python development/dev_tools/graffoo_check.py --check    # CI: exit 1 on any difference
    python development/dev_tools/graffoo_check.py -p "Modular Ext"   # one page only

development/design/Graffoo Diagram.drawio is drawn by hand, and nothing regenerates it, so
it drifts whenever a term is renamed, added or moved. This reads every page back into the
claims it makes and holds each claim against the file the page draws:

    a box or an arrow names a term          the term exists
    an arrow from A labelled P to B         P has domain A (or a superclass) and range B,
                                            or A has a restriction on P that names B
    an arrow from A labelled P to a box     A has a restriction on P, or P has a range,
                                            that names every member of the box
    an arrow labelled rdfs:subClassOf       the subclass axiom exists
    a term the page's section owns          the page names it somewhere

The diagrams follow three conventions, and the checks follow them too:

  * A term tagged gsn:inferredOnly is not drawn. The rules derive it, nobody asserts it.
  * A box may show part of a filler. "Goal supportedBy only (Goal or Solution or Strategy)"
    on the Core page is the core view of a restriction that also names gsn:Module. The
    member it leaves out must then appear on some other page of the same ontology, so the
    pages together still show the whole axiom.
  * A term is drawn on the page of the section its gsn:coreOrExtension names.

ACCEPTED lists the differences that are known and deliberate, each with its reason. An
entry that no longer matches anything is reported, so the list cannot outlive its reason.
"""
import argparse
import html
import os
import re
import sys
import xml.etree.ElementTree as ET

from rdflib import Graph, RDF, RDFS, OWL, URIRef, Literal, BNode, Namespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ttl_model as tm  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRAWIO = os.path.join(REPO, "development", "design", "Graffoo Diagram.drawio")
GSN = Namespace("https://w3id.org/OntoGSN/ontology#")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")

ONTOGSN = os.path.join(REPO, "ontology", "serializations", "ontogsn.ttl")
ALIGN = os.path.join(REPO, "alignments", "ontogsn-align.ttl")
AUGMENT = os.path.join(REPO, "augmentation", "ontogsn-augmentation.ttl")
DESIGN = os.path.join(REPO, "development", "design", "ontogsn-design.ttl")

EXTENSIONS = {"Argument Pattern Extension", "Modular Extension",
              "Confidence Argument Extension", "Dialectic Extension"}
# page -> the file it draws, the sections whose terms it must show (None: every term the
# file declares in its own namespace), and that namespace's prefix
PAGES = {
    "Core GSN": (ONTOGSN, {"Core GSN"}, "gsn"),
    "Argument Pattern Ext": (ONTOGSN, {"Argument Pattern Extension"}, "gsn"),
    "Modular Ext": (ONTOGSN, {"Modular Extension"}, "gsn"),
    "Confidence Argument Ext": (ONTOGSN, {"Confidence Argument Extension"}, "gsn"),
    "Dialectic Extension": (ONTOGSN, {"Dialectic Extension"}, "gsn"),
    "All Extensions": (ONTOGSN, EXTENSIONS, "gsn"),
    "OntoGSN-Aligned": (ALIGN, None, "gsnalign"),
    "OntoGSN-Augmented": (AUGMENT, None, "gsnaug"),
    "OntoGSN-Provenance": (DESIGN, None, "gsndesign"),
}
PREFIXES = {"gsn": str(GSN),
            "gsnalign": "https://w3id.org/OntoGSN/alignment#",
            "gsnaug": "https://w3id.org/OntoGSN/augmentation#",
            "gsndesign": "https://w3id.org/OntoGSN/design#",
            "schema": "http://schema.org/"}

# "All Extensions" is the four extension pages side by side, each moved by (dx, dy).
# Edit the four pages, then rebuild it with graffoo_edit's Diagram.compose(*ALL_EXTENSIONS).
ALL_EXTENSIONS = ("All Extensions", [("Argument Pattern Ext", -1470, -1110),
                                     ("Modular Ext", -390, 880),
                                     ("Confidence Argument Ext", 634.02, -95.5),
                                     ("Dialectic Extension", 521, 174)])


# (check, page, item) -> why the difference is accepted
ACCEPTED = {
    ("section", "Core GSN", "gsn:undeveloped"):
        "The standard puts the undeveloped decorator in Core, and the diagram follows it. "
        "ontogsn.ttl 1.3.0 tags it 'Argument Pattern Extension'. Fix the tag in the next "
        "patch release, then delete this entry.",
    ("missing", "Argument Pattern Ext", "gsn:undeveloped"): "As above: it is drawn on Core.",
    ("missing", "All Extensions", "gsn:undeveloped"): "As above: it is drawn on Core.",
    ("missing", "OntoGSN-Provenance", "gsndesign:TranslationDifference"):
        "New in design record 1.4.0. Draw it when the Provenance page is laid out again, "
        "then delete this entry.",
    ("missing", "OntoGSN-Provenance", "gsndesign:differsBy"):
        "As above: new in design record 1.4.0, not drawn yet.",
}

# Graffoo fill colours -> what a box is. The newer pages wrap them in light-dark().
BOX_KIND = {"#ffff00": "class", "#ffff99": "class-expr", "#ccffcc": "datatype",
            "#ecffec": "data-expr", "#ccffff": "note"}
KEYWORDS = {"only", "some", "value", "exactly", "min", "max"}
# an arrow labelled with one of these draws an axiom, not a property
AXIOM_PREDICATES = {
    "rdfs:subClassOf": RDFS.subClassOf, "owl:equivalentClass": OWL.equivalentClass,
    "owl:disjointWith": OWL.disjointWith, "rdfs:subPropertyOf": RDFS.subPropertyOf,
    "skos:exactMatch": SKOS.exactMatch, "skos:closeMatch": SKOS.closeMatch,
    "skos:relatedMatch": SKOS.relatedMatch, "skos:broadMatch": SKOS.broadMatch,
    "skos:narrowMatch": SKOS.narrowMatch,
}
SYMMETRIC = {"owl:equivalentClass", "owl:disjointWith", "skos:exactMatch", "skos:closeMatch",
             "skos:relatedMatch"}
STOPWORDS = KEYWORDS | {"or", "and", "not", "inverse"}


# ---------------------------------------------------------------------------- the diagram

def clean(value):
    """The visible text of a draw.io label, which may be HTML."""
    v = html.unescape(value or "")
    v = re.sub(r"<br\s*/?>|</div>|</p>", "\n", v)
    v = re.sub(r"<[^>]+>", "", v)
    v = html.unescape(v).replace("\xa0", " ")
    return re.sub(r"[ \t]+", " ", v).strip()


def flat(text):
    return " ".join(text.split())


def _style(s):
    out = {}
    for part in (s or "").split(";"):
        k, _, v = part.partition("=")
        if k:
            out[k] = v if _ else "1"
    return out


def _colour(v):
    m = re.match(r"light-dark\(([^,]+),", v or "")
    return (m.group(1) if m else (v or "")).lower() or None


def read_pages(path=DRAWIO):
    """[(page name, {cell id: mxCell})], in the order the file stores them."""
    out = []
    for d in ET.parse(path).getroot().findall("diagram"):
        cells = {}
        for el in d.iter():
            if el.tag == "mxCell":
                cells[el.get("id")] = el
            elif el.tag in ("UserObject", "object"):
                c = el.find("mxCell")
                if c is not None:
                    c.set("id", el.get("id"))
                    c.set("value", el.get("label", ""))
                    cells[el.get("id")] = c
        out.append((d.get("name"), cells))
    return out


def read_page(cells):
    """The boxes, the arrows and the names one page shows. The legend is skipped."""
    # the legend is a group: its title cell says "legend", its members share the parent
    legend = set()
    for i, c in cells.items():
        if clean(c.get("value")) == "legend":
            legend.add(i)
            if c.get("parent") not in ("0", "1"):
                legend.add(c.get("parent"))

    def in_legend(c):
        p = c.get("parent")
        while p in cells:
            if p in legend:
                return True
            p = cells[p].get("parent")
        return False

    boxes = {}
    for i, c in cells.items():
        if c.get("vertex") and not in_legend(c):
            kind = BOX_KIND.get(_colour(_style(c.get("style")).get("fillColor")))
            if kind:
                boxes[i] = (kind, flat(clean(c.get("value"))))

    # an arrow's label is its own value or a text cell parented to it
    labels = {}
    for i, c in cells.items():
        p = c.get("parent")
        if c.get("vertex") and p in cells and cells[p].get("edge"):
            labels.setdefault(p, []).append(flat(clean(c.get("value"))))

    arrows = []
    for i, c in cells.items():
        if not c.get("edge") or in_legend(c):
            continue
        st = _style(c.get("style"))
        stroke = _colour(st.get("strokeColor"))
        kind = {"#000080": "object", "#008000": "data"}.get(stroke, "subclass")
        label = " ".join(x for x in [flat(clean(c.get("value")))] + labels.get(i, []) if x)
        src, tgt = c.get("source"), c.get("target")
        if src not in boxes or tgt not in boxes:
            arrows.append({"id": i, "kind": kind, "label": label, "dangling": True,
                           "source": boxes.get(src, (None, None))[1],
                           "target": boxes.get(tgt, (None, None))[1]})
            continue
        arrows.append({"id": i, "kind": kind, "label": label, "dangling": False,
                       "source": boxes[src][1], "source_kind": boxes[src][0],
                       "target": boxes[tgt][1], "target_kind": boxes[tgt][0],
                       "target_id": tgt})

    # Arrows that leave one box, or enter one box, often share a single label drawn on
    # one of them. Which neighbour's label an unlabelled arrow carries is not recorded
    # anywhere, so it gets them all as candidates and the check tries each.
    for a in arrows:
        if not a["dangling"] and not a["label"]:
            a["candidates"] = sorted({b["label"] for b in arrows
                                      if not b["dangling"] and b["label"] and b is not a
                                      and b["kind"] == a["kind"]
                                      and (b["source"] == a["source"]
                                           or b["target_id"] == a["target_id"])})

    text = " ".join(clean(c.get("value")) for c in cells.values())
    names = set(re.findall(r"\b[a-zA-Z]+:[A-Za-z_][\w-]*", text))
    # a name the box width broke in two, such as 'gsn:toBeSupported ByContract'; only a
    # guess, so the check keeps it only when the ontology declares the joined name
    joined = {a + b for a, b in re.findall(r"\b([a-zA-Z]+:[a-z]\w*)\s+([A-Z]\w*)\b", text)}
    notes = [v for k, v in boxes.values() if k == "note"]
    return {"boxes": boxes, "arrows": arrows, "names": names, "joined": joined, "notes": notes}


def tokens(text):
    """The members a box or an expression names: local names and quoted literals."""
    lits = {m.lower() for m in re.findall(r'"([^"]*)"', text)}
    rest = re.sub(r'"[^"]*"', " ", text)
    words = {w.split(":")[-1] for w in re.findall(r"[A-Za-z_][\w:-]*", rest)}
    return lits | {w for w in words if w.lower() not in STOPWORDS}


def keyword(text):
    """The restriction keyword a box opens with. A box without one draws a range."""
    m = re.match(r"[\s(]*([a-z]+)\b", text)
    return m.group(1) if m and m.group(1) in KEYWORDS else None


def local(name):
    return name.split(":")[-1]


# --------------------------------------------------------------------------- the ontology

class Ontology:
    def __init__(self, *paths):
        g = Graph()
        for p in paths:
            g.parse(p, format="turtle")
        for k, v in PREFIXES.items():
            g.bind(k, v, override=True, replace=True)
        self.g = g
        self.terms, self.section, self.inferred = {}, {}, set()
        for t, k in ((OWL.Class, "class"), (OWL.ObjectProperty, "object property"),
                     (OWL.DatatypeProperty, "data property"),
                     (OWL.AnnotationProperty, "annotation property"),
                     (OWL.NamedIndividual, "individual")):
            for s in g.subjects(RDF.type, t):
                if isinstance(s, URIRef):
                    self.terms[self.qn(s)] = k
        for s, o in g.subject_objects(GSN.coreOrExtension):
            if isinstance(s, URIRef):
                self.section[self.qn(s)] = str(o)
        for s, o in g.subject_objects(GSN.inferredOnly):
            if isinstance(o, Literal) and o.toPython() is True:
                self.inferred.add(self.qn(s))
        self.sub = {(self.qn(s), self.qn(o)) for s, o in g.subject_objects(RDFS.subClassOf)
                    if isinstance(s, URIRef) and isinstance(o, URIRef)}
        # class -> [(property local name or None, keyword or None, member tokens)]
        self.restr = {}
        for pred in (RDFS.subClassOf, OWL.equivalentClass):
            for s, o in g.subject_objects(pred):
                if isinstance(s, URIRef) and isinstance(o, BNode):
                    self.restr.setdefault(self.qn(s), []).extend(self._expr(o))
        self.dom = {self.qn(s): self._members(o) for s, o in g.subject_objects(RDFS.domain)}
        self.rng = {self.qn(s): self._members(o) for s, o in g.subject_objects(RDFS.range)}

    def qn(self, t):
        try:
            p, _, local = self.g.namespace_manager.compute_qname(str(t))
            return f"{p}:{local}"
        except (ValueError, KeyError):
            return str(t)

    def _members(self, o):
        if isinstance(o, URIRef):
            return {tm.ln(o)}
        return tokens(tm.render_expr(self.g, o))

    def _expr(self, node):
        """A class expression as (property, keyword, members). An intersection of
        restrictions is split, because a diagram draws each part as its own arrow."""
        inter = self.g.value(node, OWL.intersectionOf)
        if inter is not None:
            parts = tm.rdf_list(self.g, inter)
            if all(self.g.value(p, OWL.onProperty) is not None for p in parts):
                return [x for p in parts for x in self._expr(p)]
        text = tm.render_expr(self.g, node)
        m = tm.RESTRICTION_RE.match(text)
        if m and self.g.value(node, OWL.onProperty) is not None:
            return [(m.group(1), m.group(2), tokens(m.group(3)))]
        return [(None, None, tokens(text))]

    def has_axiom(self, src, pred, tkind, tgt):
        """Is 'src pred tgt' asserted, where tgt is a named class or a drawn expression?"""
        want = {local(tgt)} if tkind in ("class", "datatype") else tokens(tgt)
        p = AXIOM_PREDICATES[pred]
        pairs = [(src, tgt)] + ([(tgt, src)] if pred in SYMMETRIC else [])
        for a, b in pairs:
            if ":" not in a:
                continue
            for o in self.g.objects(URIRef(self.g.namespace_manager.expand_curie(a)), p):
                have = {tm.ln(o)} if isinstance(o, URIRef) else tokens(tm.render_expr(self.g, o))
                if (want if a == src else {local(src)}) == have:
                    return True
        return False

    def ancestors(self, c):
        out, todo = {c}, [c]
        while todo:
            x = todo.pop()
            for a, b in self.sub:
                if a == x and b not in out:
                    out.add(b)
                    todo.append(b)
        return out


# ------------------------------------------------------------------------------ the checks

def check_page(name, page, onto, own_terms):
    """Every difference between one page and its ontology, as (check, item, detail)."""
    _, sections, prefix = PAGES[name]
    rows = []
    names = set(page["names"]) | {n for n in page["joined"] if n in onto.terms}
    # a note may list terms by local name only, under a heading that names the class
    for note in page["notes"]:
        for w in re.findall(r"\b[a-z]\w+\b", note):
            if f"{prefix}:{w}" in onto.terms:
                names.add(f"{prefix}:{w}")

    for t, kind in sorted(own_terms.items()):
        if sections is not None and onto.section.get(t) not in sections:
            continue
        if t in onto.inferred or t in names:
            continue
        rows.append(("missing", t, f"{kind} the page does not show"))

    for t in sorted(names):
        p = t.split(":")[0]
        if p not in PREFIXES or p == "schema":
            continue
        if t not in onto.terms:
            # a name rejoined from a line break is a guess; keep it only if it resolves
            if not any(n.startswith(t) and n != t and n in onto.terms for n in names):
                rows.append(("unknown", t, "the ontology declares no such term"))
            continue
        if t in onto.inferred:
            rows.append(("inferred", t, "inferred-only terms are not drawn"))
        sec = onto.section.get(t)
        if sections is not None and sec and t.startswith("gsn:"):
            if name == "Core GSN" and sec != "Core GSN":
                rows.append(("section", t, f"drawn on Core, tagged '{sec}'"))

    pending = []
    for a in page["arrows"]:
        a["resolved"] = []
        if a["dangling"]:
            if a["label"] or a["source"] or a["target"]:
                rows.append(("dangling", a["label"] or "(no label)",
                             f"arrow from {a['source']} to {a['target']} is not attached"))
            continue
        src, tgt, label = a["source"], a["target"], a["label"]
        if label in AXIOM_PREDICATES or (a["kind"] == "subclass" and label == ""):
            pred = label or "rdfs:subClassOf"
            if pred == "rdfs:subClassOf" and a["target_kind"] == "class":
                if not ((src, tgt) in onto.sub
                        or (tgt == "owl:Thing" and not any(x == src for x, _ in onto.sub))):
                    have = sorted(b for x, b in onto.sub if x == src) or ["owl:Thing"]
                    rows.append(("subclass", f"{src} subClassOf {tgt}",
                                 "ontology: " + ", ".join(have)))
            elif not onto.has_axiom(src, pred, a["target_kind"], tgt):
                rows.append(("axiom", f"{src} {pred} {tgt}", "the ontology has no such axiom"))
            continue
        if a["kind"] == "subclass":
            if label.split(":")[0] in ("owl", "rdfs", "skos"):
                rows.append(("unknown", label, f"arrow from {src} to {tgt}: not an axiom predicate"))
            continue
        if label:
            for prop in (p.replace(" ", "") for p in label.split("||")):
                found = _check_arrow(onto, src, prop, a["target_kind"], tgt)
                rows.extend(found)
                if not found:
                    a["resolved"].append(prop)
        else:
            pending.append(a)

    # An unlabelled arrow takes the label of a neighbour: an arrow of the same kind that
    # leaves the same box or enters the same box. A neighbour may itself have taken its
    # label that way, so this repeats until nothing changes.
    def candidates(a):
        out = []
        for b in page["arrows"]:
            if b is a or b["dangling"] or b["kind"] != a["kind"]:
                continue
            if b["source"] == a["source"] or b["target_id"] == a["target_id"]:
                props = b["resolved"] or [p.replace(" ", "") for p in b["label"].split("||") if p]
                out.extend(p for p in props if p not in out)
        return out

    changed = True
    while changed:
        changed = False
        for a in pending:
            if a["resolved"]:
                continue
            for prop in candidates(a):
                if not _check_arrow(onto, a["source"], prop, a["target_kind"], a["target"]):
                    a["resolved"].append(prop)
                    changed = True
                    break
    for a in pending:
        if not a["resolved"] and candidates(a):
            rows.append(("unlabelled", f"{a['source']} -> {a['target']}",
                         "no neighbouring label fits: " + ", ".join(candidates(a))))
    return rows


def _check_arrow(onto, src, prop, tkind, tgt):
    name = local(prop)
    # PROV terms are used, never redeclared; the Provenance page says so in a note
    if prop not in onto.terms and not prop.startswith("prov:"):
        return [("unknown", prop, f"arrow from {src} to {tgt}")]
    is_expr = src.lstrip().startswith(("(", "{"))
    src_ok = tokens(src) if is_expr else {local(x) for x in onto.ancestors(src)}
    dom, rng = onto.dom.get(prop), onto.rng.get(prop)
    want = {local(tgt)} if tkind in ("class", "datatype") else tokens(tgt)
    kw = None if tkind in ("class", "datatype") else keyword(tgt)
    for p, k, members in onto.restr.get(src, []):
        if p in (name, None) and want <= members and (kw is None or k in (kw, None)):
            return []
    if kw is None:
        dom_ok = dom is None or (src_ok <= dom if is_expr else bool(dom & src_ok))
        rng_ok = rng is None or want <= rng or tgt == "owl:Thing"
        if dom_ok and rng_ok:
            return []
        return [("domain/range", f"{prop}: {src} -> {tgt}",
                 f"ontology: {' or '.join(sorted(dom or [])) or '(none)'} -> "
                 f"{' or '.join(sorted(rng or [])) or '(none)'}")]
    have = [f"{k} {' or '.join(sorted(m))}" for p, k, m in onto.restr.get(src, []) if p == name]
    return [("restriction", f"{src} {prop} {tgt}",
             "ontology: " + (" | ".join(have) or "(none on this property)"))]


def check_coverage(group, onto):
    """A box may show part of a filler, but the pages together must show all of it."""
    drawn = {}
    for _, page in group:
        for a in page["arrows"]:
            if a["dangling"] or a["kind"] == "subclass":
                continue
            for prop in a.get("resolved", []):
                key = (a["source"], local(prop))
                want = ({local(a["target"])} if a["target_kind"] in ("class", "datatype")
                        else tokens(a["target"]))
                drawn.setdefault(key, set()).update(want)
    rows = []
    for (src, prop), seen in sorted(drawn.items()):
        for p, k, members in onto.restr.get(src, []):
            if p == prop and members & seen and not members <= seen:
                rows.append(("partial", f"{src} {prop} {k}",
                             "no page shows " + ", ".join(sorted(members - seen))))
    return rows


def check_composition(pages):
    """All Extensions must show exactly what the four extension pages show."""
    pages = dict(pages)
    target, parts = ALL_EXTENSIONS

    def drawn(cells):
        p = read_page(cells)
        arrows = [(a["kind"], a["label"], a["source"], a["target"]) for a in p["arrows"]]
        return sorted(arrows, key=str), sorted(v for _, v in p["boxes"].values())
    if target not in pages or any(n not in pages for n, _, _ in parts):
        return []
    whole = drawn(pages[target])
    pieces = [drawn(pages[n]) for n, _, _ in parts]
    joined = (sorted((a for p in pieces for a in p[0]), key=str),
              sorted(b for p in pieces for b in p[1]))
    if whole == joined:
        return []
    return [(target, "composition", "differs from the four extension pages",
             "rebuild it: graffoo_edit.py --compose")]


def run(only=None):
    pages = read_pages()
    known = [n for n, _ in pages]
    rows = []
    for name in PAGES:
        if name not in known:
            rows.append(("page", name, "the drawio file has no page of this name"))
    full = Ontology(ONTOGSN)
    groups = {}
    for name, cells in pages:
        if name not in PAGES:
            rows.append(("page", name, "no ontology is mapped to this page"))
            continue
        if only and name not in only:
            continue
        path, _, prefix = PAGES[name]
        onto = full if path == ONTOGSN else Ontology(path, ONTOGSN)
        own = Ontology(path) if path != ONTOGSN else full
        own_terms = {t: k for t, k in own.terms.items() if t.startswith(prefix + ":")}
        page = read_page(cells)
        rows.extend((name,) + r for r in check_page(name, page, onto, own_terms))
        groups.setdefault(path, (onto, []))[1].append((name, page))
    for path, (onto, group) in groups.items():
        label = group[0][0] if len(group) == 1 else os.path.basename(path)
        rows.extend((label,) + r for r in check_coverage(group, onto))

    rows.extend(check_composition(pages))

    accepted_hit = set()
    out = []
    for r in rows:
        key = (r[1], r[0], r[2])
        if key in ACCEPTED:
            accepted_hit.add(key)
        else:
            out.append(r)
    if not only:
        for key in ACCEPTED:
            if key not in accepted_hit:
                out.append((key[1], "stale exception", key[2],
                            "ACCEPTED lists a difference the diagram no longer has"))
    return out, accepted_hit


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="exit 1 on any difference")
    ap.add_argument("-p", "--page", action="append", help="check only this page (repeatable)")
    args = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    rows, accepted = run(args.page)
    for page in dict.fromkeys(r[0] for r in rows):
        print(f"\n{page}")
        for _, check, item, detail in (r for r in rows if r[0] == page):
            print(f"  {check:<14} {item}\n  {'':<14} {detail}")
    print(f"\n{len(rows)} difference(s); {len(accepted)} accepted, listed in ACCEPTED")
    if args.check and rows:
        sys.exit(1)


if __name__ == "__main__":
    main()
