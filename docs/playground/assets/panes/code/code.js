import app from "@core/queries.js";
import { bus as coreBus } from "@core/events.js";

import {
  mountTemplate,
  resolveEl,
  escapeHtml,
  fetchRepoText,
  repoHref,
  fetchText,
  highlightCode
} from "@core/utils.js";

const HTML = new URL("./code.html", import.meta.url);
const CSS  = new URL("./code.css",  import.meta.url);

// Default (fallback) solution
const TARGET_SOLUTION_IRI =
  "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#Sn11";

const CODE_BASE_URL = "data/";
const CODE_SOLUTION_QUERY = "data/queries/read_solutionWithCode.sparql";

// --- module state ----------------------------------------------------------
let _root = null;
let _bus = null;

let _codeBox = null;
let _statusEl = null;

let _currentIri = TARGET_SOLUTION_IRI;

let _cleanup = null;

// --- helpers ---------------------------------------------------------------
async function runSparql(query) {
  await app.init();
  if (!app?.selectBindings) {
    throw new Error("SPARQL store not available (app.selectBindings missing)");
  }
  return app.selectBindings(query);
}

function setStatus(msg = "") {
  if (_statusEl) _statusEl.textContent = msg;
}

function setCodeHtml(codeLanguage, codeText) {
  if (!_codeBox) return;
  _codeBox.innerHTML =
    `<pre class="code-block"><code class="language-${escapeHtml(codeLanguage)}">${escapeHtml(codeText)}</code></pre>`;
  highlightCode(_codeBox);
}

function setErrorHtml(solutionIri, err) {
  if (!_codeBox) return;
  _codeBox.innerHTML = `
    <p class="code-panel-error">
      Could not load code artefact for
      <code>${escapeHtml(solutionIri)}</code>:
      ${escapeHtml(err?.message || String(err))}
    </p>
  `;
}

async function fetchCodeMeta(solutionIri) {
  const raw = await fetchRepoText(CODE_SOLUTION_QUERY, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });

  const query = raw.replaceAll("${solutionIri}", solutionIri);
  const bindings = await runSparql(query);

  if (!bindings || !bindings.length) {
    throw new Error(`No code artefact found for ${solutionIri}`);
  }

  const row = bindings[0];

  const langLiteral     = row.lang?.value ?? "text";
  const filePathLiteral = row.filePath?.value ?? "";

  if (!filePathLiteral) {
    throw new Error(`Missing py:filePath for ${solutionIri}`);
  }

  const [relativePath, fragment] = String(filePathLiteral).split("#");
  if (!relativePath) {
    throw new Error(`Invalid py:filePath for ${solutionIri}: "${filePathLiteral}"`);
  }

  const codeUrl = repoHref(CODE_BASE_URL + relativePath, {
    from: import.meta.url,
    upLevels: 2
  });

  return {
    codeLanguage: String(langLiteral).toLowerCase(),
    codeUrl,
    fragment: fragment || null
  };
}

async function render(solutionIri) {
  if (!_root) return;

  const iri = String(solutionIri || TARGET_SOLUTION_IRI).trim();
  _currentIri = iri || TARGET_SOLUTION_IRI;

  setStatus(`Loading code artefact…`);
  if (_codeBox) _codeBox.innerHTML = `<p>Loading…</p>`;

  try {
    // 1) Get metadata from KG
    const meta = await fetchCodeMeta(_currentIri);

    // 2) Fetch actual code file
    const codeText = await fetchText(meta.codeUrl, { cache: "no-store", bust: true });

    setStatus(`Loaded (${meta.codeLanguage})`);
    setCodeHtml(meta.codeLanguage, codeText);

    // Optional: you could use meta.fragment later to scroll to a section/line
    // (currently unused)
  } catch (err) {
    setStatus(`Error`);
    setErrorHtml(_currentIri, err);
  }
}

// --- PaneManager lifecycle exports -----------------------------------------

export async function mount({ root, bus, payload }) {
  _root = root;
  _bus = bus || coreBus;

  await mountTemplate(root, {
    templateUrl: HTML,
    cssUrl: CSS,
    cache: "no-store",
    bust: true,
    replace: true
  });

  _statusEl = resolveEl("#code-status", { root, required: false });
  _codeBox  = resolveEl("#code-box",    { root, required: false });

  // If you ever pass something via payload in the future:
  // e.g., payload.solutionIri
  const initialIri = payload?.solutionIri || TARGET_SOLUTION_IRI;

  // Load once on mount
  await render(initialIri);

  // Listen for “show code for selection”
  const onSelect = (ev) => {
    const iri = ev?.detail?.iri;
    if (!iri) return;
    render(iri);
  };

  // If your bus supports unsubscribe, store and call it in cleanup.
  const offChecklist = _bus?.on?.("checklist:select", onSelect);

  _cleanup = () => {
    try { offChecklist?.(); } catch {}
    _root = null;
    _bus = null;
    _codeBox = null;
    _statusEl = null;
  };

  return _cleanup;
}

export async function resume() {
  // Re-render on resume so content is always current
  await render(_currentIri || TARGET_SOLUTION_IRI);
}

export async function suspend() {
  // nothing to stop
}

export async function unmount() {
  try { _cleanup?.(); } catch {}
  _cleanup = null;
}
