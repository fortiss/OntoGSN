# OntoGSN Provenance

The record of **why** OntoGSN says what it says: which passage of the GSN Community
Standard v3 each axiom came from, what was decided, the reasoning, and what the axiom said
at the time. PROV-O is the backbone; `gsnprov:` adds only the terms PROV-O has no room for.

| File | Role |
| :--- | :--- |
| `ontogsn-provenance.ttl` | the vocabulary. Hand-written. |
| `ontogsn-provenance-data.ttl` | the record — 937 decisions, 297 passages, 194 rationales, 747 statements. **Source of truth**, edited by hand. |
| `ontogsn-provenance-augmentations.ttl` | requirements, competency questions, stored queries, build chains. **Generated**, rebuilt by `tools/prov_augment.py`. |
| `Design Documentation.xlsx` | a human-readable view of the record. **Generated**, never read back. |
| `Competency Questions.xlsx` | the questions `queries/` answers. Hand-maintained; read by `tools/prov_augment.py`. |
| `Graffoo Diagram.drawio` | the editable source of the diagrams on the website. Hand-maintained. |

`ontogsn.ttl` does **not** `owl:imports` any of this. It would drag roughly two thousand
provenance individuals into the ABox of every reasoner run over an assurance case.

## How an axiom is identified

Two roles are kept apart, because conflating them is what broke the earlier attempts.

| Role | Mechanism |
| :--- | :--- |
| **Identity** — which axiom a record is *about*, across re-saves | `gsnprov:structuralKey`: the blank-node-free `(subject, predicate, object)` key from `tools/ttl_model.py` and `tools/shapes_model.py` |
| **Evidence** — what it said when the decision was taken | `gsnprov:statementText` + `gsnprov:statementChecksum` (`sha1[:8]`) |

Verbatim text cannot be identity. Whitespace, operand order and blank-node ids
(`_:genid83`) all change on re-save, and a namespace move once invalidated every record in
the design document. Structural keys survive all three. This is why neither RDF-star nor
`owl:Axiom` reification is used — see `tools/README.md` for the full argument.

`gsnprov:aboutTerm` and `gsnprov:mentionsTerm` are a third, weaker thing: direct IRI links
into the ontology, so the two graphs can be joined in SPARQL. They name a **term**, never a
triple, so they are one-to-many and cannot distinguish two statements about the same
subject. They are a convenience for finding candidates, not the identity mechanism. Treat a
mismatch as a hint to look, never as evidence of drift.

## How a stored query reaches the ontology

The 94 stored queries are `gsnprov:Query`, carry `gsnprov:formalism gsnprov:SPARQL`, and
hold their own text verbatim in `gsnprov:queryText` — the counterpart of
`gsnprov:statementText`, and evidence in the same way. Identity is `gsnprov:path`; change
is detected by `gsnprov:fileChecksum`.

Two links tie a query back to the ontology, and they are deliberately different strengths.

| Link | Strength | Coverage |
| :--- | :--- | :--- |
| `gsnprov:translatesStatement` | exact — this query *is* that axiom, re-expressed | the 51 rule queries, joined on the rule's name |
| `gsnprov:restsOnStatement` | derived — the axiom declaring a term the query names | 93 of 94 queries, 105 distinct axioms |

Both point at a `gsnprov:StatementRecord`, so one further hop reaches the design decision,
its rationale and the passage of the standard. That is the chain the queries were missing:

```sparql
# Which passage of the standard is this SPARQL update ultimately carrying out?
SELECT ?file ?rule ?clause WHERE {
    ?q a gsnprov:Query ; rdfs:label ?file ; gsnprov:translatesStatement ?st .
    ?st gsnprov:ruleName ?rule ; prov:wasGeneratedBy/prov:used/gsnprov:clause ?clause .
}
```

`restsOnStatement` is the *declaring* axiom only — `Goal a Class`, not every restriction
ever written about goals. Linking a query to all of those would produce a few thousand
edges that say nothing. One query, `delete_element_and_its_links.rq`, rests on nothing: it
names no `gsn:` term at all, deleting by identifier instead, which is a real property of
that query rather than a gap in the record.

SPARQL sits in `gsnprov:Formalism` alongside OWL, SWRL, SHACL and RDF, but it is the odd
one out: the others say what an axiom is written in, this one says what a *question about a
case* is written in. A query therefore has no source passage and generates no statement of
its own. That is also why `gsnprov:formalism` carries no `rdfs:domain` — it applies to both
a decision and a query, and asserting either as the domain would make a reasoner type the
other as it.

## Why a decision is an Activity

`gsnprov:DesignDecision ⊑ prov:Activity`, not `prov:Entity`. It `prov:used` the passages it
rested on and `prov:generated` the statement it produced — so a decision to represent
**nothing** is still well-formed: it simply generated nothing. 116 of the 937 decisions are
of that kind, and PROV-O has no notion of an entity that deliberately does not exist.

That also makes the decision the natural home for the rationale, because the decision *is*
the mapping between a passage and the axiom it produced. The mapping is reachable as a node
from either end:

```turtle
gsnprov:st-0110
    prov:wasDerivedFrom gsnprov:src-0043 ;
    prov:qualifiedDerivation [ a prov:Derivation ;
        prov:entity gsnprov:src-0043 ;
        prov:hadActivity gsnprov:dd-0110 ] .
```

From a statement, follow the derivation to the activity; from a passage, follow the
decisions that used it. One hop either way reaches `gsnprov:hasRationale`.

## The deliberate `(none)`

`gsnprov:noSourceRecorded` and `gsnprov:noRationaleRecorded` distinguish *"checked, there
is none"* from *"nobody has looked yet"*, which is the absence of both the flag and the
value. The design document conflated the two — 137 cells said `(none)` and 347 were blank
for the same meaning — and the distinction is worth keeping.

## Running it

```bash
python tools/prov_check.py                # what has drifted
python tools/prov_check.py --strict       # exit 1 if anything needs a human
python tools/prov_augment.py              # rebuild the augmentations
python tools/prov_to_workbook.py          # rebuild Design Documentation.xlsx
```

The record began life as a hand-maintained spreadsheet, `OntoGSN Design Document.xlsx`,
and was imported once by `tools/prov_migrate.py`. Both are gone: the graph is the source of
truth now, and `Design Documentation.xlsx` is generated *from* it rather than into it. The
import is in the history if it is ever needed again (`git log -- tools/prov_migrate.py`),
but re-running it against an edited spreadsheet would renumber the deduplicated passages
and rationales and orphan every reference made since.

## Asking it things

```sparql
PREFIX gsnprov: <https://w3id.org/OntoGSN/provenance#>
PREFIX prov:    <http://www.w3.org/ns/prov#>
PREFIX gsn:     <https://w3id.org/OntoGSN/ontology#>

# Why does the ontology say anything at all about gsn:Solution?
SELECT ?clause ?passage ?why WHERE {
    ?statement gsnprov:mentionsTerm gsn:Solution ;
               prov:wasGeneratedBy ?decision .
    ?decision  prov:used ?src ; gsnprov:hasRationale ?rationale .
    ?src       gsnprov:clause ?clause ; gsnprov:quotedText ?passage .
    ?rationale gsnprov:rationaleText ?why .
}
```

```sparql
# What did we decide NOT to model, and why?
SELECT ?key ?why WHERE {
    ?decision gsnprov:formalism gsnprov:NoFormalism ;
              gsnprov:positionKey ?key ;
              gsnprov:hasRationale/gsnprov:rationaleText ?why .
}
```

```sparql
# Which passages of the standard carry the most weight?
SELECT ?clause (COUNT(?decision) AS ?axioms) WHERE {
    ?decision prov:used ?src . ?src gsnprov:clause ?clause .
} GROUP BY ?clause ORDER BY DESC(?axioms)
```

## Namespaces

| Prefix | Namespace |
| :----- | :-------- |
| `gsnprov:` | `https://w3id.org/OntoGSN/provenance#` |
| `gsn:` | `https://w3id.org/OntoGSN/ontology#` |
| `gsnsh:` | `https://w3id.org/OntoGSN/shapes#` |
| `prov:` | `http://www.w3.org/ns/prov#` |
