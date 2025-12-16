import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function visualizeSPO(rows, {
  mount      = ".gsn-host",
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
      <!-- Goal -->
      <span class="gsn-legend-item" title="Goal node">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node goal">
            <rect x="4" y="4" width="72" height="28"></rect>
            <text x="40" y="20" text-anchor="middle">G</text>
          </g>
        </svg>
        goal
      </span>

      <!-- Strategy -->
      <span class="gsn-legend-item" title="Strategy node">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node strategy">
            <!-- simple “parallelogram-ish” polygon -->
            <polygon points="8,4 76,4 68,32 0,32"></polygon>
            <text x="40" y="20" text-anchor="middle">S</text>
          </g>
        </svg>
        strategy
      </span>

      <!-- Solution -->
      <span class="gsn-legend-item" title="Solution node (evidence)">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node solution">
            <circle cx="40" cy="18" r="14"></circle>
            <text x="40" y="20" text-anchor="middle">Sn</text>
          </g>
        </svg>
        solution
      </span>

      <!-- Context (using your .ctx modifier) -->
      <span class="gsn-legend-item" title="context">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node ctx">
            <rect x="4" y="4" width="72" height="28"></rect>
            <text x="40" y="20" text-anchor="middle">C</text>
          </g>
        </svg>
        context
      </span>

      <!-- Assumption / Justification (oval) -->
      <span class="gsn-legend-item" title="assumption / justification">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node ctx">
            <!-- oval shape -->
            <ellipse cx="40" cy="18" rx="34" ry="14"></ellipse>

            <!-- A marker (you could change to A/J if you want) -->
            <text x="40" y="20" text-anchor="middle">A</text>
          </g>
        </svg>
        assumption / justification
      </span>

      <!-- Defeater -->
      <span class="gsn-legend-item" title="Defeater (challenge)">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node def">
            <rect x="4" y="4" width="72" height="28"></rect>
            <text x="40" y="20" text-anchor="middle">D</text>
          </g>
        </svg>
        defeater
      </span>

      <!-- Valid / Invalid / Undeveloped (statuses as node styles) -->
      <span class="gsn-legend-item" title="Node marked as valid">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node valid">
            <rect x="4" y="4" width="72" height="28"></rect>
          </g>
        </svg>
        valid
      </span>

      <span class="gsn-legend-item" title="Artefacts (evidential or contextual)">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node collection item">
            <rect x="4" y="4" width="72" height="28"></rect>
          </g>
        </svg>
        artefacts
      </span>

      <span class="gsn-legend-item" title="Node marked as invalid">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node invalid">
            <rect x="4" y="4" width="72" height="28"></rect>
          </g>
        </svg>
        invalid
      </span>

      <span class="gsn-legend-item" title="Undeveloped goal">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node">
            <rect x="4" y="4" width="72" height="28"></rect>
            <!-- use your existing .undev-diamond styling -->
            <path class="undev-diamond"
                  d="M40 6 L60 18 L40 30 L20 18 Z"></path>
          </g>
        </svg>
        undeveloped
      </span>

      <!-- Rule node -->
      <span class="gsn-legend-item" title="Rule effect node">
        <svg class="gsn-legend-node" viewBox="0 0 80 36">
          <g class="gsn-node rule">
            <rect x="4" y="4" width="72" height="28"></rect>
            <text x="40" y="20" text-anchor="middle">R</text>
          </g>
        </svg>
        rule effects
      </span>

      <span class="gsn-controls"></span>
    </div>
    <svg class="gsn-svg">
      <g class="gsn-viewport"></g>
    </svg>
  `;

  const svgNode = rootEl.querySelector(".gsn-svg");
  if (!svgNode) throw new Error("visualizeSPO: internal error – svg root not found");

  const rect       = rootEl.getBoundingClientRect();
  const pixelWidth = width ?? Math.max(300, rect.width || 800);

  svgNode.setAttribute("width",  String(pixelWidth));
  svgNode.setAttribute("height", String(height));

  /*
  if (width != null) svgNode.setAttribute("width", String(width));
  svgNode.setAttribute("height", String(height));
  */

  const svg              = d3.select(svgNode);
  const g                = svg.select(".gsn-viewport");
  const defs             = svg.append("defs");
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

  marker(idArrow    , "norm");
  marker(idArrowCtx , "ctx");
  marker(idArrowDef , "def");

  function labelWidth(t, 
                      minW = 44, 
                      maxW = 180, 
                      pad  = 12) {
    return Math.min(maxW, Math.max(minW, 7.2 * String(t).length + pad));
  }

  // --- Normalize predicates into Sets
  const norm    = x => String(x).trim();
  const supSet  = new Set(supportedBy.map(norm));
  const ctxSet  = new Set(contextOf.map(norm));
  const chalSet = new Set(challenges.map(norm));

  // Base node height used for layout + shape drawing
  const NODE_H = 26;

    function kindFromTypeIri(typeIri) {
      if (!typeIri) return null;
      const t = String(typeIri);

      if (t.endsWith("#Goal")         || t.endsWith("/Goal"))         return "goal";
      if (t.endsWith("#Strategy")     || t.endsWith("/Strategy"))     return "strategy";
      if (t.endsWith("#Solution")     || t.endsWith("/Solution"))     return "solution";
      if (t.endsWith("#Context")      || t.endsWith("/Context"))      return "context";
      if (t.endsWith("#Assumption")   || t.endsWith("/Assumption"))   return "assumption";
      if (t.endsWith("#Justification")|| t.endsWith("/Justification"))return "justification";

      return null;
    }

  // Infer a GSN element kind from the short label (e.g. "G1", "S1", "Sn1", "A1", "J1").
  // Adjust this if your identifiers use a different convention.
  function inferNodeKind(id, labelText, typeIri) {
    const fromType = kindFromTypeIri(typeIri);
    if (fromType) return fromType;

    const txt = String(labelText || id);
    const p2  = txt.slice(0, 2).toUpperCase();
    const p1  = txt.charAt(0).toUpperCase();

    if (p2 === "SN") return "solution";
    if (p1 === "S")  return "strategy";
    if (p1 === "C")  return "context";
    if (p1 === "A")  return "assumption";
    if (p1 === "J")  return "justification";

    return "goal";
  }

  // OntoGSN type per node, from SPARQL (?type)
  const nodeType = new Map();

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

    // accept ?typeS / ?typeO (new) and ?type (old) for compatibility
    const tS = r.typeS || r.type;
    const tO = r.typeO;

    if (tS) {
      const T = norm(tS);
      if (T) nodeType.set(S, T);
    }
    if (tO) {
      const TO = norm(tO);
      if (TO) nodeType.set(O, TO);
    }

    if (supSet.has(P)) {
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
    const p = [...ps][0];
    if (p) primaryParent.set(child, p);
  }

  // Build adjacency for the layout tree using the primary parent only.
  const layoutChildren = new Map();
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
  const forest    = roots.map(toHierarchy);
  const superRoot = (forest.length === 1) ? forest[0] : { id: "__ROOT__", label: "", children: forest };

  // --- Layout with d3.tree()
  const root  = d3.hierarchy(superRoot, d => d.children);
  const dx    = 200;
  const dy    = 80;
  d3.tree().nodeSize([dx, dy])(root);

  // Position map: id -> {x,y,data}
  const pos = new Map();
  root.descendants().forEach(d => {
    if (d.data.id !== "__ROOT__") {
      pos.set(d.data.id, { x: d.x, y: d.y, data: d.data });
    }
  });

  // Unique nodes for rendering (no duplicates)
  const nodes = [...pos.entries()].map(([id, v]) => {
    const lbl      = v.data.label;
    const typeIri  = nodeType.get(id) || null;
    const kind     = inferNodeKind(id, lbl, typeIri);
    return {
      id,
      label: lbl,
      x: v.x,
      y: v.y,
      w: labelWidth(lbl),
      h: NODE_H,
      kind,
      contexts: v.data.contexts || [],
      typeIri
    };
  });

  const nodeById = new Map(nodes.map(n => [n.id, n]));


  // Links:
  //  - treeLinks: only primary-parent edges (what drove the layout)
  //  - extraLinks: every other parent->child edge (to get multi-parents)
  const treeLinks = [];
  for (const [child, parent] of primaryParent.entries()) {
    const src = nodeById.get(parent);
    const tgt = nodeById.get(child);
    if (src && tgt) treeLinks.push({ source: src, target: tgt });
  }

  const extraLinks = [];
  for (const [child, ps] of parents.entries()) {
    for (const p of ps) {
      if (primaryParent.get(child) === p) continue; // primary edge already in treeLinks
      const src = nodeById.get(p);
      const tgt = nodeById.get(child);
      if (src && tgt) extraLinks.push({ source: src, target: tgt });
    }
  }


  // Context nodes placed to the right on same rank
  const ctxNodes = [], ctxLinks = [];
  const ctxPos = new Map();
  const ctxOffsetX = 80, ctxOffsetY = 50;
  for (const n of nodes) {
    const ctxs = n.contexts ?? [];
    const srcW = n.w;
    ctxs.forEach((c, i) => {
      const x = n.x + ctxOffsetX + i * ctxOffsetY;
      const y = n.y; 
      const tgtW = labelWidth(c.label);

      const typeIri = nodeType.get(c.id) || null;
      const kind    = inferNodeKind(c.id, c.label, typeIri) || "context";
      const w       = labelWidth(c.label);
      const h       = NODE_H;

      ctxNodes.push({
        id: c.id,
        label: c.label,
        x,
        y,
        contextOf: n.id,
        kind,
        typeIri,
        w,
        h
      });
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
    const tgtW = n.w;
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
  console.debug("nodes"     , nodes.length      , nodes.slice(0, 3));
  console.debug("treeLinks" , treeLinks.length  , treeLinks.slice(0, 3));
  console.debug("extraLinks", extraLinks.length , extraLinks.slice(0, 3));
  console.debug("ctxLinks"  , ctxLinks.length   , ctxLinks.slice(0, 3));
  console.debug("defLinks"  , defLinks.length   , defLinks.slice(0, 3));

  // --- Collections
  const extNodeById = new Map();
  let collectionsDrawn = false;

  function getHostPos(id) {
    const key = String(id).trim();
    const p   = pos.get(key) || ctxPos.get(key);
    return p ? { x: p.x, y: p.y } : null;
  }

  function makeExternalNode(id, x, y, kind) {
    // draw a small rounded-rect + text (very lightweight)
    const g = gOverCollections.append("g")
      .attr("class"     , `gsn-node collection ext ${kind}`)
      .attr("data-id"   , id)
      .attr("transform" , `translate(${x},${y})`);

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

  //const NODE_H = 26;
  g.selectAll("path.gsn-link")
    .data(treeLinks)
    .join("path")
      .attr("class", "gsn-link")
      .attr("d", d => linkV({
        source: { x: d.source.x,
                  y: d.source.y + d.source.h / 2 },
        target: { x: d.target.x,
                  y: d.target.y - d.target.h / 2 }
      }))
      .attr("marker-end", `url(#${idArrow})`)
    .append("title").text("supported by");

  g.selectAll("path.gsn-link.extra")
    .data(extraLinks)
    .join("path")
      .attr("class", "gsn-link extra")
      .attr("d", d => linkV({
        source: { x: d.source.x,
                  y: d.source.y + d.source.h / 2 },
        target: { x: d.target.x,
                  y: d.target.y - d.target.h / 2 }
      }))
      .attr("marker-end", `url(#${idArrow})`)
    .append("title").text("supported by");

  g.selectAll("path.gsn-link.ctx")
    .data(ctxLinks)
    .join("path")
      .attr("class", "gsn-link ctx")
      //.attr("d", d => linkLine(d))
      .attr("d", d => linkH({
        source: { x: d.source.x + ((d.source?.w ?? 0) / 2), 
                  y: d.source.y },
        target: { x: d.target.x - ((d.target?.w ?? 0) / 2), 
                  y: d.target.y }
      }))
      .attr("marker-end", `url(#${idArrowCtx})`)
    .append("title").text("in context of");

  g.selectAll("path.gsn-link.def")
    .data(defLinks)
    .join("path")
      .attr("class", "gsn-link def")
      //.attr("d", d => linkLine(d))
      .attr("d", d => linkH({
        source: { x: d.source.x + ((d.source?.w ?? 0) / 2), 
                  y: d.source.y },
        target: { x: d.target.x - ((d.target?.w ?? 0) / 2), 
                  y: d.target.y }
      }))
      .attr("marker-end", `url(#${idArrowDef})`)
    .append("title").text("challenges");

  const nodeG = g.selectAll("g.gsn-node")
    .data(nodes)
    .join("g")
      .attr("class", d => `gsn-node ${d.kind}`)
      .attr("transform", d => `translate(${d.x},${d.y})`);


  const defG = g.selectAll("g.gsn-node.def")
    .data(defNodes)
    .join("g")
      .attr("class", "gsn-node def")
      .attr("transform", d => `translate(${d.x},${d.y})`);
  
  defG.on("click", (ev, d) => {
    window.dispatchEvent(new CustomEvent("gsn:defeaterClick", {
      detail: { id: d.id, 
                label: d.label }   // prefer IRI id
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

  function clearAll() {
    nodeG.attr("class", d => `gsn-node ${d.kind}`);
    ctxG.attr("class", d => `gsn-node ctx ${d.kind}`);
    defG.attr("class", "gsn-node def");

    d3.select(rootEl)
      .select("svg.gsn-svg")
      .selectAll("path.undev-diamond")
      .remove();
  }

  
  function highlightByIds(ids, klass){ 
    const S = new Set(ids.map(String));

    nodeG.classed(klass, d => S.has(d.id));
    ctxG.classed( klass, d => S.has(String(d.id)));
    defG.classed( klass, d => S.has(String(d.id)));

    if (klass === "undev") {
      updateUndevDiamonds(rootEl);
    }
  }

  // --- Core node shapes per GSN element kind -----------------------------
  const shapeG = nodeG.append("g")
    .attr("class", "gsn-node-shape");

  shapeG.each(function (d) {
    const gShape = d3.select(this);
    const w = d.w;
    const h = d.h;
    const x = -w / 2;
    const y = -h / 2;

    if (d.kind === "solution") {
      // Circle for solutions
      const r = Math.max(w, h) / 2;
      gShape.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", r);
    } else if (d.kind === "strategy") {
      // Parallelogram for strategies
      const slant = Math.min(20, w / 5);
      const points = [
        [x + slant,     y],
        [x + w + slant, y],
        [x + w - slant, y + h],
        [x - slant,     y + h]
      ].map(p => p.join(",")).join(" ");
      gShape.append("polygon")
        .attr("points", points);
    } else if (d.kind === "assumption" || d.kind === "justification") {
      // Oval for assumption / justification
      const rx = w / 2;
      const ry = h / 2;
      gShape.append("ellipse")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("rx", rx)
        .attr("ry", ry);
    } else {
      // Plain rectangle for goals (default)
      gShape.append("rect")
        .attr("width",  w)
        .attr("height", h)
        .attr("x", x)
        .attr("y", y);
    }
  });

  // Centered node label (e.g. "G1", "S1", "Sn1")
  nodeG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text(d => d.label)
    .append("title").text(d => d.id);

  // "A" / "J" marker near bottom-right for assumptions / justifications
  const ajNodes = nodeG.filter(d => d.kind === "assumption" || d.kind === "justification");
  ajNodes.append("text")
    .attr("class", "gsn-node-tag")
    .attr("text-anchor", "start")
    .attr("x", d => d.w / 2 - 6)
    .attr("y", d => d.h / 2 + 8)  // slightly outside the oval
    .text(d => d.kind === "assumption" ? "A" : "J");

  const ctxG = g.selectAll("g.gsn-node.ctx")
    .data(ctxNodes)
    .join("g")
      .attr("class", d => `gsn-node ctx ${d.kind}`)
      .attr("transform", d => `translate(${d.x},${d.y})`);

  ctxG.on("click", (ev, d) => {
    window.dispatchEvent(new CustomEvent("gsn:contextClick", {
      detail: { id: d.id, label: d.label } // id: IRI, label: "C1"/"A1"/"J1"
    }));
  });

  // Shape: rect for normal context, ellipse for assumption/justification
  ctxG.each(function (d) {
    const gCtx = d3.select(this);
    const w = d.w;
    const h = d.h;
    const x = -w / 2;
    const y = -h / 2;

    if (d.kind === "assumption" || d.kind === "justification") {
      gCtx.append("ellipse")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("rx", w / 2)
        .attr("ry", h / 2);
    } else {
      gCtx.append("rect")
        .attr("width",  w)
        .attr("height", h)
        .attr("x",      x)
        .attr("y",      y);
    }
  });

  ctxG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text(d => d.label)
    .append("title").text(d => `${d.id} (context of ${d.contextOf})`);

  // A/J marker on the bottom-right for assumptions/justifications
  const ctxAJ = ctxG.filter(d => d.kind === "assumption" || d.kind === "justification");
  ctxAJ.append("text")
    .attr("class", "gsn-node-tag")
    .attr("text-anchor", "start")
    .attr("x", d => d.w / 2 - 6)
    .attr("y", d => d.h / 2 + 8)
    .text(d => d.kind === "assumption" ? "A" : "J");

  // --- Zoom/Pan + controls
  const zoom = d3.zoom().scaleExtent([0.25, 3]).on("zoom", ev => g.attr("transform", ev.transform));
  svg.call(zoom);

  function fit(pad = 40) {
    svg.interrupt();

    const gNode = g.node();
    if (!gNode) return;

    const bbox = g.node().getBBox();
    if (!bbox.width || !bbox.height) return;
    
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
    const dxHub     = opts.dxHub     ?? opts.dx     ?? 90;
    const dyHub     = opts.dyHub     ?? opts.dy     ?? 40;
    const dyStride  = opts.dyStride  ?? 30;
    const rHub      = opts.rHub      ?? 5;
    const rItem     = opts.rItem     ?? 4;
    const armLen    = opts.armLen    ?? 50;
    const maxPerRow = opts.maxPerRow ?? 6;

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
        const ring        = Math.floor(i / perRing);
        const pos         = i % perRing;
        const startAngle  = opts.startAngle ?? Math.PI / 2;
        const angle       = startAngle + (2 * Math.PI / perRing) * pos; // start upwards
        const radius      = baseR + ring * ringGap;
        const ix          = hubX + Math.cos(angle) * radius;
        const iy          = hubY + Math.sin(angle) * radius;

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

  function updateUndevDiamonds(rootEl) {
    const svg = d3.select(rootEl).select("svg.gsn-svg");

    // Remove any existing diamonds so we don't duplicate them
    svg.selectAll("path.undev-diamond").remove();

    // For each undeveloped node, add a diamond under its rect
    svg.selectAll("g.gsn-node.undev").each(function () {
      const g = d3.select(this);
      const shape = g.select("rect, circle, ellipse, polygon");
      if (!shape.node()) return;

      const box = shape.node().getBBox();

      // Size of the diamond (half the “width” of the diamond)
      const size = 6;

      // Center X under the node, Y just below the rect
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height + size + 1; // +2px gap under the box

      g.append("path")
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

  rootEl.querySelector('[data-act = "fit"]')?.addEventListener("click", fit);
  rootEl.querySelector('[data-act = "reset"]')?.addEventListener("click", reset);
  fit();

  return { fit, reset, destroy, svg: svgNode, clearAll, highlightByIds, addCollections, clearCollections };
}

let __gsnCssLinked = false;
function ensureGraphCss(href = "OntoGSN/assets/css/graph.css") {
  if (__gsnCssLinked) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  __gsnCssLinked = true;
}