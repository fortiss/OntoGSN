// /assets/js/editor.js
import app from "./queries.js";
import panes from "./panes.js";

// Reproduce BASE_PATH + fetchText so paths to .sparql files behave like in queries.js
const BASE_URL  = new URL("../../", import.meta.url);
const BASE_PATH = (BASE_URL.protocol.startsWith("http")
  ? BASE_URL.href
  : BASE_URL.pathname
).replace(/\/$/, "");

async function fetchText(relPath) {
  const url = (relPath.startsWith("http")
    ? relPath
    : `${BASE_PATH}${relPath.startsWith("/") ? "" : "/"}${relPath}`);
  const r = await fetch(`${url}?v=${performance.timeOrigin}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
  const txt = await r.text();
  return txt.replace(/^\uFEFF/, "");
}

// ---- Config: which write actions are offered in the editor ----

const ACTIONS = [
  {
    id: "create-gsn-element",
    label: "Create GSN node",
    templatePath: "/assets/data/queries/create_gsn_element.sparql",
    fields: [
      { name: "ID",      label: "Identifier (e.g. G1.1)", placeholder: "G1.1" },
      { name: "IRI",     label: "Local name (e.g. car_G1_1)", placeholder: "car_G1_1" },
      { name: "LABEL",   label: "Label", placeholder: "Goal label..." },
      { name: "STATEMENT", label: "Statement", placeholder: "Description..." }
    ]
  },
  // Add more actions as needed...
];

// Simple templating: replace {{NAME}} with value
function applyTemplate(template, values) {
  let result = template;
  for (const [key, val] of Object.entries(values)) {
    const re = new RegExp(`{{${key}}}`, "g");
    result = result.replace(re, val);
  }
  return result;
}

// ---- UI wiring ----

async function initEditorUI() {
  const root = document.getElementById("editor-root");
  if (!root) return;

  await app.init();

  // Basic structure
  root.innerHTML = `
    <div class="editor">
      <label>
        Action:
        <select id="editor-action"></select>
      </label>

      <label style="display:block; margin-top:0.5rem;">
        GSN element type:
        <select id="editor-type"></select>
      </label>

      <div id="editor-fields" style="margin-top:0.5rem;"></div>

      <button id="editor-run" style="margin-top:0.5rem;">
        Run SPARQL UPDATE
      </button>

      <details style="margin-top:0.5rem;">
        <summary>Preview query</summary>
        <pre id="editor-preview" style="white-space:pre-wrap;"></pre>
      </details>
    </div>
  `;

  const actionSelect    = root.querySelector("#editor-action");
  const typeSelect      = root.querySelector("#editor-type");
  const fieldsContainer = root.querySelector("#editor-fields");
  const runBtn          = root.querySelector("#editor-run");
  const previewEl       = root.querySelector("#editor-preview");

  // Populate action dropdown
  for (const action of ACTIONS) {
    const opt = document.createElement("option");
    opt.value = action.id;
    opt.textContent = action.label;
    actionSelect.appendChild(opt);
  }

  function renderFields(action) {
    fieldsContainer.innerHTML = "";
    for (const f of action.fields) {
      const wrapper = document.createElement("div");
      wrapper.style.marginBottom = "0.5rem";
      wrapper.innerHTML = `
        <label style="display:block;">
          ${f.label}<br/>
          <input name="${f.name}"
                 type="text"
                 placeholder="${f.placeholder ?? ""}"
                 style="width:100%;">
        </label>
      `;
      fieldsContainer.appendChild(wrapper);
    }
  }

  function getCurrentAction() {
    return ACTIONS.find(a => a.id === actionSelect.value) || ACTIONS[0];
  }

  actionSelect.addEventListener("change", () => {
    renderFields(getCurrentAction());
    previewEl.textContent = "";
  });

  function shortenGsnType(iri) {
    const base = "https://w3id.org/OntoGSN/ontology#";
    if (iri.startsWith(base)) {
      return "gsn:" + iri.slice(base.length); // e.g. gsn:Goal
    }
    return iri;
  }

  async function loadGsnTypes() {
    const q = await fetchText("/assets/data/queries/read_allowed_gsnElements.sparql");

    const rows = await app.selectBindings(q);

    typeSelect.innerHTML = "";

    for (const row of rows || []) {
      const iri = row.type.value;
      const short = shortenGsnType(iri);

      const opt = document.createElement("option");
      opt.value = short;
      opt.textContent = short;
      typeSelect.appendChild(opt);
    }

    if (!typeSelect.children.length) {
      console.warn("No subclasses of gsn:GSNElement found by read_allowed_gsnElements.sparql");
    }
  }


  // Initial render + load type list
  renderFields(getCurrentAction());
  await loadGsnTypes();

  // Cache templates so we don't re-fetch every time
  const templateCache = new Map();

  async function getTemplate(action) {
    if (templateCache.has(action.id)) return templateCache.get(action.id);
    const txt = await fetchText(action.templatePath);
    templateCache.set(action.id, txt);
    return txt;
  }

  runBtn.addEventListener("click", async () => {
    const action = getCurrentAction();
    const values = {};

    for (const f of action.fields) {
      const input = fieldsContainer.querySelector(`input[name="${f.name}"]`);
      values[f.name] = (input?.value ?? "").trim();
    }

    const selectedType = typeSelect.value;
    if (!selectedType) {
      alert("Please choose a GSN element type.");
      return;
    }
    values.TYPE = selectedType;

    const tmpl = await getTemplate(action);
    const finalQuery = applyTemplate(tmpl, values);

    previewEl.textContent = finalQuery;

    await app.runInline(finalQuery, null, { noTable: true });
  });

}

// Boot
window.addEventListener("DOMContentLoaded", () => {
  panes.initLeftTabs();
  initEditorUI();
});
