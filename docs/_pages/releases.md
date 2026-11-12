---
layout: single
title: "Releases"
permalink: /releases/
classes: [wide, og-page]
---

Each part of OntoGSN has its own version number: the ontology, the SHACL shapes, the augmentation, the alignment and the design record. The [changelog](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md) has the full entry for each release. This page lists the releases, newest first.

| Date | Part | Version | Breaking | Summary |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-12 | Design record | [1.4.0](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#design-record-140-2026-11-12) | no | The record states how each SPARQL update differs from its SWRL rule: it retracts an old value, or it has a guard. |
| 2026-11-11 | Ontology | [1.3.1](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#ontology-131--2026-11-11--shapes-120) | yes, for reasoners | Doubt on a support link or a context link reaches the element that relies on it. `gsn:relatedTo` is symmetric. `gsn:undeveloped` is a Core GSN term. `schema:description` is a data property only. SHACL shapes 1.2.0 follow. |
| 2026-11-11 | Design record | [1.3.1](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#design-record-131-2026-11-11) | no | The vocabulary declares `gsndesign:rationaleText`, which the record states on every rationale. |
| 2026-11-10 | Augmentation | [0.5.1](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#augmentation-051-2026-11-10) | no, no term changes | A part of an artefact is an artefact. One failing artefact of a solution outweighs a conforming one. |
| 2026-11-06 | Augmentation | [0.5.0](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#augmentation-050-2026-11-06) | no, no term changes | The goal that an issue becomes gets a statement and a context. A solution can name the parts of an artefact that it relies on. |
| 2026-11-05 | SHACL shapes | [1.1.1](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#shacl-shapes-111-2026-11-05) | no | Four checks report at the severity that they declare, not as violations. |
| 2026-11-05 | Augmentation | [0.4.0](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#augmentation-040-2026-11-05) | yes, two properties are renamed | A mechanism checks an artefact. |
| 2026-11-05 | Ontology | [1.3.0](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#ontology-130--2026-11-05--shapes-110) | yes, for reasoners | Protégé reads the SWRL rules again. The rules find support cycles of any length. Top goals are scoped to their module. Twenty-four terms gain a definition. |
| 2026-11-05 | Augmentation | [0.3.2](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#augmentation-032--2026-11-05--first-release) | first release | Released together with ontology 1.3.0. |
| 2026-10-16 | Design record | [1.3.0](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#design-record-130-2026-10-16) | yes, for importers | The record moved to `development/design/`, and its namespace to `https://w3id.org/OntoGSN/design`. |
| 2026-08-15 | Ontology | [1.2.3](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#ontology-123--2026-08-15--shapes-100) | no | The domains of the decorators, for example `gsn:valid`, include each class that a rule writes them onto. |
| 2026-08-05 | Ontology | [1.2.2](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#ontology-122--2026-08-05--shapes-100-introduced-2026-08-06) | yes, for reasoners | `gsn:Defeater` is a subclass of goal or solution, not equal to it. The prefix `ontology:` becomes `gsn:`. SHACL shapes 1.0.0 follow on 2026-08-06. |
| 2026-01-23 | Ontology | [1.2.1](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#ontology-121--2026-01-23) | no | Fixes rule S9 and adds annotations. |
| 2025-07-10 | Ontology | [1.2](https://github.com/fortiss/OntoGSN/blob/main/CHANGELOG.md#ontology-12--2025-07-10) | first version in the repository | |

Versions 1.0 and 1.1 came before the repository. The [paper](https://arxiv.org/abs/2506.11023) describes them.

Each major and minor release of the ontology is archived on Zenodo. A patch release has a git tag only. The DOI [10.5281/zenodo.17808330](https://doi.org/10.5281/zenodo.17808330) always resolves to the newest archived release.
