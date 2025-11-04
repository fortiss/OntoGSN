// Oxigraph browser build (v0.5.x): web.js + web_bg.wasm from CDN
import init, { Store } from "https://cdn.jsdelivr.net/npm/oxigraph@0.5.2/web.js";

const out  = document.getElementById("out");
const show = x => out.textContent = typeof x === "string" ? x : JSON.stringify(x, null, 2);

// Compute base path that works on both user and project pages.
// If this file is at /assets/js/queries.js, "../../" points to the site base:
//   - user page:   https://user.github.io/            -> base: "/"
//   - project page:https://user.github.io/repo/       -> base: "/repo/"
const base = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

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
    const q = `
      PREFIX gsn:  <https://w3id.org/OntoGSN/ontology#>
      PREFIX case: <https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#>
      SELECT ?s ?p ?o
      WHERE { ?s ?p ?o }
      LIMIT 20
    `;

    const res  = store.query(q);
    const rows = [];
    for (const b of res) rows.push(Object.fromEntries([...b].map(([k, v]) => [k, v.value])));
    show(rows);
  } catch (e) {
    console.error(e);
    if (!out.textContent || out.textContent === "Loading…") {
      show("Error: " + e.message);
    }
  }
})();
