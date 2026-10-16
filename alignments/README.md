# OntoGSN Alignments

This folder holds mappings from OntoGSN to other argument ontologies. At present there is one.
It maps OntoGSN to the Arguments Ontology (ArgO/ARGO) from NCOR. ARGO is built on BFO and
models arguments themselves, not a notation for them.

The mapping is a nominal alignment. A nominal alignment states a correspondence between two
ontologies and changes neither. It records why each half of the correspondence holds or fails.
It creates no individuals. The gain for OntoGSN is small, and that is known. The value is a
defensible answer to a question that is asked often, so that nobody repeats the analysis.

| File | Role |
| :--- | :--- |
| `ontogsn-align.ttl` | The alignment. Hand-written. 3 bridge classes, 8 bridge properties, 2 direct assertions, 4 documentation axioms. |
| `ontogsn-align-design.ttl` | The record. It says why each axiom exists and why the rejected correspondences are absent. 27 decisions, 17 cited passages, 20 rationales. |
| `vendor/argo.ttl` | ARGO, byte for byte the same as upstream. Do not edit it. |
| `catalog-v001.xml` | Maps the base IRI of ARGO, which does not resolve, to the local copy. Tools built on the OWL API read it. |

The record holds the full analysis, including the correspondences that look right and are not.
This file holds what the record does not: the terms, the derivation rules, the pairs that share
a word, and a defect found in ARGO.

Three sources were read for ARGO. The first is `argo.ttl`. The second is its first-order
axiomatization in `Axioms/ARGO Axioms REVISED.txt` (401 lines, Prover9 syntax, not copied
here). The third is the paper "ARGO: Arguments Ontology" (Beverley, Otte, Franda, Guillon,
Donohue, Ruttenberg, Schreiber). Line references of the form `argo.ttl:NNN` point into the
copy in `vendor/`.

## Terms

The record and this file use seven terms from the ARGO side. This table defines them.

| Term | Meaning |
| :--- | :--- |
| BFO | Basic Formal Ontology, the upper ontology that ARGO imports. It splits everything into continuants and occurrents |
| Continuant | A thing that persists through time and is wholly present at each moment. A goal, a document, a claim |
| Occurrent | A thing that happens and has temporal parts. A process, an act. Disjoint from continuant |
| ICE | Information Content Entity. Information that is about something. ARGO's sentence content, statement and argument are all ICEs. ARGO takes the class from CCO, the Common Core Ontologies, and declares it inline |
| Sentence content | ARGO's most general content class: what a meaningful sentence means. It covers declaratives, imperatives and questions |
| Statement | ARGO's narrower subclass: the meaning of a declarative sentence. It can be true or false, which logicians call a proposition |
| TBox | The class and property level of an ontology, as opposed to its individuals |

ARGO has 16 classes, 22 object properties, no datatype properties and no rules. OntoGSN has 20
classes, 12 object properties, 24 datatype properties and 53 SWRL rules. The missing datatype
properties are the shortest statement of the gap. ARGO stores no truth values and no flags as
data.

## Why axioms about `gsn:` terms live here

Two of the axioms have a `gsn:` term as their subject:

```turtle
gsn:supportedBy rdfs:subPropertyOf argo:isSupportedBy .
gsn:challenges  rdfs:subPropertyOf argo:opposes .
```

The alignment graph asserts them. The file `serializations/ontogsn.ttl` never does. OntoGSN is
a faithful rendering of the GSN Community Standard v3 and is the source of truth for it. A
claim about ARGO is not a claim that the standard makes. There is a second reason. A consumer
that uses only GSN never loads BFO and CCO, because nothing in the repository imports this
folder.

## The three layers

| Layer | What | Entails |
| :--- | :--- | :--- |
| 1, direct assertion | The two sub-property axioms above | Nothing. Both ARGO properties carry only a label. They have no domain, no range and no characteristics, and they appear zero times in `ARGO Axioms REVISED.txt`. They exist to be extended |
| 2, documentation | Three `skos:*Match` axioms plus one `owl:disjointWith` | Nothing, by construction. SKOS mapping properties do not entail. BFO already entails the disjointness. The alignment asserts it only as a warning |
| 3, bridge | `InferenceStep`, `CaseArgument`, `ElementContent` and eight properties | This layer does the work |

Layer 3 exists because of one fact: a GSN inference step has no individual. The step is an
implicit fan-in, that is, a parent goal and whatever supports it. ARGO's premise and conclusion
relations therefore have nothing to attach to. `gsnalign:InferenceStep` is that missing
individual. The alignment mints it, that is, creates one new individual, per parent goal and
not per relationship. A relationship is a single edge, and a step with three supporting goals
needs one thing that holds three premises.

Two more minting rules help before you read the file.

| Class | Minted per | Why |
| :--- | :--- | :--- |
| `CaseArgument` | top goal, not `gsn:Argument` | ARGO requires exactly one conclusion, and GSN permits several top goals. Anchoring on the top goal satisfies the cardinality by construction. A structure with two top goals yields two complex arguments. Each concludes one top goal and omits the other. The two can overlap where the subtrees share elements, and ARGO permits that |
| `ElementContent` | distinct statement string, not element | A GSN away element repeats a claim from another module as a separate individual. ARGO sentence contents are identical across bearers. Keying on the string makes the two agree |

## Versioning

An alignment is valid only against the versions it was written for. The ontology header records
both versions, and both matter:

```turtle
owl:versionInfo                 "0.1.0" ;
gsnalign:alignedOntoGSNVersion  "1.2.3" ;
gsnalign:alignedARGOVersion     "ArgO v.4 development release; git 59dd512f58cf, 2025-12-03" ;
```

ARGO is a development release, and OntoGSN is before 1.3. Either can move a term under this
graph without warning. If either string changes, review the alignment again. The limitations
below apply to these two versions and can stop applying after them.

`ontogsn-align-design.ttl` also carries `gsndesign:fileChecksum` for all three graphs. Drift
is therefore detectable without reading the graphs.

## The local copy of ARGO

ARGO declares its base IRI as `http://www.github/argumentsontology/`. That host does not
resolve, so `owl:imports` cannot fetch the file over the network. The file is therefore
vendored, that is, copied into this repository.

| | |
| :--- | :--- |
| Source | `NCOR-Organization/Argument-Ontology`, `Ontology/argo.ttl` |
| Commit | `59dd512f58cf` (2025-12-03) |
| Git blob | `340166f4372ca7277243347351dfccf132b79a47`. To make sure that the copy is unchanged, run `git hash-object vendor/argo.ttl` and compare |
| Modified | No. The copy is byte for byte the same, so a diff against a later release is meaningful |

Only `argo.ttl` is copied. BFO 2020 core comes from a stable OBO PURL. ARGO declares CCO's
`Information Content Entity` inline in `argo.ttl`, so ARGO's own `imports/ice.ttl` is not
needed here.

One IRI trap explains why `ontogsn-align.ttl` declares two ARGO prefixes. ARGO mints
`complexargument` at `http://www.github/argumentsontology#complexargument`, a hash IRI. Every
other term uses the slash base. If you write `argo:complexargument`, you get a different,
undefined term and no error.

## Loading it

To parse the alignment on its own, run:

```bash
python -c "import rdflib; g=rdflib.Graph(); g.parse('alignments/ontogsn-align.ttl'); print(len(g))"
```

`rdflib` ignores `owl:imports`, so this parses the alignment alone. That is enough to inspect
the TBox. For reasoning, load `ontogsn-align.ttl` in a tool that reads `catalog-v001.xml`, such
as Protégé, ROBOT or the OWL API. The tool then resolves ARGO to the local file. Nothing in this
repository does that automatically. There is no build step here.

## The derivation rules

The bridge classes are empty until something mints their individuals. Nine rules do that. All
nine derive from what a case already asserts, so they add no authoring work. They are specified
here and not implemented (`dd-0027`). In the table, "support" means any `gsn:supportedBy` edge,
including one from a solution.

| Derive | From | Note |
| :--- | :--- | :--- |
| `gsnalign:InferenceStep` | one per `gsn:Goal` that at least one element supports | Two hops when a strategy is present: a strategy supports the goal, and goals support the strategy. One hop otherwise. Both collapse to the same step |
| `gsnalign:CaseArgument` | one per `gsn:Goal` with `gsn:top true` | |
| `argo:conclusion` | the content of a top goal | |
| `argo:subconclusion` | the content of a goal that is both supported and supporting | The strongest correspondence between the two ontologies. ARGO defines a subconclusion as the input to one act of inferring and the output of another, in distinct arguments that are proper parts of one complex argument. An intermediate GSN goal is exactly that |
| `argo:premise` | the content of a goal that nothing supports | Goals only. Solutions are excluded by `dd-0019` |
| `argo:supposition` | the content of a `gsn:Assumption` reached by `gsn:inContextOf` | Requires the commitment recorded on `dd-0007`: contextual inputs feed the inference |
| `argo:contradicts` | `gsn:challenges` with a `gsn:Goal` as target | Rebut |
| `argo:undermines` | `gsn:challenges` with a `gsn:Solution`, `gsn:Context` or `gsn:Assumption` as target | Undermine |
| `gsnalign:undercuts` | `gsn:challenges` with a `gsn:Relationship` as target | Undercut. ARGO has no equivalent |

The last three rows are a gain in the other direction. GSN encodes rebut, undermine and undercut
by what is targeted. ARGO encodes them by relation name. The rules translate one into the other.

Four points are open.

| Question | Status |
| :--- | :--- |
| Where the rules live, and in what formalism | SPARQL CONSTRUCT in `alignments/rules/`, matching `queries/rules`, is the obvious answer. Settle the step rule first. A fan-in through a strategy is two hops and one without is one hop, and both must produce the same step |
| Whether the `argo:supposition` rule interacts badly with `gsn:ContextInheritance` | Accepted risk under `dd-0007`. One fixture is worth writing |
| Whether a step with no premises (`dd-0019`) is tolerable in the long term | That depends on whether anything queries the ARGO view. The limitation is scoped to version 0.1.0 so that a later version can lift it cleanly |
| Whether a fixture exercises the alignment, as `development/dev_tools/testdata/` does for the rules | Not before the rules exist, because there is nothing to populate yet |

One dependency matters here. The undercut rule challenges a `gsn:Relationship`. The declared
range of `gsn:challenges` in OntoGSN is `gsn:GSNElement`, and a relationship is not one. The
class-level restriction on `gsn:Goal` admits a relationship, so the global range is the narrower
of the two. If OntoGSN resolves that, review the undercut rule again.

## Same word, different thing

Each pair below looks like a mapping and is not one. The record holds the rejected pairs that
produced a decision. These four did not, because they tempt a reader and not a reasoner.

| OntoGSN | ARGO | Why it fails |
| :--- | :--- | :--- |
| `gsn:Strategy` | `argo:actofinferring` | Continuant against occurrent, disjoint under BFO. A strategy has an identifier, a statement and decorators. An act of inferring is a process. This is the mapping most readers reach for first. Use `gsnalign:describedByStrategy` |
| `gsn:statement` (a datatype property) | `argo:statement` (a class) | Identical label, unrelated. One is an `xsd:string`. The other is an ICE |
| `gsn:Relationship` | `argo:statement` | `gsn:Relationship` is a subclass of `rdf:Statement`, which is a reified triple, that is, a triple described as a resource. A third unrelated meaning of the same word |
| `gsn:Defeater` | ARGO's counterargument (paper, section on extensions) | Granularity. A defeater is an element. An ARGO counterargument is a whole argument. `gsn:Defeater` is also inferred and never asserted |

## A defect in ARGO, to report upstream

This is not an alignment issue. It was found while reading and is not yet filed against
`NCOR-Organization/Argument-Ontology`. The text below is ready to file.

At `argo.ttl:53`, `:conclusionIn` is typed `owl:FunctionalProperty`. A sentence content can
then be the conclusion of at most one argument. The first-order axiomatization requires the
opposite:

```
all x all y all t((ComplexArgument(y) & conclusionIn(x,y,t))
  -> exists z(Argument(z) & properContinuantPartOfAt(z,y,t) & conclusionIn(x,z,t))).
```

The conclusion of a complex argument must also be the conclusion of one of its proper parts. A
proper part is distinct from the whole, so one content is `conclusionIn` two distinct arguments.
Under the functionality declaration, a reasoner infers that the two arguments are `owl:sameAs`.
Proper parthood rejects that. The first-order relations are ternary and time-indexed, so
functionality does not arise there. The OWL serialization appears to have gained it when the
time index was dropped. The suggested fix is to remove `owl:FunctionalProperty` from
`:conclusionIn`. The restriction at `argo.ttl:301-305` already requires exactly one
`hasConclusion` per argument, which gives the intended reading from the other direction.

Two smaller items belong in the same report. ARGO mints `complexargument` at a hash IRI while
every other term uses the slash base. The base IRI `http://www.github/` is not a valid host.

The effect on this alignment is none. `gsnalign:concludes` is asserted at the step level only
(`dd-0013`), so no content here is the conclusion of two arguments.

## What is deliberately absent

Each item below is a decision with a recorded rationale in `ontogsn-align-design.ttl`, not
an oversight. Decisions `dd-0019` through `dd-0027` are the ones that produced nothing.

| Absent | Why |
| :--- | :--- |
| The derivation rules | The nine rules above are specified and not implemented. Without them this is a TBox only. How a two-hop fan-in through a strategy collapses with a one-hop fan-in is better settled against a fixture than guessed |
| Any mapping for `gsn:Solution` | The standard says that a solution makes no claim and is a noun phrase. An ARGO premise must be affirmed, and a noun phrase cannot be. A bridge invents a claim that the author never wrote. The consequence is that a step supported only by evidence carries no ARGO premises. An ARGO query for the premises of a case returns claims and never evidence. This is not an inconsistency, because ARGO's requirement is existential, that is, it requires that a premise exists and not that one is named. It is the sharpest limitation at this version |
| Occurrent individuals | ARGO's requirements are existential restrictions. Asserting that something is an argument entails that a creation act exists, with no need to name one. Minting the acts adds four nodes per step to satisfy something already satisfied |
| Any mapping for `gsn:true`, `gsn:valid`, `gsn:defeated` or `gsn:inDoubt` | ARGO argues against truth values on information entities and recommends an evaluation process instead. There is no ARGO term to map onto |
| `gsn:Argument ⊑ argo:argument` | This collides silently with ARGO's exactly-one-conclusion restriction. `gsnalign:CaseArgument` replaces it |
| SHACL shapes | Not written |

## Namespaces

| Prefix | Namespace |
| :----- | :-------- |
| `gsnalign:` | `https://w3id.org/OntoGSN/alignment#` |
| `gsnaligndesign:` | `https://w3id.org/OntoGSN/alignment/design#` |
| `gsn:` | `https://w3id.org/OntoGSN/ontology#` |
| `gsndesign:` | `https://w3id.org/OntoGSN/design#` |
| `argo:` | `http://www.github/argumentsontology/` |
| `argoh:` | `http://www.github/argumentsontology#`. For `complexargument` only |

## Querying the record

The record reuses the `gsndesign:` vocabulary. The SPARQL in `development/design/README.md` therefore
works here unchanged.

```sparql
PREFIX gsnaligndesign: <https://w3id.org/OntoGSN/alignment/design#>
PREFIX gsndesign:      <https://w3id.org/OntoGSN/design#>
PREFIX prov:         <http://www.w3.org/ns/prov#>

# Which correspondences were considered and rejected, and why?
SELECT ?what ?why WHERE {
    ?d gsndesign:formalism gsndesign:NoFormalism ;
       gsndesign:naturalLanguage ?what ;
       gsndesign:hasRationale/gsndesign:rationaleText ?why .
}
```

```sparql
# What does this axiom rest on in ARGO, verbatim?
SELECT ?axiom ?passage ?where WHERE {
    ?st gsndesign:statementText ?axiom ;
        prov:wasGeneratedBy/prov:used ?src .
    ?src gsnaligndesign:passageText ?passage ;
         gsnaligndesign:locator ?where .
}
```
