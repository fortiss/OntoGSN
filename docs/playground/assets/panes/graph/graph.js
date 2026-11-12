// assets/panes/graph/graph.js

import queries from "@core/queries.js";
import panes from "@core/panes.js";
import { PATHS } from "@rdf/config.js";
import { shortenIri } from "@rdf/sparql.js";
import { bus } from "@core/events.js";

import { createGraphApp } from "./graph.app.js";

let _app = null;
let _offRightTab = null;

async function ensureApp(rootEl = null) {
  if (_app) return _app;

  await queries.init();

  _app = createGraphApp({
    panes,
    bus,
    qs: queries.qs,
    paths: PATHS,
    labelFn: shortenIri,
  });

  await _app.init({ rootEl });
  return _app;
}

function onRightTab(ev) {
  const d = ev?.detail || {};
  if (d.view !== "graph") return;

  const q = d.query || PATHS?.q?.visualize || "data/queries/visualize_graph.sparql";

  ensureApp()
    .then((app) => app.run(q))
    .catch((err) => console.warn("[graph] right:tab render failed:", err));
}

export async function mount({ root }) {
  await ensureApp(root);

  if (!_offRightTab) {
    _offRightTab = bus.on("right:tab", onRightTab);
  }

  return () => {
    try {
      _offRightTab?.();
    } catch {}
    _offRightTab = null;

    try {
      _app?.destroy?.();
    } catch {}
    _app = null;
  };
}

export async function resume() {
  try {
    _app?.graphCtl?.fit?.();
  } catch {}
}

export async function suspend() {
  // Intentionally left idle. Safe to keep graph dormant while hidden.
}

export async function unmount() {
  try {
    _offRightTab?.();
  } catch {}
  _offRightTab = null;

  try {
    _app?.destroy?.();
  } catch {}
  _app = null;
}