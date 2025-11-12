// /assets/js/layers.js
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import app from "./queries.js"; // re-use the same Store + TTLs that queries.js sets up

// Minimal CSS safety: load the same stylesheet graph.js expects if not present.
(function ensureGraphCss() {
  const base = document.querySelector('meta[name="jekyll-baseurl"]')?.content || '';
  const href = base + '/assets/css/graph.css';
  if ([...document.styleSheets].some(s => s.href && s.href.endsWith(href))) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
})();

// Small helpers (mirror behaviour from queries.js / graph.js without importing internals)
function shorten(iriOrLabel) {
  try {
    const u = new URL(iriOrLabel);
    if (u.hash && u.hash.length > 1) return u.hash.slice(1);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || iriOrLabel;
  } catch {
    return String(iriOrLabel).replace(/^.*[#/]/, "");
  }
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function labelWidth(t, minW = 44, maxW = 180, pad = 12) {
  return Math.min(maxW, Math.max(minW, 7.2 * String(t).length + pad));
}
function termToDisplay(t) {
  if (!t) return "";
  switch (t.termType) {
    case "NamedNode": return t.value;
    case "BlankNode": return "_:" + t.value;
    case "Literal": {
      const dt = t.datatype?.value, lg = t.language;
      if (lg) return `"${t.value}"@${lg}`;
      if (dt && dt !== "http://www.w3.org/2001/XMLSchema#string") return `"${t.value}"^^${dt}`;
      return t.value;
    }
    default: return t.value ?? String(t);
  }
}
function bindingsToRows(iter) {
  const rows = [];
  for (const b of iter) {
    const obj = {};
    for (const [k, v] of b) obj[k] = termToDisplay(v);
    rows.push(obj);
  }
  return rows;
}

export function visualizeLayers(rows, {
  mount  = "#graph",
  width  = null,
  height = 520,
  label  = shorten,
  laneLabels = null,   // e.g., ["Upstream","Input","Model","Output","Downstream","Learn"]
  laneCount = null,
  assignLayer = null,
  allowEmptyLanes = true
} = {}) {
  // Resolve mount & bootstrap container
  const rootEl = typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!rootEl) throw new Error(`visualizeLayers: mount "${mount}" not found`);

  rootEl.innerHTML = `
    <div class="gsn-legend">
      <span><span class="gsn-badge"></span> supported by</span>
      <span class="gsn-hint">scroll: zoom • drag: pan</span>
      <span class="gsn-controls">
        <button class="gsn-btn" data-act="fit">Fit</button>
        <button class="gsn-btn" data-act="reset">Reset</button>
      </span>
    </div>
    <svg class="gsn-svg"><g class="gsn-viewport"></g></svg>
  `;

  const svgNode = rootEl.querySelector(".gsn-svg");
  if (width != null) svgNode.setAttribute("width", String(width));
  svgNode.setAttribute("height", String(height));
  const svg  = d3.select(svgNode);
  const g    = svg.select(".gsn-viewport");
  const defs = svg.append("defs");

  // Arrowheads (match graph.js look & feel)
  function marker(id){
    const m = defs.append("marker")
      .attr("id", id).attr("viewBox","0 0 10 10")
      .attr("refX", 9).attr("refY", 5)
      .attr("markerWidth", 8).attr("markerHeight", 8)
      .attr("orient","auto-start-reverse")
      .attr("class", "gsn-marker norm");
    m.append("path").attr("d","M0,0 L10,5 L0,10 Z").attr("fill", "currentColor");
  }
  const uid     = Math.random().toString(36).slice(2);
  const idArrow = `arrow-${uid}`;
  marker(idArrow);

  // Build adjacency (supportedBy only; layered view focuses on sequential structure)
  const SUP = new Set([
    "supported by","gsn:supportedBy",
    "https://w3id.org/OntoGSN/ontology#supportedBy",
    "http://w3id.org/gsn#supportedBy"
  ]);
  const norm = x => String(x).trim();

  const children = new Map(); // parent -> Set(child)
  const parents  = new Map(); // child -> Set(parent)
  const nodesAll = new Set();
  for (const r of rows) {
    if (!r || !r.s || !r.p || !r.o) continue;
    const S = norm(r.s), P = norm(r.p), O = norm(r.o);
    if (!SUP.has(P)) continue;
    if (!children.has(S)) children.set(S, new Set());
    if (!parents.has(O))  parents.set(O, new Set());
    children.get(S).add(O);
    parents.get(O).add(S);
    nodesAll.add(S); nodesAll.add(O);
  }

  // Roots = nodes never seen as object of supportedBy
  const objects = new Set([...parents.keys()]);
  const roots   = [...nodesAll].filter(n => !objects.has(n));
  if (roots.length === 0) {
    const first = rows.find(r => r && SUP.has(norm(r.p)));
    if (first) roots.push(first.s);
  }

  // BFS layers (depth per node)
  const depth   = new Map();  // id -> layer index (0..)
  const layers  = [];         // Array<Array<id>>
  const seen    = new Set();
  const queue   = [];

  roots.forEach(r => { depth.set(r, 0); queue.push(r); seen.add(r); });

  while (queue.length) {
    const u = queue.shift();
    const du = depth.get(u) ?? 0;
    if (!layers[du]) layers[du] = [];
    layers[du].push(u);
    for (const v of (children.get(u) ? [...children.get(u)] : [])) {
      if (!depth.has(v)) depth.set(v, du + 1);
      if (!seen.has(v)) { seen.add(v); queue.push(v); }
    }
  }

  let lanesArr = layers;

  if (assignLayer) {
    const N = laneCount ?? (laneLabels ? laneLabels.length : layers.length);
    lanesArr = Array.from({ length: N }, () => []);
    for (const id of nodesAll) {
        const d = depth.get(id) ?? 0;
        const k = Math.max(0, Math.min(N - 1, assignLayer(id, d)));
        lanesArr[k].push(id);
    }
    } else if (laneCount != null && laneCount > 0) {
    const N = laneCount;
    lanesArr = layers.length >= N
        ? layers.slice(0, N)
        : layers.concat(Array.from({ length: N - layers.length }, () => []));
    }

  // Layout geometry
  const PAD  = { t: 28, r: 40, b: 28, l: 40 };
  const W    = svgNode.clientWidth  || 900;
  const H    = svgNode.clientHeight || height;
  const L    = lanesArr.length;
  const laneW = Math.max(160, (W - PAD.l - PAD.r) / Math.max(1, L));
  const colX  = i => PAD.l + i * laneW + laneW/2;

  // Background swimlanes
  const lanesG = g.append("g").attr("class","gsn-lanes");
  for (let i = 0; i < L; i++) {
    const gx = PAD.l + i * laneW;
    const ids = lanesArr[i] || [];
    const lane = lanesG.append("g").attr("transform", `translate(${gx},${PAD.t})`);
    lane.append("rect")
      .attr("class", "gsn-lane")
      .attr("x", 0).attr("y", 0)
      .attr("width", laneW).attr("height", Math.max(60, H - PAD.t - PAD.b))
      .attr("rx", 10).attr("ry", 10)
      .attr("fill-opacity", i % 2 ? 0.05 : 0.09);
    const lbl = laneLabels?.[i] ?? `Layer ${i+1}`;
    lane.append("text")
      .attr("class","gsn-lane-label")
      .attr("x", laneW/2).attr("y", -8)
      .attr("text-anchor","middle")
      .text(lbl);
  }

  // Compute node positions inside each lane (even vertical spacing)
  const pos = new Map(); // id -> {x,y,label}
  const laneHeight = Math.max(60, H - PAD.t - PAD.b);
  for (let i = 0; i < L; i++) {
    const ids = lanesArr[i] || [];
    const step = ids.length ? laneHeight / (ids.length + 1) : laneHeight / 2;
    ids.forEach((id, idx) => {
      const x = colX(i);
      const y = PAD.t + (idx + 1) * step;
      pos.set(id, { x, y, label: label(id) });
    });
  }

  const labels = Array.isArray(laneLabels) ? [...laneLabels] : null;
    if (allowEmptyLanes === false) {
    const filtered = [];
    const filteredLabels = labels ? [] : null;
    for (let i = 0; i < lanesArr.length; i++) {
        if ((lanesArr[i] && lanesArr[i].length) || (labels && labels[i] !== undefined)) {
        filtered.push(lanesArr[i]);
        if (filteredLabels) filteredLabels.push(labels[i] ?? `Layer ${filteredLabels.length+1}`);
        }
    }
    lanesArr = filtered;
    // use `labels` (or `filteredLabels`) instead of `laneLabels` when drawing captions
    }


  // Links (only supportedBy) between adjacent layers
  const linkH = d3.linkHorizontal().x(d => d.x).y(d => d.y);
  const links = [];
  for (const [p, kids] of children.entries()) {
    const source = pos.get(p);
    for (const c of kids) {
      const target = pos.get(c);
      if (source && target) links.push({ source, target });
    }
  }

  // Draw links
  g.selectAll("path.gsn-link")
    .data(links)
    .join("path")
      .attr("class","gsn-link")
      .attr("d", d => linkH({
        source: { x: d.source.x + labelWidth(d.source.label)/2, y: d.source.y },
        target: { x: d.target.x - labelWidth(d.target.label)/2, y: d.target.y }
      }))
      .attr("marker-end", `url(#${idArrow})`)
    .append("title").text("supported by");

  // Draw nodes
  const nodes = [...pos.entries()].map(([id, v]) => ({ id, ...v }));
  const nodeG = g.selectAll("g.gsn-node")
    .data(nodes, d => d.id)
    .join("g")
      .attr("class","gsn-node")
      .attr("data-id", d => d.id)
      .attr("transform", d => `translate(${d.x},${d.y})`);

  nodeG.append("rect")
    .attr("width",  d => labelWidth(d.label))
    .attr("height", 26)
    .attr("x", d => -labelWidth(d.label)/2)
    .attr("y", -13);

  nodeG.append("text")
    .attr("text-anchor","middle")
    .attr("dy","0.35em")
    .text(d => d.label)
    .append("title").text(d => d.id);

  // Optional overlay layer for Collections/etc.
  const gOverlay = g.append("g").attr("class","gsn-overlay-collections");

  // Zoom/pan + controls (mirror graph.js behaviour)
  const zoom = d3.zoom().scaleExtent([0.25, 3]).on("zoom", ev => g.attr("transform", ev.transform));
  svg.call(zoom);

  function fit(pad = 40) {
    svg.interrupt();
    const bbox = g.node().getBBox();
    const vw   = svgNode.clientWidth || svgNode.viewBox.baseVal.width || W;
    const vh   = svgNode.clientHeight || svgNode.viewBox.baseVal.height || H;
    const sx   = (vw - pad * 2) / bbox.width;
    const sy   = (vh - pad * 2) / bbox.height;
    const s    = Math.max(0.25, Math.min(2.5, Math.min(sx, sy)));
    const tx   = pad - bbox.x * s + (vw - (bbox.width * s + pad * 2)) / 2;
    const ty   = pad - bbox.y * s + (vh - (bbox.height * s + pad * 2)) / 2;
    const t    = d3.zoomIdentity.translate(tx, ty).scale(s);
    svg.transition().duration(450).call(zoom.transform, t).on("end interrupt", () => svg.call(zoom));
  }
  function reset() {
    svg.interrupt();
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity).on("end interrupt", () => svg.call(zoom));
  }
  function destroy(){ rootEl.innerHTML = ""; }

  // API to keep overlays working with queries.js
  function clearAll(){ nodeG.attr("class","gsn-node"); }
  function highlightByIds(ids, klass = "overlay"){
    const S = new Set(ids);
    nodeG.classed(klass, d => S.has(d.id));
  }

  function clearCollections(){
    gOverlay.selectAll("*").remove();
  }
  function addCollections(rows, opts = {}){
    // rows: [{ctx, clt, item}]
    // simple rendering: a small hub to the RIGHT of the ctx node with item pills around it
    clearCollections();
    const hubsByCtx = new Map();
    const hubDx = opts.dxHub ?? 90;
    const hubDy = opts.dyHub ?? 0;
    const arm   = opts.armLen ?? 46;

    for (const r of rows) {
      const ctx = String(r.ctx ?? "").trim();
      const host = pos.get(ctx);
      if (!host) continue;

      const idx  = (hubsByCtx.get(ctx) ?? 0);
      hubsByCtx.set(ctx, idx + 1);

      const hubX = host.x + hubDx;
      const hubY = host.y + hubDy + idx * 26;

      const hub = gOverlay.append("g").attr("transform", `translate(${hubX},${hubY})`);
      hub.append("circle").attr("r", 5).attr("class","collection-dot");

      const items = (r.item ? [r.item] : []);
      items.forEach((itemId, i) => {
        const a = (Math.PI/6) + i * (Math.PI/6);
        const ix = hubX + Math.cos(a) * arm;
        const iy = hubY + Math.sin(a) * arm;

        gOverlay.append("path").attr("class","gsn-link collection").attr("d", `M${hubX},${hubY} L${ix},${iy}`);

        const lab = String(itemId);
        const w = Math.max(42, Math.min(180, labelWidth(lab))), h = 18;
        const gi = gOverlay.append("g").attr("class","gsn-node collection item").attr("transform", `translate(${ix},${iy})`);
        gi.append("rect").attr("width", w).attr("height", h).attr("x", -w/2).attr("y", -h/2);
        gi.append("text").attr("text-anchor","middle").attr("dy","0.35em").text(lab).append("title").text(lab);
      });
    }
  }

  rootEl.querySelector('[data-act="fit"]')?.addEventListener("click", fit);
  rootEl.querySelector('[data-act="reset"]')?.addEventListener("click", reset);
  fit();

  return { fit, reset, destroy, clearAll, highlightByIds, addCollections, clearCollections, svg: svgNode };
}

// Public helper: switch the app into layered view using the same SPARQL as the tree.
export async function renderLayeredView(opts = {}) {
  // Ensure queries.js finished init (it already runs on DOMContentLoaded)
  if (!app.store) await app.init(); // no-op if already done

  // Reuse the same SPARQL that “Visualize Graph” uses in index.html
  const qURL = document.getElementById("btn-layered-view")?.dataset.q
            || "/assets/data/visualize_graph.sparql";
  const r = await fetch(`${qURL}?v=${performance.timeOrigin}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${qURL}`);
  const query = (await r.text()).replace(/^\uFEFF/, "");

  const res  = app.store.query(query);
  const rows = bindingsToRows(res);

  // Create layered controller and *hand it to the app* so overlays continue to work
  const ctl = visualizeLayers(rows, {
    mount: "#graph",
    height: 520,
    label: shorten,
    // (Optional) customize layer labels here:
    laneLabels: ["Upstream","Input","Model","Output","Downstream","Learn", "xyz"],
    laneCount: 7,
    ...opts
  });

  // Mirror how queries.js exposes graphCtl + resize handling
  app.graphCtl = ctl;
  window.graphCtl = ctl;

  // Keep “fit on resize” parity
  const onResize = () => app.graphCtl && app.graphCtl.fit();
  window.removeEventListener("resize", onResize);
  window.addEventListener("resize", onResize);
}

// Wire the “Layered View” button if present
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-layered-view")?.addEventListener("click", async () => {
    await renderLayeredView();
  });
});

// also export default for convenience (optional)
export default { renderLayeredView, visualizeLayers };
