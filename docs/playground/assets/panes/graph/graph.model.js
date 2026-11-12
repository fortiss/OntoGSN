// assets/panes/graph/graph.model.js

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { addToSetMap } from "@core/utils.js";
import { NODE_H, LAYOUT } from "./graph.config.js";

const norm = (x) => String(x).trim();

export function labelWidth(t, minW = 44, maxW = 180, pad = 12) {
  return Math.min(maxW, Math.max(minW, 7.2 * String(t).length + pad));
}

export function kindFromTypeIri(typeIri) {
  if (!typeIri) return null;
  const t = String(typeIri);

  if (t.endsWith("#Goal") || t.endsWith("/Goal")) return "goal";
  if (t.endsWith("#Strategy") || t.endsWith("/Strategy")) return "strategy";
  if (t.endsWith("#Solution") || t.endsWith("/Solution")) return "solution";
  if (t.endsWith("#Context") || t.endsWith("/Context")) return "context";
  if (t.endsWith("#Assumption") || t.endsWith("/Assumption")) return "assumption";
  if (t.endsWith("#Justification") || t.endsWith("/Justification")) return "justification";

  return null;
}

export function inferNodeKind(id, labelText, typeIri) {
  const fromType = kindFromTypeIri(typeIri);
  if (fromType) return fromType;

  const txt = String(labelText || id);
  const p2 = txt.slice(0, 2).toUpperCase();
  const p1 = txt.charAt(0).toUpperCase();

  if (p2 === "SN") return "solution";
  if (p1 === "S") return "strategy";
  if (p1 === "C") return "context";
  if (p1 === "A") return "assumption";
  if (p1 === "J") return "justification";

  return "goal";
}

export function buildGraphScene(rows, {
  label = (x) => x,
  supportedBy = [],
  contextOf = [],
  challenges = [],
} = {}) {
  const supSet = new Set(supportedBy.map(norm));
  const ctxSet = new Set(contextOf.map(norm));
  const chalSet = new Set(challenges.map(norm));

  // Per-node OntoGSN type IRI (from ?typeS / ?typeO / legacy ?type)
  const nodeType = new Map();

  // Main structural relations
  const children = new Map();
  const parents = new Map();
  const context = new Map();
  const defeat = new Map();
  const allNodes = new Set();

  for (const r of rows) {
    if (!r || !r.s || !r.p || !r.o) continue;

    const S = norm(r.s);
    const P = norm(r.p);
    const O = norm(r.o);

    const tS = r.typeS || r.type;
    const tO = r.typeO;

    if (tS) {
      const T = norm(tS);
      if (T) nodeType.set(S, T);
    }

    if (tO) {
      const T = norm(tO);
      if (T) nodeType.set(O, T);
    }

    if (supSet.has(P)) {
      allNodes.add(S);
      allNodes.add(O);

      addToSetMap(children, S, O);
      addToSetMap(parents, O, S);
    } else if (ctxSet.has(P)) {
      addToSetMap(context, S, O);
    } else if (chalSet.has(P)) {
      // O is the challenged node; S is the defeater
      addToSetMap(defeat, O, S);
    }
  }

  // Roots = nodes never seen as object of supportedBy
  const supportedObjects = new Set([...parents.keys()]);
  const roots = [...allNodes].filter((n) => !supportedObjects.has(n));

  // Fallback: if no roots found, use the subject of the first supportedBy row
  if (roots.length === 0) {
    const first = rows.find((r) => r && r.p && supSet.has(norm(r.p)));
    if (first?.s) roots.push(norm(first.s));
  }

  // Primary-parent spanning tree for layout
  const primaryParent = new Map(); // child -> chosen parent
  for (const [child, ps] of parents.entries()) {
    const p = [...ps][0];
    if (p) primaryParent.set(child, p);
  }

  const layoutChildren = new Map();
  const visited = new Set();

  function walkTree(id) {
    if (visited.has(id)) return;
    visited.add(id);

    const kids = children.get(id) ? [...children.get(id)] : [];
    for (const c of kids) {
      if (primaryParent.get(c) === id) {
        addToSetMap(layoutChildren, id, c);
        walkTree(c);
      }
    }
  }

  roots.forEach(walkTree);

  function toHierarchy(id) {
    return {
      id,
      label: label(id),
      children: layoutChildren.get(id)
        ? [...layoutChildren.get(id)].map(toHierarchy)
        : [],
      contexts: context.get(id)
        ? [...context.get(id)].map((cid) => ({
            id: cid,
            label: label(cid),
            _contextOf: id,
          }))
        : [],
    };
  }

  const forest = roots.map(toHierarchy);
  const superRoot =
    forest.length === 1
      ? forest[0]
      : { id: "__ROOT__", label: "", children: forest };

  const root = d3.hierarchy(superRoot, (d) => d.children);
  d3.tree().nodeSize([LAYOUT.dx, LAYOUT.dy])(root);

  // Position map: id -> { x, y, data }
  const pos = new Map();
  root.descendants().forEach((d) => {
    if (d.data.id !== "__ROOT__") {
      pos.set(d.data.id, { x: d.x, y: d.y, data: d.data });
    }
  });

  // Main nodes
  const nodes = [...pos.entries()].map(([id, v]) => {
    const lbl = v.data.label;
    const typeIri = nodeType.get(id) || null;
    const kind = inferNodeKind(id, lbl, typeIri);

    return {
      id,
      label: lbl,
      x: v.x,
      y: v.y,
      w: labelWidth(lbl),
      h: NODE_H,
      kind,
      contexts: v.data.contexts || [],
      typeIri,
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Links:
  // - treeLinks = only primary-parent edges
  // - extraLinks = all other supportedBy edges
  const treeLinks = [];
  for (const [child, parent] of primaryParent.entries()) {
    const src = nodeById.get(parent);
    const tgt = nodeById.get(child);
    if (src && tgt) treeLinks.push({ source: src, target: tgt });
  }

  const extraLinks = [];
  for (const [child, ps] of parents.entries()) {
    for (const p of ps) {
      if (primaryParent.get(child) === p) continue;
      const src = nodeById.get(p);
      const tgt = nodeById.get(child);
      if (src && tgt) extraLinks.push({ source: src, target: tgt });
    }
  }

  // Context nodes placed to the right on the same rank
  const ctxNodes = [];
  const ctxLinks = [];
  const ctxPos = new Map();

  for (const n of nodes) {
    const ctxs = n.contexts ?? [];

    ctxs.forEach((c, i) => {
      const x = n.x + LAYOUT.ctxOffsetX + i * LAYOUT.ctxOffsetY;
      const y = n.y;

      const typeIri = nodeType.get(c.id) || null;
      const kind = inferNodeKind(c.id, c.label, typeIri) || "context";
      const w = labelWidth(c.label);

      ctxNodes.push({
        id: c.id,
        label: c.label,
        x,
        y,
        contextOf: n.id,
        kind,
        typeIri,
        w,
        h: NODE_H,
      });

      ctxPos.set(c.id, { x, y, host: n.id });

      ctxLinks.push({
        source: { x: n.x, y: n.y, w: n.w },
        target: { x, y, w },
      });
    });
  }

  // Defeaters placed to the left
  const defNodes = [];
  const defLinks = [];

  for (const n of nodes) {
    const defs = defeat.get(n.id) ? [...defeat.get(n.id)] : [];

    defs.forEach((dft, i) => {
      const x = n.x - LAYOUT.defOffsetX - i * LAYOUT.defOffsetY;
      const y = n.y;
      const lab = label(dft);
      const w = Math.max(36, Math.min(120, 7.2 * String(lab).length + 10));

      defNodes.push({
        id: dft,
        label: lab,
        x,
        y,
        challenges: n.id,
        w,
        h: 18,
      });

      defLinks.push({
        source: { x, y, w },
        target: { x: n.x, y: n.y, w: n.w },
      });
    });
  }

  return {
    nodeType,
    pos,
    ctxPos,

    nodes,
    ctxNodes,
    defNodes,

    treeLinks,
    extraLinks,
    ctxLinks,
    defLinks,
  };
}