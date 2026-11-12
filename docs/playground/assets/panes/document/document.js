// assets/panes/document/document.js

import { bus, emitCompat } from "@core/events.js";
import {
  mountTemplate,
  safeInvoke
} from "@core/utils.js";

import {
  docRoot,
  currentDocPath,
  setDocRoot,
  setPendingHighlight,
  resetDocState
} from "./document.state.js";

import {
  clearDocHighlights,
  applyHighlight
} from "./document.highlight.js";

import {
  closeDocTooltip,
  handleDocEntityClick,
  runDocQueryInto,
  openDocPathInto
} from "./document.actions.js";

const CSS = new URL("./document.css", import.meta.url);

let _cleanup = null;

// DOM listeners
let _onRootClick = null;
let _onDocDblClick = null;
let _onDocGlobalClick = null;

// bus listeners
let _busDocOpen = null;
let _busClear = null;
let _busHighlight = null;
let _busLeftTab = null;

export async function mount({ root }) {
  setDocRoot(root);

  await mountTemplate(root, { cssUrl: CSS });

  root.innerHTML = `
    <div class="doc-view-placeholder">
      <p>Select a document using a button with <code>data-doc-query</code> to show it here.</p>
    </div>
  `;

  _onRootClick = (ev) => {
    const target = ev.target instanceof Element
      ? ev.target.closest(".doc-entity")
      : null;

    if (!target) return;
    ev.preventDefault();

    const tag = target.getAttribute("data-doc-tag");
    if (!tag) return;

    handleDocEntityClick(tag, target).catch((err) => {
      console.error("[DocView] error resolving entity tag", tag, err);
    });
  };
  root.addEventListener("click", _onRootClick);

  _onDocGlobalClick = (ev) => {
    if (!(ev.target instanceof Element)) return;
    if (ev.target.closest(".doc-entity") || ev.target.closest(".doc-entity-tooltip")) return;
    closeDocTooltip();
  };
  document.addEventListener("click", _onDocGlobalClick);

  _onDocDblClick = (ev) => {
    const hit = ev.target instanceof Element ? ev.target.closest(".doc-hit") : null;
    if (!hit) return;

    ev.preventDefault();
    ev.stopPropagation();

    emitCompat(bus, "doc:hitDblClick", {
      key: hit.getAttribute("data-doc-hit-key") || null,
      tag: hit.getAttribute("data-doc-tag") || hit.closest(".doc-entity")?.getAttribute("data-doc-tag") || null,
      text: (hit.textContent || "").trim(),
      docPath: currentDocPath
    });
  };
  root.addEventListener("dblclick", _onDocDblClick);

  _busDocOpen = (ev) => {
    const { path, queryPath, varHint = "" } = ev.detail || {};
    if (!docRoot) return;

    if (path) {
      openDocPathInto(docRoot, path).catch((err) =>
        console.error("[DocView] doc:open path failed", err)
      );
    } else if (queryPath) {
      runDocQueryInto(docRoot, queryPath, varHint).catch((err) =>
        console.error("[DocView] doc:open query failed", err)
      );
    }

    closeDocTooltip();
  };
  bus.on("doc:open", _busDocOpen);

  _busClear = () => clearDocHighlights(docRoot);
  bus.on("doc:clearHighlights", _busClear);

  _busHighlight = (ev) => {
    const detail = ev.detail || {};
    const hits = applyHighlight(detail);

    if (hits.length) {
      setPendingHighlight(null);
    } else {
      setPendingHighlight(detail);
    }
  };
  bus.on("doc:highlight", _busHighlight);

  _busLeftTab = (ev) => {
    const d = ev?.detail || {};
    const isDoc =
      d.view === "doc" ||
      d.paneId === "doc-root" ||
      d.tabId === "tab-doc";

    if (!isDoc) return;
    if (!d.docQuery) return;

    runDocQueryInto(docRoot, d.docQuery, d.docVar || "").catch((err) => {
      console.error("[DocView] left:tab doc load failed", err);
    });
  };
  bus.on("left:tab", _busLeftTab);

  _cleanup = () => {
    closeDocTooltip();

    try { root?.removeEventListener("click", _onRootClick); } catch {}
    try { root?.removeEventListener("dblclick", _onDocDblClick); } catch {}
    try { document.removeEventListener("click", _onDocGlobalClick); } catch {}

    safeInvoke(bus, "off", "doc:open", _busDocOpen);
    safeInvoke(bus, "off", "doc:clearHighlights", _busClear);
    safeInvoke(bus, "off", "doc:highlight", _busHighlight);
    safeInvoke(bus, "off", "left:tab", _busLeftTab);

    _onRootClick = null;
    _onDocDblClick = null;
    _onDocGlobalClick = null;

    _busDocOpen = null;
    _busClear = null;
    _busHighlight = null;
    _busLeftTab = null;

    setPendingHighlight(null);
  };

  return _cleanup;
}

export async function resume() {
  // keep state
}

export async function suspend() {
  closeDocTooltip();
}

export async function unmount() {
  try { _cleanup?.(); } catch {}
  _cleanup = null;
  resetDocState();
}