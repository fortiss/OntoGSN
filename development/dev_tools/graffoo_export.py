# -*- coding: utf-8 -*-
"""Export the pages of the Graffoo diagram as images, optionally next to an older version.

    python development/dev_tools/graffoo_export.py                      # every page, as PNG
    python development/dev_tools/graffoo_export.py -p "Modular Ext"     # one page
    python development/dev_tools/graffoo_export.py --format svg         # SVG instead
    python development/dev_tools/graffoo_export.py --compare HEAD       # before and after

The images go to --out, which defaults to a folder in the system temp directory, because
they are a view of development/design/Graffoo Diagram.drawio and not a source. With
--compare REV the same pages are also exported from the file as it was at the git revision
REV, and compare.html shows each page before and after, side by side.

This needs the draw.io desktop app. It looks for it in $DRAWIO, then on the PATH, then in
the usual install folders. The app counts --page-index from 1, so page 1 is the first page.
"""
import argparse
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRAWIO_FILE = os.path.join(REPO, "development", "design", "Graffoo Diagram.drawio")
REL = "development/design/Graffoo Diagram.drawio"


def find_app():
    for c in (os.environ.get("DRAWIO"), shutil.which("draw.io"), shutil.which("drawio"),
              os.path.join(os.environ.get("ProgramFiles", ""), "draw.io", "draw.io.exe"),
              os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "draw.io", "draw.io.exe"),
              "/Applications/draw.io.app/Contents/MacOS/draw.io", "/usr/bin/drawio",
              "/snap/bin/drawio"):
        if c and os.path.isfile(c):
            return c
    return None


def page_names(path):
    return [d.get("name") for d in ET.parse(path).getroot().findall("diagram")]


def slug(name):
    return re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()


def export(app, src, out_dir, pages, fmt, scale):
    os.makedirs(out_dir, exist_ok=True)
    names = page_names(src)
    done = {}
    for i, name in enumerate(names, start=1):
        if pages and name not in pages:
            continue
        target = os.path.join(out_dir, f"{i:02d}-{slug(name)}.{fmt}")
        cmd = [app, "--export", "--format", fmt, "--page-index", str(i), "--output", target]
        if fmt == "png":
            cmd += ["--scale", str(scale)]
        cmd.append(src)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0 or not os.path.isfile(target):
            sys.exit(f"draw.io failed on page {i} ({name}):\n{result.stderr or result.stdout}")
        done[name] = target
        print(f"  {name:<26} {target}")
    return done


def git_version(rev, out_dir):
    path = os.path.join(out_dir, f"Graffoo Diagram@{slug(rev)}.drawio")
    data = subprocess.run(["git", "show", f"{rev}:{REL}"], cwd=REPO, capture_output=True)
    if data.returncode != 0:
        sys.exit(data.stderr.decode(errors="replace"))
    with open(path, "wb") as f:
        f.write(data.stdout)
    return path


def compare_page(before, after, rev, out_dir):
    rows = []
    for name, img in after.items():
        old = before.get(name)
        cell = (f'<img src="{html.escape(os.path.relpath(old, out_dir))}">' if old
                else "<p>(no page of this name)</p>")
        rows.append(f"<h2>{html.escape(name)}</h2><div class=row>"
                    f"<figure><figcaption>{html.escape(rev)}</figcaption>{cell}</figure>"
                    f"<figure><figcaption>working tree</figcaption>"
                    f'<img src="{html.escape(os.path.relpath(img, out_dir))}"></figure></div>')
    page = ("<!doctype html><meta charset=utf-8><title>Graffoo compare</title><style>"
            "body{font-family:sans-serif;margin:16px;background:#fff;color:#111}"
            ".row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}"
            "figure{margin:0;flex:1 1 480px;border:1px solid #ccc;padding:8px}"
            "img{max-width:100%;height:auto}figcaption{font-weight:bold;margin-bottom:8px}"
            "</style>" + "".join(rows))
    target = os.path.join(out_dir, "compare.html")
    with open(target, "w", encoding="utf-8") as f:
        f.write(page)
    return target


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("-p", "--page", action="append", help="export only this page (repeatable)")
    ap.add_argument("--format", choices=("png", "svg", "pdf"), default="png")
    ap.add_argument("--scale", type=float, default=2.0, help="PNG scale (default 2)")
    ap.add_argument("--out", default=os.path.join(tempfile.gettempdir(), "ontogsn-graffoo"))
    ap.add_argument("--compare", metavar="REV", help="also export the file at this git revision")
    args = ap.parse_args()
    app = find_app()
    if not app:
        sys.exit("draw.io desktop not found: install it, or set DRAWIO to its executable")
    out = os.path.abspath(args.out)
    print(f"working tree -> {os.path.join(out, 'after' if args.compare else '')}")
    after = export(app, DRAWIO_FILE, os.path.join(out, "after") if args.compare else out,
                   args.page, args.format, args.scale)
    if args.compare:
        print(f"{args.compare} -> {os.path.join(out, 'before')}")
        src = git_version(args.compare, out)
        before = export(app, src, os.path.join(out, "before"), args.page, args.format, args.scale)
        print(f"\nopen {compare_page(before, after, args.compare, out)}")


if __name__ == "__main__":
    main()
