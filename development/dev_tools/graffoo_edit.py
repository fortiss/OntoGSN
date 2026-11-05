# -*- coding: utf-8 -*-
"""Small, layout-preserving edits to the Graffoo diagram, for scripts to call.

    python development/dev_tools/graffoo_edit.py "Modular Ext"     # list a page's cells
    python development/dev_tools/graffoo_edit.py --compose         # rebuild "All Extensions"

    from graffoo_edit import Diagram
    d = Diagram()
    p = d.page("Modular Ext")
    view, module = p.box("gsn:View"), p.box("gsn:Module")
    p.arrow(view, module, "gsn:depicts", like="gsn:supportedBy")
    d.save()

Nothing here lays a page out. Each edit touches only the cells it names: a new box copies
the style of an existing one, a new arrow copies the style of an existing arrow, and every
other cell keeps its position. Look at the result with graffoo_export.py, and check it with
graffoo_check.py.

The file is written back in the format draw.io itself writes, uncompressed, so that a git
diff shows exactly which cells an edit changed.
"""
import copy
import html
import os
import random
import string
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from graffoo_check import ALL_EXTENSIONS, DRAWIO, clean, flat  # noqa: E402,F401


def _new_id(existing):
    while True:
        i = "".join(random.choices(string.ascii_letters + string.digits, k=20)) + "-1"
        if i not in existing:
            return i


class Page:
    def __init__(self, diagram):
        self.diagram = diagram
        self.root = diagram.find("mxGraphModel/root")

    @property
    def cells(self):
        return {c.get("id"): c for c in self.root.iter("mxCell")}

    def label(self, cell):
        return flat(clean(cell.get("value")))

    def find(self, text, edge=False):
        """Every cell whose visible label is text, boxes by default."""
        want = flat(text)
        return [c for c in self.root.iter("mxCell")
                if self.label(c) == want and bool(c.get("edge")) == edge]

    def box(self, text, index=0):
        found = [c for c in self.find(text) if c.get("vertex")]
        if not found:
            raise KeyError(f"no box labelled {text!r} on page {self.diagram.get('name')!r}")
        return found[index]

    def label_cell(self, edge):
        """The text cell parented to an arrow, if its label is not the arrow's own value."""
        for c in self.root.iter("mxCell"):
            if c.get("parent") == edge.get("id") and c.get("vertex"):
                return c
        return None

    def arrows(self, source=None, target=None, label=None):
        out = []
        for c in self.root.iter("mxCell"):
            if not c.get("edge"):
                continue
            if source is not None and c.get("source") != source.get("id"):
                continue
            if target is not None and c.get("target") != target.get("id"):
                continue
            if label is not None:
                lc = self.label_cell(c)
                text = self.label(lc) if lc is not None else self.label(c)
                if text != flat(label):
                    continue
            out.append(c)
        return out

    def geometry(self, cell):
        g = cell.find("mxGeometry")
        return {k: float(g.get(k, 0)) for k in ("x", "y", "width", "height")}

    def set_label(self, cell, text):
        """Replace a label. In a cell that renders HTML, a line break becomes <br>."""
        if "html=1" in (cell.get("style") or ""):
            cell.set("value", "<br>".join(html.escape(x, quote=False) for x in text.split("\n")))
        else:
            cell.set("value", text)

    def move(self, cell, dx=0, dy=0):
        g = cell.find("mxGeometry")
        for attr, d in (("x", dx), ("y", dy)):
            g.set(attr, f"{float(g.get(attr, 0)) + d:g}")

    def shift_below(self, y, dy):
        """Move every box whose top is at or below y, and every waypoint below y, down by dy."""
        for c in self.root.iter("mxCell"):
            if c.get("parent") != "1":
                continue
            g = c.find("mxGeometry")
            if g is None:
                continue
            if c.get("vertex") and float(g.get("y", 0)) >= y:
                self.move(c, dy=dy)
            elif c.get("edge"):
                for p in g.iter("mxPoint"):
                    if p.get("as") != "offset" and float(p.get("y", 0)) >= y:
                        p.set("y", f"{float(p.get('y')) + dy:g}")

    def add_box(self, text, x, y, like, width=None, height=None):
        """A box at (x, y) styled like the box `like`, which is a cell or a label."""
        model = like if isinstance(like, ET.Element) else self.box(like)
        cell = copy.deepcopy(model)
        cell.set("id", _new_id(self.cells))
        self.set_label(cell, text)
        g = cell.find("mxGeometry")
        g.set("x", str(x))
        g.set("y", str(y))
        if width:
            g.set("width", str(width))
        if height:
            g.set("height", str(height))
        self.root.append(cell)
        return cell

    def arrow(self, source, target, label=None, like=None, points=(), style_extra=None,
              label_pos=0.0, label_offset=(0, 0)):
        """An arrow from source to target, styled like an arrow labelled `like`.

        The label goes into a child text cell, as on the existing pages, so that the
        checker reads it the same way. points are waypoints [(x, y), ...].
        """
        model = None
        if like is not None:
            model = like if isinstance(like, ET.Element) else self.arrows(label=like)[0]
        cell = ET.Element("mxCell")
        cell.set("id", _new_id(self.cells))
        cell.set("edge", "1")
        cell.set("parent", "1")
        cell.set("source", source.get("id"))
        cell.set("target", target.get("id"))
        style = model.get("style") if model is not None else "endArrow=classic;html=1;rounded=0;"
        # drop the anchor points the model arrow used: they belong to its own boxes
        style = ";".join(p for p in style.split(";")
                         if p and not p.split("=")[0] in ("exitX", "exitY", "exitDx", "exitDy",
                                                          "entryX", "entryY", "entryDx", "entryDy"))
        if style_extra:
            style += ";" + style_extra
        cell.set("style", style + ";")
        cell.set("value", "")
        g = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        if points:
            arr = ET.SubElement(g, "Array", {"as": "points"})
            for x, y in points:
                ET.SubElement(arr, "mxPoint", {"x": str(x), "y": str(y)})
        self.root.append(cell)
        if label:
            self.add_label(cell, label, like=model, position=label_pos, offset=label_offset)
        return cell

    def add_label(self, edge, text, like=None, position=0.0, offset=(0, 0)):
        """A text cell on an arrow, styled like the label of the arrow `like`.

        position runs from -1 (source) to 1 (target); offset moves the text by (dx, dy).
        The model label's markup is kept and only its text replaced, because the pages
        set the colour and font of a property label in an HTML span, not in the style.
        """
        model = self.label_cell(like) if like is not None else None
        lab = ET.Element("mxCell")
        lab.set("id", _new_id(self.cells))
        lab.set("vertex", "1")
        lab.set("connectable", "0")
        lab.set("parent", edge.get("id"))
        lab.set("style", model.get("style") if model is not None else
                "edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];")
        old = self.label(model) if model is not None else ""
        markup = model.get("value", "") if model is not None else ""
        if old and html.escape(old, quote=False) in markup:
            lab.set("value", markup.replace(html.escape(old, quote=False),
                                            html.escape(text, quote=False), 1))
        else:
            self.set_label(lab, text)
        g = ET.SubElement(lab, "mxGeometry", {"x": str(position), "relative": "1", "as": "geometry"})
        ET.SubElement(g, "mxPoint", {"x": str(offset[0]), "y": str(offset[1]), "as": "offset"})
        self.root.append(lab)
        return lab

    def set_route(self, edge, exit=None, entry=None, points=None, orthogonal=None):
        """Change where an arrow leaves and enters its boxes, and its waypoints."""
        style = [p for p in edge.get("style", "").split(";") if p]
        drop = set()
        if exit is not None:
            drop |= {"exitX", "exitY", "exitDx", "exitDy"}
        if entry is not None:
            drop |= {"entryX", "entryY", "entryDx", "entryDy"}
        if orthogonal is not None:
            drop.add("edgeStyle")
        style = [p for p in style if p.split("=")[0] not in drop]
        if exit is not None:
            style.append(f"exitX={exit[0]};exitY={exit[1]};exitDx=0;exitDy=0")
        if entry is not None:
            style.append(f"entryX={entry[0]};entryY={entry[1]};entryDx=0;entryDy=0")
        if orthogonal:
            style.append("edgeStyle=orthogonalEdgeStyle")
        edge.set("style", ";".join(style) + ";")
        if points is not None:
            g = edge.find("mxGeometry")
            for child in list(g):
                if child.tag == "Array":
                    g.remove(child)
            if points:
                arr = ET.SubElement(g, "Array", {"as": "points"})
                for x, y in points:
                    ET.SubElement(arr, "mxPoint", {"x": f"{x:g}", "y": f"{y:g}"})

    def place_label(self, edge, position=None, offset=None):
        lab = self.label_cell(edge)
        g = lab.find("mxGeometry")
        if position is not None:
            g.set("x", str(position))
        if offset is not None:
            o = g.find("mxPoint")
            o.set("x", str(offset[0]))
            o.set("y", str(offset[1]))

    def retarget(self, edge, source=None, target=None):
        """Attach an arrow to other boxes. Old anchor points and waypoints are dropped."""
        if source is not None:
            edge.set("source", source.get("id"))
        if target is not None:
            edge.set("target", target.get("id"))
        style = ";".join(p for p in edge.get("style", "").split(";")
                         if p and not p.split("=")[0] in ("exitX", "exitY", "exitDx", "exitDy",
                                                          "entryX", "entryY", "entryDx", "entryDy"))
        edge.set("style", style + ";")
        g = edge.find("mxGeometry")
        for child in list(g):
            if child.tag == "Array" or child.get("as") in ("sourcePoint", "targetPoint"):
                g.remove(child)

    def remove(self, cell):
        """Delete a cell, the text cells on it, and every arrow attached to it."""
        gone = {cell.get("id")}
        changed = True
        while changed:
            changed = False
            for c in list(self.root.iter("mxCell")):
                if c.get("id") in gone:
                    continue
                if c.get("parent") in gone or c.get("source") in gone or c.get("target") in gone:
                    gone.add(c.get("id"))
                    changed = True
        for c in list(self.root):
            if c.get("id") in gone:
                self.root.remove(c)

    def listing(self):
        rows = []
        for c in self.root.iter("mxCell"):
            if c.get("vertex") and c.get("parent") in ("1", None):
                g = self.geometry(c)
                rows.append(f"box   {c.get('id'):<28} {g['x']:>7.0f} {g['y']:>7.0f} "
                            f"{g['width']:>5.0f}x{g['height']:<4.0f} {self.label(c)[:60]}")
        cells = self.cells
        for c in self.root.iter("mxCell"):
            if c.get("edge"):
                lc = self.label_cell(c)
                text = self.label(lc) if lc is not None else self.label(c)
                s = cells.get(c.get("source"))
                t = cells.get(c.get("target"))
                rows.append(f"arrow {c.get('id'):<28} {self.label(s) if s is not None else '?':<30} -> "
                            f"{self.label(t) if t is not None else '?':<30} {text}")
        return "\n".join(rows)


def _shift(el, dx, dy):
    for attr, d in (("x", dx), ("y", dy)):
        if el.get(attr) is not None:
            el.set(attr, f"{float(el.get(attr)) + d:g}")


class Diagram:
    def __init__(self, path=DRAWIO):
        self.path = path
        self.tree = ET.parse(path)

    def page(self, name):
        for d in self.tree.getroot().findall("diagram"):
            if d.get("name") == name:
                return Page(d)
        raise KeyError(name)

    def compose(self, target, parts):
        """Replace page target with copies of the pages in parts, each moved by (dx, dy).

        The copies get ids derived from the originals, so a second rebuild of unchanged
        pages writes the same file.
        """
        out = self.page(target)
        for el in list(out.root):
            if el.get("id") not in ("0", "1"):
                out.root.remove(el)
        for k, (name, dx, dy) in enumerate(parts, start=1):
            src = self.page(name)
            ids = {el.get("id") for el in src.root} - {"0", "1"}
            new = {i: f"{i}~{k}" for i in ids}
            for el in src.root:
                if el.get("id") in ("0", "1"):
                    continue
                el = copy.deepcopy(el)
                el.set("id", new[el.get("id")])
                cell = el if el.tag == "mxCell" else el.find("mxCell")
                for attr in ("parent", "source", "target"):
                    if cell.get(attr) in new:
                        cell.set(attr, new[cell.get(attr)])
                g = cell.find("mxGeometry")
                if cell.get("parent") == "1" and g is not None:
                    if cell.get("vertex"):
                        _shift(g, dx, dy)
                    else:
                        for p in g.iter("mxPoint"):
                            if p.get("as") != "offset":   # a label offset is relative
                                _shift(p, dx, dy)
                out.root.append(el)

    def save(self, path=None):
        ET.indent(self.tree, space="  ")
        text = ET.tostring(self.tree.getroot(), encoding="unicode", short_empty_elements=True)
        # draw.io writes a newline in an attribute as &#xa;, and the file has LF endings
        text = text.replace("&#10;", "&#xa;").replace("&#13;", "&#xd;").replace("&#09;", "&#x9;")
        with open(path or self.path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text + "\n")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    if sys.argv[1:] == ["--compose"]:
        d = Diagram()
        d.compose(*ALL_EXTENSIONS)
        d.save()
        print(f"rebuilt '{ALL_EXTENSIONS[0]}' from {', '.join(n for n, _, _ in ALL_EXTENSIONS[1])}")
    else:
        print(Diagram().page(sys.argv[1]).listing())
