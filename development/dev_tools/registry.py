# -*- coding: utf-8 -*-
"""The registries of the stored queries and rules, and the test that keeps them in step with the files.

    ontology/queries/registry.csv   the queries and rules of OntoGSN, scope GSN
    augmentation/registry.csv       the queries, rules and derivations of the Augmentation, scope AUG

The file name of a query or a rule is its ID, <KIND>-<SCOPE>-<slug>. The section "Stored
queries" of development/dev_tools/README.md gives the standard. doc_counts.py reports what
problems() finds, and prov_inventory.py reads the rows with load().
"""
import csv
import glob
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# scope -> (registry, the folders whose .rq files it lists)
REGISTRIES = {
    "GSN": ("ontology/queries/registry.csv", ("ontology/queries",)),
    "AUG": ("augmentation/registry.csv",
            ("augmentation/queries", "augmentation/rules", "augmentation/derivations")),
}
COLUMNS = ("id", "file", "text", "parameters", "role", "origin", "group", "order", "replaces")
ORIGINS = ("core", "rsc-audit")
WRITE_VERBS = ("create", "update", "delete")
ID_RE = re.compile(r"^(RQ|WQ|RL)-(GSN|AUG)-([a-z0-9]+(?:_[a-z0-9]+)*)$")
AUG_TERM_RE = re.compile(r"\bgsnaug:[A-Za-z]")
NAME_RE = re.compile(r"(?m)^#\s+name:\s+(.*?)\s*$")


def slug(text):
    """The slug of a rule's name: lowercase, with one underscore for each run of other characters."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def parse(identifier):
    """(kind, scope, slug) of an ID, or None."""
    match = ID_RE.match(identifier)
    return match.groups() if match else None


def read(path):
    with open(os.path.join(REPO, path), encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or ()), list(reader)


def load():
    """Every row of both registries, each with its scope."""
    rows = []
    for scope, (path, _) in REGISTRIES.items():
        for row in read(path)[1]:
            rows.append(dict(row, scope=scope))
    return rows


def rules_in_order(folder):
    """The rule files of a folder, as paths from the repository root, in the order of the
    column 'order'. A runner applies the rules in this order: the rules do not all reach the
    same result in every order."""
    rows = [row for row in load() if row["file"].startswith(folder.rstrip("/") + "/")
            and row["id"].startswith("RL-")]
    return [row["file"] for row in sorted(rows, key=lambda row: int(row["order"]))]


def query_files(folders):
    """The .rq files under the folders, as paths from the repository root."""
    found = []
    for folder in folders:
        for path in glob.glob(os.path.join(REPO, folder, "**", "*.rq"), recursive=True):
            found.append(os.path.relpath(path, REPO).replace(os.sep, "/"))
    return sorted(found)


def problems():
    """Each way in which a registry and the files disagree with each other or with the standard."""
    found = []
    current = {row["id"] for row in load()}
    for scope, (path, folders) in REGISTRIES.items():
        columns, rows = read(path)
        if tuple(columns) != COLUMNS:
            found.append(f"{path}: the columns are {', '.join(columns)}, not {', '.join(COLUMNS)}")
            continue
        seen, orders = {}, {}
        for number, row in enumerate(rows, start=2):
            where, identifier, file = f"{path} line {number}", row["id"], row["file"]
            parts = parse(identifier)
            if not parts:
                found.append(f"{where}: '{identifier}' is not an ID of the form KIND-SCOPE-slug")
                continue
            kind, its_scope, its_slug = parts
            if identifier in seen:
                found.append(f"{where}: {identifier} is also on line {seen[identifier]}")
            seen[identifier] = number
            if its_scope != scope:
                found.append(f"{where}: {identifier} has the scope {its_scope}, and this registry holds {scope}")
            if os.path.basename(file) != identifier + ".rq":
                found.append(f"{where}: the file {file} is not named {identifier}.rq")
            if not any(file.startswith(folder + "/") for folder in folders):
                found.append(f"{where}: {file} is in no folder of the scope {scope}")
            in_rule_folder = "/rules/" in file or "/derivations/" in file
            if (kind == "RL") != in_rule_folder:
                found.append(f"{where}: a file of the kind {kind} belongs in "
                             + ("rules/ or derivations/" if kind == "RL" else "a folder of queries"))
            if kind == "WQ" and its_slug.split("_", 1)[0] not in WRITE_VERBS:
                found.append(f"{where}: the slug of a write starts with {', '.join(WRITE_VERBS)}")
            if not row["text"].strip():
                found.append(f"{where}: {identifier} has no text")
            if kind == "RL":
                folder = file.rsplit("/", 1)[0]
                if not row["order"].isdigit() or int(row["order"]) <= 0:
                    found.append(f"{where}: the rule {identifier} needs a whole number in 'order'")
                elif (folder, row["order"]) in orders:
                    found.append(f"{where}: the order {row['order']} is also on line {orders[(folder, row['order'])]}")
                else:
                    orders[(folder, row["order"])] = number
            elif row["order"]:
                found.append(f"{where}: only a rule has an order")
            if row["origin"] not in ORIGINS:
                found.append(f"{where}: the origin '{row['origin']}' is not one of {', '.join(ORIGINS)}")
            for old in row["replaces"].split():
                if old in current:
                    found.append(f"{where}: {identifier} replaces {old}, which is still an ID")
            full = os.path.join(REPO, file)
            if not os.path.exists(full):
                found.append(f"{where}: {file} does not exist")
                continue
            with open(full, encoding="utf-8") as handle:
                text = handle.read()
            names_aug = bool(AUG_TERM_RE.search(text))
            if scope == "GSN" and names_aug:
                found.append(f"{where}: {identifier} names a gsnaug: term, so its scope is AUG")
            if scope == "AUG" and not names_aug:
                found.append(f"{where}: {identifier} names no gsnaug: term, so its scope is GSN")
            if kind == "RL":
                name = NAME_RE.search(text)
                if not name:
                    found.append(f"{where}: the rule has no '# name:' line")
                elif slug(name.group(1)) != its_slug:
                    found.append(f"{where}: the slug {its_slug} is not the slug of the name "
                                 f"'{name.group(1)}', which is {slug(name.group(1))}")
        listed = {row["file"] for row in rows}
        for file in query_files(folders):
            if file not in listed:
                found.append(f"{path}: no row for {file}")
    return found


if __name__ == "__main__":
    for line in problems():
        print(line)
