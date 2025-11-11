/**
 * graph.js — GSN DAG renderer (supportedBy, inContextOf, challenges).
 * Public API:
 *   visualizeSPO(rows: Array<{s,p,o}>, options) -> controller
 * Controller methods:
 *   - fit(): auto-zoom
 *   - reset(): back to initial view
 *   - highlightByIds(ids, className): highlight nodes + incident edges
 *   - clearAll(): remove highlights
 *   - destroy(): cleanup event listeners + DOM
 * Emits custom events:
 *   - "gsn:contextClick", detail: { id }
 *   - "gsn:defeaterClick", detail: { id }
 */

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

/**
 * visualizeSPO
 * Renders a GSN tree (supportedBy) with same-level "in context of" nodes.
 *
 * @param {Array<{s:string,p:string,o:string}>} rows  SPARQL rows (?s ?p ?o)
 * @param {Object} options
 *   - mount:   CSS selector or HTMLElement to mount into (default "#graph")
 *   - width:   number | null (auto width if null)
 *   - height:  number (default 520)
 *   - supportedBy: string[] of allowed predicate values for supportedBy
 *   - contextOf:   string[] of allowed predicate values for inContextOf
 *   - label:   (id:string)=>string label mapper (shorten IRIs, etc.)
 *   - theme:   "light"|"dark" (minor styling tweak)
 * @returns {Object} controller with { fit(), reset(), destroy() }
 */
export function visualizeSPO(rows, {
  mount      = "#graph",
  width      = null,
  height     = 520,
  supportedBy = ["supported by",
                 "gsn:supportedBy",
                 "https://w3id.org/OntoGSN/ontology#supportedBy",
                 "http://w3id.org/gsn#supportedBy"],
  contextOf   = ["in context of",
                 "gsn:inContextOf",
                 "https://w3id.org/OntoGSN/ontology#inContextOf",
                 "http://w3id.org/gsn#inContextOf"],
  challenges  = ["challenges",
                 "gsn:challenges",
                 "https://w3id.org/OntoGSN/ontology#challenges",
                 "http://w3id.org/gsn#challenges"],
  label = d => d,
} = {}) {
  // --- Resolve mount
  const rootEl = typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!rootEl) throw new Error(`visualizeSPO: mount "${mount}" not found`);

  ensureGraphCss(); // Ensure minimal styles once per page

  // --- Reset mount content (idempotent)
  rootEl.innerHTML = `
    <div class="gsn-legend">
      <span><span class="gsn-badge"></span> supported by</span>
      <span><span class="gsn-badge ctx"></span> in context of</span>
      <span><span class="gsn-badge def"></span> challenges</span>
      <span><span class="gsn-badge clt"></span> refers to</span>
      <span><span class="gsn-badge vld"></span> valid</span>
      <span><span class="gsn-badge ivld"></span> invalid</span>
      <span><span class="gsn-badge undev"></span> undeveloped</span>
      <span><span class="gsn-badge rule"></span> rule effects</span>
      
      <span class="gsn-controls">
        <button class="gsn-btn" data-act="fit">Fit</button>
        <!-- <button class="gsn-btn" data-act="reset">Reset</button> -->
      </span>
    </div>
    <svg class="gsn-svg"><g class="gsn-viewport"></g></svg>
  `;

  const svgNode = rootEl.querySelector(".gsn-svg");
  if (width != null) svgNode.setAttribute("width", String(width));
  svgNode.setAttribute("height", String(height));

  const svg   = d3.select(svgNode);
  const g     = svg.select(".gsn-viewport");
  const defs  = svg.append("defs");
  const gOverCollections = g.append("g").attr("class", "gsn-overlay-collections");

  function marker(id, klass){
    const m = defs.append("marker")
      .attr("id", id).attr("viewBox","0 0 10 10")
      .attr("refX", 9).attr("refY", 5)
      .attr("markerWidth", 8).attr("markerHeight", 8)
      .attr("orient","auto-start-reverse")
      .attr("class", `gsn-marker ${klass}`);
    m.append("path").attr("d","M0,0 L10,5 L0,10 Z").attr("fill", "currentColor");
  }

  const uid        = Math.random().toString(36).slice(2);
  const idArrow    = `arrow-${uid}`;
  const idArrowCtx = `arrow-ctx-${uid}`;
  const idArrowDef = `arrow-def-${uid}`;

  marker(idArrow, "norm");
  marker(idArrowCtx, "ctx");
  marker(idArrowDef, "def");

  function labelWidth(t, minW = 44, maxW = 180, pad = 12) {
    return Math.min(maxW, Math.max(minW, 7.2 * String(t).length + pad));
  }

  // --- Normalize predicates into Sets
  const norm = x => String(x).trim();
  const supSet = new Set(supportedBy.map(norm));
  const ctxSet = new Set(contextOf.map(norm));
  const chalSet = new Set(challenges.map(norm));

  // --- Build adjacency from rows
  const children = new Map();
  const parents  = new Map();
  const context  = new Map();
  const allNodes = new Set();
  const defeat   = new Map();

  const add = (map, k, v) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(v); };

  for (const r of rows) {
    if (!r || !r.s || !r.p || !r.o) continue;
    const S = norm(r.s), P = norm(r.p), O = norm(r.o);
    if (supSet.has(P)) {
      // only supportedBy triples define the tree’s nodes
      allNodes.add(S); allNodes.add(O);
      add(children, S, O); add(parents, O, S);
    } else if (ctxSet.has(P)) {
      add(context, S, O);
    } else if (chalSet.has(P)) {
      add(defeat, O, S);
    }
  }

  // --- Roots = nodes never seen as object of supportedBy
  const supportedObjects = new Set([...parents.keys()]);
  const roots = [...allNodes].filter(n => !supportedObjects.has(n));
  if (roots.length === 0) {
    const first = rows.find(r => r && supSet.has(norm(r.p)));
    if (first) roots.push(first.s);
  }

  // --- Build a primary-parent map (spanning tree) for layout
  // For every node with parents, choose the first one encountered as primary.
  const primaryParent = new Map();   // child -> chosen parent
  for (const [child, ps] of parents.entries()) {
    // keep ordering stable: Array spread keeps insertion order
    const p = [...ps][0];
    if (p) primaryParent.set(child, p);
  }

  // Build adjacency for the layout tree using the primary parent only.
  const layoutChildren = new Map();  // parent -> Set(children) for spanning tree
  const addLC = (k, v) => { if (!layoutChildren.has(k)) layoutChildren.set(k, new Set()); layoutChildren.get(k).add(v); };

  // traverse starting from each root to collect the spanning tree
  const visited = new Set();
  function walkTree(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const kids = children.get(id) ? [...children.get(id)] : [];
    for (const c of kids) {
      if (primaryParent.get(c) === id) {
        addLC(id, c);
        walkTree(c);
      }
    }
  }
  roots.forEach(walkTree);

  // Build a hierarchy object for d3.tree() using layoutChildren
  function toHierarchy(id) {
    return {
      id,
      label: label(id),
      children: layoutChildren.get(id) ? [...layoutChildren.get(id)].map(toHierarchy) : [],
      contexts: context.get(id) ? [...context.get(id)].map(cid => ({ id: cid, label: label(cid), _contextOf: id })) : []
    };
  }
  const forest = roots.map(toHierarchy);
  const superRoot = (forest.length === 1) ? forest[0] : { id: "__ROOT__", label: "", children: forest };

  // --- Layout with d3.tree()
  const root = d3.hierarchy(superRoot, d => d.children);
  const dx = 200, dy = 80;
  d3.tree().nodeSize([dx, dy])(root);

  // Position map: id -> {x,y}
  const pos = new Map();
  root.descendants().forEach(d => { if (d.data.id !== "__ROOT__") pos.set(d.data.id, { x: d.x, y: d.y, data: d.data }); });

  // Unique nodes for rendering (no duplicates)
  const nodes = [...pos.entries()].map(([id, v]) => ({ id, label: v.data.label, x: v.x, y: v.y, contexts: v.data.contexts || [] }));

  // Links:
  //  - treeLinks: only primary-parent edges (what drove the layout)
  //  - extraLinks: every other parent->child edge (to get multi-parents)
  const treeLinks = [];
  for (const [child, parent] of primaryParent.entries()) {
    if (pos.has(child) && pos.has(parent)) treeLinks.push({ source: pos.get(parent), target: pos.get(child) });
  }

  const extraLinks = [];
  for (const [child, ps] of parents.entries()) {
    for (const p of ps) {
      if (primaryParent.get(child) === p) continue; // skip primary edge (already in treeLinks)
      if (pos.has(child) && pos.has(p)) extraLinks.push({ source: pos.get(p), target: pos.get(child) });
    }
  }

  // Context nodes placed to the right on same rank
  const ctxNodes = [], ctxLinks = [];
  const ctxPos = new Map();
  const ctxOffsetX = 80, ctxOffsetY = 50;
  for (const n of nodes) {
    const ctxs = n.contexts ?? [];
    const srcW = labelWidth(n.label);
    ctxs.forEach((c, i) => {
      const x = n.x + ctxOffsetX + i * ctxOffsetY;
      const y = n.y; 
      const tgtW = labelWidth(c.label);

      ctxNodes.push({ id: c.id, label: c.label, x, y, contextOf: n.id });
      ctxPos.set(c.id, { x, y, host: n.id });

      ctxLinks.push({
        source: { x: n.x, y: n.y, w: srcW },
        target: { x,   y,   w: tgtW }
      });
    });
  }

  const defNodes = [], defLinks = [];
  const defOffsetX = 80, defOffsetY = 50;
  for (const n of nodes) {
    const defs = defeat.get(n.id) ? [...defeat.get(n.id)] : [];
    const tgtW = labelWidth(n.label);
    defs.forEach((dft, i) => {
      const x = n.x - defOffsetX - i * defOffsetY; // to the LEFT
      const y = n.y;
      const lab = label(dft);
      const srcW = Math.max(36, Math.min(120, 7.2 * lab.length + 10));
      defNodes.push({ id: dft, label: label(dft), x, y, challenges: n.id });
      //defLinks.push({ source: { x, y }, target: { x: n.x, y: n.y } });
      defLinks.push({
        source: { x, y, w: srcW },
        target: { x: n.x, y: n.y, w: tgtW }
      });
    });
  }
  console.debug("nodes", nodes.length, nodes.slice(0, 3));
  console.debug("treeLinks", treeLinks.length, treeLinks.slice(0, 3));
  console.debug("extraLinks", extraLinks.length, extraLinks.slice(0, 3));
  console.debug("ctxLinks", ctxLinks.length, ctxLinks.slice(0, 3));
  console.debug("defLinks", defLinks.length, defLinks.slice(0, 3));

  // --- Collections
  const extNodeById = new Map();
  let collectionsDrawn = false;

  function getHostPos(id) {
    const key = String(id).trim();
    const p = pos.get(key) || ctxPos.get(key);
    return p ? { x: p.x, y: p.y } : null;
  }

  function makeExternalNode(id, x, y, kind) {
    // draw a small rounded-rect + text (very lightweight)
    const g = gOverCollections.append("g")
      .attr("class", `gsn-node collection ext ${kind}`)
      .attr("data-id", id)
      .attr("transform", `translate(${x},${y})`);

    g.append("rect")
      .attr("x", -28).attr("y", -12)
      .attr("width", 56).attr("height", 24)
      .attr("rx", 6).attr("ry", 6);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(kind === "clt" ? "Collection" : "Item");

    extNodeById.set(id, { x, y, kind, g });
    return extNodeById.get(id);
  }

  function link(a, b, cls = "collection") {
    gOverCollections.append("path")
      .attr("class", `gsn-link ${cls}`)
      .attr("d", `M${a.x},${a.y} L${b.x},${b.y}`);
  }


  // --- Render
  const linkV = d3.linkVertical().x(d => d.x).y(d => d.y);
  const linkH = d3.linkHorizontal().x(d => d.x).y(d => d.y);

  const NODE_H = 26;
  g.selectAll("path.gsn-link")
    .data(treeLinks)
    .join("path")
      .attr("class", "gsn-link")
      .attr("d", d => linkV({ 
        //source: d.source, target: d.target 
        source: { x: d.source.x, y: d.source.y + NODE_H/2 },
        target: { x: d.target.x, y: d.target.y - NODE_H/2 }
      }))
      .attr("marker-end", `url(#${idArrow})`)
    .append("title").text("supported by");

  g.selectAll("path.gsn-link.extra")
    .data(extraLinks)
    .join("path")
      .attr("class", "gsn-link extra")
      .attr("d", d => linkV({ 
        //source: d.source, target: d.target 
        source: { x: d.source.x, y: d.source.y + NODE_H/2 },
        target: { x: d.target.x, y: d.target.y - NODE_H/2 }
      }))
      .attr("marker-end", `url(#${idArrow})`)
    .append("title").text("supported by");

  g.selectAll("path.gsn-link.ctx")
    .data(ctxLinks)
    .join("path")
      .attr("class", "gsn-link ctx")
      //.attr("d", d => linkLine(d))
      .attr("d", d => linkH({
        source: { x: d.source.x + ((d.source?.w ?? 0) / 2), y: d.source.y },
        target: { x: d.target.x - ((d.target?.w ?? 0) / 2), y: d.target.y }
      }))
      .attr("marker-end", `url(#${idArrowCtx})`)
    .append("title").text("in context of");

  g.selectAll("path.gsn-link.def")
    .data(defLinks)
    .join("path")
      .attr("class", "gsn-link def")
      //.attr("d", d => linkLine(d))
      .attr("d", d => linkH({
        source: { x: d.source.x + ((d.source?.w ?? 0) / 2), y: d.source.y },
        target: { x: d.target.x - ((d.target?.w ?? 0) / 2), y: d.target.y }
      }))
      .attr("marker-end", `url(#${idArrowDef})`)
    .append("title").text("challenges");

  const nodeG = g.selectAll("g.gsn-node")
    .data(nodes)
    .join("g")
      .attr("class", "gsn-node")
      .attr("transform", d => `translate(${d.x},${d.y})`);

  const defG = g.selectAll("g.gsn-node.def")
    .data(defNodes)
    .join("g")
      .attr("class", "gsn-node def")
      .attr("transform", d => `translate(${d.x},${d.y})`);
  
  defG.on("click", (ev, d) => {
    window.dispatchEvent(new CustomEvent("gsn:defeaterClick", {
      detail: { id: d.id, label: d.label }   // prefer IRI id
    }));
  });

  g.selectAll("g.gsn-node.def").raise();

  defG.append("rect")
    .attr("width", d => Math.max(36, Math.min(120, 7.2 * String(d.label).length + 10)))
    .attr("height", 18)
    .attr("x", d => -Math.max(36, Math.min(120, 7.2 * String(d.label).length + 10)) / 2)
    .attr("y", -9);

  defG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text(d => d.label)
    .append("title").text(d => `${d.id} (challenges ${d.challenges})`);

  function clearAll(){ 
    nodeG.attr("class","gsn-node"); 
    ctxG.attr("class", "gsn-node ctx");
    defG.attr("class", "gsn-node def");
  }
  function highlightByIds(ids, klass){
    const S = new Set(ids.map(String));
    nodeG.classed(klass, d => S.has(d.id));
    ctxG.classed(klass, d => S.has(String(d.id)));
    defG.classed(klass, d => S.has(String(d.id)));
  }
  window.graphCtl = { clearAll, highlightByIds, fit, reset };

  nodeG.append("rect")
    .attr("width", d => labelWidth(d.label))
    .attr("height", 26)
    .attr("x", d => -labelWidth(d.label)/2)
    .attr("y", -13);

  nodeG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text(d => d.label)
    .append("title").text(d => d.id);

  const ctxG = g.selectAll("g.gsn-node.ctx")
    .data(ctxNodes)
    .join("g")
      .attr("class", "gsn-node ctx")
      .attr("transform", d => `translate(${d.x},${d.y})`);

  ctxG.on("click", (ev, d) => {
    window.dispatchEvent(new CustomEvent("gsn:contextClick", {
      detail: { id: d.id, label: d.label } // id: IRI, label: "C1"
    }));
  });

  ctxG.append("rect")
    .attr("width", d => labelWidth(d.label))
    .attr("height", 22)
    .attr("x", d => -labelWidth(d.label)/2)
    .attr("y", -11);

  ctxG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text(d => d.label)
    .append("title").text(d => `${d.id} (context of ${d.contextOf})`);

  // --- Zoom/Pan + controls
  const zoom = d3.zoom().scaleExtent([0.25, 3]).on("zoom", ev => g.attr("transform", ev.transform));
  svg.call(zoom);

  function fit(pad = 40) {
    svg.interrupt();
    const bbox = g.node().getBBox();
    const vw   = svgNode.clientWidth || svgNode.viewBox.baseVal.width || 800;
    const vh   = svgNode.clientHeight || svgNode.viewBox.baseVal.height || height;
    const sx   = (vw - pad * 2) / bbox.width;
    const sy   = (vh - pad * 2) / bbox.height;
    const s    = Math.max(0.25, Math.min(2.5, Math.min(sx, sy)));
    const tx   = pad - bbox.x * s + (vw - (bbox.width * s + pad * 2)) / 2;
    const ty   = pad - bbox.y * s + (vh - (bbox.height * s + pad * 2)) / 2;

    const t = d3.zoomIdentity.translate(tx, ty).scale(s);
    svg.transition()
      .duration(450)
      .call(zoom.transform, t)
      .on("end interrupt", () => {svg.call(zoom)});
    if (!vw || !vh) return;
  }
  function reset()  { 
    svg.interrupt(); 
    svg.transition()
      .duration(400)
      .call(zoom.transform, d3.zoomIdentity)
      .on("end interrupt", () => svg.call(zoom)); 
    }
  function destroy() { rootEl.innerHTML = ""; }

  function clearCollections() {
    gOverCollections.selectAll("*").remove();
    extNodeById.clear();
    collectionsDrawn = false;
  }

  function addCollections(rows, opts = {}) {
    // rows: [{ctx, clt, item}]
    const dxHub     = opts.dxHub     ?? 90;  // hub distance to the right of the anchor
    const dyHub     = opts.dyHub     ?? 40;
    const dyStride  = opts.dyStride  ?? 30;  // vertical spacing between multiple hubs per same ctx
    const rHub      = opts.rHub      ?? 5;   // hub (collection) radius
    const rItem     = opts.rItem     ?? 4;   // item dot radius
    const armLen    = opts.armLen    ?? 50;  // hub→item spoke length
    const maxPerRow = opts.maxPerRow ?? 6;   // number of items to arrange around hub before next ring

    const groups = new Map(); // key: `${ctx}||${clt}` → { ctx, clt, items: Set<item> }
    for (const r of rows) {
      const key = `${r.ctx}||${r.clt}`;
      let g = groups.get(key);
      if (!g) { g = { ctx: r.ctx, clt: r.clt, items: new Set() }; groups.set(key, g); }
      g.items.add(r.item);
    }

    const hubsPerCtx = new Map(); // ctx → count
    for (const gk of groups.keys()) {
      const { ctx, clt, items } = groups.get(gk);
      const host = getHostPos(ctx);
      if (!host) continue; // no anchor on canvas, skip

      const idx = (hubsPerCtx.get(ctx) ?? 0);
      hubsPerCtx.set(ctx, idx + 1);

      const hubX = host.x + dxHub;
      const hubY = host.y + dyHub + idx*dyStride; // south + stacked south

      // Hub (collection) as a small dot
      const hub = gOverCollections.append("g")
        .attr("class", "collection-hub")
        .attr("transform", `translate(${hubX},${hubY})`);

      hub.append("circle")
        .attr("r", rHub)
        .attr("class", "collection-dot");

      // Link from anchor (context/main) to hub
      gOverCollections.append("path")
        .attr("class", "gsn-link collection")
        .attr("d", `M${host.x},${host.y} L${hubX},${hubY}`);

      // 3) Arrange items in a small radial fan around the hub
      const itemList = Array.from(items);
      const perRing  = Math.max(1, maxPerRow);
      const ringGap  = 16;     // distance between concentric rings of items
      const baseR    = armLen; // radius for first ring

      itemList.forEach((itemId, i) => {
        const ring = Math.floor(i / perRing);
        const pos  = i % perRing;
        const startAngle = opts.startAngle ?? Math.PI / 2;
        const angle = startAngle + (2 * Math.PI / perRing) * pos; // start upwards

        const radius = baseR + ring * ringGap;
        const ix = hubX + Math.cos(angle) * radius;
        const iy = hubY + Math.sin(angle) * radius;

        // spoke
        gOverCollections.append("path")
          .attr("class", "gsn-link collection")
          .attr("d", `M${hubX},${hubY} L${ix},${iy}`);

        // item dot (with <title> tooltip so we don’t clutter with labels)
        const itemLabel = label(itemId);
        const w = Math.max(42, Math.min(180, labelWidth(itemLabel))); // clamp width a bit
        const h = 20;

        const gi = gOverCollections.append("g")
          .attr("class", "gsn-node collection item")
          .attr("transform", `translate(${ix},${iy})`);

        gi.append("rect")
          .attr("width", w)
          .attr("height", h)
          .attr("x", -w / 2)
          .attr("y", -h / 2);

        gi.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .text(itemId)
          .append("title").text(itemId);
      });
    }

    collectionsDrawn = true;
  }

  rootEl.querySelector('[data-act="fit"]')?.addEventListener("click", fit);
  rootEl.querySelector('[data-act="reset"]')?.addEventListener("click", reset);
  fit();

  return { fit, reset, destroy, svg: svgNode, clearAll, highlightByIds, addCollections, clearCollections };
}

let __gsnCssLinked = false;
function ensureGraphCss(href = "/assets/css/graph.css") {
  if (__gsnCssLinked) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  __gsnCssLinked = true;
}