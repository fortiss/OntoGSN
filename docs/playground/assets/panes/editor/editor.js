import app from "@core/queries.js";
import { bus } from "@core/events.js";
import { mountTemplate, fetchRepoText, resolveEl, applyTemplate, safeInvoke } from "@core/utils.js";

// module-relative URLs (works on localhost + GH Pages)
const HTML = new URL("./editor.html", import.meta.url);
const CSS  = new URL("./editor.css",  import.meta.url);

// ---- Config: which write actions are offered in the editor ----
const ACTIONS = [
  {
    id: "create-gsn-element",
    label: "Create GSN node",
    templatePath: "data/queries/create_gsn_element.sparql",
    fields: [
      { name: "ID",        label: "Identifier (e.g. G1.1)", placeholder: "G1.1" },
      { name: "IRI",       label: "Local name (e.g. car_G1_1)", placeholder: "car_G1_1" },
      { name: "LABEL",     label: "Label", placeholder: "Goal label..." },
      { name: "STATEMENT", label: "Statement", placeholder: "Description..." }
    ]
  },
  // Add more actions as needed...
];

// --- module state ------------------------------------------------------
let editorRoot = null;

// cache templates so we don't re-fetch every time (persists while module is loaded)
const _templateCache = new Map();

// ---- helpers ----------------------------------------------------------
async function ensureStore() {
  if (!app.store) await app.init();
  return app.store;
}

function getCurrentAction(actionSelect) {
  return ACTIONS.find(a => a.id === actionSelect.value) || ACTIONS[0];
}

function shortenGsnType(iri) {
  const base = "https://w3id.org/OntoGSN/ontology#";
  if (String(iri).startsWith(base)) return "gsn:" + iri.slice(base.length);
  return iri;
}

async function loadGsnTypes(typeSelect) {
  const q = await fetchRepoText("data/queries/read_allowed_gsnElements.sparql", {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });

  const rows = await app.selectBindings(q);

  typeSelect.innerHTML = "";
  for (const row of rows || []) {
    const iri = row.type?.value;
    if (!iri) continue;

    const short = shortenGsnType(iri);
    const opt = document.createElement("option");
    opt.value = short;
    opt.textContent = short;
    typeSelect.appendChild(opt);
  }

  if (!typeSelect.children.length) {
    console.warn("[editor] No subclasses of gsn:GSNElement found (read_allowed_gsnElements.sparql)");
  }
}

async function getTemplate(action) {
  if (_templateCache.has(action.id)) return _templateCache.get(action.id);

  const txt = await fetchRepoText(action.templatePath, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });

  _templateCache.set(action.id, txt);
  return txt;
}

function renderFields(fieldsContainer, action) {
  fieldsContainer.innerHTML = "";
  for (const f of action.fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "editor-field";
    wrapper.innerHTML = `
      <label>
        ${f.label}<br/>
        <input name="${f.name}"
              type="text"
              placeholder="${f.placeholder ?? ""}">
      </label>
    `;
    fieldsContainer.appendChild(wrapper);
  }
}

// --- PaneManager lifecycle exports -------------------------------------
let _cleanup = null;

// handlers we may want to detach
let _onActionChange = null;
let _onRun = null;
let _busLeftTab = null;

export async function mount({ root }) {
  editorRoot = root;
  await ensureStore();

  await mountTemplate(root, {
    templateUrl: HTML,
    cssUrl: CSS,
    cache: "no-store",
    bust: true,
    replace: true
  });

  const actionSelect    = resolveEl("#editor-action",  { root, required: false, name: "Editor: #editor-action" });
  const typeSelect      = resolveEl("#editor-type",    { root, required: false, name: "Editor: #editor-type" });
  const fieldsContainer = resolveEl("#editor-fields",  { root, required: false, name: "Editor: #editor-fields" });
  const runBtn          = resolveEl("#editor-run",     { root, required: false, name: "Editor: #editor-run" });
  const previewEl       = resolveEl("#editor-preview", { root, required: false, name: "Editor: #editor-preview" });

  if (!actionSelect || !typeSelect || !fieldsContainer || !runBtn || !previewEl) {
    console.warn("[editor] Missing expected DOM elements in template");
    return () => {};
  }

  // Populate action dropdown
  actionSelect.innerHTML = "";
  for (const action of ACTIONS) {
    const opt = document.createElement("option");
    opt.value = action.id;
    opt.textContent = action.label;
    actionSelect.appendChild(opt);
  }

  // Initial fields + types
  renderFields(fieldsContainer, getCurrentAction(actionSelect));
  await loadGsnTypes(typeSelect);

  _onActionChange = () => {
    renderFields(fieldsContainer, getCurrentAction(actionSelect));
    previewEl.textContent = "";
  };
  actionSelect.addEventListener("change", _onActionChange);

  _onRun = async () => {
    const action = getCurrentAction(actionSelect);

    const values = {};
    for (const f of action.fields) {
      const input = fieldsContainer.querySelector(`input[name="${f.name}"]`);
      values[f.name] = (input?.value ?? "").trim();
    }

    const selectedType = (typeSelect.value ?? "").trim();
    if (!selectedType) {
      alert("Please choose a GSN element type.");
      return;
    }
    values.TYPE = selectedType;

    try {
      runBtn.disabled = true;

      const tmpl = await getTemplate(action);
      const finalQuery = applyTemplate(tmpl, values);

      previewEl.textContent = finalQuery;

      // execute update/insert (no table output)
      await app.runInline(finalQuery, null, { noTable: true });

      // optional: let other panes know store changed
      safeInvoke(bus, "emit", "store:changed", { source: "editor", action: action.id });
    } catch (e) {
      console.error("[editor] run failed:", e);
      previewEl.textContent = `ERROR:\n${e?.message || String(e)}\n\n---\n\n${previewEl.textContent || ""}`;
    } finally {
      runBtn.disabled = false;
    }
  };
  runBtn.addEventListener("click", _onRun);

  // Optional refresh when tab becomes active
  _busLeftTab = (ev) => {
    const d = ev?.detail || {};
    const isEditor =
      d.view === "editor" ||
      d.paneId === "editor-root" ||
      d.tabId === "tab-editor";

    if (!isEditor) return;

    // If types are empty for some reason, reload them
    if (!typeSelect.children.length) {
      loadGsnTypes(typeSelect).catch(console.warn);
    }
  };
  bus.on("left:tab", _busLeftTab);

  _cleanup = () => {
    try { actionSelect?.removeEventListener("change", _onActionChange); } catch {}
    try { runBtn?.removeEventListener("click", _onRun); } catch {}

    safeInvoke(bus, "off", "left:tab", _busLeftTab);

    _onActionChange = null;
    _onRun = null;
    _busLeftTab = null;
  };

  return _cleanup;
}

export async function resume() {
  // no-op (state is already in DOM + module cache)
}

export async function suspend() {
  // no-op
}

export async function unmount() {
  try { _cleanup?.(); } catch {}
  _cleanup = null;
  editorRoot = null;
}
