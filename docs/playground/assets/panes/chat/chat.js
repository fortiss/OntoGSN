import app from "@core/queries.js";
import { bus as coreBus } from "@core/events.js";

import {
  mountTemplate,
  resolveEl,
  fetchRepoTextCached,
  bindingsToRows,
  escapeHtml,
  sparqlIri,
  safeInvoke
} from "@core/utils.js";

import {
  loadOpenRouterPrefs,
  saveOpenRouterPrefs,
  askOpenRouter,
  OPENROUTER_DEFAULT_MODEL
} from "@core/openrouter.js";

// module-relative URLs (works on localhost + GH Pages)
const HTML = new URL("./chat.html", import.meta.url);
const CSS  = new URL("./chat.css",  import.meta.url);

// repo paths (resolved via fetchRepoTextCached + from/upLevels)
const Q_CONTEXT = "./data/queries/read_chatContext.sparql";
const Q_NEIGH   = "./data/queries/read_chatNeighborhood.sparql";

// ---- module state ------------------------------------------------------

let _root = null;
let _cleanup = null;

let _onSubmit = null;
let _offLeftTab = null;
let _offChatAsk = null;

// ---- helpers -------------------------------------------------------------

function normCmd(s) {
  return String(s ?? "").trim();
}

// Make sure Oxigraph is ready
async function ensureStore() {
  if (!app.store) await app.init();
  return app.store;
}

// Naive keyword extraction (keep 3–5 useful tokens)
function keywords(q) {
  return Array.from(new Set(
    q.toLowerCase().split(/[^a-z0-9_:\-]+/i)
      .filter(w => w.length > 2 && w !== "the" && w !== "and")
  )).slice(0, 5);
}

function escapeRegexLiteral(s) {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadQueryText(path) {
  return fetchRepoTextCached(path, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });
}

async function makeContextQuery(words) {
  const tpl = await loadQueryText(Q_CONTEXT);

  const pats = words.map(escapeRegexLiteral);

  const rx = pats.map(p => {
    const s = JSON.stringify(p); // safe SPARQL string literal
    return [
      `regex(str(?s), ${s}, "i")`,
      `regex(str(?label), ${s}, "i")`,
      `regex(str(?id), ${s}, "i")`,
      `regex(str(?statement), ${s}, "i")`,
    ].join(" || ");
  }).join(" || ");

  return tpl.replaceAll("__RX__", rx || "true");
}

async function makeNeighborhoodQuery(ids) {
  const tpl = await loadQueryText(Q_NEIGH);

  // ensure valid IRIs for SPARQL VALUES
  const vals = ids
    .map(s => String(s ?? "").trim())
    .filter(Boolean)
    .map(sparqlIri)
    .join(" ");

  return tpl.replaceAll("__VALS__", vals || "<urn:dummy>");
}

async function gatherContext(question) {
  const store = await ensureStore();

  const kws = keywords(question);
  if (!kws.length) return { synopsis: "", triples: [] };

  const q1 = await makeContextQuery(kws);
  const rows1 = bindingsToRows(store.query(q1));

  const ids = rows1
    .map(r => r.s)
    .filter(Boolean)
    .slice(0, 12);

  let triples = [];
  if (ids.length) {
    const q2 = await makeNeighborhoodQuery(ids);
    triples = bindingsToRows(store.query(q2)).map(({ s, p, o }) => ({ s, p, o }));
  }

  const topLines = rows1.slice(0, 12).map(r =>
    `• ${r.id ?? r.label ?? r.s}  [${r.s}]`
  ).join("\n");

  return { synopsis: topLines, triples };
}

// ---- pane UI -------------------------------------------------------------

function appendMsg(root, role, html) {
  const log = resolveEl("#chat-log", { root, required: false, name: "chat: #chat-log" });
  if (!log) return;

  const el = document.createElement("div");
  el.className = role === "user" ? "msg user" : "msg bot";

  el.style.cssText =
    "margin:.25rem 0;padding:.35rem .5rem;border-radius:.5rem;background:#f7f7f7;";

  el.innerHTML = html;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

function setBusy(root, on) {
  const sendBtn = resolveEl("#chat-send", { root, required: false });
  const inputEl = resolveEl("#chat-input", { root, required: false });
  if (sendBtn) sendBtn.disabled = !!on;
  if (inputEl) inputEl.disabled = !!on;
}

function focusInput(root) {
  resolveEl("#chat-input", { root, required: false })?.focus();
}

// ---- submit handler ----------------------------------------------------

async function handleSubmit(ev) {
  ev.preventDefault();
  if (!_root) return;

  const apiKeyEl = resolveEl("#chat-key",   { root: _root, required: false });
  const modelEl  = resolveEl("#chat-model", { root: _root, required: false });
  const inputEl  = resolveEl("#chat-input", { root: _root, required: false });

  if (!apiKeyEl || !modelEl || !inputEl) return;

  const apiKey = normCmd(apiKeyEl.value);
  const model  = normCmd(modelEl.value) || "openai/gpt-4o-mini";
  const q      = normCmd(inputEl.value);

  if (!apiKey) {
    alert("Paste your OpenRouter API key first.");
    return;
  }
  if (!q) return;

  saveOpenRouterPrefs({ apiKey, model });

  appendMsg(_root, "user", escapeHtml(q));
  inputEl.value = "";
  setBusy(_root, true);

  try {
    const { synopsis, triples } = await gatherContext(q);

    const contextBlock =
`You are the OntoGSN assistant. Use the provided *Knowledge Graph context* to answer briefly and accurately.
- Prefer concrete node identifiers (like G1, C1, Sn1) when relevant.
- If the answer is not supported by the context, say you don't know and why.
- Key relations: gsn:supportedBy, gsn:inContextOf, gsn:challenges, prov:Collection links.

[Knowledge Graph context — nodes]
${synopsis || "(no close matches)"}

[Knowledge Graph context — triples]
${triples.slice(0, 120).map(t => `${t.s}  ${t.p}  ${t.o}`).join("\n")}`;

    const messages = [
      {
        role: "system",
        content: "You answer questions about an assurance case represented in a GSN-like ontology."
      },
      {
        role: "user",
        content: `${q}\n\n${contextBlock}`
      }
    ];

    const answer = await askOpenRouter({
      apiKey,
      model,
      messages,
      title: "OntoGSN Chat"
    });

    appendMsg(_root, "bot", escapeHtml(answer));
  } catch (e) {
    appendMsg(_root, "bot", `<em>${escapeHtml(e?.message || String(e))}</em>`);
  } finally {
    setBusy(_root, false);
  }
}

// ---- bus helper (safe unsubscribe) ------------------------------------

function onBus(theBus, eventName, fn) {
  // If your bus.on returns an "off" function, we keep it.
  const off = safeInvoke(theBus, "on", eventName, fn);
  if (typeof off === "function") return off;

  // Otherwise try bus.off(fn) on cleanup.
  return () => safeInvoke(theBus, "off", eventName, fn);
}

// ---- PaneManager lifecycle exports -------------------------------------

export async function mount({ root, bus }) {
  _root = root;

  await mountTemplate(root, {
    templateUrl: HTML,
    cssUrl: CSS,
    cache: "no-store",
    bust: true,
    replace: true
  });

  // restore key/model
  const keyEl   = resolveEl("#chat-key",   { root, required: false });
  const modelEl = resolveEl("#chat-model", { root, required: false });

  const prefs = loadOpenRouterPrefs();
  if (keyEl)   keyEl.value   = prefs.apiKey || "";
  if (modelEl) modelEl.value = prefs.model || modelEl.value || OPENROUTER_DEFAULT_MODEL;


  const formEl = resolveEl("#chat-form", { root, required: false });

  _onSubmit = (ev) => handleSubmit(ev);
  formEl?.addEventListener("submit", _onSubmit);

  const theBus = bus || coreBus;

  // focus input when tab becomes active
  _offLeftTab = onBus(theBus, "left:tab", (ev) => {
    const d = ev?.detail || {};
    const isChat =
      d.view === "chat" ||
      d.paneId === "chat-root" ||
      d.tabId === "tab-chat";

    if (!isChat) return;

    setTimeout(() => focusInput(root), 0);
  });

  // external panes can trigger a chat question
  _offChatAsk = onBus(theBus, "chat:ask", (ev) => {
    const q = String(ev?.detail?.question ?? "").trim();
    if (!q) return;

    const inputEl = resolveEl("#chat-input", { root, required: false });
    if (inputEl) inputEl.value = q;

    // submit programmatically
    safeInvoke(formEl, "dispatchEvent", new Event("submit", { bubbles: true, cancelable: true }));
  });

  _cleanup = () => {
    try { formEl?.removeEventListener("submit", _onSubmit); } catch {}
    _onSubmit = null;

    try { _offLeftTab?.(); } catch {}
    try { _offChatAsk?.(); } catch {}
    _offLeftTab = null;
    _offChatAsk = null;

    _root = null;
  };

  return _cleanup;
}

export async function resume({ root }) {
  // a gentle UX win: focus the input when returning
  setTimeout(() => focusInput(root || _root), 0);
}

export async function suspend() {
  // nothing heavy to stop, but we *could* disable busy state if desired
  // setBusy(_root, false);
}

export async function unmount() {
  try { _cleanup?.(); } catch {}
  _cleanup = null;
}
