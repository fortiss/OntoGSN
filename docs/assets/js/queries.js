import init, { Store } from "https://cdn.jsdelivr.net/npm/oxigraph@0.5.2/web.js";
import { visualizeSPO } from "./graph.js";

/** @typedef {{s:string,p:string,o:string}} SPORow */

// ---------- DOM handles ----------
const outEl     = document.getElementById("out");
const resultsEl = document.getElementById("results");
const graphEl   = document.getElementById("graph");

const show = x => { if (outEl) outEl.textContent = (typeof x === "string" ? x : JSON.stringify(x, null, 2)); };

// Compute repository root (two levels up from /assets/js/*.js)
const BASE_URL  = new URL("../../", import.meta.url);
const BASE_PATH = (BASE_URL.protocol.startsWith("http") ? BASE_URL.href : BASE_URL.pathname).replace(/\/$/, "");
const MIME_TTL = "text/turtle";
const BASE_ONTO = "https://w3id.org/OntoGSN/ontology#";
const BASE_CASE = "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#";
const BASE_CAR  = "https://example.org/car-demo#";

// Centralize paths in one place for readability
const PATHS = {
  onto    : "/assets/data/ontologies/ontogsn_lite.ttl",
  example : "/assets/data/ontologies/example_ac.ttl",
  car     : "/assets/data/ontologies/car.ttl",
  q       : {
    nodes     : "/assets/data/queries/read_all_nodes.sparql",
    rels      : "/assets/data/queries/read_all_relations.sparql",
    visualize : "/assets/data/queries/visualize_graph.sparql",
    propCtx   : "/assets/data/queries/propagate_context.sparql",
    propDef   : "/assets/data/queries/propagate_defeater.sparql",
    listModules     : "/assets/data/queries/list_modules.sparql",
    visualizeByMod  : "/assets/data/queries/visualize_graph_by_module.sparql"
  }
};

// One global-ish app instance to keep state tidy
class QueryApp {
  /** @type {Store|null} */                     store = null;
  /** @type {ReturnType<visualizeSPO>|null} */  graphCtl = null;
  /** @type {(e:Event)=>void} */                _onResize = () => {};
  /** @type {Map<string, Set<string>>} */       overlays = new Map();

  async init() {
    await init();
    this.store = new Store();
    await this._loadTTL();
    this._attachUI();
    await this._buildModulesBar();
  }

  async run(queryPath, overlayClass = null, { noTable = false } = {}) {
    try {
      this._setBusy(true);
      const query = await fetchText(queryPath);

      // Detect INSERT DATA and treat as SPARQL UPDATE
      const trimmed = query.trim().toUpperCase();
      if (isUpdateQuery(query)) {
        await this.store.update(query);  // await is nice, since run(...) is async

        if (!noTable && resultsEl) {
          resultsEl.innerHTML = "<p>SPARQL UPDATE executed.</p>";
        }
        this._setStatus?.("SPARQL UPDATE executed.");
        return; // don’t fall through to store.query(...)
      }

      const res   = this.store.query(query);
      const rows  = bindingsToRows(res);

      if (!noTable) {
        renderTable(resultsEl, rows);
      }

      const hasS = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "s");
      const hasP = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "p");
      const hasO = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "o");
      
      const hasCollectionsShape = rows.length > 0 && "ctx" in rows[0] && "clt" in rows[0] && "item" in rows[0];

      if (hasCollectionsShape) {
        if (!this.graphCtl?.addCollections) {
          this._setStatus?.('Collections overlay not available. Draw the graph first.');
          return;
        }
        this.graphCtl.addCollections(rows, { dx: 90, dy: 26 }); // tweak spacing if you like
        this._setStatus?.(`Added ${rows.length} collection link${rows.length===1?"":"s"}.`);

        // keep your resize handler + window.graphCtl lines (same as other branches)
        window.removeEventListener("resize", this._onResize);
        this._onResize = () => this.graphCtl && this.graphCtl.fit();
        window.addEventListener("resize", this._onResize);
        window.graphCtl = this.graphCtl;
        return;
      }
      
      // GRAPH CASE: ?s ?p ?o (plus optional ?type etc.)
      if (hasS && hasP && hasO) {
        console.debug("[graph/run] rows:", rows.length, rows.slice(0, 5));

        if (this.graphCtl && typeof this.graphCtl.destroy === "function") {
          this.graphCtl.destroy();
          this.graphCtl = null;
        } else {
          this._setStatus?.("No triples found in results (expecting ?s ?p ?o).");
        }

        // Pass FULL rows (s,p,o,type,...) to graph.js
        this.graphCtl = visualizeSPO(rows, {
          mount: graphEl,
          height: 520,
          label: shorten,
          supportedBy: [
            "supported by",
            "gsn:supportedBy",
            "https://w3id.org/OntoGSN/ontology#supportedBy",
            "http://w3id.org/gsn#supportedBy",
          ],
          contextOf: [
            "in context of",
            "gsn:inContextOf",
            "https://w3id.org/OntoGSN/ontology#inContextOf",
            "http://w3id.org/gsn#inContextOf",
          ],
          challenges: [
            "challenges",
            "gsn:challenges",
            "https://w3id.org/OntoGSN/ontology#challenges",
            "http://w3id.org/gsn#challenges",
          ],
          theme: "light",
        });
      
        if (this.graphCtl?.fit) this.graphCtl.fit();
        this._setStatus?.(`Rendered graph from ${rows.length} triples.`);
        this._applyVisibility();

        window.removeEventListener("resize", this._onResize);
        this._onResize = () => this.graphCtl && this.graphCtl.fit();
        window.addEventListener("resize", this._onResize);

        // expose for console/tests
        window.graphCtl = this.graphCtl;
        this._reapplyOverlays();
        return;

      }

      if (hasS && !hasP && !hasO) {
        if (!this.graphCtl?.highlightByIds) {
          // No graph to highlight yet — give a friendly nudge
          this._setStatus?.("Nothing to highlight yet. Run “Visualize Graph” first.");
          return;
        }

        const ids = rows.map(r => r.s).filter(Boolean);
        const cls = overlayClass || "overlay";

        this.overlays.set(cls, new Set(ids));

        this._reapplyOverlays();
        this._setStatus?.(`Highlighted ${ids.length} ${cls} node${ids.length === 1 ? "" : "s"}.`);

        window.removeEventListener("resize", this._onResize);
        this._onResize = () => this.graphCtl && this.graphCtl.fit();
        window.addEventListener("resize", this._onResize);
        window.graphCtl = this.graphCtl;
        return;        
      }



      // CASE 3: Anything else → fall back to your existing table/render logic
      // (e.g., show raw table or an info message)
      if (rows.length === 0) {
        this._setStatus?.("No results.");
        return;
      }

      this._setStatus?.("Query returned an unsupported shape. Expect either ?s ?p ?o (graph) or single ?s (overlay).");

      // Keep resize listener idempotent
      window.removeEventListener("resize", this._onResize);
      this._onResize = () => this.graphCtl && this.graphCtl.fit();
      window.addEventListener("resize", this._onResize);
      // You can keep a global for compatibility if other scripts poke it
      window.graphCtl = this.graphCtl;
    } catch (e) {
      outEl.textContent =
        `Error running ${queryPath}:
        ${e?.message || e}
        Hints:
          - Check the path (is it correct under GitHub Pages?)
          - Did TTLs parse? (see console for parse errors)
          - Does the query SELECT ?s ?p ?o if you expect graph output?`;
      console.error(e);
    } finally {
      this._setBusy(false);
    }
  }

  // --- private helpers ---
  async runInline(queryText, overlayClass = null, { noTable = false } = {}) {
    try {
      this._setBusy(true);

      // Detect INSERT DATA and treat as SPARQL UPDATE
      if (isUpdateQuery(queryText)) {
        await this.store.update(queryText);
        if (!noTable && resultsEl) {
          resultsEl.innerHTML = "<p>SPARQL UPDATE executed.</p>";
        }
        this._setStatus?.("SPARQL UPDATE executed.");
        return;
      }

      const res   = this.store.query(queryText);
      const rows  = bindingsToRows(res);

      if (!noTable) renderTable(resultsEl, rows);

      const hasS = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "s");
      const hasP = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "p");
      const hasO = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], "o");

      // Graph case: full rows (s,p,o,type,...)
      if (hasS && hasP && hasO) {
        console.debug("[graph/inline] rows:", rows.length, rows.slice(0, 5));

        if (this.graphCtl?.destroy) { 
          this.graphCtl.destroy(); 
          this.graphCtl = null; 
        } else {
          this._setStatus?.("No triples found in results (expecting ?s ?p ?o).");
        }

        this.graphCtl = visualizeSPO(rows, {
          mount: graphEl,
          height: 520,
          label: shorten,
          supportedBy: [
            "supported by","gsn:supportedBy",
            "https://w3id.org/OntoGSN/ontology#supportedBy","http://w3id.org/gsn#supportedBy",
          ],
          contextOf: [
            "in context of","gsn:inContextOf",
            "https://w3id.org/OntoGSN/ontology#inContextOf","http://w3id.org/gsn#inContextOf",
          ],
          challenges: [
            "challenges","gsn:challenges",
            "https://w3id.org/OntoGSN/ontology#challenges","http://w3id.org/gsn#challenges",
          ],
          theme: "light",
        });

        this.graphCtl?.fit?.();
        this._applyVisibility();

        window.removeEventListener("resize", this._onResize);
        this._onResize = () => this.graphCtl && this.graphCtl.fit();
        window.addEventListener("resize", this._onResize);
        window.graphCtl = this.graphCtl;
        this._reapplyOverlays();
        return;
      }

      // Overlay-only case (kept for parity)
      if (hasS && !hasP && !hasO) {
        if (!this.graphCtl?.highlightByIds) {
          this._setStatus?.("Nothing to highlight yet. Run “Visualize Graph” first.");
          return;
        }
        const ids = rows.map(r => r.s).filter(Boolean);
        const cls = overlayClass || "overlay";
        this.overlays.set(cls, new Set(ids));
        this._reapplyOverlays();
        this._setStatus?.(`Highlighted ${ids.length} ${cls} node${ids.length === 1 ? "" : "s"}.`);
        return;
      }

      this._setStatus?.("Query returned an unsupported shape.");
    } catch (e) {
      outEl.textContent = `Error (inline query): ${e?.message || e}`;
    } finally {
      this._setBusy(false);
    }
  }

  async _buildModulesBar() {
    // 1) Query modules
    const listQ = await fetchText(PATHS.q.listModules);
    const rows  = bindingsToRows(this.store.query(listQ));

    // 2) Find/create the container at the bottom
    let bar = document.getElementById("modulesBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "modulesBar";
      bar.className = "modules-bar";
      document.body.appendChild(bar);
    }
    bar.innerHTML = "";

    // 3) An “All” button to restore the global view
    const btnAll = document.createElement("button");
    btnAll.textContent = "All";
    btnAll.addEventListener("click", () => this.run(PATHS.q.visualize));
    bar.appendChild(btnAll);

    // 4) One button per module
    for (const r of rows) {
      const iri   = r.module;
      if (!iri) {
        console.warn("[modules] Missing ?module variable in list_modules.sparql row:", r); 
        continue; 
      }

      const label = r.label || shorten(iri);
      const b = document.createElement("button");
      b.textContent = label;
      b.title = iri;
      b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();

        const tmpl  = await fetchText(PATHS.q.visualizeByMod);
        let query   = tmpl;
        query = query.replaceAll("<{{MODULE_IRI}}>", `<${iri}>`);
        query = query.replaceAll("{{MODULE_IRI}}", `<${iri}>`);
        console.debug("[modules] query preview:", query.slice(0, 400));
        await this.runInline(query, null, { noTable: false });
      });
      bar.appendChild(b);
    }
  }


  _applyVisibility() {
    const root = graphEl; // already defined at top of queries.js
    const ctx = document.getElementById("toggle-context");
    const df  = document.getElementById("toggle-defeat");
    if (!root) return;
    root.classList.toggle("hide-ctx", !(ctx?.checked));
    root.classList.toggle("hide-def", !(df?.checked));
    this.graphCtl?.fit?.(); // keep the view tidy
  }

  _reapplyOverlays() {
    if (!this.graphCtl) return;
    // one clean slate
    if (this.graphCtl.clearAll) this.graphCtl.clearAll();
    // then reapply each active class
    for (const [cls, idSet] of this.overlays.entries()) {
      if (idSet && idSet.size > 0) {
        this.graphCtl.highlightByIds(Array.from(idSet), cls);
      }
    }
  }

  async _loadTTL() {
    // Always load from BASE_PATH, used in both TEST and PROD
    const ontoURL    = `${BASE_PATH}${PATHS.onto}`;
    const exampleURL = `${BASE_PATH}${PATHS.example}`;
    const carURL     = `${BASE_PATH}${PATHS.car}`;

    const [ttlOnto, ttlExample, ttlCar] = await Promise.all([getTTL(ontoURL), getTTL(exampleURL), getTTL(carURL),]);
    try {
      this.store.load(ttlOnto, MIME_TTL, BASE_ONTO);
      this.store.load(ttlExample, MIME_TTL, BASE_CASE);
      this.store.load(ttlCar,     MIME_TTL, BASE_CAR);
    } catch (e) {
      const preview = ttlOnto.slice(0, 300);
      show?.(`Parse error while loading TTL: ${e.message}\n\nPreview of ontogsn_lite.ttl:\n${preview}`);
      throw e;
    }

    // Wire graph interactions (context/defeater propagation) once
    window.addEventListener("gsn:contextClick", async (ev) => {
      const iri = ev?.detail?.id;
      if (!iri) return;
      const tmpl = await fetchText(PATHS.q.propCtx);
      const q    = tmpl.replaceAll("{{CTX_IRI}}", `<${iri}>`);
      const res  = this.store.query(q);
      const rows = bindingsToRows(res);
      const ids  = rows.map(r => r.nodeIRI).filter(Boolean);
      this.graphCtl?.clearAll();
      this.graphCtl?.highlightByIds(ids, "in-context");
    });

    window.addEventListener("gsn:defeaterClick", async (ev) => {
      const iri = ev?.detail?.id;
      if (!iri) return;
      const tmpl = await fetchText(PATHS.q.propDef);
      const q    = tmpl.replaceAll("{{DFT_IRI}}", `<${iri}>`);
      const res  = this.store.query(q);
      const rows = bindingsToRows(res);
      const ids  = rows.map(r => r.hitIRI).filter(Boolean);
      this.graphCtl?.clearAll();
      this.graphCtl?.highlightByIds(ids, "def-prop");
    });
  }

  _attachUI() {
    // Single event delegation for all buttons tagged with [data-query]
    document.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-query]:not(input)") : null;
      if (!btn) return;
      const path = btn.getAttribute("data-query");
      const noTable = btn.dataset.noTable === "1" || btn.dataset.noTable === "true";
      if (!path) return;
      this.run(path, null, { noTable });
    });

    document.addEventListener("change", (e) => {
      const el = e.target instanceof Element 
      ? e.target.closest('input[type="checkbox"][data-class]') : null;
      if (!el) return;

      const cls  = el.getAttribute("data-class") || "overlay";
      const noTable = el.dataset.noTable === "1" || el.dataset.noTable === "true";

      const raw = el.getAttribute("data-queries") ?? el.getAttribute("data-query");
      if (!raw) return;

      const paths = raw
        .split(/[;,]/)          // split on comma or semicolon
        .map(s => s.trim())
        .filter(Boolean);

      if (!paths.length) return;

      const deletePath = el.getAttribute("data-delete-query");
      const eventName  = el.getAttribute("data-event");

      const isOverloadRule = paths.some(p =>
        p.includes("propagate_overloadedCar.sparql")
      );

      if (el.checked) {
        (async () => {
          for (const path of paths) {
            await this.run(path, cls, { noTable });
          }
          if (isOverloadRule) {
            window.dispatchEvent(
              new CustomEvent("car:overloadChanged", {
                detail: { active: true }
              })
            );
          }
          if (eventName) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { active: true } }));
          }
        })();
      } else {
        (async () => {
          if (deletePath) {
            await this.run(deletePath, cls, { noTable: true });
          }

          // turn off this class overlay
          this.overlays.set(cls, new Set());
          this._reapplyOverlays();
          this._setStatus?.(`Hid ${cls} overlay.`);

          if (cls === "collection") {
            this.graphCtl?.clearCollections?.();
            this._setStatus?.("Hid collections overlay.");
          }

          // Notify the car model that overload propagation is cleared
          if (isOverloadRule) {
            window.dispatchEvent(
              new CustomEvent("car:overloadChanged", {
                detail: { active: false }
              })
            );
          }
          if (eventName) {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { active: false } }));
          }
        })();
      }
    });
    const ctxBox = document.getElementById("toggle-context");
    const dfBox  = document.getElementById("toggle-defeat");
    ctxBox?.addEventListener("change", () => this._applyVisibility());
    dfBox ?.addEventListener("change", () => this._applyVisibility());
  }

  _setBusy(busy) {
    document.body.toggleAttribute("aria-busy", !!busy);
    const btns = document.querySelectorAll("[data-query]");
    btns.forEach(b => b.toggleAttribute("disabled", !!busy));
  }
}

// ---------- generic helpers ----------

function toTriples(rows) {
  const get = (r, keys) => keys.find(k => r[k] !== undefined);
  const triples = [];
  for (const r of rows) {
    const ks = get(r, ["s","subject","subj","source","nodeIRI","from","g"]);
    const kp = get(r, ["p","predicate","pred","rel","property","edge"]);
    const ko = get(r, ["o","object","obj","target","to","hitIRI"]);
    const s = ks ? r[ks] : undefined;
    const p = kp ? r[kp] : undefined;
    const o = ko ? r[ko] : undefined;
    if (s && p && o) triples.push({ s, p, o });
  }
  return triples;
}

async function fetchText(relPath) {
  const url = (relPath.startsWith("http") ? relPath :
               `${BASE_PATH}${relPath.startsWith("/") ? "" : "/"}${relPath}`);
  const r = await fetch(`${url}?v=${performance.timeOrigin}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
  const txt = await r.text();
  return txt.replace(/^\uFEFF/, ""); // strip BOM
}

function getFirstKeyword(queryText) {
  const lines = String(queryText).split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;           // skip empty
    if (t.startsWith("#")) continue; // skip comments
    if (/^(PREFIX|BASE)\b/i.test(t)) continue; // skip PREFIX/BASE
    return t.split(/\s+/)[0].toUpperCase();
  }
  return "";
}

function isUpdateQuery(queryText) {
  const kw = getFirstKeyword(queryText);
  // basic set of SPARQL UPDATE operations
  return ["INSERT","DELETE","LOAD","CREATE","DROP","CLEAR","COPY","MOVE","ADD"].includes(kw);
}

async function getTTL(url) {
  const r = await fetch(`${url}?v=${performance.timeOrigin}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
  const txt = await r.text();
  const first = txt.split(/\r?\n/).find(l => l.trim().length) || "";
  if (first.startsWith("<!")) throw new Error(`Got HTML instead of Turtle from ${url}. Check the path.`);
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

function bindingsToRows(iter) {
  const rows = [];
  for (const b of iter) {
    const obj = {};
    for (const [k, v] of b) obj[k] = termToDisplay(v);
    rows.push(obj);
  }
  return rows;
}

function renderTable(el, rows) {
  if (!el) return;
  if (!rows.length) { el.innerHTML = "<p>No results.</p>"; return; }
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  let html = '<table class="sparql"><thead><tr>' + headers.map(h => `<th>${esc(h)}</th>`).join("") + '</tr></thead><tbody>';
  for (const r of rows) html += '<tr>' + headers.map(h => `<td>${esc(r[h] ?? "")}</td>`).join("") + '</tr>';
  html += '</tbody></table>';
  el.innerHTML = html;
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function shorten(iriOrLabel) {
  try {
    const u = new URL(iriOrLabel);
    if (u.hash && u.hash.length > 1) return u.hash.slice(1);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || iriOrLabel;
  } catch {
    return iriOrLabel.replace(/^.*[#/]/, "");
  }
}

// ---------- boot ----------
const app = new QueryApp();
//app.init();
window.addEventListener("DOMContentLoaded", async () => {
  await app.init();                     // loads TTLs + wires UI
  await app.run(PATHS.q.visualize);
});

// Also export the app for debugging in console if needed
export default app;