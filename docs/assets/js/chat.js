import app from "./queries.js";

// --- tiny helpers -----------------------------------------------------------
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Grab or persist the key/model locally
// Grab or persist the key/model locally
const KEY_K = "openrouter_api_key";
const MODEL_K = "openrouter_model";

/**
 * Build the chat UI inside #chat-root once.
 */
function buildChatUI() {
  const root = document.getElementById("chat-root");
  if (!root || root.dataset.initialised === "1") return;
  root.dataset.initialised = "1";

  root.innerHTML = `
    <div id="chat-panel" style="max-width:640px;width:100%;">
      <details open>
        <summary><strong>Chat with OntoGSN (OpenRouter)</strong></summary>

        <div id="chat-log"
             style="border:1px solid #ddd;border-radius:.5rem;
                    padding:.5rem;height:220px;overflow:auto;margin:.5rem 0;"></div>

        <form id="chat-form" style="display:grid;gap:.5rem;">
          <input id="chat-key" type="password"
                 placeholder="OpenRouter API key (stored locally)"
                 autocomplete="off">
          <input id="chat-model" type="text"
                 value="openai/gpt-4o-mini"
                 title="Any OpenRouter model id">
          <textarea id="chat-input" rows="2"
                    placeholder="Ask about goals, contexts, solutions…"></textarea>
          <button id="chat-send" type="submit">Send</button>
        </form>

        <small>Tip: your key is kept in <code>localStorage</code> on this device only.</small>
      </details>
    </div>
  `;

  const keyEl   = /** @type {HTMLInputElement|null} */ (document.querySelector("#chat-key"));
  const modelEl = /** @type {HTMLInputElement|null} */ (document.querySelector("#chat-model"));

  if (keyEl)   keyEl.value   = localStorage.getItem(KEY_K)   || "";
  if (modelEl) modelEl.value = localStorage.getItem(MODEL_K) || modelEl.value;

  const formEl = document.querySelector("#chat-form");
  if (formEl) {
    formEl.addEventListener("submit", onChatSubmit);
  }
}



// Make sure Oxigraph is ready
async function ensureStore() {
  if (!app.store) await app.init?.(); // no-op if already initialized
  return app.store;
}

// Naive keyword extraction (keep 3–5 useful tokens)
function keywords(q) {
  return Array.from(new Set(
    q.toLowerCase().split(/[^a-z0-9_:\-]+/i)
      .filter(w => w.length > 2 && w !== "the" && w !== "and")
  )).slice(0, 5);
}

// Build a tiny SPARQL to fetch a) matched nodes and b) their immediate edges
function makeContextQuery(words) {
  // up to 5 words → disjunction of regex tests over id/label/comment + IRIs
  const re = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const RX = re.map(w =>
    `regex(str(?s), "${w}", "i") || regex(str(?label), "${w}", "i") || regex(str(?id), "${w}", "i") || regex(str(?o), "${w}", "i")`
  ).join(" || ");

  return `
PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema:<https://schema.org/>
PREFIX gsn:   <https://w3id.org/OntoGSN/ontology#>

# 1) Candidate nodes by keyword
SELECT DISTINCT ?s ?label ?id ?statement
WHERE {
  OPTIONAL { ?s rdfs:label ?label }
  OPTIONAL { ?s schema:identifier ?id }
  OPTIONAL { ?s gsn:statement ?statement}
  #FILTER(STRSTARTS(STR(?s), "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#"))
  FILTER(${RX})
}
LIMIT 30`;
}

// Expand immediate graph around the top N candidates
function makeNeighborhoodQuery(ids) {
  const vals = ids.map(i => `<${i}>`).join(" ");
  return `
SELECT ?s ?p ?o
WHERE {
  VALUES ?s { ${vals} }
  ?s ?p ?o .
}
LIMIT 200`;
}

// Turn bindings into plain JS rows (same as queries.js)
function bindingsToRows(iter) {
  const rows = [];
  for (const b of iter) {
    const obj = {};
    for (const [k, v] of b) {
      switch (v.termType) {
        case "NamedNode": obj[k] = v.value; break;
        case "BlankNode": obj[k] = "_:" + v.value; break;
        case "Literal": {
          const dt = v.datatype?.value, lg = v.language;
          obj[k] = lg ? `"${v.value}"@${lg}` :
                   (dt && dt !== "http://www.w3.org/2001/XMLSchema#string") ? `"${v.value}"^^${dt}` :
                   v.value;
          break;
        }
        default: obj[k] = v.value ?? String(v);
      }
    }
    rows.push(obj);
  }
  return rows;
}

// Query store for context block
async function gatherContext(question) {
  const store = await ensureStore();
  const kws = keywords(question);
  if (!kws.length) return { synopsis: "", triples: [] };

  const q1 = makeContextQuery(kws);
  const r1 = store.query(q1);
  const rows1 = bindingsToRows(r1);
  const ids = rows1.map(r => r.s).filter(Boolean).slice(0, 12);

  let triples = [];
  if (ids.length) {
    const q2 = makeNeighborhoodQuery(ids);
    const r2 = store.query(q2);
    triples = bindingsToRows(r2).map(({ s, p, o }) => ({ s, p, o }));
  }

  // Short, LLM-friendly synopsis
  const topLines = rows1.slice(0, 12).map(r =>
    `• ${r.id ?? r.label ?? r.s}  [${r.s}]`
  ).join("\n");

  return {
    synopsis: topLines,
    triples
  };
}

// Call OpenRouter (non-streaming for simplicity)
// Docs: POST https://openrouter.ai/api/v1/chat/completions + headers. :contentReference[oaicite:2]{index=2}
async function askOpenRouter({ apiKey, model, messages }) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": location.origin, // optional attribution
      "X-Title": "OntoGSN Chat (local)" // optional attribution
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 10000,
      //stream: true
      // You can set stream: true and handle SSE later if you want typing. :contentReference[oaicite:3]{index=3}
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${t}`);
  }
  const data = await res.json();
  const c = data?.choices?.[0]?.message?.content || "";
  return c;
}

// --- UI wiring --------------------------------------------------------------
function appendMsg(role, html) {
  const el = document.createElement("div");
  el.className = role === "user" ? "msg user" : "msg bot";
  el.style.cssText = "margin:.25rem 0;padding:.35rem .5rem;border-radius:.5rem;background:#f7f7f7;";
  el.innerHTML = html;
  $("#chat-log").appendChild(el);
  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
}

async function onChatSubmit(ev) {
  ev.preventDefault();

  const apiKeyEl = /** @type {HTMLInputElement|null} */ ($("#chat-key"));
  const modelEl  = /** @type {HTMLInputElement|null} */ ($("#chat-model"));
  const inputEl  = /** @type {HTMLTextAreaElement|null} */ ($("#chat-input"));
  const sendBtn  = /** @type {HTMLButtonElement|null} */ ($("#chat-send"));

  if (!apiKeyEl || !modelEl || !inputEl || !sendBtn) return;

  const apiKey = apiKeyEl.value.trim();
  const model  = modelEl.value.trim() || "openai/gpt-4o-mini";
  const q      = inputEl.value.trim();

  if (!apiKey) { alert("Paste your OpenRouter API key first."); return; }
  if (!q) return;

  // persist locally
  localStorage.setItem(KEY_K, apiKey);
  localStorage.setItem(MODEL_K, model);

  appendMsg("user", esc(q));
  inputEl.value = "";
  sendBtn.disabled = true;

  try {
    const { synopsis, triples } = await gatherContext(q);
    const contextBlock =
`You are the OntoGSN assistant. Use the provided *Knowledge Graph context* to answer briefly and accurately.
- Prefer concrete node identifiers (like G1, C1, Sn1) when relevant.
- If the answer is not supported by the context, say you don't know and why (for example, you received no context data).
- Key relations: gsn:supportedBy, gsn:inContextOf, gsn:challenges, prov:Collection links.

[Knowledge Graph context — nodes]
${synopsis || "(no close matches)"}

[Knowledge Graph context — triples]
${triples.slice(0, 120).map(t => `${t.s}  ${t.p}  ${t.o}`).join("\n")}`;

    const messages = [
      { role: "system", content: "You answer questions about an assurance case represented in a GSN-like ontology." },
      { role: "user", content: `${q}\n\n${contextBlock}` }
    ];

    const answer = await askOpenRouter({ apiKey, model, messages });
    appendMsg("bot", esc(answer));
  } catch (e) {
    appendMsg("bot", `<em>${esc(e.message)}</em>`);
  } finally {
    sendBtn.disabled = false;
  }
}

// Initialise chat UI once DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  buildChatUI();
});