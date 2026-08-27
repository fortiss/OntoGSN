# OntoGSN Augmentation

Terms for linking a GSN assurance case to the things GSN deliberately does not model: the people
and roles behind an element, the tool that produced a piece of evidence and where it is kept, the
review issues raised against the case, and the regulatory requirement a claim answers to.

Written against **OntoGSN 1.2.4**. Nothing in this repository imports it, and it restates no `gsn:`
domain or range.

| File | Role |
| :--- | :--- |
| `ontogsn-augmentation.ttl` | the vocabulary. 14 classes, 30 properties, 6 SKOS concepts, 4 SWRL rules |
| `ontogsn-augmentation-shapes.ttl` | 13 SHACL shapes |
| `rules/*.rq` | a SPARQL twin of each SWRL rule, runnable without a reasoner |
| `testdata/example_issues.ttl` | a minimal case exercising every rule branch |
| `testdata/example_violations.ttl` | a deliberately wrong case, one node per shape |
| `check.py` | parses, runs the rules to a fixpoint, and validates both fixtures |

```bash
python augmentation/check.py
```

Standalone on purpose. `tools/check_all.py` globs `serializations/`, `shapes/` and `queries/`, so it
never sees this directory — the augmentation cannot break the core checks.

## The three groups

| Group | Terms | Idea |
| :--- | :--- | :--- |
| **Artefact provenance** | `storedIn`, `retrievableWith`, `generatedBy`, `generatedWith`, `generatedFrom`, `verifiedWith`, `revisionOf`, `containsElement` | how a piece of evidence came to be, and how to get it again |
| **Roles** | `assures`/`assuredBy`, `owns`/`ownedBy`, `reviews`/`reviewedBy`, `hasRole` | who stands behind what |
| **Issues** | `Issue`, `Answer` and its three subclasses, `raisedAgainst`, `issueType`, `answers`, `supersedes`, `raisedIn`, `coveredIn` | what a reviewer asked for, and whether it has been closed |

Plus four link properties — `instantiatedFrom`, `requiredBy`, `linksTo`, `tag`.

Every link names what sits at its far end:

| Class | Reached by | Is |
| :--- | :--- | :--- |
| `System` | `assures` | the system, service or organisation the case is about |
| `Requirement` | `requiredBy` | the regulation or obligation an element answers to |
| `Role` | `hasRole` | what an agent is in the review process |
| `ArtefactElement` | `instantiatedFrom`, `containsElement` | the row, clause or section of an artefact a claim was drawn from |

None of the four carries a taxonomy. They name the far end so a shape can check it; what a system or
a requirement *is* still belongs to the user's domain ontology.

## Three decisions worth knowing before reading the file

**Provenance hangs off `gsn:Artefact`, never off `gsn:Solution`.** A solution is the GSN element that
*references* an artefact; the storage location, the generating tool and the verification script are
facts about the file. Nothing extra is needed to query from the argument side, because the solution
already carries the hop:

```sparql
?claim gsn:supportedBy/gsn:refersTo ?artefact .
?artefact gsnaug:generatedWith ?tool ; gsnaug:verifiedWith ?rule .
```

Hanging any of the six on a solution is reported as a warning rather than a violation, since the
data is not wrong so much as in the wrong place.

**An issue is an ask, not a status.** `gsn:inDoubt` and `gsn:defeated` are states of an element; an
issue is the request to move an element off one. Modelling the ask as an individual is what makes
"how many rounds has this claim taken" countable, and what lets an ask be superseded or answered.

**A range names, it does not reject.** `rdfs:range` is generative: a value outside it is not
refused, it is retyped. So every range in the vocabulary is repeated as a SHACL shape, and the shape
is what rejects a wrong value. `gsnaug:raisedAgainst` is the case that matters most — its range is a
six-way union covering everything in a case a reviewer can point at (`Argument`, `Artefact`,
`AssuranceCase`, `GSNElement`, `Pattern`, `Relationship`), wide enough to be worth stating and wide
enough that a target outside it is almost certainly a mistake. `gsn:Catalogue` and
`gsn:InstantiationDataReference` are deliberately outside it.

What the target *is* also still matters to the rules: only a `revise` or `resolve` issue against a
`Goal` or a `Solution` becomes a defeater.

## What the rules do, and what they refuse to do

Only two of the nine combinations of issue type and target produce a defeater:

| Issue type | Target is a `Goal` or `Solution` | Target is anything else |
| :--- | :--- | :--- |
| `clarify` | nothing inferred | nothing inferred |
| `revise` | **A2** — becomes a challenge; the target goes `gsn:inDoubt` | nothing inferred |
| `resolve` | **A3** — becomes a challenge; the target is `gsn:defeated` | nothing inferred |

An auditor asking for a context to be better expressed is making a remark about the quality of a
contextual element, not a claim about the argument, and it must not move a truth value. The issue is
still recorded and still queryable.

Where a rule does fire, OntoGSN's own dialectic rules take over: **S52** types anything that
`gsn:challenges` as a `gsn:Defeater`, and **S48** derives `gsn:inDoubt` from a true goal that
challenges. Only `gsn:defeated` has to be asserted here, because **S46** derives it from a *valid
`gsn:Solution`* and an issue is an ask rather than evidence.

| Rule | Reads |
| :--- | :--- |
| `A2a` / `A2b` | a revise issue against a goal / a solution becomes a true goal challenging it |
| `A3a` / `A3b` | a resolve issue against a goal / a solution becomes a goal challenging it, and defeats it |

A2 and A3 are two rules each because a SWRL body is a conjunction and cannot express "a goal **or** a
solution" in one rule.

## PROV-O

Three properties are subproperties of PROV rather than bare PROV terms:

| Term | PROV anchor |
| :--- | :--- |
| `generatedBy` | `prov:wasAttributedTo` — the person |
| `generatedWith` | `prov:wasAttributedTo` — the tool, as a `prov:SoftwareAgent` |
| `generatedFrom` | `prov:wasDerivedFrom` |

Subproperties, because bare `prov:wasAttributedTo` cannot tell the author from the tool, because a
domain may be declared on our own term but never restated on a `prov:` one, and because a shape can
then constrain this repository's cases without constraining everyone's PROV.

`storedIn`, `retrievableWith` and `verifiedWith` have no PROV anchor and are minted outright: PROV
records what happened, and those three describe future access.

This is why the file carries one axiom whose subject is a `gsn:` term:

```turtle
gsn:Artefact rdfs:subClassOf prov:Entity .
```

Asserted here and never in `serializations/ontogsn.ttl` — same call, for the same reason, as the two
`gsn:` axioms in `alignments/gsnalign.ttl`. Without it the three subproperties have a domain of
`gsn:Artefact` under superproperties whose domain is `prov:Entity`, and a PROV-aware consumer sees
nothing.

## No top-level context subclasses

An earlier version of this vocabulary carried `TopSubjectContext` and `TopObjectContext`, two
subclasses of `gsn:Context` marking the context that names what is claimed and the one that names
what it is claimed of, with rules `A5a`/`A5b` deriving `assures` and `requiredBy` from them.

Both classes and both rules are gone. `gsnaug:assures` and `gsnaug:requiredBy` say the same thing
directly, and they work for a case that draws no top-level context at all — which is a conforming
case, since declaring one is GSN best practice but **not normative**. Two ways of saying one fact
also needed a shape to check that they agreed, and the derivation reached the system through
`gsn:refersTo`, whose range is `gsn:Artefact`, so the system a case was about ended up typed as a
piece of evidence. Naming the far ends fixed that as well.

A case that marks its top-level contexts in a diagram loses nothing: the contexts are still ordinary
`gsn:Context` elements, and what they mean is now asserted on the goal.

## Namespaces

| Prefix | Namespace |
| :----- | :-------- |
| `gsnaug:` | `https://w3id.org/OntoGSN/augmentation#` |
| `gsnaugsh:` | `https://w3id.org/OntoGSN/augmentation/shapes#` |
| `gsnaugswrl:` | `https://w3id.org/OntoGSN/augmentation/swrl#` |
| `gsn:` | `https://w3id.org/OntoGSN/ontology#` |
| `prov:` | `http://www.w3.org/ns/prov#` |

## Versioning

`gsnaug:augmentedOntoGSNVersion "1.2.4"` scopes the whole file, and two things in it would not hold
before that release: `gsnaug:instantiatedFrom` assumes an `InstantiationDataReference` may carry
`gsn:refersTo`, and A2/A3 assume `gsn:challenges` reaches the class of target the rule matches.
Re-check this directory whenever that string moves.
