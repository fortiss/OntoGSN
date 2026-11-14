// assets/panes/graph/graph.view.js

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function requireChild(rootEl, selector, message = selector) {
  const el = rootEl.querySelector(selector);
  if (!el) throw new Error(`graph.html is missing ${message}`);
  return el;
}

function createLayers(viewport) {
  return {
    links: viewport.append("g").attr("class", "gsn-layer-links"),
    extraLinks: viewport.append("g").attr("class", "gsn-layer-extra-links"),
    ctxLinks: viewport.append("g").attr("class", "gsn-layer-ctx-links"),
    defLinks: viewport.append("g").attr("class", "gsn-layer-def-links"),
    nodes: viewport.append("g").attr("class", "gsn-layer-nodes"),
    ctxNodes: viewport.append("g").attr("class", "gsn-layer-ctx-nodes"),
    defNodes: viewport.append("g").attr("class", "gsn-layer-def-nodes"),
    collections: viewport.append("g").attr("class", "gsn-layer-collections"),
  };
}

export function initSvg(rootEl, { width, height }) {
  const svgNode = requireChild(rootEl, ".gsn-svg");
  const viewportNode = requireChild(rootEl, ".gsn-viewport");

  svgNode.setAttribute("width", String(width));
  svgNode.setAttribute("height", String(height));

  const svg = d3.select(svgNode);
  const viewport = d3.select(viewportNode);

  // Fresh defs for each render
  const defs = svg.append("defs");
  const layers = createLayers(viewport);

  return { svgNode, svg, viewport, defs, layers };
}

export function createMarkers(defs, { arrow, arrowCtx, arrowDef }) {
  function marker(id, klass) {
    const m = defs.append("marker")
      .attr("id", id)
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto-start-reverse")
      .attr("class", `gsn-marker ${klass}`);

    m.append("path")
      .attr("d", "M0,0 L10,5 L0,10 Z")
      .attr("fill", "currentColor");
  }

  marker(arrow, "norm");
  marker(arrowCtx, "ctx");
  marker(arrowDef, "def");

  return { arrow, arrowCtx, arrowDef };
}

export function renderTreeLinks(layer, links, markerId) {
  const linkV = d3.linkVertical().x((d) => d.x).y((d) => d.y);

  const sel = layer.selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "gsn-link")
    .attr("d", (d) => linkV({
      source: {
        x: d.source.x,
        y: d.source.y + d.source.h / 2,
      },
      target: {
        x: d.target.x,
        y: d.target.y - d.target.h / 2,
      },
    }))
    .attr("marker-end", `url(#${markerId})`);

  sel.append("title").text("supported by");
  return sel;
}

export function renderExtraLinks(layer, links, markerId) {
  const linkV = d3.linkVertical().x((d) => d.x).y((d) => d.y);

  const sel = layer.selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "gsn-link extra")
    .attr("d", (d) => linkV({
      source: {
        x: d.source.x,
        y: d.source.y + d.source.h / 2,
      },
      target: {
        x: d.target.x,
        y: d.target.y - d.target.h / 2,
      },
    }))
    .attr("marker-end", `url(#${markerId})`);

  sel.append("title").text("supported by");
  return sel;
}

export function renderContextLinks(layer, links, markerId) {
  const linkH = d3.linkHorizontal().x((d) => d.x).y((d) => d.y);

  const sel = layer.selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "gsn-link ctx")
    .attr("d", (d) => linkH({
      source: {
        x: d.source.x + ((d.source?.w ?? 0) / 2),
        y: d.source.y,
      },
      target: {
        x: d.target.x - ((d.target?.w ?? 0) / 2),
        y: d.target.y,
      },
    }))
    .attr("marker-end", `url(#${markerId})`);

  sel.append("title").text("in context of");
  return sel;
}

export function renderDefLinks(layer, links, markerId) {
  const linkH = d3.linkHorizontal().x((d) => d.x).y((d) => d.y);

  const sel = layer.selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "gsn-link def")
    .attr("d", (d) => linkH({
      source: {
        x: d.source.x + ((d.source?.w ?? 0) / 2),
        y: d.source.y,
      },
      target: {
        x: d.target.x - ((d.target?.w ?? 0) / 2),
        y: d.target.y,
      },
    }))
    .attr("marker-end", `url(#${markerId})`);

  sel.append("title").text("challenges");
  return sel;
}

function appendNodeShape(gShape, d) {
  const w = d.w;
  const h = d.h;
  const x = -w / 2;
  const y = -h / 2;

  if (d.kind === "solution") {
    const r = Math.max(w, h) / 2;
    gShape.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", r);
    return;
  }

  if (d.kind === "strategy") {
    const slant = Math.min(20, w / 5);
    const points = [
      [x + slant, y],
      [x + w + slant, y],
      [x + w - slant, y + h],
      [x - slant, y + h],
    ].map((p) => p.join(",")).join(" ");

    gShape.append("polygon")
      .attr("points", points);
    return;
  }

  if (d.kind === "assumption" || d.kind === "justification") {
    gShape.append("ellipse")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("rx", w / 2)
      .attr("ry", h / 2);
    return;
  }

  gShape.append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("x", x)
    .attr("y", y);
}

function appendNodeLabel(nodeG, titleTextFn) {
  nodeG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text((d) => d.label)
    .append("title")
    .text(titleTextFn);
}

function appendAjMarkers(nodeG) {
  const ajNodes = nodeG.filter((d) => d.kind === "assumption" || d.kind === "justification");

  ajNodes.append("text")
    .attr("class", "gsn-node-tag")
    .attr("text-anchor", "start")
    .attr("x", (d) => d.w / 2 - 6)
    .attr("y", (d) => d.h / 2 + 8)
    .text((d) => (d.kind === "assumption" ? "A" : "J"));
}

export function renderMainNodes(layer, nodes) {
  const nodeG = layer.selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", (d) => `gsn-node ${d.kind}`)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  const shapeG = nodeG.append("g")
    .attr("class", "gsn-node-shape");

  shapeG.each(function (d) {
    appendNodeShape(d3.select(this), d);
  });

  appendNodeLabel(nodeG, (d) => d.id);
  appendAjMarkers(nodeG);

  return nodeG;
}

export function renderContextNodes(layer, ctxNodes) {
  const ctxG = layer.selectAll("g")
    .data(ctxNodes)
    .join("g")
    .attr("class", (d) => `gsn-node ctx ${d.kind}`)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  const shapeG = ctxG.append("g")
    .attr("class", "gsn-node-shape");

  shapeG.each(function (d) {
    appendNodeShape(d3.select(this), d);
  });

  appendNodeLabel(ctxG, (d) => `${d.id} (context of ${d.contextOf})`);
  appendAjMarkers(ctxG);

  return ctxG;
}

export function renderDefNodes(layer, defNodes) {
  const defG = layer.selectAll("g")
    .data(defNodes)
    .join("g")
    .attr("class", "gsn-node def")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  defG.append("rect")
    .attr("width", (d) => d.w)
    .attr("height", 18)
    .attr("x", (d) => -d.w / 2)
    .attr("y", -9);

  defG.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text((d) => d.label)
    .append("title")
    .text((d) => `${d.id} (challenges ${d.challenges})`);

  return defG;
}

export function updateUndevDiamonds(svg) {
  svg.selectAll("path.undev-diamond").remove();

  svg.selectAll("g.gsn-node.undev").each(function () {
    const g = d3.select(this);
    const shape = g.select("rect, circle, ellipse, polygon");
    if (!shape.node()) return;

    const box = shape.node().getBBox();
    const size = 6;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height + size + 1;

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

export function clearHighlights({ nodeG, ctxG, defG, svg }) {
  nodeG.attr("class", (d) => `gsn-node ${d.kind}`);
  ctxG.attr("class", (d) => `gsn-node ctx ${d.kind}`);
  defG.attr("class", "gsn-node def");
  svg.selectAll("path.undev-diamond").remove();
}

export function highlightByIds({ nodeG, ctxG, defG, svg, ids, klass }) {
  const set = new Set((ids || []).map(String));

  nodeG.classed(klass, (d) => set.has(String(d.id)));
  ctxG.classed(klass, (d) => set.has(String(d.id)));
  defG.classed(klass, (d) => set.has(String(d.id)));

  if (klass === "undev") {
    updateUndevDiamonds(svg);
  }
}

export function attachZoom(svg, viewport, svgNode, { height }) {
  const zoom = d3.zoom()
    .scaleExtent([0.25, 3])
    .on("zoom", (ev) => {
      viewport.attr("transform", ev.transform);
    });

  svg.call(zoom);

  const disableDblZoom = () => {
    svg.on("dblclick.zoom", null);
  };

  disableDblZoom();

  function fit(pad = 40) {
    svg.interrupt();

    const viewportNode = viewport.node();
    if (!viewportNode) return;

    const bbox = viewportNode.getBBox();
    if (!bbox.width || !bbox.height) return;

    const vb = svgNode.viewBox?.baseVal;
    const vw =
      svgNode.clientWidth ||
      (vb?.width || 0) ||
      Number(svgNode.getAttribute("width")) ||
      800;

    const vh =
      svgNode.clientHeight ||
      (vb?.height || 0) ||
      Number(svgNode.getAttribute("height")) ||
      height;

    const sx = (vw - pad * 2) / bbox.width;
    const sy = (vh - pad * 2) / bbox.height;
    const s = Math.max(0.25, Math.min(2.5, Math.min(sx, sy)));

    const tx = pad - bbox.x * s + (vw - (bbox.width * s + pad * 2)) / 2;
    const ty = pad - bbox.y * s + (vh - (bbox.height * s + pad * 2)) / 2;

    const t = d3.zoomIdentity.translate(tx, ty).scale(s);

    svg.transition()
      .duration(450)
      .call(zoom.transform, t)
      .on("end interrupt", disableDblZoom);
  }

  function reset() {
    svg.interrupt();

    svg.transition()
      .duration(400)
      .call(zoom.transform, d3.zoomIdentity)
      .on("end interrupt", disableDblZoom);
  }

  return { zoom, fit, reset };
}