import queries from "@core/queries.js";
import panes from "@core/panes.js";
import { bus, emitCompat } from "@core/events.js";
import { PATHS } from "@rdf/config.js";
import { fetchRepoText, mountTemplate } from "@core/utils.js";

const BRIDGE_CSS = new URL("./bridgeGraphDocument.css", import.meta.url);

const CFG = {
  // You can add these to rdf/config.js PATHS.q.*, or keep these defaults.
  qNodeToDoc: PATHS?.q?.bridge_nodeToDoc || "/assets/data/queries/bridge_node_to_doc.sparql",
  qDocToGraph: PATHS?.q?.bridge_docToGraph || "/assets/data/queries/bridge_doc_hit_to_graph.sparql",
  qDocLinkIndex: PATHS?.q?.read_docLinkIndex || "/assets/data/queries/read_docLinkIndex.sparql",

  // UX
  autoShowDoc: true,
  autoShowGraph: true,

  // Graph overlay class to apply when doc drives graph highlighting
  graphCls: "doc-hit",

  graphLinkCls: "has-doclink",
  cache: "no-store",
  bust: true,
};

let _docLinkIndex = {
  rows: [],
  byNode: new Map(), // iri -> [link,...]
  byDoc: new Map(),  // docPath -> [link,...]
  nodeIds: [],
};

let _bridgeInit = false;

// --- helpers ---------------------------------------------------------------

async function mountBridgeCss() {
  // rootEl can be any existing element; mountTemplate won't modify it if templateUrl is null.
  const root = document.documentElement || document.body;
  await mountTemplate(root, {
    templateUrl: null,
    cssUrl: BRIDGE_CSS.href,
    cache: "force-cache",
    bust: false,
  });
}

function cellValue(x) {
  if (x == null) return null;
  if (typeof x === "object" && "value" in x) return x.value;
  return x;
}

function firstNonNull(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    const vv = cellValue(v);
    if (vv != null && String(vv).trim() !== "") return vv;
  }
  return null;
}

async function loadQueryText(path) {
  // Prefer query service cache/loader if you have it; else fall back to fetchRepoText
  if (queries?.qs?.fetchQueryText) {
    return queries.qs.fetchQueryText(path, { cache: CFG.cache, bust: CFG.bust });
  }
  return fetchRepoText(path, { from: import.meta.url, upLevels: 2, cache: CFG.cache, bust: CFG.bust });
}

function substTemplate(tmpl, vars) {
  let q = String(tmpl);
  for (const [k, v] of Object.entries(vars)) {
    // Use JSON.stringify so quotes are safe in SPARQL strings
    q = q.replaceAll(`{{${k}}}`, JSON.stringify(v ?? ""));
  }
  return q;
}

async function runSelectQueryText(qText, source = "bridge:inline") {
  // Prefer QueryService API if present
  if (queries?.qs?.runText) {
    const res = await queries.qs.runText(qText, { source });
    return res?.rows ?? [];
  }
  // Fallback if your QueriesApp exposes selectBindings()
  if (queries?.selectBindings) {
    return queries.selectBindings(qText);
  }
  throw new Error("Bridge: no query runner found (expected queries.qs.runText or queries.selectBindings).");
}

async function showDocTab() {
  if (!CFG.autoShowDoc) return null;
  return panes?.activateLeftTab?.("tab-doc");
}

function normalizeDocPathish(x) {
  return String(x ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .replace(/^assets\//, "");
}

async function emitDocHighlightAfterOpen(path, highlightPayload) {
  await showDocTab();

  if (!path) {
    if (highlightPayload) {
      emitCompat(bus, "doc:highlight", {
        ...highlightPayload,
        add: false,
        scroll: true,
      });
    }
    return;
  }

  if (!highlightPayload) {
    emitCompat(bus, "doc:open", { path });
    return;
  }

  const wanted = normalizeDocPathish(path);
  let off = null;

  const onLoaded = (ev) => {
    const loadedPath = normalizeDocPathish(ev?.detail?.path || "");
    if (wanted && loadedPath && loadedPath !== wanted) return;

    try { if (typeof off === "function") off(); } catch {}

    const run = () => {
      emitCompat(bus, "doc:highlight", {
        ...highlightPayload,
        add: false,
        scroll: true,
      });
    };

    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else setTimeout(run, 0);
  };

  off = bus.on("doc:loaded", onLoaded);
  emitCompat(bus, "doc:open", { path });
}

function showGraphTab() {
  if (!CFG.autoShowGraph) return;
  panes?.activateRightTab?.("btn-tree-view");
}

function pushMap(map, k, v) {
  const key = String(k);
  let arr = map.get(key);
  if (!arr) map.set(key, (arr = []));
  arr.push(v);
}

function normalizeDocLinkRow(r) {
  // Be tolerant about column names coming back from SPARQL
  const iri =
    firstNonNull(r, ["iri", "node", "s", "id", "nodeIRI", "hitIRI"]);
  const docPath =
    firstNonNull(r, ["docPath", "path", "doc", "file", "md"]);

  if (!iri || !docPath) return null;

  const selector = firstNonNull(r, ["selector", "css", "querySelector"]);
  const headingId = firstNonNull(r, ["headingId", "heading", "hid"]);
  const tag = firstNonNull(r, ["tag", "docTag"]);
  const text = firstNonNull(r, ["text", "needle"]);
  const key = firstNonNull(r, ["key", "hitKey", "linkKey"]);

  return {
    iri: String(iri),
    docPath: String(docPath),
    selector: selector != null ? String(selector) : null,
    headingId: headingId != null ? String(headingId) : null,
    tag: tag != null ? String(tag) : null,
    text: text != null ? String(text) : null,
    key: key != null ? String(key) : null,
  };
}

async function refreshDocLinkIndex({ applyToGraph = true, emitEvent = true } = {}) {
  await queries.init();

  let rows = [];
  try {
    const tmpl = await loadQueryText(CFG.qDocLinkIndex);
    // no template vars needed; but substTemplate is harmless if you later add {{DOC_PATH}}
    const q = substTemplate(tmpl, {});
    rows = await runSelectQueryText(q, CFG.qDocLinkIndex);
  } catch (e) {
    console.warn("[bridge] docLinkIndex query not available or failed:", e);
    rows = [];
  }

  const norm = rows.map(normalizeDocLinkRow).filter(Boolean);

  const byNode = new Map();
  const byDoc = new Map();

  for (const link of norm) {
    pushMap(byNode, link.iri, link);
    pushMap(byDoc, link.docPath, link);
  }

  const nodeIds = Array.from(byNode.keys());

  _docLinkIndex = { rows: norm, byNode, byDoc, nodeIds };

  // (A) decorate graph nodes that have at least one link
  if (applyToGraph) {
    applyDocLinkMarkersToGraph();
  }

  // (B) publish index for any consumer pane (doc, graph, etc.)
  if (emitEvent) {
    // Convert Maps to plain objects for safer transport.
    const byNodeObj = Object.fromEntries(Array.from(byNode.entries()));
    const byDocObj = Object.fromEntries(Array.from(byDoc.entries()));
    emitCompat(bus, "bridge:docLinkIndex", {
      rows: norm,
      byNode: byNodeObj,
      byDoc: byDocObj,
      nodeIds,
    });
  }

  return _docLinkIndex;
}

function applyDocLinkMarkersToGraph() {
  const ids = _docLinkIndex?.nodeIds || [];
  if (!ids.length) return;

  emitCompat(bus, "graph:highlight", {
    ids,
    cls: CFG.graphLinkCls,
    replace: true,
  });
}

// --- mapping: graph -> doc -------------------------------------------------

async function onGraphNodeDblClick(ev) {
  const d = ev?.detail || {};
  const iri = d.iri || d.id || null;
  if (!iri) return;

  // Ensure query infra
  await queries.init();

  let rows = [];
  try {
    const tmpl = await loadQueryText(CFG.qNodeToDoc);
    const q = substTemplate(tmpl, {
      IRI: String(iri),
      LABEL: String(d.label ?? ""),
      KIND: String(d.kind ?? ""),
      TYPE_IRI: String(d.typeIri ?? ""),
    });
    rows = await runSelectQueryText(q, CFG.qNodeToDoc);
  } catch (e) {
    console.warn("[bridge] node->doc query not available or failed; falling back to heuristic.", e);
  }

  // Interpret first row (flexible schema)
  const r0 =
    rows[0] ||
    (_docLinkIndex?.byNode?.get?.(String(iri))?.[0] ?? {}) ||
    {};
  const path =
    firstNonNull(r0, ["path", "docPath", "doc", "md", "file"]) || null;

  const selector = firstNonNull(r0, ["selector", "css", "querySelector"]);
  const headingId = firstNonNull(r0, ["headingId", "heading", "hid"]);
  const tag = firstNonNull(r0, ["tag", "docTag"]);
  const text = firstNonNull(r0, ["text", "needle"]);
  const docKey = firstNonNull(r0, ["key", "hitKey", "linkKey"]);
  const key = docKey;

  // Then highlight something (prefer explicit targets; fallback to tag from IRI fragment)

  const fallbackTag = (() => {
    const s = String(iri);
    const frag = s.includes("#") ? s.split("#").pop() : s.split("/").pop();
    return frag && frag.length < 80 ? frag : null;
  })();

  const highlightPayload =
    docKey ? { docKey, key: docKey } :
      selector ? { selector, key: key ?? selector } :
        headingId ? { headingId, key: key ?? headingId } :
          tag ? { tag, key: key ?? tag } :
            text ? { text, key: key ?? text } :
              fallbackTag ? { docKey: fallbackTag, key: fallbackTag } :
                null;

  await emitDocHighlightAfterOpen(path, highlightPayload);

}

// --- mapping: doc -> graph -------------------------------------------------

async function onDocHitDblClick(ev) {
  const d = ev?.detail || {};
  const key = d.key || null;
  const tag = d.tag || null;
  const text = d.text || "";
  const docPath = d.docPath || null;

  await queries.init();

  let rows = [];
  try {
    const tmpl = await loadQueryText(CFG.qDocToGraph);
    const q = substTemplate(tmpl, {
      KEY: String(key ?? ""),
      TAG: String(tag ?? ""),
      TEXT: String(text ?? ""),
      DOC_PATH: String(docPath ?? ""),
    });
    rows = await runSelectQueryText(q, CFG.qDocToGraph);
  } catch (e) {
    console.warn("[bridge] doc->graph query not available or failed; falling back to heuristic.", e);
  }

  // Accept flexible result shapes:
  // - { s: <iri> } OR { iri: <iri> } OR { node: <iri> } OR { id: <iri> }
  const ids = rows
    .map(r => firstNonNull(r, ["s", "iri", "node", "id", "nodeIRI", "hitIRI"]))
    .filter(Boolean)
    .map(String);

  // Fallback heuristic: if tag looks like a full IRI, try highlighting it directly.
  if (!ids.length && tag && /^https?:\/\//i.test(tag)) ids.push(String(tag));

  if (!ids.length) return;

  showGraphTab();
  emitCompat(bus, "graph:highlight", { ids, cls: CFG.graphCls, replace: true });
}

// --- init ------------------------------------------------------------------

export async function initBridgeGraphDocument() {
  if (_bridgeInit) return;
  _bridgeInit = true;

  await mountBridgeCss();

  // Make sure query infra is ready (safe even if boot already did it)
  await queries.init();

  bus.on("gsn:nodeDblClick", onGraphNodeDblClick);
  bus.on("doc:hitDblClick", onDocHitDblClick);
  bus.on("right:tab", (ev) => {
    const d = ev?.detail || {};
    const isGraph =
      d.view === "graph" ||
      d.paneId === "graph-root" ||
      d.tabId === "tab-graph";

    if (!isGraph) return;

    applyDocLinkMarkersToGraph();
  });

  await refreshDocLinkIndex({ applyToGraph: true, emitEvent: true });

  bus.on("bridge:refreshDocLinkIndex", () => refreshDocLinkIndex({ applyToGraph: true, emitEvent: true }));

  console.log("[bridge] graph<->doc bridge wired");
}

// Auto-init on import
initBridgeGraphDocument().catch(err => console.error("[bridge] init failed", err));
