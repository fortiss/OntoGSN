# OntoGSN Augmentation

Terms for linking a GSN assurance case to the things GSN deliberately does not model: the people
and roles behind an element, the tool that produced a piece of evidence and where it is kept, the
review issues raised against the case, and the regulatory requirement a claim answers to.

Written against **OntoGSN 1.2.4**. Nothing in this repository imports it, and it restates no `gsn:`
domain or range.

| File | Role |
| :--- | :--- |
| `ontogsn-augmentation.ttl` | the vocabulary. 11 classes, 20 properties, 3 SKOS concepts, 6 SWRL rules |
| `ontogsn-augmentation-shapes.ttl` | 9 SHACL shapes, one of them shipped switched off |
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
| **Artefact provenance** | `storedIn`, `retrievableWith`, `generatedBy`, `generatedWith`, `generatedFrom`, `verifiedWith` | how a piece of evidence came to be, and how to get it again |
| **Roles** | `assures`/`assuredBy`, `owns`/`ownedBy`, `reviews`/`reviewedBy` | who stands behind what |
| **Issues** | `Issue`, `Answer` and its three subclasses, `raisedAgainst`, `issueType`, `answers`, `supersedes` | what a reviewer asked for, and whether it has been closed |

Plus four link properties — `instantiatedFrom`, `requiredBy`, `linksTo`, `tag` — and two context
subclasses, `TopSubjectContext` and `TopObjectContext`.

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

**`gsnaug:raisedAgainst` has no `rdfs:range`.** A reviewer may raise an issue against anything in a
case. Narrowing the range would either reject legitimate asks or — since range is generative rather
than restrictive — silently retype whatever the issue happened to point at. What the target *is*
still matters, but to the rules rather than to the vocabulary.

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
| `A5a` | a top goal whose top object context refers to a system `gsnaug:assures` that system |
| `A5b` | a top goal whose top subject context refers to a requirement is `gsnaug:requiredBy` it |

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

## The deactivated shape

`TopContextCompletenessShape` requires every top goal to carry both a `TopSubjectContext`, naming
what is claimed, and a `TopObjectContext`, naming what it is claimed of. It ships
`sh:deactivated true`.

Declaring a top-level context is GSN best practice but **not normative**, so a case that omits one is
conforming and this shape would report it. A project that has decided to require them removes the
`sh:deactivated`. That is a house rule, not a fact about GSN — which is also why `gsnaug:assures` and
`gsnaug:requiredBy` exist alongside the two classes rather than depending on them.

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
