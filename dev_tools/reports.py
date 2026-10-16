# -*- coding: utf-8 -*-
"""Regenerate the three reports the website publishes about the ontology.

    python dev_tools/reports.py                  # regenerate every report that is stale
    python dev_tools/reports.py --fetch          # the same, getting a missing tool first
    python dev_tools/reports.py oops --force     # regenerate one, even if it is current
    python dev_tools/reports.py --check          # exit 1 if a report is stale; runs nothing

    report   tool     written to               made from
    widoco   WIDOCO   docs/documentation/      serializations/ontogsn.ttl
    oops     OOPS!    docs/evaluation/oops/    serializations/ontogsn.rdf
    foops    FOOPS!   docs/evaluation/foops/   https://w3id.org/OntoGSN/ontology

.github/workflows/reports.yml runs this when the ontology changes on main, and proposes the
result as a pull request. Run by hand, it does the same thing on this machine.

None of the tools is vendored. --fetch clones a missing one into the folder that holds this
repository, at the version pinned in TOOLS - the layout a person gets by cloning the four
repositories side by side. WIDOCO and FOOPS! publish a JAR with each release, which is
downloaded into the clone and checked against a recorded SHA-256. OOPS! publishes none, so
it is built from the clone with Maven. A tool is fetched only for a report that is about to
be regenerated. --tools-dir puts the clones somewhere else.

Each report folder holds a build.json naming the tool, its version, the input and the
input's checksum. A report whose build.json matches what a run would record is current and
is left alone, and --force regenerates it anyway. That is what stops a re-run from
proposing a change: WIDOCO's page is byte-identical between runs, but the four copies of
the ontology and the WebVOWL data it writes beside it are not - blank-node labels and key
order move - so regenerating and diffing would always find a difference that means nothing.

What each tool is given, and why:

WIDOCO documents serializations/ontogsn.ttl, the hand-maintained source. It always names its
page index-en.html, and a copy is saved as index.html so that /documentation/ serves it.

OOPS! reads RDF/XML only. It is given serializations/ontogsn.rdf with the ontology node
retyped, by the function oops_check.py uses for the same reason: written the way rdflib
writes it, that node makes OOPS! report P38 and P39 against an ontology that declares both.
Its command line writes Turtle whose resource names are random UUIDs, so what is published
is a sorted summary of it, oops.json. A checker can stop with an exception, and OOPS! then
logs it and carries on. The page lists such a checker, so that its missing row does not
read as a pass.

FOOPS! is given the ontology IRI, not a file. Nine of its 24 checks are about publication -
does the IRI resolve, does it negotiate content, does the version IRI resolve, is the prefix
registered - and a file cannot answer them. The IRI serves main through
raw.githubusercontent.com, which caches for five minutes, so the published copies are first
compared with the files here, and the run waits (--wait) or stops rather than assess the
version before this one. --file assesses serializations/ontogsn.ttl instead, 15 checks, to
preview a change that is not on main yet. What the published ontology scores also depends
on things no build.json records - a registry entry, a licence URL that resolves - and
--force re-assesses it.
"""
import argparse
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import oops_check
import ttl_model

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ONTOLOGY_TTL = "serializations/ontogsn.ttl"
ONTOLOGY_RDF = "serializations/ontogsn.rdf"
ONTOLOGY_IRI = "https://w3id.org/OntoGSN/ontology"

# what the IRI serves for each Accept header, and the file here it has to equal
PUBLISHED = [("text/turtle", "serializations/ontogsn.ttl"),
             ("application/rdf+xml", "serializations/ontogsn.rdf"),
             ("application/ld+json", "serializations/ontogsn.jsonld")]
POLL_SECONDS = 30

# Bump when a page template or the content of a report changes, so that every report is
# regenerated although no input moved.
TEMPLATE_VERSION = 1

TOOLS = {
    "widoco": {
        "name": "WIDOCO",
        "repository": "https://github.com/dgarijo/Widoco",
        "clone": "Widoco",
        "ref": "v1.4.25",
        "version": "1.4.25",
        "jar": "JAR/widoco-1.4.25-jar-with-dependencies_JDK-17.jar",
        "download": "https://github.com/dgarijo/Widoco/releases/download/v1.4.25/"
                    "widoco-1.4.25-jar-with-dependencies_JDK-17.jar",
        "sha256": "be57a270fffb91e55810fa308717e704a44e2e7c027a3d68125a49da6c8b4e2b",
    },
    "oops": {
        "name": "OOPS!",
        "repository": "https://github.com/oeg-upm/OOPS",
        "clone": "OOPS",
        # the last release, 0.2.0, predates fixes to the P27, P31 and P32 checkers
        "ref": "11572ea6b31cba29dd3f8a443e24311652f059de",
        "version": "0.3.0-SNAPSHOT",
        "build": ["-B", "-q", "-Dmaven.test.skip=true", "clean", "package"],
        "webapp": "target/oops-0.3.0-SNAPSHOT/WEB-INF",
    },
    "foops": {
        "name": "FOOPS!",
        "repository": "https://github.com/oeg-upm/fair_ontologies",
        "clone": "fair_ontologies",
        "ref": "v0.4.0",
        "version": "0.4.0",
        "jar": "JAR/fair_ontologies-0.4.0.jar",
        "download": "https://github.com/oeg-upm/fair_ontologies/releases/download/v0.4.0/"
                    "fair_ontologies-0.4.0.jar",
        "sha256": "ed7db9f6fd029f933726f9305a6464583f30f8f590b07a6f87e499cfacc4f393",
    },
}

OUTPUT = {"widoco": "docs/documentation",
          "oops": "docs/evaluation/oops",
          "foops": "docs/evaluation/foops"}

WIDOCO_OPTIONS = ["-getOntologyMetadata", "-rewriteAll", "-uniteSections", "-webVowl",
                  "-includeAnnotationProperties", "-excludeProvenance", "-noPlaceHolderText",
                  "-lang", "en"]

# All three tools are Java. Before Java 18 the default charset follows the platform, which
# on Windows is not UTF-8, and the ontology is not ASCII.
JAVA_OPTIONS = ["-Dfile.encoding=UTF-8"]

OOPS_NS = "http://oops.linkeddata.es/def#"
OOPS_CATALOGUE = "https://oops.linkeddata.es/catalogue.jsp"
IMPORTANCE = ["CRITICAL", "IMPORTANT", "MINOR"]

# what OOPS! logs around a checker, and when one of them throws
CHECKER_STARTED = re.compile(r"Checking (\S+) \.\.\.\s*$")
CHECKER_FINISHED = re.compile(r"Checking (\S+) done\.\s*$")
CHECKER_CRASHED = "General/unknown error occurred during checking"
EXCEPTION_LINE = re.compile(r"^\s*([\w.$]+(?:Exception|Error))\b")
CHECKER_FRAME = re.compile(r"\bat es\.upm\.fi\.oeg\.oops\.checkers\.(\w+)\.")

FAIR_ORDER = ["Findable", "Accessible", "Interoperable", "Reusable"]
FOOPS_STATUS = {"ok": "passed", "error": "failed"}


class Failed(Exception):
    """A report could not be made. The message says why, and what to do about it."""


def repo_path(relative):
    return os.path.join(REPO, *relative.split("/"))


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def last_lines(text, count=25):
    return "\n".join(text.strip().splitlines()[-count:])


def run(command, cwd=None):
    """Run a command and return what it printed. Raise Failed if it exits non-zero."""
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True,
                                encoding="utf-8", errors="replace")
    except FileNotFoundError:
        raise Failed(f"{command[0]} is not installed, or not on the PATH") from None
    output = result.stdout + result.stderr
    if result.returncode != 0:
        raise Failed(f"{os.path.basename(command[0])} exited with status {result.returncode}:\n"
                     f"{last_lines(output)}")
    return output


def java():
    found = shutil.which("java")
    if not found:
        raise Failed("no java on the PATH - WIDOCO, OOPS! and FOOPS! all need a JDK 17 or newer")
    return found


def write_text(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def write_json(path, data):
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def replace_folder(source, target):
    """Make target hold exactly what source holds, so a file a tool stopped writing goes too.

    The folder itself is emptied rather than removed: on Windows, a folder that a shell or an
    editor has open cannot be removed, although everything in it can.
    """
    os.makedirs(target, exist_ok=True)
    for entry in os.listdir(target):
        path = os.path.join(target, entry)
        if os.path.isdir(path) and not os.path.islink(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
    shutil.copytree(source, target, dirs_exist_ok=True)


# ---------------------------------------------------------------------------------------
# the tools

def clone_dir(name, tools_dir):
    return os.path.join(tools_dir, TOOLS[name]["clone"])


def jar_path(name, tools_dir):
    return os.path.join(clone_dir(name, tools_dir), *TOOLS[name]["jar"].split("/"))


def oops_webapp(tools_dir):
    return os.path.join(clone_dir("oops", tools_dir), *TOOLS["oops"]["webapp"].split("/"))


def not_fetched(name, path):
    return Failed(f"{TOOLS[name]['name']} is not at {path} - "
                  f"run: python dev_tools/reports.py {name} --fetch")


def head_commit(clone):
    result = subprocess.run(["git", "-C", clone, "rev-parse", "HEAD"],
                            capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def fetch(name, tools_dir):
    tool = TOOLS[name]
    clone = clone_dir(name, tools_dir)
    if not os.path.isdir(clone):
        print(f"cloning {tool['repository']} at {tool['ref']} into {clone}")
        # blobless: the whole history, but only the files of the commit that is checked out
        run(["git", "clone", "--quiet", "--filter=blob:none", "--no-checkout",
             tool["repository"] + ".git", clone])
        run(["git", "-C", clone, "checkout", "--quiet", tool["ref"]])
    if "jar" in tool:
        download_jar(name, tools_dir)
    else:
        build_oops(tools_dir)


def download_jar(name, tools_dir):
    tool = TOOLS[name]
    jar = jar_path(name, tools_dir)
    if not (os.path.isfile(jar) and sha256_file(jar) == tool["sha256"]):
        os.makedirs(os.path.dirname(jar), exist_ok=True)
        print(f"downloading {tool['download']}")
        partial = jar + ".part"
        try:
            with urllib.request.urlopen(tool["download"], timeout=300) as response, \
                    open(partial, "wb") as fh:
                shutil.copyfileobj(response, fh)
        except OSError as error:
            raise Failed(f"could not download {tool['download']} ({error})") from None
        digest = sha256_file(partial)
        if digest != tool["sha256"]:
            os.remove(partial)
            raise Failed(f"{tool['download']} has SHA-256 {digest}, not the recorded "
                         f"{tool['sha256']} - refusing to run it")
        os.replace(partial, jar)
    print(f"{tool['name']} {tool['version']}: {jar}")


def build_oops(tools_dir):
    tool = TOOLS["oops"]
    clone = clone_dir("oops", tools_dir)
    webapp = oops_webapp(tools_dir)
    head = head_commit(clone)
    if head != tool["ref"]:
        print(f"note: {clone} is at {head}, not the pinned {tool['ref']}. The report records "
              "the commit it was made with, and CI will regenerate it from the pinned one.")
    # names the commit the build in target/ was made from, so that checking out another
    # commit in the clone causes a rebuild
    marker = os.path.join(clone, "target", "ontogsn-reports-built-from")
    try:
        with open(marker, encoding="utf-8") as fh:
            built = fh.read().strip()
    except OSError:
        built = None
    if built != head or not os.path.isdir(os.path.join(webapp, "classes")):
        maven = os.environ.get("MVN") or shutil.which("mvn")
        if not maven:
            raise Failed("OOPS! publishes no JAR and is built from source, which needs Maven: "
                         "put mvn on the PATH, or its full path in the MVN environment variable")
        print(f"building OOPS! in {clone} - about two minutes the first time")
        run([maven] + tool["build"], cwd=clone)
        write_text(marker, f"{head}\n")
    print(f"OOPS! {tool['version']} ({(head or '?')[:7]}): {webapp}")


# ---------------------------------------------------------------------------------------
# what a report is made from

def ontology_version():
    with open(repo_path(ONTOLOGY_TTL), encoding="utf-8") as fh:
        match = re.search(r'owl:versionInfo\s+"([^"]+)"', fh.read())
    return match.group(1) if match else "unknown"


def widoco_inputs():
    return {"input": ONTOLOGY_TTL,
            "input_sha256": sha256_file(repo_path(ONTOLOGY_TTL)),
            "options": WIDOCO_OPTIONS}


def oops_inputs(content):
    # the checksum is of what OOPS! is given, so a change to the normalisation counts too
    return {"input": f"{ONTOLOGY_RDF}, ontology node retyped by dev_tools/oops_check.py",
            "input_sha256": sha256_bytes(content.encode("utf-8"))}


def foops_inputs(from_file):
    # Assessed by IRI, the input is what the IRI serves. The run refuses to start until that
    # equals the files here, so the local Turtle's checksum identifies it.
    return {"input": ONTOLOGY_TTL if from_file else ONTOLOGY_IRI,
            "input_sha256": sha256_file(repo_path(ONTOLOGY_TTL))}


def build_record(name, tool_ref, inputs):
    """What a report is made from. Two runs with the same record make the same report."""
    tool = TOOLS[name]
    record = {"generator": "dev_tools/reports.py",
              "template_version": TEMPLATE_VERSION,
              "tool": tool["name"],
              "tool_version": tool["version"],
              "tool_source": f"{tool['repository']}/tree/{tool_ref}",
              "ontology_version": ontology_version()}
    record.update(inputs)
    return record


def expected_record(name, from_file):
    """The record a run would write now, with every tool at its pinned version."""
    ref = TOOLS[name]["ref"]
    if name == "widoco":
        return build_record(name, ref, widoco_inputs())
    if name == "oops":
        return build_record(name, ref, oops_inputs(oops_check.normalised_ontology()))
    return build_record(name, ref, foops_inputs(from_file))


def recorded(name):
    try:
        with open(os.path.join(repo_path(OUTPUT[name]), "build.json"), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def stale_fields(name, from_file):
    """The fields of build.json a run would change. Empty means the report is current."""
    old = recorded(name)
    if old is None:
        return ["build.json, which is missing"]
    new = expected_record(name, from_file)
    return sorted(key for key in set(old) | set(new) if old.get(key) != new.get(key))


# ---------------------------------------------------------------------------------------
# the pages

def e(text):
    return html.escape(str(text), quote=True)


def page(title, permalink, body):
    """A page of the website. Jekyll puts it in the site's layout."""
    return ("---\n"
            "layout: single\n"
            f'title: "{title}"\n'
            f"permalink: {permalink}\n"
            "---\n"
            "<!-- Generated by dev_tools/reports.py. Do not edit by hand. -->\n"
            # what the tools write is text, never Liquid
            "{% raw %}\n" + body + "{% endraw %}\n")


def facts(rows):
    cells = "".join(f"<tr><th>{e(key)}</th><td>{value}</td></tr>\n" for key, value in rows)
    return f"<table>\n{cells}</table>\n"


def tool_link(record):
    label = f"{record['tool']} {record['tool_version']}"
    return f'<a href="{e(record["tool_source"])}">{e(label)}</a>'


def term(iri):
    """An IRI as the code element a reader recognises: gsn:Goal, with the IRI as its tooltip."""
    name = ttl_model.qname(iri)
    return f'<code title="{e(iri)}">{e(iri if name.startswith("<") else name)}</code>'


# ---------------------------------------------------------------------------------------
# WIDOCO

def make_widoco(tools_dir):
    jar = jar_path("widoco", tools_dir)
    if not os.path.isfile(jar):
        raise not_fetched("widoco", jar)
    record = build_record("widoco", TOOLS["widoco"]["ref"], widoco_inputs())
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "documentation")
        log = run([java()] + JAVA_OPTIONS + ["-jar", jar, "-ontFile", repo_path(ONTOLOGY_TTL),
                                             "-outFolder", out] + WIDOCO_OPTIONS, cwd=tmp)
        # WIDOCO exits 0 when it cannot load the ontology, so judge it by what it wrote
        written = os.path.join(out, "index-en.html")
        if not os.path.isfile(written):
            raise Failed(f"WIDOCO wrote no index-en.html:\n{last_lines(log)}")
        shutil.copyfile(written, os.path.join(out, "index.html"))
        write_json(os.path.join(out, "build.json"), record)
        replace_folder(out, repo_path(OUTPUT["widoco"]))
    return f"documents OntoGSN {record['ontology_version']} with WIDOCO {record['tool_version']}"


# ---------------------------------------------------------------------------------------
# OOPS!

def importance_rank(level):
    return IMPORTANCE.index(level) if level in IMPORTANCE else len(IMPORTANCE)


def oops_pitfalls(model_path):
    """The pitfalls in the Turtle the OOPS! command line writes, sorted so that a re-run
    produces the same list: most important first, then by code."""
    from rdflib import Graph, Namespace, RDF, URIRef
    oops = Namespace(OOPS_NS)
    graph = Graph()
    graph.parse(model_path, format="turtle")
    pitfalls = []
    for node in graph.subjects(RDF.type, oops.pitfall):
        elements = []
        for value in graph.objects(node, oops.hasAffectedElement):
            # A value can name a group OOPS! describes on its own - for P30, the classes it
            # suspects are equivalent - rather than a term of the ontology. The group's IRI is
            # a random UUID, so it is replaced by its members.
            members = sorted(str(member) for member in
                             graph.objects(URIRef(str(value)), oops.hasAffectedElement))
            elements.append(members or [str(value)])
        pitfalls.append({
            "code": str(graph.value(node, oops.hasCode) or "").split(" - ", 1)[0].strip(),
            "title": str(graph.value(node, oops.hasName) or ""),
            "importance": str(graph.value(node, oops.hasImportanceLevel) or "").upper(),
            "cases": int(str(graph.value(node, oops.hasNumberAffectedElements) or 0)),
            "description": str(graph.value(node, oops.hasDescription) or ""),
            "elements": sorted(elements),
        })
    pitfalls.sort(key=lambda p: (importance_rank(p["importance"]), p["code"]))
    return pitfalls


def oops_crashes(log):
    """The checkers that stopped with an exception. OOPS! logs each one and carries on."""
    crashes, running, crash = [], None, None
    for line in log.splitlines():
        started, finished = CHECKER_STARTED.search(line), CHECKER_FINISHED.search(line)
        if started or finished:
            running, crash = (started.group(1) if started else None), None
        elif CHECKER_CRASHED in line and running:
            crash = {"checker": running, "pitfall": None, "error": None}
            crashes.append(crash)
        elif crash:
            exception, frame = EXCEPTION_LINE.match(line), CHECKER_FRAME.search(line)
            if exception and not crash["error"]:
                crash["error"] = exception.group(1)
            if frame and not crash["pitfall"]:
                crash["pitfall"] = frame.group(1)
    return sorted(crashes, key=lambda c: c["checker"])


def oops_summary(result):
    pitfalls = result["pitfalls"]
    counts = ", ".join(f"{sum(1 for p in pitfalls if p['importance'] == level)} {level.lower()}"
                       for level in IMPORTANCE)
    summary = f"{len(pitfalls)} pitfalls ({counts})"
    missed = [c["pitfall"] or c["checker"] for c in result["not_evaluated"]]
    if missed:
        summary += f", {', '.join(missed)} not evaluated"
    return summary


def oops_page(result, record):
    version = e(record["ontology_version"])
    pitfalls, crashes = result["pitfalls"], result["not_evaluated"]
    body = [
        "<p>OOPS! (OntOlogy Pitfall Scanner!) compares an ontology with a "
        f'<a href="{OOPS_CATALOGUE}">catalogue of frequent modelling mistakes</a>. The '
        "catalogue calls each mistake a pitfall, and gives it an importance: critical, "
        f"important or minor. This page lists the pitfalls that OOPS! found in OntoGSN "
        f"{version}.</p>\n",
        facts([("Ontology", f"OntoGSN {version}, <code>{e(ONTOLOGY_RDF)}</code>"),
               ("Tool", tool_link(record)),
               ("Result", e(oops_summary(result))),
               ("Data", '<a href="oops.json">oops.json</a>, <a href="build.json">build.json</a>')]),
        "<h2>Pitfalls</h2>\n",
    ]
    if pitfalls:
        rows = []
        for p in pitfalls:
            elements = ", ".join(" and ".join(term(iri) for iri in group)
                                 for group in p["elements"]) or "the ontology as a whole"
            rows.append(f"<tr><td>{e(p['code'])}</td><td>{e(p['title'])}</td>"
                        f"<td>{e(p['importance'].capitalize())}</td><td>{p['cases']}</td>"
                        f"<td>{elements}</td></tr>\n")
        body.append("<table>\n<thead><tr><th>Code</th><th>Pitfall</th><th>Importance</th>"
                    "<th>Cases</th><th>Affected elements</th></tr></thead>\n<tbody>\n"
                    + "".join(rows) + "</tbody>\n</table>\n")
        body.append("<h2>What the pitfalls mean</h2>\n<dl>\n" + "".join(
            f"<dt>{e(p['code'])} {e(p['title'])}</dt>\n<dd>{e(p['description'])}</dd>\n"
            for p in pitfalls) + "</dl>\n")
    else:
        body.append("<p>OOPS! found no pitfalls.</p>\n")
    if crashes:
        body.append(
            "<h2>Not evaluated</h2>\n<p>The checker for each pitfall below stopped with an "
            "error. OOPS! did not evaluate these pitfalls, so the tables above do not show "
            "them, even if the ontology has them.</p>\n<table>\n<thead><tr><th>Pitfall</th>"
            "<th>Error</th></tr></thead>\n<tbody>\n" + "".join(
                f"<tr><td>{e(c['pitfall'] or c['checker'])}</td>"
                f"<td><code>{e(c['error'] or 'unknown')}</code></td></tr>\n" for c in crashes)
            + "</tbody>\n</table>\n")
    return page("OOPS! pitfall scan", "/evaluation/oops/", "".join(body))


def make_oops(tools_dir):
    webapp = oops_webapp(tools_dir)
    if not os.path.isdir(os.path.join(webapp, "classes")):
        raise not_fetched("oops", webapp)
    content = oops_check.normalised_ontology()
    ref = head_commit(clone_dir("oops", tools_dir)) or TOOLS["oops"]["ref"]
    record = build_record("oops", ref, oops_inputs(content))
    classpath = os.pathsep.join([os.path.join(webapp, "classes"), os.path.join(webapp, "lib", "*")])
    with tempfile.TemporaryDirectory() as tmp:
        write_text(os.path.join(tmp, "ontogsn.rdf"), content)
        # The command line has no option for where to write: it is always tstOut.model.ttl,
        # in the working directory.
        log = run([java()] + JAVA_OPTIONS + ["-cp", classpath, "es.upm.fi.oeg.oops.Cli",
                                             "--input-file", "ontogsn.rdf"], cwd=tmp)
        model = os.path.join(tmp, "tstOut.model.ttl")
        if not os.path.isfile(model):
            raise Failed(f"OOPS! wrote no tstOut.model.ttl:\n{last_lines(log)}")
        result = {"pitfalls": oops_pitfalls(model), "not_evaluated": oops_crashes(log)}
        out = os.path.join(tmp, "oops")
        os.makedirs(out)
        write_json(os.path.join(out, "oops.json"), result)
        write_json(os.path.join(out, "build.json"), record)
        write_text(os.path.join(out, "index.html"), oops_page(result, record))
        replace_folder(out, repo_path(OUTPUT["oops"]))
    return oops_summary(result)


# ---------------------------------------------------------------------------------------
# FOOPS!

def published_differences():
    """The local files that differ from what the ontology IRI serves for the same format."""
    differing = []
    for accept, local in PUBLISHED:
        request = urllib.request.Request(ONTOLOGY_IRI, headers={"Accept": accept})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                served = response.read()
        except OSError as error:
            differing.append(f"{local} (the {accept} request failed: {error})")
            continue
        with open(repo_path(local), "rb") as fh:
            if fh.read() != served:
                differing.append(local)
    return differing


def wait_for_publication(wait):
    deadline = time.monotonic() + wait
    while True:
        differing = published_differences()
        if not differing:
            return
        if time.monotonic() >= deadline:
            raise Failed(
                f"{ONTOLOGY_IRI} does not serve this commit's {', '.join(differing)}, so FOOPS! "
                "would assess another version. The IRI serves main: run this on main, wait a "
                "few minutes for the cache, or use --file to assess the local file instead.")
        print(f"{ONTOLOGY_IRI} still serves another version of {', '.join(differing)}; "
              f"checking again in {POLL_SECONDS} seconds")
        time.sleep(POLL_SECONDS)


def fair_rank(category):
    return FAIR_ORDER.index(category) if category in FAIR_ORDER else len(FAIR_ORDER)


def foops_summary(data):
    checks = data["checks"]
    passed = sum(1 for c in checks if c.get("status") == "ok")
    return (f"{round(float(data.get('overall_score', 0)) * 100)}%, "
            f"{passed} of {len(checks)} checks passed")


def foops_page(data, record):
    version = e(record["ontology_version"])
    if record["input"] == ONTOLOGY_IRI:
        subject = (f'OntoGSN {version} as published at <a href="{ONTOLOGY_IRI}">'
                   f"{ONTOLOGY_IRI}</a>")
    else:
        subject = (f"the file <code>{e(ONTOLOGY_TTL)}</code> of OntoGSN {version}. An "
                   "assessment of a file leaves out the checks that need the published "
                   "ontology")
    checks = sorted(data["checks"], key=lambda c: (fair_rank(c.get("category_id")),
                                                   c.get("principle_id", ""),
                                                   c.get("abbreviation", "")))
    rows = "".join(
        f"<tr><td>{e(c.get('category_id', ''))} ({e(c.get('principle_id', ''))})</td>"
        f"<td><a href=\"{e(c.get('id', ''))}\">{e(c.get('abbreviation', ''))}</a> "
        f"{e(c.get('title', ''))}</td>"
        f"<td>{e(FOOPS_STATUS.get(c.get('status'), c.get('status', '')))}</td>"
        f"<td>{c.get('total_passed_tests', 0)} of {c.get('total_tests_run', 0)}</td>"
        f"<td>{e(c.get('explanation', ''))}</td></tr>\n" for c in checks)
    body = (
        "<p>FOOPS! checks an ontology against the FAIR principles. FAIR stands for findable, "
        f"accessible, interoperable and reusable. FOOPS! assessed {subject}.</p>\n"
        + facts([("Ontology", f"OntoGSN {version}, <code>{e(record['input'])}</code>"),
                 ("Tool", tool_link(record)),
                 ("Score", e(foops_summary(data))),
                 ("Data", '<a href="foops.json">foops.json</a>, '
                          '<a href="build.json">build.json</a>')])
        + "<h2>Checks</h2>\n<table>\n<thead><tr><th>FAIR principle</th><th>Check</th>"
          "<th>Result</th><th>Tests passed</th><th>Explanation</th></tr></thead>\n<tbody>\n"
        + rows + "</tbody>\n</table>\n")
    return page("FOOPS! FAIR assessment", "/evaluation/foops/", body)


def make_foops(tools_dir, from_file, wait):
    jar = jar_path("foops", tools_dir)
    if not os.path.isfile(jar):
        raise not_fetched("foops", jar)
    if from_file:
        target = ["-ontFile", repo_path(ONTOLOGY_TTL)]
    else:
        wait_for_publication(wait)
        target = ["-ontURI", ONTOLOGY_IRI]
    record = build_record("foops", TOOLS["foops"]["ref"], foops_inputs(from_file))
    with tempfile.TemporaryDirectory() as tmp:
        # The release JAR starts the FOOPS! web service. PropertiesLauncher starts its command
        # line instead, from the same JAR.
        log = run([java()] + JAVA_OPTIONS + ["-Dloader.main=fair.FOOPS", "-cp", jar,
                                             "org.springframework.boot.loader.PropertiesLauncher"]
                  + target + ["-out", "foops.json"], cwd=tmp)
        # FOOPS! also exits 0 when it fails, so judge it by what it wrote
        try:
            with open(os.path.join(tmp, "foops.json"), encoding="utf-8") as fh:
                text = fh.read()
            data = json.loads(text)
        except (OSError, ValueError):
            raise Failed(f"FOOPS! wrote no readable foops.json:\n{last_lines(log)}") from None
        if not data.get("checks"):
            raise Failed(f"FOOPS! ran no checks:\n{last_lines(log)}")
        out = os.path.join(tmp, "foops")
        os.makedirs(out)
        write_text(os.path.join(out, "foops.json"), text.replace("\r\n", "\n"))
        write_json(os.path.join(out, "build.json"), record)
        write_text(os.path.join(out, "index.html"), foops_page(data, record))
        replace_folder(out, repo_path(OUTPUT["foops"]))
    return foops_summary(data)


# ---------------------------------------------------------------------------------------

def report_summary(name, text):
    print(f"{name}: {text}")
    # in GitHub Actions, the job hands this line to the pull request it proposes
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as fh:
            fh.write(f"{name}={text}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Regenerate the WIDOCO, OOPS! and FOOPS! reports the website publishes.")
    parser.add_argument("reports", nargs="*", metavar="REPORT",
                        help="widoco, oops or foops (default: all three)")
    parser.add_argument("--fetch", action="store_true",
                        help="before regenerating a report, clone, download or build its tool "
                             "if it is missing")
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if a report is stale; runs no tool")
    parser.add_argument("--force", action="store_true",
                        help="regenerate a report even when it is current")
    parser.add_argument("--tools-dir", default=os.path.dirname(REPO), metavar="DIR",
                        help="where the tool clones live (default: the folder that holds "
                             "this repository)")
    parser.add_argument("--file", action="store_true",
                        help=f"FOOPS!: assess {ONTOLOGY_TTL} instead of the published ontology")
    parser.add_argument("--wait", type=int, default=0, metavar="SECONDS",
                        help="FOOPS!: how long to wait for the published ontology to match "
                             "the files here (default: 0)")
    args = parser.parse_args()

    names = args.reports or list(OUTPUT)
    unknown = [name for name in names if name not in OUTPUT]
    if unknown:
        parser.error(f"unknown report {', '.join(unknown)} - choose from {', '.join(OUTPUT)}")
    tools_dir = os.path.abspath(args.tools_dir)

    if args.check:
        stale = {name: stale_fields(name, args.file) for name in names}
        for name in names:
            print(f"{name}: " + (f"STALE ({', '.join(stale[name])} changed)"
                                 if stale[name] else "current"))
        if any(stale.values()):
            print("\nregenerate with: python dev_tools/reports.py "
                  + " ".join(name for name in names if stale[name]))
            sys.exit(1)
        return

    builders = {"widoco": lambda: make_widoco(tools_dir),
                "oops": lambda: make_oops(tools_dir),
                "foops": lambda: make_foops(tools_dir, args.file, args.wait)}
    failures = []
    for name in names:
        if not args.force and not stale_fields(name, args.file):
            report_summary(name, "current, not regenerated")
            continue
        try:
            # fetched only now, so that a run with nothing stale costs no download or build
            if args.fetch:
                fetch(name, tools_dir)
            report_summary(name, builders[name]())
        except Failed as error:
            print(f"{name}: FAILED\n{error}")
            failures.append(name)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
