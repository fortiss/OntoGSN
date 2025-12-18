import panes from "./panes.js";
import app from "./queries.js";

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

async function runSparql(query) {
  if (!app || typeof app.selectBindings !== "function") {
    throw new Error("SPARQL store not available (app.selectBindings missing)");
  }
  return app.selectBindings(query);
}

const TARGET_SOLUTION_IRI = "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#Sn11";
const CODE_BASE_URL = "/OntoGSN/assets/data/";
const CODE_SOLUTION_QUERY = "../assets/data/queries/read_solutionWithCode.sparql";

async function fetchCodeMeta(solutionIri) {
  const r = await fetch(
    `${CODE_SOLUTION_QUERY}?v=${performance.timeOrigin}`,
    { cache: "no-store" }
  );
  if (!r.ok) {
    throw new Error(`Fetch failed ${r.status} for ${CODE_SOLUTION_QUERY}`);
  }
  const raw       = (await r.text()).replace(/^\uFEFF/, "");
  const query     = raw.replace("${solutionIri}", solutionIri);
  const bindings  = await runSparql(query);

  if (!bindings || !bindings.length) {
    throw new Error(`No code artefact found for ${solutionIri}`);
  }

  const row = bindings[0];
  const langLiteral     = row.lang     && row.lang.value     ? row.lang.value     : "text";
  const filePathLiteral = row.filePath && row.filePath.value ? row.filePath.value : "";

  if (!filePathLiteral) {
    throw new Error(`Missing py:filePath for ${solutionIri}`);
  }

  const [relativePath, fragment] = filePathLiteral.split("#");
  if (!relativePath) {
    throw new Error(`Invalid py:filePath for ${solutionIri}: "${filePathLiteral}"`);
  }

  return {
    codeLanguage: String(langLiteral).toLowerCase(),
    codeUrl: CODE_BASE_URL + relativePath,
    fragment: fragment || null
  };
}


async function renderCodePanel() {
  const root = document.getElementById("code-root");
  if (!root) return;

  root.innerHTML = `<p>Loading code artefact…</p>`;

  try {
    // 1) Get metadata from the KG
    const meta = await fetchCodeMeta(TARGET_SOLUTION_IRI);

    // 2) Fetch the actual code file
    const resp = await fetch(meta.codeUrl);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const codeText = await resp.text();

    root.innerHTML = `
      <section class="code-panel">
        <pre class="code-block">
<code class="language-${esc(meta.codeLanguage)}">${esc(codeText)}</code>
        </pre>
      </section>
    `;

    // 3) Apply syntax highlighting
    if (window.hljs) {
      root.querySelectorAll("pre code").forEach(block => {
        window.hljs.highlightElement(block);
      });
    }

  } catch (err) {
    root.innerHTML = `
      <section class="code-panel">
        <p class="code-panel-error">
          Could not load code artefact for
          <code>${esc(TARGET_SOLUTION_IRI)}</code>:
          ${esc(err.message)}
        </p>
      </section>
    `;
  }
}


window.addEventListener("DOMContentLoaded", async () => {
  panes.initLeftTabs();
  renderCodePanel();
});
