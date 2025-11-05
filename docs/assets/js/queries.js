// Oxigraph browser build (v0.5.x): web.js + web_bg.wasm from CDN
import init, { Store } from "https://cdn.jsdelivr.net/npm/oxigraph@0.5.2/web.js";

const out  = document.getElementById("out");
const show = x => out.textContent = typeof x === "string" ? x : JSON.stringify(x, null, 2);
const base = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

async function loadQuery(path) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
  const txt = await r.text();
  return txt.replace(/^\uFEFF/, ""); // strip BOM if present
}

async function getTTL(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
  const txt = await r.text();

  // If we accidentally fetched an HTML error/404 page, bail early
  const firstLine = txt.split(/\r?\n/).find(l => l.trim().length) || "";
  if (firstLine.startsWith("<!")) {
    throw new Error(`Got HTML instead of Turtle from ${url}. Check the path.`);
  }
  return txt;
}

function termToDisplay(t) {
  if (!t) return "";
  switch (t.termType) {
    case "NamedNode": return t.value;
    case "BlankNode": return "_:" + t.value;
    case "Literal": {
      const dt = t.datatype?.value;
      const lg = t.language;
      if (lg) return `"${t.value}"@${lg}`;
      if (dt && dt !== "http://www.w3.org/2001/XMLSchema#string") return `"${t.value}"^^${dt}`;
      return t.value;
    }
    default: return t.value ?? String(t);
  }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** rows: Array<Object>, keys are variable names */
function renderTable(el, rows) {
  if (!rows.length) { el.innerHTML = "<p>No results.</p>"; return; }
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  let html = '<table class="sparql"><thead><tr>' +
             headers.map(h => `<th>${esc(h)}</th>`).join("") +
             '</tr></thead><tbody>';
  for (const r of rows) {
    html += '<tr>' + headers.map(h => `<td>${esc(r[h] ?? "")}</td>`).join("") + '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}


(async () => {
  try {
    await init(); // loads web_bg.wasm from the same CDN folder
    const store = new Store();

    // Your ontologies live in ./assets/data
    const ontoPath    = `${base}/assets/data/ontogsn_lite.ttl`;
    const examplePath = `${base}/assets/data/example_ac.ttl`;

    const [ttlOnto, ttlExample] = await Promise.all([
      getTTL(ontoPath),
      getTTL(examplePath),
    ]);

    // Load both into the default graph
    try {
      store.load(ttlOnto,    "text/turtle", "https://w3id.org/OntoGSN/ontology#");
      store.load(ttlExample, "text/turtle", "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#");
    } catch (e) {
      // Help debug common "Invalid IRI code point ' '" issues
      const preview = ttlOnto.slice(0, 300);
      show(`Parse error while loading TTL: ${e.message}\n\nPreview of ontogsn_lite.ttl:\n${preview}`);
      throw e;
    }

    // Sample query
    const q = await loadQuery("/assets/data/read_all.sparql");

    const res  = store.query(q);
    const rows = [];
    for (const b of res) {
      const obj = {};
      for (const [k, v] of b) obj[k] = termToDisplay(v);
      rows.push(obj);
    }
    renderTable(document.getElementById("results"), rows);
  } catch (e) {
    console.error(e);
    if (!out.textContent || out.textContent === "Loading…") {
      show("Error: " + e.message);
    }
  }
})();
