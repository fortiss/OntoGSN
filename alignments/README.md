# OntoGSN Alignments

Mappings from OntoGSN to other argument ontologies. Currently one: the Arguments Ontology
(ArgO/ARGO, NCOR), which is BFO-based and models arguments as such rather than as a notation.

This is a **nominal alignment**. It states the correspondence, records why each half of it holds
or fails, and mints nothing. The gain for OntoGSN is marginal and known to be so; the value is in
having a defensible answer rather than repeating the analysis each time it is asked for.

| File | Role |
| :--- | :--- |
| `gsnalign.ttl` | the alignment. Hand-written. 3 bridge classes, 8 bridge properties, 2 direct assertions, 4 documentation axioms. |
| `gsnalign-provenance.ttl` | why each axiom exists, and why the rejected correspondences are absent. 27 decisions, 17 cited passages, 20 rationales. |
| `vendor/argo.ttl` | ARGO, byte-identical to upstream. **Never edit.** |
| `catalog-v001.xml` | maps ARGO's unresolvable base IRI to the vendored copy for OWLAPI-based tools. |

The full analysis behind all of it — including the correspondences that look right and are not —
is in `NOTES-argo.md` at the repository root.

## Why axioms about `gsn:` terms live here

Two of the axioms have a `gsn:` term as their subject:

```turtle
gsn:supportedBy rdfs:subPropertyOf argo:isSupportedBy .
gsn:challenges  rdfs:subPropertyOf argo:opposes .
```

They are asserted in this graph and never in `serializations/ontogsn.ttl`. OntoGSN is a faithful
rendering of the GSN Community Standard v3 and is the source of truth for it; a claim about ARGO
is not a claim the standard makes. Keeping them here also means a GSN-only consumer never pulls
BFO and CCO into its closure — nothing in the repository imports this directory.

## The three layers

| Layer | What | Entails |
| :--- | :--- | :--- |
| **1 — direct assertion** | The two sub-property axioms above | Nothing. Both ARGO properties are label-only: no domain, no range, no characteristics, and **zero occurrences** in `ARGO Axioms REVISED.txt`. They exist to be extended |
| **2 — documentation** | Three `skos:*Match` axioms plus one `owl:disjointWith` | Nothing, by construction. SKOS mapping properties do not entail. The disjointness is already entailed by BFO and is asserted only as a warning |
| **3 — bridge** | `InferenceStep`, `CaseArgument`, `ElementContent` and eight properties | This is where the work happens |

Layer 3 exists because of one fact: **a GSN inference step has no individual.** It is an implicit
fan-in — a parent goal and whatever supports it — so there is nothing for ARGO's premise and
conclusion relations to attach to. `gsnalign:InferenceStep` is that missing individual, minted one
per parent goal rather than one per relationship, because a relationship is a single edge and a
step with three supporting goals needs one thing holding three premises.

Two minting rules are worth knowing before reading the file:

- `CaseArgument` is minted **per top goal**, not per `gsn:Argument`. ARGO requires exactly one
  conclusion and GSN permits several top goals; anchoring on the top goal satisfies the
  cardinality by construction. A structure with two top goals yields two complex arguments, each
  concluding one of them and omitting the other. They may overlap where the subtrees share
  elements, which ARGO permits.
- `ElementContent` is minted **per distinct statement string**, not per element. GSN away elements
  repeat a claim from another module as a separate individual; ARGO sentence contents are
  identical across bearers. Keying on the string is what makes the two agree.

## Versioning

An alignment is only valid against the versions it was written for. Both are recorded on the
ontology header and both are load-bearing:

```turtle
owl:versionInfo                 "0.1.0" ;
gsnalign:alignedOntoGSNVersion  "1.2.3" ;
gsnalign:alignedARGOVersion     "ArgO v.4 development release; git 59dd512f58cf, 2025-12-03" ;
```

ARGO is a development release and OntoGSN is pre-1.3, so either can move a term underneath this
graph without warning. **Re-check the alignment whenever either string changes.** The limitations
below are scoped to these two versions and may not survive them.

`gsnalign-provenance.ttl` additionally carries `gsnprov:fileChecksum` for all three graphs, so
drift is detectable without reading them.

## The vendored copy

ARGO declares its base as `http://www.github/argumentsontology/`, which is not a resolvable host,
so `owl:imports` cannot be followed over the network. The file is therefore vendored.

| | |
| :--- | :--- |
| Source | `NCOR-Organization/Argument-Ontology`, `Ontology/argo.ttl` |
| Commit | `59dd512f58cf` (2025-12-03) |
| Git blob | `340166f4372ca7277243347351dfccf132b79a47` — verify with `git hash-object vendor/argo.ttl` |
| Modified | No. Byte-identical, so a diff against a later release is meaningful |

Only `argo.ttl` is vendored. BFO 2020 core comes from a stable OBO PURL, and CCO's
`Information Content Entity` is declared inline in `argo.ttl` itself, so ARGO's own
`imports/ice.ttl` is redundant here.

One IRI trap, which is why `gsnalign.ttl` declares two ARGO prefixes: `complexargument` is minted
at `http://www.github/argumentsontology#complexargument` — a **hash** IRI — while every other term
uses the slash base. Writing `argo:complexargument` produces a different, undefined term and no
error.

## Loading it

```bash
python -c "import rdflib; g=rdflib.Graph(); g.parse('alignments/gsnalign.ttl'); print(len(g))"
```

`rdflib` ignores `owl:imports`, so this parses the alignment alone — enough to inspect the TBox.
For reasoning, load `gsnalign.ttl` in a tool that honours `catalog-v001.xml` (Protégé, ROBOT, the
OWL API), which will resolve ARGO to the vendored file. Nothing in this repository does that
automatically; there is no build step here.

## What is deliberately absent

Each of these is a decision with a recorded rationale in `gsnalign-provenance.ttl`, not an
oversight. `dd-0019` through `dd-0027` are the decisions that produced nothing.

| Absent | Why |
| :--- | :--- |
| **The derivation rules** | The nine rules that would populate the bridge classes are specified in `NOTES-argo.md` §7 and not implemented. Without them this is a TBox only. Settling how a two-hop fan-in through a strategy collapses with a one-hop fan-in is better done against a fixture than guessed |
| **Any mapping for `gsn:Solution`** | The standard says a solution makes no claim and is a noun phrase; an ARGO premise must be *affirmed*, which a noun phrase cannot be. Bridging would mean inventing a claim the author never wrote. **Consequence: a step supported only by evidence carries no ARGO premises**, so an ARGO query for the premises of a case returns claims and never evidence. Not an inconsistency — ARGO's requirement is existential — but the sharpest limitation at this version |
| **Occurrent individuals** | ARGO's requirements are `∃` restrictions, so asserting that something is an argument entails a creation act exists without needing one named. Four nodes per step to satisfy something already satisfied |
| **Any mapping for `gsn:true` / `valid` / `defeated` / `inDoubt`** | ARGO argues against truth values on information entities and recommends an evaluation *process* instead. There is no ARGO term to map onto |
| **`gsn:Argument ⊑ argo:argument`** | Collides silently with ARGO's exactly-one-conclusion restriction. `gsnalign:CaseArgument` replaces it |
| **SHACL shapes** | Not written |

## Namespaces

| Prefix | Namespace |
| :----- | :-------- |
| `gsnalign:` | `https://w3id.org/OntoGSN/alignment#` |
| `gsnalignprov:` | `https://w3id.org/OntoGSN/alignment/provenance#` |
| `gsn:` | `https://w3id.org/OntoGSN/ontology#` |
| `gsnprov:` | `https://w3id.org/OntoGSN/provenance#` |
| `argo:` | `http://www.github/argumentsontology/` |
| `argoh:` | `http://www.github/argumentsontology#` — for `complexargument` only |

## Asking it things

The record reuses the `gsnprov:` vocabulary, so the SPARQL in `provenance/README.md` works here
unchanged.

```sparql
PREFIX gsnalignprov: <https://w3id.org/OntoGSN/alignment/provenance#>
PREFIX gsnprov:      <https://w3id.org/OntoGSN/provenance#>
PREFIX prov:         <http://www.w3.org/ns/prov#>

# Which correspondences were considered and rejected, and why?
SELECT ?what ?why WHERE {
    ?d gsnprov:formalism gsnprov:NoFormalism ;
       gsnprov:naturalLanguage ?what ;
       gsnprov:hasRationale/gsnprov:rationaleText ?why .
}
```

```sparql
# What does this axiom rest on in ARGO, verbatim?
SELECT ?axiom ?passage ?where WHERE {
    ?st gsnprov:statementText ?axiom ;
        prov:wasGeneratedBy/prov:used ?src .
    ?src gsnalignprov:passageText ?passage ;
         gsnalignprov:locator ?where .
}
```
