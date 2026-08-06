# -*- coding: utf-8 -*-
"""Map each design-document row onto a statement in serializations/ontogsn.ttl.

The document's "Simplified Item in Ontology" column is an informal Manchester-like
shorthand ('Goal inContextOf only (Assumption or Context)'). This module parses it
into a (subject, predicate, object) key, normalizes both sides identically, and
matches. Rule rows are matched via the "Item in GSN Ontology" column instead, which
holds SWRL in DL syntax and lines up with the rule structure in the graph.

Every status other than EXACT/RULE/TRUNCATED is a review signal, not a failure.
"""
import hashlib
import re

import shapes_model
import ttl_model

# --- statuses -----------------------------------------------------------------
EXACT = "exact"
EXACT_RULE = "exact-rule"
TRUNCATED = "literal-truncated"
EQUIV_EXPR = "expression-equivalent"
RULE_FUZZY = "rule-near-match"
VALUE_CHANGED = "value-changed"
UNMATCHED = "unmatched"
UNMATCHED_RULE = "unmatched-rule"
NO_AXIOM = "no-axiom-decision"
NO_AXIOM_PREFIX = "no-axiom-prefix"
NO_LINK = "no-statement-recorded"
NL_STALE = "nl-stale"
REMOVED = "removed-from-ontology"
ARCHIVED_LIVE = "archived-still-resolves"

# the owl:Ontology node; its metadata is not a design decision (decision D7)
ONTOLOGY_NODE = "ontology"

MATCHED = {EXACT, EXACT_RULE, TRUNCATED, EQUIV_EXPR, RULE_FUZZY, VALUE_CHANGED}
NEEDS_REVIEW = {VALUE_CHANGED, UNMATCHED, UNMATCHED_RULE, RULE_FUZZY, NO_LINK, NL_STALE}

E_COL = "Item in Natural Language"
TTL_COL = "Item in OntoGSN TTL"
NO_STATEMENT = ("(none)", "n/a", "")   # this row records a decision, not an axiom

QUOTES = dict.fromkeys(map(ord, "“”„‟"), '"')
QUOTES.update(dict.fromkeys(map(ord, "‘’‚‛"), "'"))
PREFIXES = r"(?:xsd|gsn|rdfs|rdf|owl|skos|schema|dc|terms|vann|swrl|swrlb|swrlx|swrla|cc)"
RESTR_KW = ("only", "some", "exactly", "min", "max", "value")

ANNOT = {"label", "definition", "altlabel", "note", "coreorextension", "renderedas",
         "description", "comment", "preflabel", "abstract", "citation", "creator",
         "title", "identifier", "source", "publisher", "disclaimer", "license",
         "url", "version", "versioninfo", "modified", "created", "issued",
         "contributor", "preferrednamespaceprefix", "bibliographiccitation", "coreorgsn"}
PRED_ALIAS = {"type": "a", "coreorgsn": "coreorextension", "abstract": "description",
              "citation": "bibliographiccitation"}


# --- normalization (one implementation, used for BOTH sides) ------------------
def norm(s):
    s = (s or "").translate(QUOTES).replace("\xa0", " ").replace("…", "...")
    return re.sub(r"\s+", " ", s).strip()


def nlit(s):
    s = norm(s).strip("\"'").strip()
    return re.sub(r"\s*\.\.\.\s*$", "", s).strip("\"'").strip().lower()


def nexpr(s):
    s = re.sub(rf"\b{PREFIXES}:", "", norm(s))
    s = s.replace("'", "").replace('"', "").replace("_", "")
    s = re.sub(r"\s+", " ", s).strip()

    def sort_group(m):
        inner = m.group(1)
        for op in (" or ", " and "):
            if op in inner:
                return "(" + op.join(sorted(x.strip() for x in inner.split(op))) + ")"
        return "(" + inner + ")"
    for _ in range(4):
        nxt = re.sub(r"\(([^()]*)\)", sort_group, s)
        if nxt == s:
            break
        s = nxt
    return s.lower()


def flat(expr):
    """Bracketing/order-insensitive form, for the fallback tier only."""
    s = re.sub(r"\s+", " ", re.sub(r"[()]", " ", expr or "")).strip()
    for op in (" and ", " or "):
        if op in s:
            return op.join(sorted(x.strip() for x in s.split(op) if x.strip()))
    return s


def nobj(pred, obj):
    o = norm(obj)
    head = o.split()[0].lower() if o.split() else ""
    if head in RESTR_KW or o.startswith("("):      # a restriction is never a literal
        return nexpr(obj)
    return nlit(obj) if pred.lower() in ANNOT else nexpr(obj)


def npred(p):
    p = re.sub(rf"^{PREFIXES}:", "", norm(p).lower())
    return PRED_ALIAS.get(p, p)


def nsubj(s):
    s = norm(s)
    if s.startswith("<") and s.endswith(">"):
        inner = despace_names(s[1:-1])
        toks = inner.split()
        if len(toks) >= 2 and toks[1].startswith("("):        # implicit subClassOf
            inner = f"{toks[0]} subClassOf {' '.join(toks[1:])}"
        return nexpr(f"<{inner}>")
    return "ontology" if s == "gsn" else nexpr(s)


# --- parsing the shorthand ----------------------------------------------------
def despace_names(t):
    """'assurance claim point' -> assuranceclaimpoint, so a quoted multi-word property
    name tokenizes as one word. Never touches the inside of a "double-quoted literal",
    where single quotes are content (e.g. renderedAs "cross ('X') superimposed ...")."""
    return "".join(
        part if part.startswith('"')
        else re.sub(r"'([^']+)'", lambda m: m.group(1).replace(" ", ""), part)
        for part in re.split(r'("[^"]*")', t))


def parse_rendering(text):
    t = norm(text)
    if not t or t.lower() in NO_STATEMENT:
        return None
    m = re.match(r"^<(.+?)>\s+(\S+)\s+(.*)$", t)              # axiom annotation
    if m:
        return (f"<{m.group(1)}>", m.group(2), m.group(3))
    t = despace_names(t)
    # a general class axiom leads with a parenthesised expression as its subject
    if t.startswith("("):
        depth = 0
        for i, ch in enumerate(t):
            depth += (ch == "(") - (ch == ")")
            if depth == 0:
                rest = t[i + 1:].split()
                return (t[:i + 1], rest[0], " ".join(rest[1:])) if rest else None
    toks = t.split()
    if len(toks) < 2:
        return None
    if toks[1].startswith("(") or toks[1].lower() == "not":    # bare class expression
        return (toks[0], "subClassOf", " ".join(toks[1:]))
    return (toks[0], toks[1], " ".join(toks[2:]))


def doc_key(parsed):
    if not parsed:
        return None
    s, p, o = parsed
    return (nsubj(s), npred(p), nobj(p, o))


def norm_rule(text):
    t = re.sub(rf"\b{PREFIXES}:", "", norm(text)).replace(" ", "").lower()
    if "->" not in t:
        return None
    body, head = t.split("->", 1)
    return (frozenset(x for x in body.split("^") if x),
            frozenset(x for x in head.split("^") if x))


# --- the matcher --------------------------------------------------------------
def language_of(row):
    """Which formalism the row's statement is written in.

    Everything in this project is RDF, so the useful distinction is the language layered
    on top of it: OWL axioms, SWRL rules, SHACL shapes.
    """
    ttl = (row.get(TTL_COL) or "").strip()
    text = norm(row.get(E_COL, ""))
    if ttl.startswith("gsnsh:"):
        return "SHACL"
    if ttl.startswith("# ") or "->" in ttl:
        return "SWRL"
    if ttl:
        return "OWL"
    # Retired rows have no Turtle left, so the sentence is the only evidence of what
    # they were written in.
    if text.startswith("IF "):
        return "SWRL"
    if re.match(r"^(Base )?[Pp]refix", text):
        return "RDF"                       # a namespace declaration, not an axiom
    if text.lower() in NO_STATEMENT:
        return "(none)"                    # a deliberate decision to model nothing
    return "OWL"


def checksum(ttl):
    """Short fingerprint of the axiom a sentence was written for."""
    return hashlib.sha1((ttl or "").encode("utf-8")).hexdigest()[:8] if ttl else ""


def file_checksum(path):
    """SHA-256 of a text file's content, with line endings normalised.

    Hashing the raw bytes makes the value depend on how git checked the file out: the
    same commit hashes one way on Windows (CRLF) and another on Linux (LF), so a checksum
    recorded on one platform reports the file as edited in place on the other. CI caught
    exactly that on its first run. Normalising makes this a fingerprint of the content,
    which is what it was always meant to be.
    """
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read().replace(b"\r\n", b"\n")).hexdigest()


def match_rows(rows, statements, rules):
    """Verify each row's recorded ttl_statement against the ontology.

    The natural-language column is prose, so the *link* to the ontology is the stored
    Turtle: a row is correct when that statement is still present. Where it is not, we
    look for one with the same subject and predicate to say what it probably became.
    """
    pool = {}
    for st in statements:
        pool.setdefault(st["ttl"], []).append(st)
    for r in rules:
        prefix = "# " + r["label"] + "\n" if r["label"] else ""
        pool.setdefault(prefix + r["dl"], []).append(r)

    by_sp = {}
    for st in statements:
        head = " ".join(st["ttl"].split()[:2])
        by_sp.setdefault(head, []).append(st)

    used, out = set(), []
    for row in rows:
        rec = dict(row)
        archived = bool(row.get("_archived") or row.get("struck_through"))
        ttl = (row.get(TTL_COL) or "").strip()
        nl_text = norm(row.get(E_COL, ""))

        def finish(status):
            # a retired row whose axiom has since changed or gone is simply retired;
            # it should not ask for attention every time the ontology moves on
            rec["match_status"] = REMOVED if (archived and status in
                                              (UNMATCHED, UNMATCHED_RULE, VALUE_CHANGED))                 else status
            out.append(rec)

        if not ttl:
            if nl_text.lower() in NO_STATEMENT:
                finish(NO_AXIOM)
            elif re.match(r"^(Base )?[Pp]refix", nl_text):
                finish(NO_AXIOM_PREFIX)
            elif archived:
                # a retired row describes something the ontology no longer has, so
                # having nothing to point at is the expected outcome
                finish(REMOVED)
            else:
                finish(NO_LINK)
            continue

        candidates = pool.get(ttl)
        if candidates:
            hit = next((c for c in candidates if id(c) not in used), candidates[0])
            used.add(id(hit))
            stale = row.get("nl_checksum") and row["nl_checksum"] != checksum(ttl)
            if archived:
                finish(ARCHIVED_LIVE)
            elif stale:
                finish(NL_STALE)
            else:
                finish(EXACT_RULE if ttl.startswith("# ") else EXACT)
            continue

        head = " ".join(ttl.split()[:2])
        rec["suggested"] = "; ".join(c["ttl"] for c in by_sp.get(head, [])[:2])
        finish(UNMATCHED_RULE if ttl.startswith("# ") else
               (VALUE_CHANGED if rec["suggested"] else UNMATCHED))

    orphans = {"statements": [st for st in statements if id(st) not in used
                              and nsubj(st["key"][0]) != ONTOLOGY_NODE],
               "rules": [r for r in rules if id(r) not in used]}
    return out, orphans


def load_and_match(rows, ttl_path=None):
    """The workbook documents both the ontology and the SHACL shapes derived from it,
    so a row may point at either graph."""
    _, statements, rules = ttl_model.inventory(ttl_path)
    _, shapes = shapes_model.inventory()
    return match_rows(rows, statements + shapes, rules)
