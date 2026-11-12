import app   from "@core/queries.js";
import panes from "@core/panes.js";
import { mountTemplate, resolveEl, fetchRepoText, escapeHtml, termToDisplay } from "@core/utils.js";
import { bus } from "@core/events.js";

const HTML = new URL("./table.html", import.meta.url);
const CSS  = new URL("./table.css", import.meta.url);

const DEFAULT_TABLE_QUERY = "data/queries/read_graph.sparql";

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function bindingsToDisplayRows(bindingRows) {
  const rows = [];
  for (const row of (bindingRows || [])) {
    const out = {};
    for (const [name, cell] of Object.entries(row || {})) {
      out[name] = termToDisplay(cell);
    }
    rows.push(out);
  }
  return rows;
}

function renderTableInto(hostEl, rows) {
  if (!hostEl) return;

  if (!rows || !rows.length) {
    hostEl.innerHTML = "<p>No results.</p>";
    return;
  }

  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];

  let html =
    '<table class="sparql"><thead><tr>' +
    headers.map(h => `<th>${escapeHtml(h)}</th>`).join("") +
    "</tr></thead><tbody>";

  for (const r of rows) {
    html += "<tr>" +
      headers.map(h => `<td>${escapeHtml(r[h] ?? "")}</td>`).join("") +
      "</tr>";
  }

  html += "</tbody></table>";

  hostEl.innerHTML = html;
}

function renderErrorInto(hostEl, err, label = "query") {
  if (!hostEl) return;
  hostEl.innerHTML =
    `<p class="table-error">Error running ${escapeHtml(label)}: ${escapeHtml(err?.message || String(err))}</p>`;
}

async function ensureStore() {
  if (!app?.store) await app.init();
}

// ---------------------------------------------------------------------------
// Table controller
// ---------------------------------------------------------------------------

class TableApp {
  constructor({ panes, bus } = {}) {
    this.panes = panes;
    this.bus = bus;

    this.rootEl = null;
    this.contentEl = null;

    this._ac = null;
    this._wired = false;
    this._renderSeq = 0;

    this._offLeftTab = null;
    this._offRightTab = null;
  }

  async init({ root } = {}) {
    // Root = element passed by PaneManager
    this.rootEl =
      root
      ?? resolveEl("#results", { required: true, name: "Table view root (#results)" });

    await mountTemplate(this.rootEl, {
      templateUrl: HTML,
      cssUrl: CSS,
      cache: "no-store",
      bust: true
    });

    this.contentEl = resolveEl("#table-content", {
      root: this.rootEl,
      required: true,
      name: "Table view: #table-content"
    });

    // Optional: keep this behavior if your left tabs are global
    try { this.panes.initLeftTabs?.(); } catch {}

    // Wire listeners once per mount
    this._ac?.abort?.();
    this._ac = new AbortController();

    this._wireUI({ signal: this._ac.signal });
    this._wireBus();

    this._wired = true;

    // Default query on mount
    await this.run(DEFAULT_TABLE_QUERY, { label: "default query" });
  }

  destroy() {
    // Remove DOM listeners
    try { this._ac?.abort?.(); } catch {}
    this._ac = null;

    // Remove bus listeners
    try { this._offLeftTab?.(); } catch {}
    this._offLeftTab = null;

    try { this._offRightTab?.(); } catch {}
    this._offRightTab = null;

    this._wired = false;
    this.rootEl = null;
    this.contentEl = null;
  }

  async run(queryPath, { label = "query" } = {}) {
    const seq = ++this._renderSeq;

    if (!this.contentEl) return;

    try {
      await ensureStore();

      const queryText = await fetchRepoText(queryPath, {
        from: import.meta.url,
        upLevels: 2,
        cache: "no-store",
        bust: true
      });

      const bindingRows = await app.selectBindings(queryText);
      const displayRows = bindingsToDisplayRows(bindingRows);

      // if a newer run started, skip rendering this result
      if (seq !== this._renderSeq) return;

      renderTableInto(this.contentEl, displayRows);
    } catch (err) {
      if (seq !== this._renderSeq) return;
      console.error("[TableView] error running table query:", err);
      renderErrorInto(this.contentEl, err, label);
    }
  }

  _wireUI({ signal } = {}) {
    // Any element with [data-table-query] triggers the table query (delegated)
    this.rootEl.addEventListener("click", (ev) => {
      const el = ev.target instanceof Element
        ? ev.target.closest("[data-table-query]")
        : null;

      if (!el) return;

      ev.preventDefault();

      const queryPath = el.getAttribute("data-table-query");
      if (!queryPath) return;

      // Keep original behavior: switch the left tab to Table
      try { this.panes.activateLeftTab?.("tab-table"); } catch {}

      this.run(queryPath, { label: queryPath });
    }, { signal });
  }

  _wireBus() {
    // Optional: support "left:tab" / "right:tab" navigation patterns
    // (safe even if those events never fire)
    if (!this.bus?.on) return;

    // If you use left:tab to open the table view and optionally pass a query
    this._offLeftTab = this.bus.on("left:tab", (ev) => {
      const d = ev?.detail || {};
      if (d.view !== "table") return;

      const q = d.query || DEFAULT_TABLE_QUERY;
      this.run(q, { label: q });
    });

    // Some apps reuse right:tab for all panes; handle it too, harmlessly
    this._offRightTab = this.bus.on("right:tab", (ev) => {
      const d = ev?.detail || {};
      if (d.view !== "table") return;

      const q = d.query || DEFAULT_TABLE_QUERY;
      this.run(q, { label: q });
    });
  }
}

// ---------------------------------------------------------------------------
// PaneManager lifecycle (lazy-load safe)
// ---------------------------------------------------------------------------

let _app = null;

async function ensureApp(root) {
  if (_app) return _app;
  _app = new TableApp({ panes, bus });
  await _app.init({ root });
  return _app;
}

export async function mount({ root } = {}) {
  await ensureApp(root);

  // cleanup function for PaneManager
  return () => {
    try { _app?.destroy?.(); } catch {}
    _app = null;
  };
}

export async function resume() {
  // no-op (table doesn't need refit), but kept for consistency
}

export async function suspend() {
  // no-op
}

export async function unmount() {
  try { _app?.destroy?.(); } catch {}
  _app = null;
}

export default { mount, resume, suspend, unmount };
