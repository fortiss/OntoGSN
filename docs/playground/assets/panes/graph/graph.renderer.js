// assets/panes/graph/graph.renderer.js

import { mountTemplate, resolveEl, uid } from "@core/utils.js";
import { emitCompat } from "@core/events.js";

import { HTML, CSS } from "./graph.config.js";
import { buildGraphScene, labelWidth } from "./graph.model.js";
import { createCollectionsController } from "./graph.collections.js";
import {
  requireChild,
  initSvg,
  createMarkers,
  renderTreeLinks,
  renderExtraLinks,
  renderContextLinks,
  renderDefLinks,
  renderMainNodes,
  renderContextNodes,
  renderDefNodes,
  clearHighlights,
  highlightByIds,
  attachZoom,
} from "./graph.view.js";

export async function visualizeSPO(rows, {
  mount = ".gsn-host",
  width = null,
  height = 520,
  supportedBy = [],
  contextOf = [],
  challenges = [],
  label = (x) => x,
  eventBus = null,
} = {}) {
  const rootEl =
    (mount instanceof Element)
      ? mount
      : resolveEl(mount, { name: "visualizeSPO: mount" });

  if (!rootEl) {
    throw new Error(`visualizeSPO: mount "${mount}" not found`);
  }

  await mountTemplate(rootEl, { templateUrl: HTML, cssUrl: CSS });

  // Validate template structure
  requireChild(rootEl, ".gsn-graph-ui");
  requireChild(rootEl, ".gsn-graph-rules");
  requireChild(rootEl, ".gsn-graph-hud");

  // Ensure positioning context for absolute overlay UI
  rootEl.classList.add("gsn-graph-pane");
  if (getComputedStyle(rootEl).position === "static") {
    rootEl.style.position = "relative";
  }

  const rect = rootEl.getBoundingClientRect();
  const pixelWidth = width ?? Math.max(300, rect.width || 800);

  const { svgNode, svg, viewport, defs, layers } = initSvg(rootEl, {
    width: pixelWidth,
    height,
  });

  const markerIds = createMarkers(defs, {
    arrow: uid("arrow-"),
    arrowCtx: uid("arrow-ctx-"),
    arrowDef: uid("arrow-def-"),
  });

  const scene = buildGraphScene(rows, {
    label,
    supportedBy,
    contextOf,
    challenges,
  });

  renderTreeLinks(layers.links, scene.treeLinks, markerIds.arrow);
  renderExtraLinks(layers.extraLinks, scene.extraLinks, markerIds.arrow);
  renderContextLinks(layers.ctxLinks, scene.ctxLinks, markerIds.arrowCtx);
  renderDefLinks(layers.defLinks, scene.defLinks, markerIds.arrowDef);

  const nodeG = renderMainNodes(layers.nodes, scene.nodes);
  const ctxG = renderContextNodes(layers.ctxNodes, scene.ctxNodes);
  const defG = renderDefNodes(layers.defNodes, scene.defNodes);

  function emitNodeDbl(ev, payload) {
    ev.preventDefault();
    ev.stopPropagation();
    emitCompat(eventBus, "gsn:nodeDblClick", payload);
  }

  nodeG.on("click", (ev, d) => {
    if (ev.detail > 1) return;

    emitCompat(eventBus, "gsn:nodeClick", {
      id: d.id,
      label: d.label,
      kind: d.kind,
      typeIri: d.typeIri,
    });
  });

  nodeG.on("dblclick", (ev, d) => {
    emitNodeDbl(ev, {
      iri: d.id,
      label: d.label,
      kind: d.kind,
      typeIri: d.typeIri,
    });
  });

  ctxG.on("click", (ev, d) => {
    emitCompat(eventBus, "gsn:contextClick", {
      id: d.id,
      label: d.label,
    });
  });

  ctxG.on("dblclick", (ev, d) => {
    emitNodeDbl(ev, {
      iri: d.id,
      label: d.label,
      kind: d.kind,
      typeIri: d.typeIri,
    });
  });

  defG.on("click", (ev, d) => {
    emitCompat(eventBus, "gsn:defeaterClick", {
      id: d.id,
      label: d.label,
    });
  });

  defG.on("dblclick", (ev, d) => {
    emitNodeDbl(ev, {
      iri: d.id,
      label: d.label,
      kind: "defeater",
    });
  });

  const { fit, reset } = attachZoom(svg, viewport, svgNode, { height });

  const collectionsCtl = createCollectionsController({
    layer: layers.collections,
    pos: scene.pos,
    ctxPos: scene.ctxPos,
    label,
    labelWidth,
  });

  function clearAll() {
    clearHighlights({ nodeG, ctxG, defG, svg });
  }

  function highlightSelection(ids, klass) {
    highlightByIds({
      nodeG,
      ctxG,
      defG,
      svg,
      ids,
      klass,
    });
  }

  function destroy() {
    rootEl.replaceChildren();
  }

  rootEl.querySelector('[data-act="fit"]')?.addEventListener("click", fit);
  rootEl.querySelector('[data-act="reset"]')?.addEventListener("click", reset);

  fit();

  return {
    fit,
    reset,
    destroy,
    svg: svgNode,

    clearAll,
    highlightByIds: highlightSelection,

    addCollections: collectionsCtl.addCollections,
    clearCollections: collectionsCtl.clearCollections,
  };
}