# -*- coding: utf-8 -*-
"""Render an ontology statement as an English sentence.

    gsn:challenges rdfs:domain [ (Goal or Solution) ]  ->  "Only a goal or a solution can challenge something."

Used to fill the workbook's *Item in Natural Language* column. The text is stored, not
regenerated on every write, so wording can be improved by hand; re-run this module for
rows you add.
"""
import re

import ttl_model

VOWELS = "aeiouAEIOU"
NUMBER_WORD = {"0": "no", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five"}


def _cap(text):
    """Capitalise the first letter only - 'a GSN element' must not become 'A gsn element'."""
    return text[:1].upper() + text[1:] if text else text

CLASS_NOUN = {
    "Argument": "argument", "Artefact": "artefact",
    "ArtefactReference": "artefact reference", "Assumption": "assumption",
    "AssuranceCase": "assurance case", "Catalogue": "catalogue", "Context": "context",
    "Defeater": "defeater", "GSNElement": "GSN element", "Goal": "goal",
    "InstantiationDataReference": "instantiation data reference",
    "Justification": "justification", "Module": "module", "Pattern": "pattern",
    "Relationship": "relationship",
    "RelationshipWithConfidence": "relationship with confidence",
    "Solution": "solution", "Statement": "statement", "Strategy": "strategy",
    "Template": "template", "View": "view",
}

# active phrase, used for both domain and range sentences
OBJ_PHRASE = {
    "supportedBy": "be supported by", "inContextOf": "be in the context of",
    "challenges": "challenge", "contains": "contain", "refersTo": "refer to",
    "consistentWith": "be consistent with", "substitutedBy": "be substituted by",
    "associatedWith": "be associated with", "attachedTo": "be attached to",
    "instantiationOf": "be an instantiation of", "relatedTo": "be related to",
    "subject": "have as its subject", "predicate": "have as its predicate",
    "object": "have as its object",
}

# data properties that record a value rather than raise a flag
VALUE_NOUN = {
    "identifier": "an identifier", "statement": "a statement", "description": "a description",
    "argumentType": "an argument type", "relationshipType": "a relationship type",
    "viewType": "a view type", "minCardinality": "a minimum cardinality",
    "maxCardinality": "a maximum cardinality",
}

DATATYPE_WORDS = {
    "boolean": "true or false", "string": "text", "nonNegativeInteger":
    "a whole number of zero or more", "integer": "a whole number", "anyURI": "a web address",
    "date": "a date", "dateTime": "a date and time", "decimal": "a decimal number",
    "Literal": "a literal value",
}

TYPE_WORDS = {
    "Class": "a class", "ObjectProperty": "a relationship between elements",
    "DatatypeProperty": "a data property", "AnnotationProperty": "an annotation",
    "Datatype": "a datatype", "Ontology": "an ontology", "Statement": "a statement",
}

ANNOTATION_SENTENCE = {
    "label": "{S} is labelled “{v}”.",
    "definition": "{S} is defined as: “{v}”",
    "altLabel": "{S} is also known as “{v}”.",
    "note": "Note on {S}: “{v}”",
    "comment": "Comment on {S}: “{v}”",
    "coreOrExtension": "{S} belongs to {v}.",
    "description": "{S} is described as: “{v}”",
}


# Axioms the templates cannot say well. Written by hand; keep the key in step with
# ttl_model's rendering or the override silently stops applying (check_coverage warns).
OVERRIDES = {
    ("(Goal and not inverse supportedBy some Goal)", "EquivalentTo", 'top value "true"'):
        "A goal is marked as a top goal exactly when it supports no other goal.",
}


def _literal(value):
    """'"true"' -> 'true';  '"confidence"' -> '“confidence”'"""
    v = value.strip().strip('"')
    return v if v in ("true", "false") or v.isdigit() else f"“{v}”"


def _a(word):
    return ("an " if word[:1] in VOWELS else "a ") + word


def _noun(name):
    return CLASS_NOUN.get(name, name)


def _label(labels, name):
    return labels.get(name, re.sub(r"(?<!^)(?=[A-Z])", " ", name).lower())


def _join(parts, conj):
    parts = list(parts)
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + f" {conj} " + parts[-1]


def _third_person(act):
    """'be supported by' -> 'is supported by';  'contain' -> 'contains'."""
    head, _, rest = act.partition(" ")
    if head == "be":
        return "is" + ((" " + rest) if rest else "")
    if head == "have":
        return "has" + ((" " + rest) if rest else "")
    return head + "s" + ((" " + rest) if rest else "")


def qualifier(expr, labels):
    """A restriction used *inside* a class expression reads as a qualifying phrase:
    'contains some Goal' -> 'that contains at least one goal'."""
    neg = ""
    if expr.startswith("not "):
        neg, expr = "not ", expr[4:].strip()
    m = re.match(r"^(inverse )?(\w+) (only|some|value|exactly|min|max) (.+)$", expr)
    if not m:
        return None
    inv, prop, kw, filler = m.groups()
    label = _label(labels, prop)
    if inv:                       # an inverse property reverses who plays which role
        act = OBJ_PHRASE.get(prop, f"be ‘{label}’ of")
        active = re.sub(r"^be ", "", act)
        filler_noun = phrase_expr(filler, labels, False)
        if neg:
            return f"that does not {active} any {filler_noun}"
        return f"that {_third_person(active)} at least one {filler_noun}"
    if prop in OBJ_PHRASE:
        verb = _third_person(OBJ_PHRASE[prop])
        if neg:
            return f"that is not {re.sub(r'^is ', '', verb)} any {phrase_expr(filler, labels, False)}"
        if kw == "some":
            return f"that {verb} at least one {phrase_expr(filler, labels, False)}"
        if kw == "only":
            return f"that can only {OBJ_PHRASE[prop]} {phrase_expr(filler, labels)}"
        if kw == "value":
            return f"whose ‘{label}’ is {_literal(filler)}"
        n, _, rest = filler.partition(" ")
        word = {"exactly": "exactly", "min": "at least", "max": "at most"}[kw]
        return f"that {verb} {word} {NUMBER_WORD.get(n, n)} {phrase_expr(rest, labels, False)}"
    noun = VALUE_NOUN.get(prop)
    if kw == "value":
        return f"whose ‘{label}’ is {_literal(filler)}"
    if noun:
        return f"that has {noun}"
    return f"that is marked as ‘{label}’"


def _split_top(text, op):
    """Split on `op` only at bracket depth zero."""
    parts, depth, start = [], 0, 0
    i = 0
    while i < len(text):
        depth += (text[i] == "(") - (text[i] == ")")
        if depth == 0 and text.startswith(op, i):
            parts.append(text[start:i])
            i += len(op)
            start = i
            continue
        i += 1
    parts.append(text[start:])
    return [p.strip() for p in parts if p.strip()]


def _wrapped(expr):
    """True when the outer brackets enclose the whole expression."""
    if not (expr.startswith("(") and expr.endswith(")")):
        return False
    depth = 0
    for i, ch in enumerate(expr):
        depth += (ch == "(") - (ch == ")")
        if depth == 0 and i < len(expr) - 1:
            return False
    return True


def _intersection(parts, labels, article):
    """'Argument and argumentType value "confidence"' reads as a noun plus qualifiers,
    not as a list joined by 'and'."""
    named = [p for p in parts if qualifier(p, labels) is None]
    quals = [qualifier(p, labels) for p in parts if qualifier(p, labels) is not None]
    head = _join([phrase_expr(p, labels, article) for p in named], "and") if named \
        else ("something" if quals else "")
    if not quals:
        return head
    tidy = [quals[0]] + [re.sub(r"^that ", "", q) for q in quals[1:]]
    return f"{head} {_join(tidy, 'and')}".strip()


def phrase_expr(expr, labels, article=True):
    """'(Goal or Solution)' -> 'a goal or a solution'"""
    expr = expr.strip()
    if _wrapped(expr):
        inner = expr[1:-1]
        alts = _split_top(inner, " or ")
        if len(alts) > 1:
            return _join([phrase_expr(p, labels, article) for p in alts], "or")
        conj = _split_top(inner, " and ")
        if len(conj) > 1:
            return _intersection(conj, labels, article)
        expr = inner
    if expr.startswith("{") and expr.endswith("}"):
        return "one of " + _join([v.strip().strip('"') for v in expr[1:-1].split(",")], "or")

    q = qualifier(expr, labels)
    if q:                                    # a nested restriction
        return q
    if expr in DATATYPE_WORDS:
        return DATATYPE_WORDS[expr]
    expr = re.sub(r"^(?:xsd|gsn|rdfs|rdf|owl|skos|schema):", "", expr.strip("'\""))
    if expr in DATATYPE_WORDS:
        return DATATYPE_WORDS[expr]
    if expr and expr[:1].islower():
        return f"‘{_label(labels, expr)}’"      # a property name, not a class
    noun = _noun(expr)
    return _a(noun) if article else noun


def restriction_clause(subject_noun, prop, kw, filler, labels):
    obj = phrase_expr(filler, labels)
    if prop in OBJ_PHRASE:
        act = OBJ_PHRASE[prop]
        if kw == "only":
            return f"{subject_noun} can only {act} {obj}"
        if kw == "some":
            return f"{subject_noun} must {act} at least one {phrase_expr(filler, labels, False)}"
        if kw in ("exactly", "min", "max"):
            n, _, rest = filler.partition(" ")
            word = {"exactly": "exactly", "min": "at least", "max": "at most"}[kw]
            tail = phrase_expr(rest, labels, False) if rest else "of them"
            return f"{subject_noun} must {act} {word} {NUMBER_WORD.get(n, n)} {tail}"
        if kw == "value":
            return f"{subject_noun} must {act} {obj}"
    noun = VALUE_NOUN.get(prop)
    label = _label(labels, prop)
    if kw in ("exactly", "min", "max"):
        n, _, rest = filler.partition(" ")
        word = {"exactly": "exactly", "min": "at least", "max": "at most"}[kw]
        thing = noun or f"a value for ‘{label}’"
        thing = re.sub(r"^an? ", "", thing)
        return f"{subject_noun} must have {word} {NUMBER_WORD.get(n, n)} {thing}"
    if kw == "value":
        return f"{subject_noun} is marked ‘{label}’ = {_literal(filler)}"
    if noun:
        verb = "can only have" if kw == "only" else "must have"
        detail = phrase_expr(filler, labels, False)
        tail = "" if filler.strip() in DATATYPE_WORDS else f" ({detail})"
        return f"{subject_noun} {verb} {noun}{tail}"
    verb = "is" if kw == "some" else "can only be"
    return f"{subject_noun} {verb} marked as ‘{label}’ ({phrase_expr(filler, labels, False)})"


def sentence(key, labels):
    """(subject, predicate, object) from ttl_model -> an English sentence."""
    if tuple(key) in OVERRIDES:
        return OVERRIDES[tuple(key)]
    s, p, o = key
    o = o.strip()
    if len(o) > 1 and o[0] in "\"“" and o[-1] in "\"”":
        o = o[1:-1].strip()                  # the value already carried its own quotes

    if s.startswith("<") and s.endswith(">"):        # an annotation on another axiom
        inner = s[1:-1].split(" ", 2)
        rule = sentence(tuple(inner), labels).rstrip(".") if len(inner) == 3 else s
        if p == "coreOrExtension":
            return f"The rule “{rule}” belongs to {o}."
        return f"Explanation of the rule “{rule}”: “{o}”"
    subj_label = labels.get(s, s)
    S = f"‘{subj_label}’" if s and s[:1].islower() else _noun(s).capitalize() \
        if s in CLASS_NOUN else s

    if p == "a":
        if o in ("AsymmetricProperty", "IrreflexiveProperty", "SymmetricProperty"):
            act = OBJ_PHRASE.get(s, f"be ‘{subj_label}’ of")
            if o == "IrreflexiveProperty":
                return f"Nothing can {act} itself."
            if o == "AsymmetricProperty":
                return (f"If one element can {act} another, the reverse cannot also be true.")
            return f"If one element can {act} another, the reverse is also true."
        return f"{S} is defined as {TYPE_WORDS.get(o, _a(o))}."

    restr = re.match(r"^(only|some|value|exactly|min|max) (.+)$", o)
    if restr and p not in ("domain", "range", "subClassOf", "EquivalentTo"):
        who = _a(_noun(s)) if s in CLASS_NOUN else S
        return restriction_clause(_cap(who), p, restr.group(1), restr.group(2),
                                  labels).rstrip(".") + "."

    if s == "ontology":                      # the owl:Ontology node itself
        return f"The ontology's {_label(labels, p)} is “{o}”."

    if p in ANNOTATION_SENTENCE:
        if p == "coreOrExtension":
            return f"{S} belongs to {o}."
        return ANNOTATION_SENTENCE[p].format(S=S, v=o)
    if p == "renderedAs":
        who = _a(_noun(s)) if s in CLASS_NOUN else S
        shape = o if re.match(r"^(an?|the) ", o) else _a(o)
        return f"{_cap(who)} is drawn as {shape}."
    if p == "subClassOf":
        body = phrase_expr(o, labels)
        if body.startswith(("that ", "whose ", "marked ")):
            return f"Every {_noun(s)} is something {body[body.index(' ') + 1:]}."                 if body.startswith("that ") else f"Every {_noun(s)} is something {body}."
        return f"Every {_noun(s)} is {body}."
    if p == "EquivalentTo":
        return f"Something is {_a(_noun(s))} exactly when it is {phrase_expr(o, labels)}."
    if p == "disjointWith":
        return f"Nothing can be both {_a(_noun(s))} and {phrase_expr(o, labels)}."
    if p == "propertyDisjointWith":
        return (f"Nothing can be both ‘{subj_label}’ and ‘{_label(labels, o)}’.")
    if p == "domain":
        act = OBJ_PHRASE.get(s)
        if act:
            return f"Only {phrase_expr(o, labels)} can {act} something."
        noun = VALUE_NOUN.get(s)
        what = f"have {noun}" if noun else f"be marked as ‘{subj_label}’"
        return f"Only {phrase_expr(o, labels)} can {what}."
    if p == "range":
        act = OBJ_PHRASE.get(s)
        if act:
            return f"Something can only {act} {phrase_expr(o, labels)}."
        noun = VALUE_NOUN.get(s)
        val = DATATYPE_WORDS.get(o) or phrase_expr(o, labels)
        if noun:
            return f"{_cap(noun)} is recorded as {val}."
        return f"‘{subj_label}’ is recorded as {val}."
    if s.startswith("("):                       # a general class axiom
        return f"Anything that is {phrase_expr(s, labels)} is exactly {phrase_expr(o, labels)}."

    # a restriction, e.g. ('Goal', 'supportedBy', 'only (Goal or Strategy)')
    m = re.match(r"^(only|some|value|exactly|min|max) (.+)$", o)
    if m:
        who = _a(_noun(s)) if s in CLASS_NOUN else S
        return restriction_clause(_cap(who), p, m.group(1), m.group(2), labels).rstrip(".") + "."
    return f"{S}: {p} {o}."


def labels_of(graph):
    return {r["key"][0]: r["key"][2] for r in ttl_model.statements(graph)
            if r["key"][1] == "label"}


def rule_sentence(dl, labels):
    """SWRL in DL syntax -> 'IF … THEN …', matching the style of OntoGSN SWRL Rules.xlsx."""
    def atom(text):
        m = re.match(r"^([\w:]+)\((.+)\)$", text.strip())
        if not m:
            return text.strip()
        name = m.group(1).split(":")[-1]
        args = [a.strip().lstrip("?") for a in m.group(2).split(",")]
        label = _label(labels, name)
        if len(args) == 1:
            return f"{args[0]} is {_a(_noun(name))}"
        x, y = args[0], args[1]
        if name == "notEqual":
            return f"{x} is not the same as {y}"
        if name == "equal":
            return f"{x} is the same as {y}"
        if name == "makeOWLThing":
            return f"a new {y} is created for {x}"
        if y in ("true", "false"):
            return f"{x} is{'' if y == 'true' else ' NOT'} {label}"
        if name in OBJ_PHRASE:
            return f"{x} {_third_person(OBJ_PHRASE[name])} {y}"
        if name in ("subject", "predicate", "object"):
            return f"{x} has {name} {y}"
        return f"{x} has {label} {y}"

    body, _, head = dl.partition("->")
    b = " AND ".join(atom(a) for a in body.split("^") if a.strip())
    h = " AND ".join(atom(a) for a in head.split("^") if a.strip())
    return f"IF {b} THEN {h}"
