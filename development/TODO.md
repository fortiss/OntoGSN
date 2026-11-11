# Development TODO

Possible improvements to the tooling and the design record in this folder.

An item belongs here if a change inside `development/` alone can close it. A workflow file
under `.github/workflows/` that only runs these scripts counts as part of this folder. An
item that changes the ontology, the shapes, the queries or a release does not belong here.

| Item | Where | Why | Status |
| :--- | :--- | :--- | :--- |
| A workflow that a person starts by hand, which runs `check_all.py --fix` and opens a pull request with the result | `.github/workflows/`, in the style of `reports.yml` | A contributor without Python can then get current derived files. A person starts the job and a person merges the pull request, so CI still never regenerates a file by itself. A job that pushes a commit to the branch is not an option: it cannot push to a fork, and a commit from a bot does not start the checks again. | Open. Wait until outside contributions need it. |
| Decide if `check_all.py --fix` must also run `query_check.py` | `dev_tools/check_all.py` | `--fix` runs the three build scripts only. A stale query record is the other common reason that the pre-commit hook refuses a commit. `query_check.py` executes the stored queries, so it is a verification and not a build. | Open |
