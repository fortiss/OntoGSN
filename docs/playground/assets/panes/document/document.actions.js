// assets/panes/document/document.actions.js

import app from "@core/queries.js";
import { bus, emitCompat } from "@core/events.js";
import {
  escapeHtml,
  fetchText,
  fetchRepoText,
  repoHref
} from "@core/utils.js";

import { renderMarkdown, decorateDocRanges } from "./document.render.js";
import {
  nextDocReq,
  isLatestDocReq,
  setCurrentDocPath
} from "./document.state.js";
import { flushPendingHighlight } from "./document.highlight.js";

let currentTooltip = null;

export function closeDocTooltip() {
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

  const firstRow = rows[0];
  const entityIri = firstRow.entity?.value || "";

  const labels = [];
  const comments = [];
  const types = [];

  for (const r of rows) {
    const pIri = r.p?.value;
    const o = r.o;
    if (!pIri || !o) continue;

    const val = o.value;
    if (!val) continue;

    if (/label$/i.test(pIri)) labels.push(val);
    else if (/comment$/i.test(pIri) || /description$/i.test(pIri)) comments.push(val);
    else if (/type$/i.test(pIri)) types.push(val);
  }

  const uniq = (arr) => [...new Set(arr)];
  const label = uniq(labels)[0];
  const comment = uniq(comments)[0];
  const typeStr = uniq(types).slice(0, 3).join(", ");

  const mainLabel = label || tag;
  const displayIri = entityIri ? escapeHtml(entityIri) : "";

  let html = `
    <div class="doc-entity-tooltip-header">${escapeHtml(mainLabel)}</div>
    <div class="doc-entity-tooltip-body">
  `;

  if (comment) html += `<p class="doc-entity-tooltip-comment">${escapeHtml(comment)}</p>`;
  if (typeStr) html += `<p class="doc-entity-tooltip-types"><strong>Type:</strong> ${escapeHtml(typeStr)}</p>`;
  if (displayIri) html += `<p class="doc-entity-tooltip-iri">${displayIri}</p>`;

  html += `</div>`;
  return html;
}

function showDocEntityTooltip(targetEl, tag, rows) {
  closeDocTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "doc-entity-tooltip";
  tooltip.innerHTML = buildTooltipHtml(tag, rows);
  document.body.appendChild(tooltip);

  const rect = targetEl.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  tooltip.style.top = `${rect.bottom + scrollY + 4}px`;
  tooltip.style.left = `${rect.left + scrollX}px`;

  currentTooltip = tooltip;
}

export async function handleDocEntityClick(tag, targetEl) {
  await app.init();

  const qPath = "data/queries/read_documentEntity.sparql";
  let queryText = await fetchRepoText(qPath, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });

  queryText = queryText.replaceAll("__TAG__", JSON.stringify(String(tag)));
  const rows = await app.selectBindings(queryText);

  showDocEntityTooltip(targetEl, tag, rows);
  emitCompat(bus, "ontogsndoc:entityClick", { tag, rows });
}

function resolveDocUrl(relOrAbs) {
  if (!relOrAbs) return null;
  const s = String(relOrAbs).trim();
  if (!s) return null;

  if (s.startsWith("//")) return `${location.protocol}${s}`;

  const url = repoHref(s, { from: import.meta.url, upLevels: 2 });
  const u = new URL(url, location.href);

  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error(`Blocked document URL protocol: ${u.protocol}`);
  }

  return u.toString();
}

async function fetchDoc(pathLiteral) {
  const url = resolveDocUrl(pathLiteral);
  if (!url) throw new Error("Empty document path from query.");
  return fetchText(url, { cache: "no-store", bust: true });
}

function renderDocInto(rootEl, mdText) {
  const html = renderMarkdown(mdText);
  rootEl.innerHTML = `<article class="doc-view">${html}</article>`;
  decorateDocRanges(rootEl);
  flushPendingHighlight();
}

export async function runDocQueryInto(rootEl, queryPath, varHint) {
  const reqId = nextDocReq();
  rootEl.innerHTML = "<p>Loading…</p>";

  await app.init();

  const queryText = await fetchRepoText(queryPath, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });

  const rows = await app.selectBindings(queryText);
  if (!isLatestDocReq(reqId)) return;

  if (!rows.length) throw new Error("Doc query returned no rows.");
  const row0 = rows[0];

  const key = (varHint || "").trim().replace(/^\?/, "");
  const chosenKey = (key && row0[key]) ? key : Object.keys(row0)[0];
  const cell = row0[chosenKey];

  const val = (cell && typeof cell === "object" && "value" in cell) ? cell.value : cell;
  if (!val) throw new Error(`Doc query returned no usable value for ${chosenKey}`);

  const md = await fetchDoc(val);
  if (!isLatestDocReq(reqId)) return;

  renderDocInto(rootEl, md);
  setCurrentDocPath(val);

  emitCompat(bus, "doc:loaded", {
    path: val,
    queryPath,
    varHint,
    mode: "query"
  });
}

export async function openDocPathInto(rootEl, pathLiteral) {
  const reqId = nextDocReq();
  rootEl.innerHTML = "<p>Loading…</p>";

  const md = await fetchDoc(pathLiteral);
  if (!isLatestDocReq(reqId)) return;

  renderDocInto(rootEl, md);
  setCurrentDocPath(pathLiteral);

  emitCompat(bus, "doc:loaded", {
    path: pathLiteral,
    mode: "path"
  });
}