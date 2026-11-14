import panes from "@core/panes.js";
import {
  RUNTIME_CONFIG_KEY,
  getConfigSnapshot,
  loadConfigOverrides,
  saveConfigOverrides,
  clearConfigOverrides,
  applyConfigOverrides
} from "@rdf/config.js";

import { resolveEl, escapeHtml, downloadText, mountTemplate } from "@core/utils.js";

const HTML = new URL("./settings.html", import.meta.url);
const CSS  = new URL("./settings.css",  import.meta.url);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _flattenPaths(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && v.constructor === Object) {
      out.push(..._flattenPaths(v, key));
    } else {
      out.push({ key, value: (v == null ? "" : String(v)) });
    }
  }
  return out;
}

function _setNested(root, dottedKey, value) {
  const parts = String(dottedKey).split(".").filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function _readBasesFromUI(root) {
  const bases = {};
  root.querySelectorAll("[data-bases-key]").forEach(inp => {
    const k = inp.getAttribute("data-bases-key");
    bases[k] = String(inp.value ?? "");
  });
  return bases;
}

function _readPathsFromUI(root) {
  const paths = {};
  root.querySelectorAll("[data-path-key]").forEach(inp => {
    const key = inp.getAttribute("data-path-key");
    _setNested(paths, key, String(inp.value ?? ""));
  });
  return paths;
}

function _readDatasetsFromUI(root) {
  const out = [];

  root.querySelectorAll('tr[data-ds-row="1"]').forEach(tr => {
    const enabled = tr.querySelector('[data-ds-enabled]')?.checked ?? true;
    const path    = String(tr.querySelector('[data-ds-path]')?.value ?? "").trim();
    const base    = String(tr.querySelector('[data-ds-base]')?.value ?? "").trim();

    // disabled rows do not appear in overrides (so "On" is meaningful)
    if (!enabled) return;

    // skip empty rows
    if (!path) return;

    out.push({ path, base });
  });

  return out;
}

function _renderDynamicBits(root) {
  const snap  = getConfigSnapshot();
  const saved = loadConfigOverrides() || {};

  // runtime key
  const keyEl = root.querySelector("#settings-runtime-key");
  if (keyEl) keyEl.textContent = RUNTIME_CONFIG_KEY;

  // saved raw JSON
  const savedEl = root.querySelector("#settings-saved-raw");
  if (savedEl) savedEl.value = JSON.stringify(saved, null, 2);

  // BASES grid
  const basesGrid = root.querySelector("#settings-bases-grid");
  if (basesGrid) {
    basesGrid.innerHTML = ["onto", "case", "car", "code"].map(k => `
      <label class="cfg-field">
        <span class="cfg-label">BASES.${escapeHtml(k)}</span>
        <input class="cfg-input" type="text" data-bases-key="${escapeHtml(k)}"
               value="${escapeHtml(snap.BASES?.[k] || "")}">
      </label>
    `).join("");
  }

  // PATHS grid
  const pathsGrid = root.querySelector("#settings-paths-grid");
  if (pathsGrid) {
    const flatPaths = _flattenPaths(snap.PATHS);
    pathsGrid.innerHTML = flatPaths.map(({ key, value }) => `
      <label class="cfg-field">
        <span class="cfg-label">PATHS.${escapeHtml(key)}</span>
        <input class="cfg-input" type="text" data-path-key="${escapeHtml(key)}"
               value="${escapeHtml(value)}">
      </label>
    `).join("");
  }

  // DATASETS table body
  const dsBody = root.querySelector("#settings-datasets-body");
  if (dsBody) {
    dsBody.innerHTML = (snap.DATASETS || []).map((ds, i) => `
      <tr data-ds-row="1">
        <td><input type="checkbox" data-ds-enabled checked></td>
        <td><input class="cfg-input cfg-mono" type="text" data-ds-path value="${escapeHtml(ds?.path || "")}"></td>
        <td><input class="cfg-input cfg-mono" type="text" data-ds-base value="${escapeHtml(ds?.base || "")}"></td>
        <td><button type="button" class="cfg-link" data-ds-del="${i}">remove</button></td>
      </tr>
    `).join("");
  }
}

function _wireEvents(root, { signal } = {}) {
  const statusEl = root.querySelector("#settings-status");
  const setStatus = (msg, kind = "ok") => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.dataset.kind = kind;
  };

  const buildOverridesFromUI = () => ({
    BASES: _readBasesFromUI(root),
    PATHS: _readPathsFromUI(root),
    DATASETS: _readDatasetsFromUI(root),
  });

  // Add dataset row
  root.querySelector("#settings-add-ds")?.addEventListener("click", () => {
    const body = root.querySelector("#settings-datasets-body");
    if (!body) return;

    const tr = document.createElement("tr");
    tr.setAttribute("data-ds-row", "1");
    tr.innerHTML = `
      <td><input type="checkbox" data-ds-enabled checked></td>
      <td><input class="cfg-input cfg-mono" type="text" data-ds-path value=""></td>
      <td><input class="cfg-input cfg-mono" type="text" data-ds-base value=""></td>
      <td><button type="button" class="cfg-link" data-ds-del="new">remove</button></td>
    `;
    body.appendChild(tr);
  }, { signal });

  // Remove dataset row (delegated)
  root.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("[data-ds-del]");
    if (!btn) return;
    ev.preventDefault();
    btn.closest("tr")?.remove();
  }, { signal });

  // Save & reload
  root.querySelector("#settings-apply-reload")?.addEventListener("click", () => {
    const overrides = buildOverridesFromUI();
    const ok = saveConfigOverrides(overrides);
    if (!ok) return setStatus("Could not save overrides (localStorage unavailable?).", "err");
    location.reload();
  }, { signal });

  // Apply now (no reload)
  root.querySelector("#settings-apply-now")?.addEventListener("click", () => {
    const overrides = buildOverridesFromUI();
    applyConfigOverrides(overrides);
    setStatus("Applied in-memory. Reload required for dataset loading to reflect changes.", "ok");
  }, { signal });

  // Reset overrides
  root.querySelector("#settings-reset")?.addEventListener("click", () => {
    clearConfigOverrides();
    setStatus("Overrides cleared. Reloading…", "ok");
    location.reload();
  }, { signal });

  // Export
  root.querySelector("#settings-export")?.addEventListener("click", () => {
    const overrides = buildOverridesFromUI();
    downloadText(
      "ontogsn_settings_overrides.json",
      JSON.stringify(overrides, null, 2),
      { mime: "application/json" }
    );
    setStatus("Exported overrides JSON.", "ok");
  }, { signal });

  // Import
  root.querySelector("#settings-import")?.addEventListener("change", async (ev) => {
    const file = ev.target?.files?.[0];
    if (!file) return;

    try {
      const obj = JSON.parse(await file.text());
      const ok = saveConfigOverrides(obj);
      if (!ok) throw new Error("localStorage unavailable");
      setStatus("Imported overrides. Reloading…", "ok");
      location.reload();
    } catch (e) {
      setStatus(`Import failed: ${e?.message || String(e)}`, "err");
    } finally {
      ev.target.value = "";
    }
  }, { signal });
}

async function renderSettingsPane(root) {
  if (!root) return;

  await mountTemplate(root, {
    templateUrl: HTML,
    cssUrl: CSS,
    cache: "no-store",
    bust: true
  });

  _renderDynamicBits(root);
}

// ---------------------------------------------------------------------------
// PaneManager lifecycle (lazy-load safe)
// ---------------------------------------------------------------------------

let _rootEl = null;
let _ac = null;
let _suspended = false;
let _tabsInitDone = false;

export async function mount({ root } = {}) {
  _rootEl = root ?? resolveEl("#settings-root", { required: true, name: "Settings pane root" });

  // Optional: if Settings is a "left pane" module, keep this behavior,
  // but do it only when mounted.
  if (!_tabsInitDone) {
    try { panes.initLeftTabs?.(); } catch {}
    _tabsInitDone = true;
  }

  // fresh abort controller per mount (for clean listener cleanup)
  _ac?.abort?.();
  _ac = new AbortController();

  await renderSettingsPane(_rootEl);
  _wireEvents(_rootEl, { signal: _ac.signal });

  return () => unmount();
}

export async function resume() {
  _suspended = false;
}

export async function suspend() {
  _suspended = true;
}

export async function unmount() {
  _suspended = true;

  try { _ac?.abort?.(); } catch {}
  _ac = null;

  try {
    if (_rootEl) _rootEl.innerHTML = "";
  } catch {}

  _rootEl = null;
}

export default { mount, resume, suspend, unmount };
