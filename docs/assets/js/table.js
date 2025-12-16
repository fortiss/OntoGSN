import app   from "./queries.js";
import panes from "./panes.js";

const BASE_URL  = new URL("../../", import.meta.url);
const BASE_PATH = (BASE_URL.protocol.startsWith("http")
  ? BASE_URL.href
  : BASE_URL.pathname
).replace(/\/$/, "");

const DEFAULT_TABLE_QUERY = "/assets/data/queries/read_graph.sparql";

// --- helpers -------------------------------------------------------------

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Convert an Oxigraph term (or { value, term } from selectBindings) to a display string
function termToDisplay(cell) {
  if (!cell) return "";

  // app.selectBindings returns { value, term }
  const t = cell.term || cell;
  if (!t) return cell.value ?? "";

  switch (t.termType) {
    case "NamedNode":
      return t.value;
    case "BlankNode":
      return "_:" + t.value;
    case "Literal": {
      const dt = t.datatype?.value;
      const lg = t.language;
      if (lg) return `"${t.value}"@${lg}`;
      if (dt && dt !== "http://www.w3.org/2001/XMLSchema#string") {
        return `"${t.value}"^^${dt}`;
      }
      return t.value;
    }
    default:
      return t.value ?? String(t);
  }
}

function bindingsToDisplayRows(bindingRows) {
  const rows = [];
  for (const row of bindingRows) {
    const out = {};
    for (const [name, cell] of Object.entries(row)) {
      out[name] = termToDisplay(cell);
    }
    rows.push(out);
  }
  return rows;
}

async function fetchQueryText(queryPath) {
  const url = (queryPath.startsWith("http")
    ? queryPath
    : `${BASE_PATH}${queryPath.startsWith("/") ? "" : "/"}${queryPath}`);

  const r = await fetch(`${url}?v=${performance.timeOrigin}`, {
    cache: "no-store",
  });
  if (!r.ok) {
    throw new Error(`Fetch failed ${r.status} for ${url}`);
  }
  return (await r.text()).replace(/^\uFEFF/, "");
}

function renderTableInto(tableEl, rows) {
  if (!tableEl) return;

  if (!rows.length) {
    tableEl.innerHTML = "<p>No results.</p>";
    return;
  }

  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];

  let html = '<table class="sparql"><thead><tr>' +
    headers.map(h => `<th>${esc(h)}</th>`).join("") +
    "</tr></thead><tbody>";

  for (const r of rows) {
    html += "<tr>" +
      headers.map(h => `<td>${esc(r[h] ?? "")}</td>`).join("") +
      "</tr>";
  }
  html += "</tbody></table>";

  tableEl.innerHTML = html;
}

async function runTableQueryInto(tableEl, queryPath) {
  if (!tableEl) return;
  await app.init();

  const queryText     = await fetchQueryText(queryPath);
  const bindingRows   = await app.selectBindings(queryText);
  const displayRows   = bindingsToDisplayRows(bindingRows);

  renderTableInto(tableEl, displayRows);
}

// --- boot ---------------------------------------------------------------

function initTableView() {
  const root = document.getElementById("results");
  if (!root) return;

  // Initial placeholder
  root.innerHTML = `
    <div class="table-pane">
      <div class="table-controls">
        <button type="button"
                data-table-query="/assets/data/queries/read_all_nodes.sparql">
          Nodes
        </button>
        <button type="button"
                data-table-query="/assets/data/queries/read_all_relations.sparql">
          Relations
        </button>
      </div>
      <div id="table-content" class="table-content">
        <div class="table-placeholder">
          <p>Run a SPARQL SELECT query (e.g., “Node Info”) to see results here.</p>
        </div>
      </div>
    </div>
  `;

  const contentEl = root.querySelector("#table-content");
  if (!contentEl) return;

  //panes.activateLeftTab?.("tab-table");

  runTableQueryInto(contentEl, DEFAULT_TABLE_QUERY).catch(err => {
    console.error("[TableView] error running default table query", err);
    root.innerHTML =
      `<p class="table-error">Error running default query: ${esc(err?.message || String(err))}</p>`;
  });

  // Any element with data-table-query drives the table pane
  document.addEventListener("click", (ev) => {
    const el = ev.target instanceof Element
      ? ev.target.closest("[data-table-query]")
      : null;
    if (!el) return;

    ev.preventDefault();

    const queryPath = el.getAttribute("data-table-query");
    if (!queryPath) return;

    // Make sure the Table tab / pane is active
    panes.activateLeftTab?.("tab-table");

    runTableQueryInto(contentEl, queryPath).catch(err => {
      console.error("[TableView] error running table query", err);
      root.innerHTML =
        `<p class="table-error">Error running query: ${esc(err?.message || String(err))}</p>`;
    });
  });
}

window.addEventListener("DOMContentLoaded", initTableView);
