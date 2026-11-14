# -*- coding: utf-8 -*-
"""Copy the OntoGSN Workbench into docs/playground/ and make sure that the copy is current.

    python development/dev_tools/playground_sync.py --workbench ../ontogsn_workbench --commit <rev>
    python development/dev_tools/playground_sync.py --ontology-only   # refresh the ontology copy
    python development/dev_tools/playground_sync.py --check           # the form check_all.py calls

The Playground on the website is a filtered copy of the Workbench, which has its own
repository. This script reads the Workbench at one commit, leaves out the paths in EXCLUDE,
and writes the result to docs/playground/. It reads the files from the commit and not from
the working tree, so an uncommitted edit or an ignored key file cannot enter the website.

Three kinds of file are in docs/playground/:

    copied      a Workbench file. Do not edit it here. Change the Workbench and sync again.
    owned       a Playground version of a Workbench file, listed in OWNED. The script does not
                overwrite it. It records the checksum of the Workbench file that the owned
                file came from, and it reports when the Workbench file changed.
    local       a file that the Workbench does not have, listed in LOCAL.

The script changes a copied file in two cases. It removes the comments from a SPARQL file,
because query_check.py allows no comment in a SPARQL file of this repository. It replaces
the ontology of the Workbench with ontology/serializations/ontogsn.ttl of this branch.

docs/playground/VENDOR.json records the commit and the checksum of each copied file.
--check needs no Workbench. It fails when the ontology copy differs from its source, when a
copied file differs from its checksum, when a file is missing, or when the folder holds a
file that the record does not list.
"""
import argparse
import fnmatch
import hashlib
import io
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DEST = "docs/playground"
MANIFEST = "VENDOR.json"
ONTOLOGY_SOURCE = "ontology/serializations/ontogsn.ttl"
ONTOLOGY_COPY = "assets/data/ontologies/ontogsn.ttl"

# What the Playground takes from the Workbench. index.html is taken through OWNED.
INCLUDE = ("assets/*", "LICENSE")

# What it leaves out. A pattern is matched against the path in the Workbench.
EXCLUDE = (
    # experimental panes: three need a key file or a camera, one is a development console
    "assets/panes/audio/*",
    "assets/panes/video/*",
    "assets/panes/image/*",
    "assets/panes/terminal/*",
    # queries that only the excluded panes run
    "assets/data/queries/read_all_goals.sparql",
    "assets/data/queries/read_all_solutions.sparql",
    # documentation of the Workbench and its pictures
    "*README.md",
    "assets/panes/*/image.png",
    "assets/panes/*/screenshot.png",
    "assets/images/interface_*",
    # replaced by ONTOLOGY_COPY
    "assets/data/ontologies/ontogsn_lite.ttl",
    "assets/data/ontologies/ontogsn.ttl",
)

# Playground file -> Workbench file that it is a version of.
OWNED = {
    "index.html": "index.html",
    "assets/core/boot.js": "assets/core/boot.js",
}

LOCAL = ("README.md", MANIFEST)

TEXT_EXTENSIONS = (".js", ".mjs", ".css", ".html", ".ttl", ".sparql", ".md", ".py", ".axml",
                   ".json", ".txt", ".svg")
TEXT_NAMES = ("LICENSE",)


def is_text(path):
    return path.endswith(TEXT_EXTENSIONS) or os.path.basename(path) in TEXT_NAMES


def normalise(path, data):
    """LF line ends for a text file, as .gitattributes sets for this repository."""
    if is_text(path):
        return data.replace(b"\r\n", b"\n")
    return data


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def matches(path, patterns):
    return any(fnmatch.fnmatchcase(path, p) for p in patterns)


def strip_sparql_comments(text):
    """Remove each comment. A '#' inside an IRI or a string is not a comment."""
    out = []
    for line in text.split("\n"):
        in_iri = False
        quote = None
        cut = None
        i = 0
        while i < len(line):
            c = line[i]
            if quote:
                if c == "\\":
                    i += 1
                elif c == quote:
                    quote = None
            elif in_iri:
                if c == ">":
                    in_iri = False
                elif c in " \t":            # it was a less-than sign, not an IRI
                    in_iri = False
            elif c in "\"'":
                quote = c
            elif c == "<":
                in_iri = True
            elif c == "#":
                cut = i
                break
            i += 1
        if cut is None:
            out.append(line)
            continue
        kept = line[:cut].rstrip()
        if kept:
            out.append(kept)
        # a line that held a comment only is removed
    return "\n".join(out)


def git(workbench, *args):
    run = subprocess.run(["git", "-C", workbench, *args], capture_output=True)
    if run.returncode != 0:
        sys.exit("git %s failed in %s:\n%s" % (" ".join(args), workbench,
                                              run.stderr.decode("utf-8", "replace")))
    return run.stdout


def jekyll_skips(path):
    """Jekyll does not publish a file or folder whose name starts with one of these."""
    return any(part[:1] in ("_", ".", "#") or part.endswith("~") for part in path.split("/"))


def read_manifest(dest):
    path = os.path.join(dest, MANIFEST)
    if not os.path.exists(path):
        return None
    with io.open(path, encoding="utf-8") as handle:
        return json.load(handle)


def write_manifest(dest, manifest):
    with io.open(os.path.join(dest, MANIFEST), "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(manifest, indent=1, sort_keys=True, ensure_ascii=False) + "\n")


def write_file(dest, path, data):
    full = os.path.join(dest, *path.split("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as handle:
        handle.write(data)


def read_file(dest, path):
    with open(os.path.join(dest, *path.split("/")), "rb") as handle:
        return normalise(path, handle.read())


def files_in(dest):
    found = []
    for folder, _dirs, names in os.walk(dest):
        for name in names:
            found.append(os.path.relpath(os.path.join(folder, name), dest).replace(os.sep, "/"))
    return sorted(found)


def ontology_bytes():
    with open(os.path.join(REPO, *ONTOLOGY_SOURCE.split("/")), "rb") as handle:
        return normalise(ONTOLOGY_SOURCE, handle.read())


def sync(workbench, commit, dest, reviewed):
    previous = read_manifest(dest) or {}
    commit = commit or previous.get("commit")
    if not commit:
        sys.exit("No commit is recorded yet. Give one with --commit.")
    rev = git(workbench, "rev-parse", commit + "^{commit}").decode().strip()
    date = git(workbench, "log", "-1", "--format=%cs", rev).decode().strip()
    source = git(workbench, "remote", "get-url", "origin").decode().strip()
    if source.endswith(".git"):
        source = source[:-4]
    listed = [p for p in git(workbench, "ls-tree", "-r", "--name-only", rev).decode().split("\n") if p]

    copied = {}
    removed_comments = []
    for path in listed:
        if not matches(path, INCLUDE) or matches(path, EXCLUDE) or path in OWNED.values():
            continue
        if jekyll_skips(path):
            sys.exit("Jekyll does not publish %s. Add it to EXCLUDE or rename it in the Workbench." % path)
        data = normalise(path, git(workbench, "show", "%s:%s" % (rev, path)))
        if path.endswith(".sparql"):
            text = data.decode("utf-8")
            stripped = strip_sparql_comments(text)
            if stripped != text:
                removed_comments.append(path)
                data = stripped.encode("utf-8")
        copied[path] = data
    copied[ONTOLOGY_COPY] = ontology_bytes()

    owned = {}
    notes = []
    for path, upstream in sorted(OWNED.items()):
        if upstream not in listed:
            sys.exit("The Workbench has no %s at %s." % (upstream, rev[:7]))
        upstream_data = normalise(upstream, git(workbench, "show", "%s:%s" % (rev, upstream)))
        upstream_sum = sha256(upstream_data)
        recorded = (previous.get("owned") or {}).get(path, {}).get("upstream_sha256")
        target = os.path.join(dest, *path.split("/"))
        if not os.path.exists(target):
            write_file(dest, path, upstream_data)
            notes.append("CREATED %s from the Workbench. Edit it for the Playground." % path)
            recorded = upstream_sum
        elif recorded is None or reviewed:
            recorded = upstream_sum
        elif recorded != upstream_sum:
            notes.append("REVIEW %s: the Workbench changed %s since the Playground version was "
                         "made. Bring the change over, then run again with --reviewed."
                         % (path, upstream))
        owned[path] = {"upstream": upstream, "upstream_sha256": recorded}

    for path, data in copied.items():
        write_file(dest, path, data)
    keep = set(copied) | set(owned) | set(LOCAL)
    for path in files_in(dest):
        if path not in keep:
            os.remove(os.path.join(dest, *path.split("/")))
            notes.append("REMOVED %s, which the Workbench does not have any more." % path)
    for folder, dirs, names in os.walk(dest, topdown=False):
        if not dirs and not names:
            os.rmdir(folder)

    write_manifest(dest, {
        "source": source,
        "commit": rev,
        "commit_date": date,
        "excluded": list(EXCLUDE),
        "ontology": {"source": ONTOLOGY_SOURCE, "copy": ONTOLOGY_COPY},
        "owned": owned,
        "files": {path: sha256(data) for path, data in sorted(copied.items())},
    })
    print("Copied %d files from %s at %s (%s) to %s." % (len(copied), source, rev[:7], date, dest))
    if removed_comments:
        print("Removed comments from %d SPARQL files:" % len(removed_comments))
        for path in removed_comments:
            print("  " + path)
    for note in notes:
        print(note)


def ontology_only(dest):
    manifest = read_manifest(dest)
    if manifest is None:
        sys.exit("%s has no %s. Run a full sync first." % (dest, MANIFEST))
    data = ontology_bytes()
    write_file(dest, ONTOLOGY_COPY, data)
    manifest["files"][ONTOLOGY_COPY] = sha256(data)
    write_manifest(dest, manifest)
    print("Copied %s to %s/%s." % (ONTOLOGY_SOURCE, dest, ONTOLOGY_COPY))


def check(dest):
    manifest = read_manifest(dest)
    if manifest is None:
        print("%s has no %s." % (dest, MANIFEST))
        return 1
    problems = []
    present = set(files_in(dest))
    for path, recorded in sorted(manifest["files"].items()):
        if path not in present:
            problems.append("missing: %s" % path)
        elif path == ONTOLOGY_COPY:
            if read_file(dest, path) != ontology_bytes():
                problems.append("stale: %s differs from %s. Fix: playground_sync.py --ontology-only"
                                % (path, ONTOLOGY_SOURCE))
        elif sha256(read_file(dest, path)) != recorded:
            problems.append("changed here: %s. Change the Workbench and sync again." % path)
    for path in sorted(manifest["owned"]):
        if path not in present:
            problems.append("missing: %s" % path)
    listed = set(manifest["files"]) | set(manifest["owned"]) | set(LOCAL)
    for path in sorted(present - listed):
        problems.append("not in %s: %s" % (MANIFEST, path))
    for problem in problems:
        print(problem)
    if not problems:
        print("docs/playground/ is the Workbench at %s, with the ontology of this branch."
              % manifest["commit"][:7])
    return 1 if problems else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--workbench", help="path of a clone of the Workbench repository")
    ap.add_argument("--commit", help="commit of the Workbench to copy. Default: the recorded commit")
    ap.add_argument("--out", help="write to this folder and not to docs/playground/")
    ap.add_argument("--reviewed", action="store_true",
                    help="record that the owned files hold the changes of the Workbench files")
    ap.add_argument("--ontology-only", action="store_true",
                    help="copy the ontology of this branch again. Needs no Workbench")
    ap.add_argument("--check", action="store_true", help="write nothing, exit 1 on a difference")
    args = ap.parse_args()

    dest = os.path.abspath(args.out) if args.out else os.path.join(REPO, *DEST.split("/"))
    if args.check:
        sys.exit(check(dest))
    if args.ontology_only:
        ontology_only(dest)
        return
    if not args.workbench:
        ap.error("--workbench is required for a sync")
    os.makedirs(dest, exist_ok=True)
    sync(os.path.abspath(args.workbench), args.commit, dest, args.reviewed)


if __name__ == "__main__":
    main()
