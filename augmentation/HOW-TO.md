# OntoGSN Augmentation: how to

Each heading names a task. Read the heading as "How to ...". The vocabulary enforces what
`shapes/ontogsn-augmentation-shapes.ttl` checks. This manual covers what it does not enforce.

The examples use these prefixes:

```turtle
@prefix ex:      <https://example.org/case#> .
@prefix gsn:     <https://w3id.org/OntoGSN/ontology#> .
@prefix gsnaug:  <https://w3id.org/OntoGSN/augmentation#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix schema:  <http://schema.org/> .
```

## Register a mechanism

A mechanism is a way to generate, retrieve or verify a piece of evidence. Create one
individual of `gsnaug:Mechanism` per way. Link the artefact to it with the property that
names the task: `gsnaug:generableWith`, `gsnaug:retrievableWith` or `gsnaug:verifiableWith`.
After the mechanism ran, add the past-tense twin: `gsnaug:generatedWith`,
`gsnaug:retrievedWith` or `gsnaug:verifiedWith`.

Then say how the mechanism runs:

1. If the mechanism runs without a person, set `gsnaug:automated true`.
2. If a person has to run it, set `gsnaug:automated false`.
3. If the mechanism is a script or a command, put its text in `gsnaug:script`. Name the
   interpreter in the text itself, as a shebang line or a PowerShell `#requires` line.
4. If the mechanism is a SHACL shape, a SWRL rule or a SPARQL query, type the same node as
   both. The check tool then reads what it depends on off the node.
5. If the mechanism is a script or a query, list the domain terms it reads by hand with
   `gsnaug:readsTerm`.

Together, these separate four states. A mechanism that runs by itself. A mechanism that a
person runs from its text. A mechanism that needs something the case names. A mechanism that
is an interview, with no text at all.

## Say what a mechanism needs in order to run

Use `dcterms:requires` on the mechanism, one value per thing it needs. A value is a node, not
a string. Name an interpreter, a package, a container image, a credential or a host.

```turtle
ex:note-check a gsnaug:Mechanism ;
    gsnaug:automated true ;
    dcterms:requires <https://example.org/tools#powershell-7> ;
    gsnaug:script "Select-String -Path interview-note.md -Pattern '^Interviewee:'" .
```

Stop there. What a tool or a package is, which version, and what it needs in turn, belongs to
a domain ontology or to a software bill of materials. The augmentation holds the link only.

## Declare the roles in your organization

The vocabulary has the class `gsnaug:Role` and no role individuals. Declare your own
individuals in your own namespace, one per role your process names, and attach them to agents
with `gsnaug:hasRole`.

```turtle
ex:role-auditor a gsnaug:Role ; schema:name "Auditor" .
ex:role-dpo     a gsnaug:Role ; schema:name "Data Protection Officer" .
ex:auditor-bo   a prov:Agent  ; gsnaug:hasRole ex:role-auditor .
```

The two roles that every assurance process has are already properties, not names. Whoever
stands behind an element is in `gsnaug:ownedBy`. Whoever checks it is in `gsnaug:reviewedBy`.
Whoever asked is in `gsnaug:raisedBy`. A query that needs "the auditor" reads those three
properties and never needs the role name. The relay chain of an issue, with `gsnaug:heldBy`
and `gsnaug:supersedes`, works for any number of intermediate roles.

## Respond to an issue, and close it

An issue collects responses. A response is content: an explanation, a changed element, a new
piece of evidence. Record each one as a `gsnaug:Response` that `gsnaug:respondsTo` the issue.
Several responses to one issue are normal.

A response does not close the issue. The issue closes when it carries a `gsnaug:issueOutcome`:

1. If the raiser accepted a response, set the outcome to "resolved".
2. If the holder cannot answer and passed the issue on, set "cannot answer" and raise the
   next issue in the chain with `gsnaug:supersedes`.
3. If the holder refused the ask, set "declined".
4. If the ask cannot be met at all, set "infeasible".

An issue with no outcome is open, however many responses it has. The raiser decides on
"resolved". The holder decides on the other three.

```turtle
ex:I3 a gsnaug:Issue ; gsnaug:issueType gsnaug:revise ; gsnaug:raisedAgainst ex:Sn1 .
ex:R1 a gsnaug:Response ; gsnaug:respondsTo ex:I3 ; schema:description "Log retention set to 12 months." .
ex:I3 gsnaug:issueOutcome "resolved" .
```

If an issue is marked "resolved" and no response is on record, the shapes report a warning.
Add the response, or correct the outcome.

## Keep the owner and the reviewer apart

If the same agent is in `gsnaug:ownedBy` and `gsnaug:reviewedBy` of one element or artefact,
the shapes report a warning. The review on record is not an independent one.

An owner reading their own draft is a normal state of a case under construction. Leave the
warning in place until a second agent reviewed the element, then record that agent.

## Trace changes in a requirement

A requirement is a `gsnaug:Requirement` and also a `prov:Entity`. If the requirement changes,
create a new individual and link it to the old one with `prov:wasRevisionOf`. Do not edit
the old one.

```turtle
ex:regulation      a gsnaug:Requirement .
ex:regulation-2027 a gsnaug:Requirement ; prov:wasRevisionOf ex:regulation .
```

Then run `queries/fc39_requirement_revised.rq`. It lists every element that is still
`gsnaug:requiredBy` the old requirement and not yet by the new one, with its owner.

If a requirement is one clause of a longer text, model the text as a `gsn:Artefact` and the
clause as a `gsnaug:ArtefactPart` that is `gsnaug:partOf` it. The clause is the thing that
gets revised.

## Trace changes in the system

A system is a `gsnaug:System` and also a `prov:Entity`. If the system changes, create a new
individual and link it to the old one with `prov:wasRevisionOf`, as for a requirement.

```turtle
ex:it-system    a gsnaug:System .
ex:it-system-r2 a gsnaug:System ; prov:wasRevisionOf ex:it-system .
```

Then run `queries/fc40_system_revised.rq`. It lists every artefact that was
`gsnaug:generatedFrom` the old system and not yet redrawn from the new one, with the solution
that cites the artefact and the goals above it.

Not every change in a system matters to the case. The vocabulary does not decide which
changes matter. Two things narrow the answer. First, the granularity at which you version the
system, see the next section. Second, the judgement you record afterwards, see the section on
turning a change into an issue.

## Trace changes in the environment

The environment of a claim is what GSN puts in a context: the country of deployment, the
operating conditions, the configuration, the list of systems in scope. Make the context refer
to an artefact that holds that information, and revise the artefact when the environment
changes.

```turtle
ex:C-deployment a gsn:Context ;
    gsn:statement "Deployed in the countries listed." ;
    gsn:refersTo ex:deployment-list .
ex:deployment-list    a gsn:Artefact .
ex:deployment-list-v2 a gsn:Artefact ; gsnaug:replaces ex:deployment-list .
```

Then run `queries/fc41_context_revised.rq`. It lists every goal in a context that still refers
to the old artefact, and every goal below it, because a context applies to the whole argument
under the element it is attached to.

Do not model the environment itself. The vocabulary does not say what a country, a condition
or a configuration is. The artefact holds whatever your domain ontology says, and the context
is the one hook the argument needs.

## Decide how much of the system and the environment to represent

The vocabulary never asks for more than one link per claim. How much sits at the far end of
that link is your choice, and the choice sets how precise the change-impact answer is. Pick the
smallest level that gives you the answer you need.

| Level | What you model | What a change reports |
| :--- | :--- | :--- |
| Whole system | One `gsnaug:System`, revised as a whole | Every artefact drawn from the system, every claim above them |
| Named part | One `gsnaug:System` per file, module or repository, with your own part-of relation | The artefacts drawn from that part, and their claims |
| Artefact part | A `gsnaug:ArtefactPart` per function, sheet or row | The claims that rest on that part |
| Domain term | `gsnaug:readsTerm` on each mechanism | The mechanisms that depend on the term, their artefacts, their claims |

If you represent less, the answer is wider than the true impact, and you spend more time on
judgement. If you represent more, the answer is narrower, and you spend more time on modelling.
Both are valid. Start at the whole system and refine only the parts that change often.

If you want to represent more, put the extra structure in your domain ontology and link to it.
Use `gsnaug:generatedFrom` to say which part an artefact came from. Use `gsnaug:linksTo` for
any other link from the case into the domain. Keep the part-of structure of the system, and
what its parts are, out of the case.

## Trace changes in individual files

Version the system at the level the evidence was taken at, not at the level of the whole
system. If a piece of evidence was drawn from one file, make that file the thing the artefact
is `gsnaug:generatedFrom`, and revise that file.

```turtle
ex:logging-module    a gsnaug:System .
ex:logging-module-r2 a gsnaug:System ; prov:wasRevisionOf ex:logging-module .
ex:access-log a gsn:Artefact ; gsnaug:generatedFrom ex:logging-module .
```

A change to a file that no artefact was drawn from then reports nothing. A change to the
logging module reports the access log and every claim that rests on it. The whole-system
revision still works beside it, for the cases where the whole thing was replaced.

The vocabulary does not say what a file, a module or a repository is. Use your domain
ontology for that, and use its own part-of relation to place the file inside the system.
Do not use `gsnaug:partOf` for this. That property is for a part of an artefact only.

## Separate design evidence from effectiveness evidence

A control that exists is not a control that works. Give each control two claims. One claims the
control is designed and implemented, and cites evidence drawn from the system. The other claims
the control operated effectively over a period, and cites the result of a test or a review.

A pattern for this is in `example/patterns/control-design-and-effectiveness.ttl`. It has one
top goal in context, a strategy over the controls a requirement asks for, an optional
decomposition over the scope of each control, and the two claims at the bottom. Mark the two
claims with `gsnaug:tag "design-and-implementation"` and `gsnaug:tag "test-of-effectiveness"`.

The split is what makes change impact precise. A change to the system reaches the design
evidence, through `gsnaug:generatedFrom`, and not the test results. A new period reaches the
effectiveness claim and nothing else. Never cite the same artefact under both claims.

## Trace changes in parts of a file

If a piece of evidence rests on one function, one sheet or one row, name that part as a
`gsnaug:ArtefactPart` and link it to the whole with `gsnaug:partOf`. Record the mechanism on
the part. The rules copy `gsnaug:verifiableWith` down from the whole to the part. The other
provenance properties stay where you put them.

```turtle
ex:access-log-row-42 a gsnaug:ArtefactPart ; gsnaug:partOf ex:access-log .
```

A report over the part confirms or refutes the solution that refers to the whole artefact, in
the same way as a report over the whole. Link the report to the part with `prov:used`.

`gsnaug:partOf` is a `dcterms:isPartOf`. A tool that knows Dublin Core and not this vocabulary
reads the relation.

A part has no location and no version of its own. Revise the artefact that holds it with
`gsnaug:replaces`, and the part of the new artefact is a new part.

The vocabulary does not compare the text of a script to what is in `gsnaug:script`. If you
need that comparison, keep a checksum in your domain ontology and compare it there.

## Turn a detected change into an issue

A revision query reports what a change reaches. It does not say whether the change matters.
That is a judgement, and the case records who made it.

1. Run `fc39_requirement_revised.rq`, `fc40_system_revised.rq` or `fc41_context_revised.rq`.
2. For each row, decide whether the element or the evidence is affected.
3. If it is affected, raise a `gsnaug:Issue` of type `gsnaug:revise` against the element or
   the solution. Record yourself in `gsnaug:raisedBy`.
4. If it is not affected, link the element to the new requirement, redraw the evidence from
   the new system, or point the context at the new artefact, so that the row disappears.

A revise issue against a goal or a solution becomes a challenge, and the target goes
`gsn:inDoubt`. The same path serves an auditor's ask and a developer's change. No separate
flag for "stale" exists, and none is needed.
