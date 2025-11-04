import init, { Store } from "https://cdn.jsdelivr.net/npm/oxigraph@0.4.0/oxigraph_wasm.js";

const out = document.getElementById('out');
const base = document.querySelector('script[type="module"][src]')?.getAttribute('src')
  ?.split('/assets/')[0] || ''; // falls back to '' for user pages

function show(obj) {
  out.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

(async () => {
  try {
    await init();
    const store = new Store();

    // Put your TTL files in /assets/data/
    const files = [
      `${base}/assets/data/ontogsn_lite.ttl`,
      `${base}/assets/data/example_ac.ttl`,
    ];

    const texts = await Promise.all(files.map(async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
      return r.text();
    }));

    // Load both into the default graph
    store.load(texts[0], "text/turtle", "https://w3id.org/OntoGSN/ontology#");
    store.load(texts[1], "text/turtle", "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#");

    const q = `
      PREFIX gsn:  <https://w3id.org/OntoGSN/ontology#>
      PREFIX case: <https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#>
      SELECT ?s ?p ?o
      WHERE { ?s ?p ?o }
      LIMIT 20
    `;

    const res = store.query(q);
    const rows = [];
    for (const b of res) {
      rows.push(Object.fromEntries([...b].map(([k, v]) => [k, v.value])));
    }
    show(rows);
  } catch (e) {
    show("Error: " + e.message);
    console.error(e);
  }
})();
