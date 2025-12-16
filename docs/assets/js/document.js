import app from "./queries.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js";
import panes from "./panes.js";

marked.setOptions({
  gfm: true,     // GitHub-style markdown (tables, etc.)
  breaks: false, // keep normal line-break behavior
});

// Mirror BASE_PATH logic from queries.js / editor.js
const BASE_URL  = new URL("../../", import.meta.url);
const BASE_PATH = (BASE_URL.protocol.startsWith("http")
  ? BASE_URL.href
  : BASE_URL.pathname
).replace(/\/$/, "");

// --- helpers -------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Base renderer so we can fall back to normal link behavior
const baseRenderer = new marked.Renderer();

// Treat links with href like `$roof-rack` as ontology references
marked.use({
  renderer: {
    link(href, title, text) {
      if (href && href.startsWith("$")) {
        // strip the leading "$"
        const tag = href.slice(1); // e.g. "roof-rack"

        const safeTag   = escapeHtml(tag);
        const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";

        // Render as a span/button with a data attribute, not as a real <a href=...>
        return `
          <button
            type="button"
            class="doc-entity"
            data-doc-tag="${safeTag}"${safeTitle}
          >${text}</button>
        `;
      }

      // Normal links behave as usual
      return baseRenderer.link.call(this, href, title, text);
    },
  },
});

function resolveUrl(relOrAbs) {
  if (!relOrAbs) return null;

  // Absolute URL
  if (/^https?:\/\//i.test(relOrAbs)) {
    return relOrAbs;
  }

  // Protocol-relative: //example.org/...
  if (/^\/\//.test(relOrAbs)) {
    return `${window.location.protocol}${relOrAbs}`;
  }

  // Root-relative: /assets/...
  if (relOrAbs.startsWith("/")) {
    return `${BASE_PATH}${relOrAbs}`;
  }

  // Relative to repo root
  return `${BASE_PATH}/${relOrAbs}`;
}

async function fetchDoc(pathLiteral) {
  const url = resolveUrl(pathLiteral);
  if (!url) throw new Error("Empty document path from query.");

  const r = await fetch(`${url}?v=${performance.timeOrigin}`, {
    cache: "no-store",
  });
  if (!r.ok) {
    throw new Error(`Fetch failed ${r.status} for ${url}`);
  }
  return await r.text();
}

// Very small, safe-ish Markdown → HTML renderer (headings, lists, code, paragraphs)
function renderMarkdown(mdText) {
    return marked.parse(mdText);
  };

async function runDocQueryInto(rootEl, queryPath, varHint) {
  await app.init();

  // Load query text (same pattern as fetchText in queries.js/editor.js)
  const url = (queryPath.startsWith("http")
    ? queryPath
    : `${BASE_PATH}${queryPath.startsWith("/") ? "" : "/"}${queryPath}`);

  const r = await fetch(`${url}?v=${performance.timeOrigin}`, {
    cache: "no-store",
  });
  if (!r.ok) {
    throw new Error(`Fetch failed ${r.status} for ${url}`);
  }
  const queryText = (await r.text()).replace(/^\uFEFF/, "");

  const rows = await app.selectBindings(queryText);
  if (!rows.length) {
    rootEl.innerHTML = "<p>No document path returned by query.</p>";
    return;
  }

  const row    = rows[0];
  const names  = Object.keys(row);
  if (!names.length) {
    rootEl.innerHTML = "<p>Query returned results but no variables.</p>";
    return;
  }

  // Pick variable: prefer data-doc-var, else some sensible defaults, else first var
  let varName = varHint && row[varHint] ? varHint : null;
  if (!varName) {
    const preferred = ["doc", "document", "path", "file", "url", "md", "markdown"];
    varName = preferred.find(n => row[n]) || names[0];
  }

  const val = row[varName]?.value;
  if (!val) {
    rootEl.innerHTML =
      "<p>Could not find a suitable document path variable in query result.</p>";
    return;
  }

  const md   = await fetchDoc(val);
  const html = renderMarkdown(md);
  rootEl.innerHTML = `<article class="doc-view">${html}</article>`;
}

// --- boot ---------------------------------------------------------------

function initDocView() {
  const root = document.getElementById("doc-root");
  if (!root) return;

  root.innerHTML = `
    <div class="doc-view-placeholder">
      <p>Select a document using a button with <code>data-doc-query</code>
      to show it here.</p>
    </div>`;

  // Any element with data-doc-query will trigger loading a Markdown doc
  document.addEventListener("click", (ev) => {
    const el = ev.target instanceof Element
      ? ev.target.closest("[data-doc-query]")
      : null;
    if (!el) return;

    ev.preventDefault();

    const queryPath = el.getAttribute("data-doc-query");
    if (!queryPath) return;

    const varHint = el.getAttribute("data-doc-var") || "";

    panes.activateLeftTab("tab-doc");

    runDocQueryInto(root, queryPath, varHint).catch(err => {
      console.error("[DocView] error loading document", err);
      root.innerHTML =
        `<p class="doc-error">Error loading document: ${escapeHtml(err?.message || String(err))}</p>`;
    });
  });

  // Click handler for ontology references inside the document
  root.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element
      ? ev.target.closest(".doc-entity")
      : null;

    if (!target) return;

    ev.preventDefault();

    const tag = target.getAttribute("data-doc-tag");
    if (!tag) return;

    handleDocEntityClick(tag, target).catch(err => {
      console.error("[DocView] error resolving entity tag", tag, err);
    });
  });

  // Close tooltip when clicking anywhere outside entities / tooltip
  document.addEventListener("click", (ev) => {
    if (!(ev.target instanceof Element)) return;
    if (ev.target.closest(".doc-entity") || ev.target.closest(".doc-entity-tooltip")) {
      return; // handled by the other handler
    }
    closeDocTooltip();
  });

}

let currentTooltip = null;

function closeDocTooltip() {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}

function buildTooltipHtml(tag, rows) {
  const safeTag = escapeHtml(tag);

  if (!rows || !rows.length) {
    return `
      <div class="doc-entity-tooltip-header">${safeTag}</div>
      <div class="doc-entity-tooltip-body">
        <p>No ontology details found.</p>
      </div>
    `;
  }

  const firstRow  = rows[0];
  const entityIri = firstRow.entity?.value || "";

  const labels   = [];
  const comments = [];
  const types    = [];

  for (const r of rows) {
    const pIri = r.p?.value;
    const o    = r.o;
    if (!pIri || !o) continue;

    const val = o.value;
    if (!val) continue;

    if (/label$/i.test(pIri)) {
      labels.push(val);
    } else if (/comment$/i.test(pIri) || /description$/i.test(pIri)) {
      comments.push(val);
    } else if (/type$/i.test(pIri)) {
      types.push(val);
    }
  }

  const uniq = arr => [...new Set(arr)];
  const label   = uniq(labels)[0];
  const comment = uniq(comments)[0];
  const typeStr = uniq(types).slice(0, 3).join(", ");

  const mainLabel  = label || tag;
  const displayIri = entityIri ? escapeHtml(entityIri) : "";

  let html = `
    <div class="doc-entity-tooltip-header">${escapeHtml(mainLabel)}</div>
    <div class="doc-entity-tooltip-body">
  `;

  if (comment) {
    html += `<p class="doc-entity-tooltip-comment">${escapeHtml(comment)}</p>`;
  }

  if (typeStr) {
    html += `<p class="doc-entity-tooltip-types"><strong>Type:</strong> ${escapeHtml(typeStr)}</p>`;
  }

  if (displayIri) {
    html += `<p class="doc-entity-tooltip-iri">${displayIri}</p>`;
  }

  html += `</div>`;
  return html;
}

function showDocEntityTooltip(targetEl, tag, rows) {
  closeDocTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "doc-entity-tooltip";
  tooltip.innerHTML = buildTooltipHtml(tag, rows);
  document.body.appendChild(tooltip);

  const rect    = targetEl.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  const top  = rect.bottom + scrollY + 4; // a bit under the word
  const left = rect.left   + scrollX;

  tooltip.style.top  = `${top}px`;
  tooltip.style.left = `${left}px`;

  currentTooltip = tooltip;
}


// Example: resolve a document tag against the ontology
async function handleDocEntityClick(tag, targetEl) {
  await app.init();

  // Example strategy: use the tag as a schema:identifier
  // Adjust prefixes / property to match your actual ontology.
  const queryText = `
PREFIX schema: <https://schema.org/>
PREFIX ex: <https://example.org/car-demo#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?s ?p ?o
WHERE {
  ?entity schema:identifier ?id .
  FILTER CONTAINS(?id, ${JSON.stringify(tag)})
  {
        ?entity ?p ?o .
        BIND(?entity AS ?s)
    }
  UNION
  {
        ?s ?p ?entity .
        BIND(?entity AS ?o)
    }
}
LIMIT 20
  `;

  const rows = await app.selectBindings(queryText);

  // Show a tooltip in the document view
  showDocEntityTooltip(targetEl, tag, rows);

  // Still notify the rest of the app if needed
  window.dispatchEvent(new CustomEvent("ontogsndoc:entityClick", {
    detail: { tag, rows }
  }));
}

window.addEventListener("DOMContentLoaded", initDocView);
