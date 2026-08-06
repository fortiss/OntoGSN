# -*- coding: utf-8 -*-
"""Recast a generated sentence as history, for rows retired to the Archive sheet.

An archived row describes something the ontology no longer has, so the present tense
would assert something untrue. Rules keep their timeless IF/THEN form.
"""
import re

RULES = [
    (r"^Every (.+?) is ", r"Every \1 was "),
    (r"\bis defined as\b", "was defined as"),
    (r"\bis labelled\b", "was labelled"),
    (r"\bis also known as\b", "was also known as"),
    (r"\bis described as\b", "was described as"),
    (r"\bis recorded as\b", "was recorded as"),
    (r"\bis drawn as\b", "was drawn as"),
    (r"\bis marked\b", "was marked"),
    (r"\bbelongs to\b", "belonged to"),
    (r"\bNothing can\b", "Nothing could"),
    (r"\bcan only\b", "could only"),
    (r"\bcan be\b", "could be"),
    (r"\bcan have\b", "could have"),
    (r"\bcan (challenge|contain|refer|support)\b", r"could \1"),
    (r"\bmust have\b", "had to have"),
    (r"\bmust contain\b", "had to contain"),
    (r"\bmust be\b", "had to be"),
    (r"\bmust\b", "had to"),
    (r"^The ontology's (.+?) is\b", r"The ontology's \1 was"),
]


def past(sentence):
    """-> the same sentence in the past tense, or unchanged if no rule applies."""
    if not sentence or sentence.startswith("IF ") or sentence.strip() == "(none)":
        return sentence
    for pattern, repl in RULES:
        out = re.sub(pattern, repl, sentence, count=1)
        if out != sentence:
            return out
    return sentence
