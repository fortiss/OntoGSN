# Development TODO

Possible improvements to the tooling and the design record in this folder.

An item belongs in the first table if a change inside `development/` alone can close it. A
workflow file under `.github/workflows/` that only runs these scripts counts as part of this
folder. An item that changes the ontology, the shapes, the queries or a release belongs in the
second table.

## Items in this folder

| Item | Where | Why | Status |
| :--- | :--- | :--- | :--- |
| A workflow that a person starts by hand, which runs `check_all.py --fix` and opens a pull request with the result | `.github/workflows/`, in the style of `reports.yml` | A contributor without Python can then get current derived files. A person starts the job and a person merges the pull request, so CI still never regenerates a file by itself. A job that pushes a commit to the branch is not an option: it cannot push to a fork, and a commit from a bot does not start the checks again. | Open. Wait until outside contributions need it. |

## Flaws that need a change outside this folder

Recorded on 2026-11-12. Rows 5 and 6 are judgments, not tasks.

| # | Flaw | Where | What "fixed" looks like | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Nothing executes. No tool in this repository runs a check over a case of a user and applies the augmentation rules | `QUICK-START.md`, section "Dynamic assurance case" | A documented path from a tool run to a report in the graph, either in this repository or by a named external producer | Proposal in `QUICK-START.md`: a worked example with a script of 45 lines that the reader saves. Open: make the script a tool file. |
| 3 | The SPARQL twins of A6 and A7 are slow in rdflib. The FinComp hub measured more than 4 minutes for 33 reports and 23 parts | `augmentation/README.md` (section "Run time of the SPARQL rules in rdflib"), `dev_tools/augmentation_check.py`, `ontology/example/run_rules.py` | A fixed join order in the tools, or Oxigraph for the augmentation rules as for the core rules | Open. The README documents the limit since 2026-11-11. The maintainer tests a fix in another repository. |
| 5 | The process is heavy for the size, and one person wrote all 212 commits | `dev_tools/` (28 Python scripts), `design/` | A short contributor path that needs only `check_all.py` reduces the risk | Judgment |
| 6 | Little evidence of outside use. The one named consumer is the FinComp hub | no file | A list of known users on the website is the usual answer | Judgment |
| 7 | Seven folders have no `README.md` | `ontology/serializations/`, `ontology/example/`, `ontology/example/patterns/`, `augmentation/queries/`, `augmentation/rules/`, `augmentation/shapes/`, `augmentation/derivations/` | Each folder has a `README.md`. A folder of generated or uniform files gets a generated one, as `ontology/queries/rules/` has | Open |
| 8 | The design record does not state how the SPARQL twins of the augmentation rules differ from their SWRL rules. It holds the core rules only | `augmentation/rules/`, `dev_tools/prov_augment.py` (`QUERY_DIRS`) | The record holds the augmentation rules, and `augmentation/rules/README.md` has a generated table as `ontology/queries/rules/README.md` has. Today 13 of the 16 twins have a difference | Open |
