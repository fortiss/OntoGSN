import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import app from "@core/queries.js";
//import panes from "@core/panes.js";
import {
  ensureCss,
  repoHref,
  fetchRepoTextCached,
  resolveEl,
  uid,
  addToSetMap,
  bindingsToRows,
  shortenIri,
  labelWidthPx,
  inferGsnKind,
  cleanRdfLiteral,
  loadLocalBool,
  saveLocalBool
} from "@core/utils.js";
import { bus } from "@core/events.js";

ensureCss(repoHref("panes/graph/graph.css", { from: import.meta.url, upLevels: 2 }));
ensureCss(repoHref("panes/layers/layers.css", { from: import.meta.url, upLevels: 2 }));

const NODE_H = 26;

const K_SHOW_UNASSIGNED = "ontogsn_layers_show_unassigned_v1";

// ============================================================================
// Pure renderer (controller-style) — safe to call repeatedly
// ============================================================================

export function visualizeLayers(
  rows,
  {
    mount = ".gsn-host",
    width = null,
    height = 520,
    label = shortenIri,
    laneLabels = null,
    laneCount = null,

    // single lane
    assignLayer = null,

    // multiple lanes per node (for ghost nodes)
    assignLayers = null,

    allowEmptyLanes = true,
    dropUnassigned = false,
  } = {}
) {

  // --- Helpers ---------------------------------------------------------

  const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
  const norm = (x) => String(x ?? "").trim();

  // --- Resolve mount & bootstrap container ----------------------------

  function wrapSvgText(textSel, width, lineHeightEm = 1.05) {
    textSel.each(function () {
      const text = d3.select(this);
      const words = (text.text() || "").split(/\s+/).filter(Boolean);

      const x = text.attr("x");
      const y = text.attr("y");

      text.text(null);

      let line = [];
      let lineNumber = 0;

      let tspan = text.append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", "0em");

      for (const w of words) {
        line.push(w);
        tspan.text(line.join(" "));

        if (tspan.node().getComputedTextLength() > width && line.length > 1) {
          line.pop();
          tspan.text(line.join(" "));
          line = [w];

          tspan = text.append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", `${++lineNumber * lineHeightEm}em`)
            .text(w);
        }
      }
    });
  }

  function laneTreeX(items, laneIdx, depth, parents) {
    const ids = items.map(e => String(e.id));
    const laneSet = new Set(ids);

    const ROOT = `__lane_root__${laneIdx}`;

    // pick ONE parent per node (tree needs single parent)
    // but only if parent is also in this lane AND is "higher" in global supportedBy depth
    const rows = [{ id: ROOT, parentId: null }];

    for (const id of ids) {
      const ps = parents.get(id);
      const dChild = depth.get(id) ?? 0;

      let chosen = null;

      if (ps && ps.size) {
        const inside = [...ps].filter(p =>
          p && p !== id &&
          laneSet.has(p) &&
          ((depth.get(p) ?? -1) < dChild)   // prevents cycles / weirdness
        );

        if (inside.length) {
          inside.sort((a, b) =>
            (depth.get(a) ?? 999) - (depth.get(b) ?? 999) ||
            String(a).localeCompare(String(b))
          );
          chosen = inside[0];
        }
      }

      rows.push({ id, parentId: chosen ?? ROOT });
    }

    try {
      const strat = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parentId);

      const root = strat(rows);

      // unit layout → we scale it later to lane width
      d3.tree().nodeSize([1, 1])(root);

      const xMap = new Map();
      for (const n of root.descendants()) {
        if (n.id === ROOT) continue;
        xMap.set(n.id, n.x);
      }
      return xMap;

    } catch (e) {
      // fallback: stable order
      const xMap = new Map();
      ids.forEach((id, i) => xMap.set(id, i));
      return xMap;
    }
  }


  const rootEl = typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!rootEl) throw new Error(`visualizeLayers: mount "${mount}" not found`);
  rootEl.classList.add("gsn-host");

  rootEl.innerHTML = `
  <div class="gsn-legend">
    <span><span class="gsn-badge"></span> supported by</span>

    <label class="gsn-toggle">
      <input type="checkbox" data-act="toggle-unassigned" />
      Show unassigned
    </label>

    <span class="gsn-hint">scroll: zoom • drag: pan</span>
  </div>
  <svg class="gsn-svg"><g class="gsn-viewport"></g></svg>
`;


  const svgNode = rootEl.querySelector(".gsn-svg");
  if (!svgNode) throw new Error("visualizeLayers: internal error – svg root not found");

  const rect = rootEl.getBoundingClientRect();
  const pixelWidth = width ?? Math.max(300, rect.width || 800);

  svgNode.setAttribute("width", String(pixelWidth));
  svgNode.setAttribute("height", String(height));

  const svg = d3.select(svgNode);
  const g = svg.select(".gsn-viewport");
  const defs = svg.append("defs");

  // Arrowheads
  function marker(id) {
    const m = defs
      .append("marker")
      .attr("id", id)
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto-start-reverse")
      .attr("class", "gsn-marker norm");
    m.append("path").attr("d", "M0,0 L10,5 L0,10 Z").attr("fill", "currentColor");
  }

  const idArrow = uid("arrow-");
  marker(idArrow);

  // --- Build adjacency (supportedBy only) -----------------------------

  const SUP = new Set([
    "supported by",
    "gsn:supportedBy",
    "https://w3id.org/OntoGSN/ontology#supportedBy",
    "http://w3id.org/gsn#supportedBy",
  ]);

  const nodeType = new Map();
  const children = new Map(); // parent -> Set(child)
  const parents = new Map(); // child  -> Set(parent)
  const nodesAll = new Set();

  for (const r of rows) {
    if (!r) continue;

    const S = norm(val(r.s));
    const P = norm(val(r.p));
    const O = norm(val(r.o));
    if (!S || !P || !O) continue;

    const tS = val(r.typeS ?? r.type);
    const tO = val(r.typeO);

    if (tS) nodeType.set(S, norm(tS));
    if (tO) nodeType.set(O, norm(tO));

    if (!SUP.has(P)) continue;

    if (!children.has(S)) children.set(S, new Set());
    if (!parents.has(O)) parents.set(O, new Set());

    children.get(S).add(O);
    parents.get(O).add(S);
    nodesAll.add(S);
    nodesAll.add(O);
  }

  // Roots = nodes never seen as object of supportedBy
  const objects = new Set([...parents.keys()]);
  const roots = [...nodesAll].filter((n) => !objects.has(n));

  if (roots.length === 0) {
    const first = rows.find((r) => r && SUP.has(norm(val(r.p))));
    const fallback = first ? norm(val(first.s)) : null;
    if (fallback) roots.push(fallback);
  }

  // --- BFS depth per node --------------------------------------------

  const depth = new Map(); // id -> depth/layer index
  const layers = []; // Array<Array<id>>
  const seen = new Set();
  const queue = [];

  for (const r of roots) {
    depth.set(r, 0);
    queue.push(r);
    seen.add(r);
  }

  while (queue.length) {
    const u = queue.shift();
    const du = depth.get(u) ?? 0;

    if (!layers[du]) layers[du] = [];
    layers[du].push(u);

    const kids = children.get(u) ? [...children.get(u)] : [];
    for (const v of kids) {
      if (!depth.has(v)) depth.set(v, du + 1);
      if (!seen.has(v)) {
        seen.add(v);
        queue.push(v);
      }
    }
  }

  // --- Build lanes array (supports ghost multi-placement) --------------

  /**
   * laneItems: Array<Array<{ key, id, lane, isGhost }>>
   * - id = base node IRI
   * - key = unique per lane instance (id@@lane)
   */
  let laneItems = layers.map((a, li) =>
    [...a].map((id) => ({
      key: `${id}@@${li}`,
      id,
      lane: li,
      isGhost: false,
    }))
  );

  // primary instance key per base node id (for link routing)
  const primaryKeyById = new Map();

  function recordPrimary(entry) {
    if (!primaryKeyById.has(entry.id)) primaryKeyById.set(entry.id, entry.key);
  }

  for (const lane of laneItems) for (const e of lane) recordPrimary(e);

  // ✅ Multi-lane placement: assignLayers(id) => [laneIdx...]
  if (assignLayers) {
    const N = laneCount ?? (Array.isArray(laneLabels) ? laneLabels.length : layers.length);
    laneItems = Array.from({ length: Math.max(1, N) }, (_, li) => []);

    for (const id of nodesAll) {
      const d = depth.get(id) ?? 0;
      let ks = assignLayers(id, d);

      // normalize
      if (ks == null) ks = [];
      if (!Array.isArray(ks)) ks = [ks];

      // clamp + sort + unique
      const uniq = [...new Set(ks.map((x) => Number(x)).filter((x) => Number.isFinite(x)))]
        .map((k) => Math.max(0, Math.min(N - 1, k)))
        .sort((a, b) => a - b);

      // if no layers: fallback to lane 0
      if (!uniq.length) {
        if (dropUnassigned) continue;
        uniq.push(0);
      }

      const lanes = uniq;

      lanes.forEach((laneIdx, i) => {
        const entry = {
          key: `${id}@@${laneIdx}`,
          id,
          lane: laneIdx,
          isGhost: i > 0, // everything after the first is a ghost
        };

        laneItems[laneIdx].push(entry);

        // primary instance is first lane in sorted list
        if (i === 0) primaryKeyById.set(id, entry.key);
      });
    }
  }

  // ✅ Single-lane placement (existing behavior)
  else if (assignLayer) {
    const N = laneCount ?? (Array.isArray(laneLabels) ? laneLabels.length : layers.length);
    laneItems = Array.from({ length: Math.max(1, N) }, (_, li) => []);

    for (const id of nodesAll) {
      const d = depth.get(id) ?? 0;
      const kRaw = assignLayer(id, d);
      const k = Math.max(0, Math.min(N - 1, Number(kRaw) || 0));

      const entry = { key: `${id}@@${k}`, id, lane: k, isGhost: false };
      laneItems[k].push(entry);
      primaryKeyById.set(id, entry.key);
    }
  }

  // LaneCount override without assignLayer(s)
  else if (laneCount != null && laneCount > 0) {
    const N = laneCount;

    laneItems =
      laneItems.length >= N
        ? laneItems.slice(0, N)
        : laneItems.concat(Array.from({ length: N - laneItems.length }, (_, li) => []));
  }

  // Filter empty lanes BEFORE layout
  if (allowEmptyLanes === false) {
    const newLanes = [];
    const newLabels = [];

    for (let i = 0; i < laneItems.length; i++) {
      const items = laneItems[i] || [];
      if (!items.length) continue;

      newLanes.push(items);
      newLabels.push(
        Array.isArray(laneLabels)
          ? laneLabels[i] ?? `Layer ${newLanes.length}`
          : `Layer ${newLanes.length}`
      );
    }

    laneItems = newLanes.length ? newLanes : laneItems;
    laneLabels = newLabels.length ? newLabels : laneLabels;
  }


  // --- Layout geometry -----------------------------------------------

  const PAD = { t: 28, r: 40, b: 28, l: 40 };

  const W = svgNode.clientWidth || pixelWidth || 900;
  const H = svgNode.clientHeight || height;

  const L = Math.max(1, laneItems.length);
  const laneW = Math.max(260, (W - PAD.l - PAD.r) / L);
  const colX = (i) => PAD.l + i * laneW + laneW / 2;
  const laneHeight = Math.max(60, H - PAD.t - PAD.b);

  // --- Swimlanes background ------------------------------------------

  const lanesG = g.append("g").attr("class", "gsn-lanes");

  for (let i = 0; i < L; i++) {
    const gx = PAD.l + i * laneW;

    const lane = lanesG.append("g").attr("transform", `translate(${gx},${PAD.t})`);

    lane
      .append("rect")
      .attr("class", `gsn-lane ${i % 2 ? "odd" : "even"}`)
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", laneW)
      .attr("height", laneHeight)
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("fill-opacity", i % 2 ? 0.05 : 0.09);

    const lblRaw = Array.isArray(laneLabels) ? laneLabels[i] ?? `Layer ${i + 1}` : `Layer ${i + 1}`;
    const lbl = cleanRdfLiteral(lblRaw);

    lane
      .append("text")
      .attr("class", "gsn-lane-label")
      .attr("x", laneW / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .text(lbl)
      .call(wrapSvgText, laneW - 12);

  }

  // --- Compute node positions ----------------------------------------

  const pos = new Map(); // id -> { x, y, label }
  const primaryPos = new Map();
  // global supportedBy levels (align rows across lanes)
  const maxLevel = Math.max(0, ...depth.values());
  const levelStep = laneHeight / (maxLevel + 2);

  // padding inside each lane box
  const INPAD_X = 12;

  for (let i = 0; i < L; i++) {
    const items = laneItems[i] || [];

    const laneLeft = PAD.l + i * laneW;
    const laneRight = laneLeft + laneW;

    // tree-ish spread for X inside this lane
    const xMap = laneTreeX(items, i, depth, parents);
    const xs = [...xMap.values()];

    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : 0;
    const midX = (minX + maxX) / 2;

    const usableW = Math.max(10, laneW - INPAD_X * 2);
    const scaleX = (maxX > minX) ? (usableW / (maxX - minX)) : 0;

    for (const e of items) {
      const id = e.id;

      const lbl = label(id);
      const w = labelWidthPx(lbl);

      //X: center of lane + scaled tree offset
      const x0 = laneLeft + laneW / 2;
      const tx = xMap.get(String(id)) ?? 0;
      let x = x0 + (scaleX ? (tx - midX) * scaleX : 0);

      //Y: fixed by supportedBy level (leveled like graph pane)
      const lvl = depth.get(id) ?? 0;
      const y = PAD.t + (lvl + 1) * levelStep;

      // keep node fully inside lane
      const minAllowed = laneLeft + INPAD_X + w / 2;
      const maxAllowed = laneRight - INPAD_X - w / 2;
      x = Math.max(minAllowed, Math.min(maxAllowed, x));

      pos.set(e.key, {
        x, y,
        label: lbl,
        id: e.id,
        lane: e.lane,
        level: depth.get(e.id) ?? 0,
        isGhost: !!e.isGhost
      });


      if (primaryKeyById.get(e.id) === e.key) {
        primaryPos.set(e.id, { x, y, label: lbl });
      }
    }
  }


  const LINK_PAD = 3; // tiny gap between arrowhead and node outline

  function nodeHalfW(n) {
    // circles use r = max(w,h)/2 in your renderer
    if (n.kind === "solution") return Math.max(n.w, n.h) / 2;
    return n.w / 2;
  }
  function nodeHalfH(n) {
    if (n.kind === "solution") return Math.max(n.w, n.h) / 2;
    return n.h / 2;
  }

  // --- Links (supportedBy only) --------------------------------------

  const linkV = d3.linkVertical().x(d => d.x).y(d => d.y);
  const linkH = d3.linkHorizontal().x(d => d.x).y(d => d.y);

  function edgePath(src, tgt) {
    const sameLane = (src.lane === tgt.lane);

    // ✅ Within a lane: draw like a tree (top -> bottom)
    if (sameLane) {
      return linkV({
        source: { x: src.x, y: src.y + nodeHalfH(src) + LINK_PAD },
        target: { x: tgt.x, y: tgt.y - nodeHalfH(tgt) - LINK_PAD },
      });
    }

    // ✅ Across lanes: draw left->right (or right->left) cleanly
    const right = tgt.x >= src.x;
    const sx = src.x + (right ? nodeHalfW(src) : -nodeHalfW(src)) + (right ? LINK_PAD : -LINK_PAD);
    const tx = tgt.x - (right ? nodeHalfW(tgt) : -nodeHalfW(tgt)) - (right ? LINK_PAD : -LINK_PAD);

    return linkH({
      source: { x: sx, y: src.y },
      target: { x: tx, y: tgt.y },
    });
  }

  // --- Nodes ----------------------------------------------------------

  const nodes = [...pos.entries()].map(([key, v]) => {
    const baseId = v.id;
    const lbl = v.label;
    const typeIri = nodeType.get(baseId) || null;

    return {
      key,         // unique per lane instance
      id: baseId,  // base node id (IRI)
      label: lbl,
      x: v.x,
      y: v.y,
      lane: v.lane,
      level: v.level,
      w: labelWidthPx(lbl),
      h: NODE_H,
      kind: inferGsnKind(baseId, lbl, typeIri),
      typeIri,
      isGhost: !!v.isGhost,
    };
  });

  function spreadLaneLevels(nodes, {
    laneLeft,
    laneRight,
    gap = 14,
    pad = 10,
  } = {}) {
    const left = laneLeft + pad;
    const right = laneRight - pad;

    // group by level (tree depth)
    const groups = d3.group(nodes, d => d.level);

    for (const arr of groups.values()) {
      arr.sort((a, b) => a.x - b.x);

      // forward pass: enforce min spacing
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const cur = arr[i];
        const need = prev.x + nodeHalfW(prev) + gap + nodeHalfW(cur);
        if (cur.x < need) cur.x = need;
      }

      // clamp right
      const last = arr[arr.length - 1];
      const overR = (last.x + nodeHalfW(last)) - right;
      if (overR > 0) arr.forEach(n => n.x -= overR);

      // clamp left
      const first = arr[0];
      const overL = left - (first.x - nodeHalfW(first));
      if (overL > 0) arr.forEach(n => n.x += overL);

      // second pass after clamping
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const cur = arr[i];
        const need = prev.x + nodeHalfW(prev) + gap + nodeHalfW(cur);
        if (cur.x < need) cur.x = need;
      }
    }
  }

  for (let lane = 0; lane < L; lane++) {
    const laneLeft = PAD.l + lane * laneW;
    const laneRight = laneLeft + laneW;

    const inLane = nodes.filter(n => n.lane === lane);
    spreadLaneLevels(inLane, { laneLeft, laneRight, gap: 16 });
  }

  // ---------------------------------------------------------------------
  // Links (supportedBy) — MUST be built AFTER nodes are spread
  // ---------------------------------------------------------------------

  // Primary node instance per base id (used for routing)
  const primaryNodeById = new Map();
  for (const n of nodes) {
    if (primaryKeyById.get(n.id) === n.key) primaryNodeById.set(n.id, n);
  }

  // Build supportedBy links using node objects (not {x,y,label})
  const links = [];
  for (const [p, kids] of children.entries()) {
    const source = primaryNodeById.get(p);
    if (!source) continue;

    for (const c of kids) {
      const target = primaryNodeById.get(c);
      if (!target) continue;
      links.push({ source, target });
    }
  }

  // Render links BEHIND nodes (separate group)
  const gLinks = g.append("g").attr("class", "gsn-links");

  gLinks.selectAll("path.gsn-link")
    .data(links)
    .join("path")
    .attr("class", "gsn-link")
    .attr("d", d => edgePath(d.source, d.target))
    .attr("marker-end", `url(#${idArrow})`)
    .append("title")
    .text("supported by");

  const nodeG = g
    .selectAll("g.gsn-node")
    .data(nodes, (d) => d.key)
    .join("g")
    .attr("class", (d) => `gsn-node ${d.kind}${d.isGhost ? " ghost" : ""}`)
    .attr("data-id", (d) => d.id)
    .attr("data-key", (d) => d.key)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  const shapeG = nodeG.append("g").attr("class", "gsn-node-shape");

  shapeG.each(function (d) {
    const gShape = d3.select(this);
    const w = d.w;
    const h = d.h;
    const x = -w / 2;
    const y = -h / 2;

    if (d.kind === "solution") {
      const r = Math.max(w, h) / 2;
      gShape.append("circle").attr("cx", 0).attr("cy", 0).attr("r", r);
    } else if (d.kind === "strategy") {
      const slant = Math.min(20, w / 5);
      const points = [
        [x + slant, y],
        [x + w + slant, y],
        [x + w - slant, y + h],
        [x - slant, y + h],
      ]
        .map((p) => p.join(","))
        .join(" ");
      gShape.append("polygon").attr("points", points);
    } else if (d.kind === "assumption" || d.kind === "justification") {
      gShape.append("ellipse").attr("cx", 0).attr("cy", 0).attr("rx", w / 2).attr("ry", h / 2);
    } else {
      gShape.append("rect").attr("width", w).attr("height", h).attr("x", x).attr("y", y);
    }
  });

  nodeG
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text((d) => d.label)
    .append("title")
    .text((d) => d.id);

  const ajNodes = nodeG.filter((d) => d.kind === "assumption" || d.kind === "justification");
  ajNodes
    .append("text")
    .attr("class", "gsn-node-tag")
    .attr("text-anchor", "start")
    .attr("x", (d) => d.w / 2 - 6)
    .attr("y", (d) => d.h / 2 + 8)
    .text((d) => (d.kind === "assumption" ? "A" : "J"));

  // --- Overlay layer --------------------------------------------------

  const gOverlay = g.append("g").attr("class", "gsn-overlay-collections");

  // --- Zoom / pan -----------------------------------------------------

  const zoom = d3
    .zoom()
    .scaleExtent([0.25, 3])
    .on("zoom", (ev) => g.attr("transform", ev.transform));

  svg.call(zoom);

  // match graph.js: disable dblclick zoom
  svg.on("dblclick.zoom", null);

  function fit(pad = 40) {
    svg.interrupt();

    const gNode = g.node();
    if (!gNode) return;

    const bbox = gNode.getBBox();
    if (!bbox.width || !bbox.height) return;

    const vw = svgNode.clientWidth || svgNode.viewBox.baseVal.width || W;
    const vh = svgNode.clientHeight || svgNode.viewBox.baseVal.height || H;

    const sx = (vw - pad * 2) / bbox.width;
    const sy = (vh - pad * 2) / bbox.height;
    const s = Math.max(0.25, Math.min(2.5, Math.min(sx, sy)));

    const tx = pad - bbox.x * s + (vw - (bbox.width * s + pad * 2)) / 2;
    const ty = pad - bbox.y * s + (vh - (bbox.height * s + pad * 2)) / 2;

    const t = d3.zoomIdentity.translate(tx, ty).scale(s);
    svg.transition().duration(450).call(zoom.transform, t);
  }

  function destroy() {
    rootEl.innerHTML = "";
  }

  function updateUndevDiamonds() {
    const svgSel = d3.select(rootEl).select("svg.gsn-svg");
    svgSel.selectAll("path.undev-diamond").remove();

    svgSel.selectAll("g.gsn-node.undev").each(function () {
      const gNode = d3.select(this);
      const shape = gNode.select("rect, circle, ellipse, polygon");
      if (!shape.node()) return;

      const box = shape.node().getBBox();
      const size = 5;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height + size + 2;

      gNode
        .append("path")
        .attr("class", "undev-diamond")
        .attr(
          "d",
          `
          M ${cx} ${cy - size}
          L ${cx + size} ${cy}
          L ${cx} ${cy + size}
          L ${cx - size} ${cy}
          Z
        `
        );
    });
  }

  function clearAll() {
    nodeG.attr("class", (d) => `gsn-node ${d.kind}${d.isGhost ? " ghost" : ""}`);
    d3.select(rootEl).select("svg.gsn-svg").selectAll("path.undev-diamond").remove();
  }


  function highlightByIds(ids, klass = "overlay") {
    const S = new Set(ids.map(String));
    nodeG.classed(klass, (d) => S.has(String(d.id)));
    if (klass === "undev") updateUndevDiamonds();
  }

  function clearCollections() {
    gOverlay.selectAll("*").remove();
  }

  function addCollections(rows, opts = {}) {
    clearCollections();

    const hubDx = opts.dxHub ?? opts.dx ?? 90;
    const hubDy = opts.dyHub ?? opts.dy ?? 0;
    const arm = opts.armLen ?? 46;

    const grouped = new Map(); // ctx -> Set(items)
    for (const r of rows || []) {
      const ctx = norm(val(r.ctx));
      const item = norm(val(r.item));
      if (!ctx || !item) continue;

      let set = grouped.get(ctx);
      if (!set) {
        set = new Set();
        grouped.set(ctx, set);
      }
      set.add(item);
    }

    const hubsByCtx = new Map();

    for (const [ctx, itemsSet] of grouped.entries()) {
      const host = primaryNodeById.get(ctx);
      if (!host) continue;

      const idx = hubsByCtx.get(ctx) ?? 0;
      hubsByCtx.set(ctx, idx + 1);

      const hubX = host.x + hubDx;
      const hubY = host.y + hubDy + idx * 26;

      const hub = gOverlay.append("g").attr("transform", `translate(${hubX},${hubY})`);
      hub.append("circle").attr("r", 5).attr("class", "collection-dot");

      const items = Array.from(itemsSet);

      items.forEach((itemId, i) => {
        const a = Math.PI / 6 + i * (Math.PI / 6);
        const ix = hubX + Math.cos(a) * arm;
        const iy = hubY + Math.sin(a) * arm;

        gOverlay
          .append("path")
          .attr("class", "gsn-link collection")
          .attr("d", `M${hubX},${hubY} L${ix},${iy}`);

        const lab = String(itemId);
        const w = Math.max(42, Math.min(180, labelWidthPx(lab)));
        const h = 18;

        const gi = gOverlay
          .append("g")
          .attr("class", "gsn-node collection item")
          .attr("transform", `translate(${ix},${iy})`);

        gi.append("rect").attr("width", w).attr("height", h).attr("x", -w / 2).attr("y", -h / 2);
        gi.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .text(lab)
          .append("title")
          .text(lab);
      });
    }
  }

  fit();

  return { fit, destroy, clearAll, highlightByIds, addCollections, clearCollections, svg: svgNode };
}

// ============================================================================
// Lazy-load PaneManager lifecycle wiring
// ============================================================================

let _root = null;
let _ctl = null;
let _offRightTab = null;
let _suspended = false;

const Q_GRAPH = "data/queries/visualize_graph.sparql";
const Q_LAYERS = "data/queries/visualize_layers.sparql";

async function fetchQueryRows(queryPath) {
  if (!app.store) await app.init();

  const query = await fetchRepoTextCached(queryPath, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true,
  });

  const res = app.store.query(query);
  return bindingsToRows(res);
}

async function fetchGraphRows(queryPath = Q_GRAPH) {
  return fetchQueryRows(queryPath);
}

async function fetchLayerRows(queryPath = Q_LAYERS) {
  return fetchQueryRows(queryPath);
}


let _renderSeq = 0;

async function renderIntoRoot({ queryPath = null, renderOpts = {} } = {}) {
  if (!_root) return;

  const seq = ++_renderSeq;
  const qPath = queryPath || "data/queries/visualize_graph.sparql";

  try {
    const graphRows = await fetchGraphRows(qPath);
    const layerRows = await fetchLayerRows(Q_LAYERS);

    // Abort if a newer render started, or pane got unmounted
    if (seq !== _renderSeq || !_root || !_root.isConnected) return;

    try { _ctl?.destroy?.(); } catch { }
    _ctl = null;

    // --- Build ontology-driven layer membership ----------------------------

    const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
    const norm = (x) => String(x ?? "").trim();

    // node -> Set(layerIri)
    const nodeToLayers = new Map();

    // layerIri -> { label, pos }
    const layerInfo = new Map();

    for (const r of layerRows || []) {
      const s = norm(val(r.s));
      const l = norm(val(r.l));
      if (!s || !l) continue;

      addToSetMap(nodeToLayers, s, l);

      if (!layerInfo.has(l)) {
        // Try optional label/position vars (from improved query)
        const lbl = norm(val(r.lbl)) || shortenIri(l);

        let pos = val(r.pos);
        pos = pos != null && pos !== "" ? Number(pos) : null;
        if (!Number.isFinite(pos)) pos = null;

        layerInfo.set(l, { label: lbl, pos });
      }
    }

    // Order layers (pos first, then label)
    const orderedLayerIds = [...layerInfo.entries()]
      .sort((a, b) => {
        const A = a[1], B = b[1];
        const pa = (A.pos == null ? 9999 : A.pos);
        const pb = (B.pos == null ? 9999 : B.pos);
        if (pa !== pb) return pa - pb;
        return String(A.label).localeCompare(String(B.label));
      })
      .map(([id]) => id);

    // Lane labels from ontology
    const laneLabels = orderedLayerIds.map((id) => layerInfo.get(id)?.label ?? shortenIri(id));

    const showUnassigned =
      (renderOpts.showUnassigned != null)
        ? !!renderOpts.showUnassigned
        : loadLocalBool(K_SHOW_UNASSIGNED, { defaultValue: true });



    // Add an optional "Unassigned" lane at the end
    let unassignedLane = -1;

    if (showUnassigned) {
      laneLabels.push("Unassigned");
      unassignedLane = laneLabels.length - 1;
    }

    // layerIri -> laneIndex
    const layerIndex = new Map(orderedLayerIds.map((id, i) => [id, i]));

    // Assign lane index for each node ID
    // - if multiple did:covers layers exist: choose the *lowest index* layer
    // - if none exist: send to Unassigned lane
    const assignLayers = (nodeId /*, depth */) => {
      const set = nodeToLayers.get(String(nodeId));
      if (!set || set.size === 0) return showUnassigned ? [unassignedLane] : [];

      const idxs = [];
      for (const lid of set) {
        const idx = layerIndex.get(lid);
        if (idx != null) idxs.push(idx);
      }
      if (!idxs.length) return showUnassigned ? [unassignedLane] : [];

      // primary = smallest lane index
      idxs.sort((a, b) => a - b);
      return [...new Set(idxs)];
    };


    _ctl = visualizeLayers(graphRows, {
      mount: _root,
      height: 520,
      label: shortenIri,

      // ontology-driven lanes
      laneLabels,
      laneCount: laneLabels.length,
      assignLayers,

      // removes "Unassigned" lane if empty (and any empty layer lanes)
      allowEmptyLanes: false,
      dropUnassigned: !showUnassigned,

      ...renderOpts,
    });

    const cb = _root.querySelector('input[data-act="toggle-unassigned"]');
    if (cb) {
      cb.checked = showUnassigned;

      cb.onchange = () => {
        const v = !!cb.checked;
        saveLocalBool(K_SHOW_UNASSIGNED, v);

        // rerender with the new setting
        renderIntoRoot({
          queryPath: qPath,
          renderOpts: { ...renderOpts, showUnassigned: v },
        }).catch(console.warn);
      };
    }

  } catch (err) {
    console.warn("[layers] render failed:", err);

    // Don’t leave the user with a blank pane
    if (_root && _root.isConnected) {
      _root.innerHTML = `
        <div class="layers-error">
          <b>Layers failed to render</b><br/>
          <pre>${String(err?.message || err)}</pre>
        </div>
      `;
    }
  }
}


function onRightTab(ev) {
  const d = ev?.detail || {};
  if (d.view !== "layers") return;
  if (_suspended) return;

  // Allow the tab to override query path or rendering options
  const queryPath = d.query || null;
  const renderOpts = d.renderOpts || {};
  _suspended = false;

  renderIntoRoot({ queryPath, renderOpts }).catch((err) =>
    console.warn("[layers] render failed:", err)
  );
}

// PaneManager calls this when the layered tab becomes active
export async function mount({ root } = {}) {
  _root = root || resolveEl("#layers-root", { required: true, name: "Layers pane root" });

  // attach right:tab listener only while mounted
  if (!_offRightTab) {
    _offRightTab = bus.on("right:tab", onRightTab);
  }

  // initial render
  await renderIntoRoot();

  // return cleanup callback (PaneManager pattern)
  return () => unmount();
}

export async function resume({ root, payload } = {}) {
  _suspended = false;

  if (root) _root = root;
  // If we were destroyed (e.g. by setRightController teardown), re-render.
  const hasSvg = !!_root?.querySelector?.("svg.gsn-svg");

  if (!_ctl || !hasSvg) {
    const queryPath = payload?.query || null;
    const renderOpts = payload?.renderOpts || {};
    await renderIntoRoot({ queryPath, renderOpts });
    return;
  }

  // Otherwise just fit (fast path)
  try { _ctl?.fit?.(); } catch { }
}


export async function suspend() {
  // if you want: keep state but stop reacting to tab events
  _suspended = true;
}

export async function unmount() {
  _renderSeq++;
  // remove listener
  try {
    _offRightTab?.();
  } catch { }
  _offRightTab = null;

  // destroy controller
  try {
    _ctl?.destroy?.();
  } catch { }
  _ctl = null;

  _root = null;
}

// optional default export
export default {
  mount,
  resume,
  suspend,
  unmount,
  visualizeLayers,
};
