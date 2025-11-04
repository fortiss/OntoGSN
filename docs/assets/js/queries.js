// ESM import from jsDelivr (works on GitHub Pages)
import init, { Store } from "https://cdn.jsdelivr.net/npm/oxigraph@0.5.2/web.js";

const out = document.getElementById("out");
const show = x => out.textContent = typeof x === "string" ? x : JSON.stringify(x, null, 2);

(async () => {
  try {
    // Loads the WASM (web_bg.wasm) from the same CDN path
    await init();

    const store = new Store();

    // Adjust base if you use project pages; {{ site.baseurl }} is injected in the HTML page
    const base = document.documentElement.dataset.baseurl || "";

    const [ttlOnto, ttlExample] = await Promise.all([
      fetch(`${base}/assets/data/ontogsn_lite.ttl`).then(r => r.text()),
      fetch(`${base}/assets/data/example_ac.ttl`).then(r => r.text()),
    ]);

    store.load(ttlOnto,    "text/turtle", "https://w3id.org/OntoGSN/ontology#");
    store.load(ttlExample, "text/turtle", "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#");

    const q = `
      PREFIX gsn:  <https://w3id.org/OntoGSN/ontology#>
      PREFIX case: <https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#>
      SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 20
    `;
    const res = store.query(q);
    const rows = [];
    for (const b of res) rows.push(Object.fromEntries([...b].map(([k,v]) => [k, v.value])));
    show(rows);
  } catch (e) {
    console.error(e);
    show("Error: " + e.message);
  }
})();
