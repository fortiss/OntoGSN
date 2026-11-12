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
| Decide if `check_all.py --fix` must also run `query_check.py` | `dev_tools/check_all.py` | `--fix` runs the three build scripts only. A stale query record is the other common reason that the pre-commit hook refuses a commit. `query_check.py` executes the stored queries, so it is a verification and not a build. | Open |
| Take the counts in the design record from a script | `design/README.md` line 82, `design/ontogsn-design-data.ttl` line 27 | The counts are hand-written text, so they go stale. The README says that 118 of the 944 decisions generated nothing. A count of the active decisions without `prov:generated` gave 135 on 2026-11-11. | Open. Find the rule behind 118, or recount. |

## Flaws that need a change outside this folder

Recorded on 2026-11-12. The last two rows are judgments, not tasks. Rows 5 and 6
are closed (w3id pull request perma-id/w3id.org#7160, and the Zenodo rule in `README.md` of this
folder). Row 7 is closed by the new root `README.md` and `QUICK-START.md`. Row 8 is deferred design work.

| # | Flaw | Where | What "fixed" looks like | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Nothing executes. The "dynamic assurance case" is a recipe that ends with "in a script or a scheduled job" | `QUICK-START.md`, section "Dynamic assurance case" | A documented path from a tool run to a report in the graph, either in this repository or by a named external producer | Open |
| 2 | The SWRL rules and their SPARQL twins do not have the same semantics. The twins delete old values and carry guards that the SWRL rules lack | `ontology/queries/rules/`, `augmentation/rules/`, `augmentation/README.md` (the section on the two guards) | One statement of which form is normative, and a list of the rules where the results can differ | Open |
| 3 | The SPARQL twins of A6 and A7 are slow in rdflib. The FinComp hub measured more than 4 minutes for 33 reports and 23 parts | `augmentation/README.md` (section "Run time of the SPARQL rules in rdflib"), `dev_tools/augmentation_check.py`, `ontology/example/run_rules.py` | A fixed join order in the tools, or Oxigraph for the augmentation rules as for the core rules | Open. The README documents the limit since 2026-11-11. |
| 4 | The playground loads an ontology at version 1.2 | `docs/assets/data/ontologies/ontogsn_lite.ttl`, `docs/assets/js/queries.js` line 31 | A build script regenerates the file and a check compares it with `ontogsn.ttl`, or the file is removed | Open |
| 9 | The process is heavy for the size, and one person wrote all 212 commits | `dev_tools/` (26 Python scripts), `design/` | A short contributor path that needs only `check_all.py` reduces the risk | Judgment |
| 10 | Little evidence of outside use. The one named consumer is the FinComp hub | no file | A list of known users on the website is the usual answer | Judgment |
