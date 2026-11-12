// Cache fetched text by normalized URL
const _textCache = new Map();   // key: url.href -> string
const _cssLinked = new Set();   // key: url.href -> true

function _asUrl(u) {
  // Normalize to absolute URL so comparisons are stable across pages/base paths.
  return (u instanceof URL) ? u : new URL(String(u), document.baseURI);
}

/**
 * Fetch text with optional caching.
 * - cache: "force-cache" (default) is good for GH Pages / production.
 * - for dev, use cache:"no-store" or bust:true
 */
export async function fetchText(url, { cache = "force-cache", bust = false } = {}) {
  const u = _asUrl(url);
  const key = u.href;

  const memoize = (!bust && cache !== "no-store");

  if (memoize && _textCache.has(key)) return _textCache.get(key);

  const reqUrl = new URL(u.href);
  if (bust) reqUrl.searchParams.set("v", String(performance.timeOrigin));

  const res = await fetch(reqUrl.href, { cache });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${reqUrl.href}`);

  const txt = (await res.text()).replace(/^\uFEFF/, "");
  if (memoize) _textCache.set(key, txt);
  return txt;
}

export function asBool(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

export function asBoolText(v) {
  if (v == null) return "";
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "false") return s;
  return String(v);
}

export function pickBindingValue(row, name, fallback = "") {
  const cell = row?.[name];
  return cell?.value ?? fallback;
}

export function sparqlIri(iri) {
  const s = String(iri ?? "").trim();
  if (!s) return "";
  if (/[<>\s]/.test(s)) throw new Error(`Invalid IRI for SPARQL: ${s}`);
  return `<${s}>`;
}

const _repoTextCache = new Map(); // key: path -> text

export async function fetchRepoTextCached(path, fetchOpts) {
  if (_repoTextCache.has(path)) return _repoTextCache.get(path);
  const txt = await fetchRepoText(path, fetchOpts);
  _repoTextCache.set(path, txt);
  return txt;
}


// Join "/assets/..." against the repo root (not the site origin root).
export function repoHref(path, { from = import.meta.url, upLevels = 2 } = {}) {
  const base = repoBasePath(from, upLevels); // no trailing slash
  const s = String(path ?? "");

  // Already an absolute URL (http:, https:, data:, blob:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return s;

  if (s.startsWith("#") || s.startsWith("?")) return `${base}/${s}`;

  // Treat leading "/" as repo-relative (so it becomes `${base}/assets/...`, not `origin/assets/...`)
  return `${base}${s.startsWith("/") ? "" : "/"}${s}`;
}

export async function fetchRepoText(path, { from = import.meta.url, upLevels = 2, ...opts } = {}) {
  return fetchText(repoHref(path, { from, upLevels }), opts);
}

/**
 * Load an HTML file and return a fresh DocumentFragment each call.
 */
export async function loadTemplate(url, opts) {
  const html = await fetchText(url, opts);
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.cloneNode(true);
}

/**
 * Ensure a stylesheet is linked only once.
 */
export function ensureCss(href) {
  const u = _asUrl(href);
  const key = u.href;

  if (_cssLinked.has(key)) return;

  // If already present in DOM (e.g., added by another module), record and exit.
  for (const l of document.querySelectorAll('link[rel="stylesheet"]')) {
    try {
      if (new URL(l.href, document.baseURI).href === key) {
        _cssLinked.add(key);
        return;
      }
    } catch { /* ignore */ }
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = key;
  document.head.appendChild(link);

  _cssLinked.add(key);
}

/**
 * Convenience: ensureCss + mount template into root.
 */
export async function mountTemplate(rootEl, {
  templateUrl = null, // OPTIONAL now
  cssUrl = null,      // already optional
  replace = true,
  cache = "force-cache",
  bust = false
} = {}) {
  if (!rootEl) return null;

  if (cssUrl) {
    const arr = Array.isArray(cssUrl) ? cssUrl : [cssUrl];
    for (const u of arr) ensureCss(u);
  }

  // If no templateUrl provided, do nothing template-wise (CSS-only mount).
  if (!templateUrl) return rootEl;

  const frag = await loadTemplate(templateUrl, { cache, bust });
  if (replace) rootEl.replaceChildren(frag);
  else rootEl.appendChild(frag);

  return rootEl;
}

export function resolveEl(mount, { root = document, required = true, name = "mount" } = {}) {
  const rootEl = (typeof root === "string") ? document.querySelector(root) : root;
  const el = (typeof mount === "string") ? rootEl?.querySelector(mount) : mount;

  if (!el && required) {
    const where = rootEl ? "" : " (root not found)";
    throw new Error(`${name}: ${typeof mount === "string" ? `"${mount}"` : "(element)"} not found${where}`);
  }
  return el;
}

export function exposeForDebug(name, value, { param = "debug" } = {}) {
  if (new URLSearchParams(location.search).has(param)) {
    window[name] = value;
  }
}

export function addToSetMap(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

export function uid(prefix = "") {
  const id = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  return prefix ? `${prefix}${id}` : id;
}

export function splitTokens(raw, re = /[;,]/) {
  return String(raw ?? "")
    .split(re)
    .map(s => s.trim())
    .filter(Boolean);
}

export function repoBaseUrl(from = import.meta.url, upLevels = 2) {
  let u = new URL(from);
  for (let i = 0; i < upLevels; i++) u = new URL("../", u);
  return u;
}

export function repoBasePath(from = import.meta.url, upLevels = 2) {
  const u = repoBaseUrl(from, upLevels);
  const s = u.protocol.startsWith("http") ? u.href : u.pathname;
  return s.replace(/\/$/, "");
}

export function downloadText(filename, text, { mime = "text/plain" } = {}) {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;

  (document.body ?? document.documentElement).appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}


export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function termToDisplay(cell) {
  if (cell == null) return "";

  // app.selectBindings often returns { value, term }
  const t = cell?.term ?? cell;

  // If we don't have a real RDFJS-like term, fall back to .value or string
  if (!t || typeof t !== "object" || !("termType" in t)) {
    return String(cell?.value ?? cell);
  }

  switch (t.termType) {
    case "NamedNode": return t.value;
    case "BlankNode": return "_:" + t.value;
    case "Literal": {
      const dt = t.datatype?.value;
      const lg = t.language;
      if (lg) return `"${t.value}"@${lg}`;
      if (dt && dt !== "http://www.w3.org/2001/XMLSchema#string") {
        return `"${t.value}"^^${dt}`;
      }
      return t.value;
    }
    default:
      return t.value ?? String(cell?.value ?? cell);
  }
}

export function bindingsToRows(iter) {
  const rows = [];
  for (const b of iter) {
    const obj = {};
    for (const [k, v] of b) obj[k] = termToDisplay(v);
    rows.push(obj);
  }
  return rows;
}

export function highlightCode(root = document) {
  if (!window.hljs) return;
  root.querySelectorAll("pre code").forEach(block => window.hljs.highlightElement(block));
}

export function readFileText(file, { encoding = "utf-8" } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.onload  = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file, encoding);
  });
}

export function turtleEscapeLiteral(str) {
  return String(str)
    .replace(/(["\\])/g, "\\$1")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

export function turtleEscapeMultilineLiteral(str) {
  return String(str).replace(/"""/g, '\\"""');
}

export function applyTemplate(template, values) {
  let out = String(template ?? "");
  const obj = values ?? {};
  for (const [rawKey, rawVal] of Object.entries(obj)) {
    // Escape key for regex safety
    const key = String(rawKey).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re  = new RegExp(`{{${key}}}`, "g");
    const val = String(rawVal ?? "");

    // Use function replacement so "$1", "$&", etc in val are NOT treated specially
    out = out.replace(re, () => val);
  }
  return out;
}

export function shortenIri(iriOrLabel) {
  try {
    const u = new URL(String(iriOrLabel));
    if (u.hash && u.hash.length > 1) return u.hash.slice(1);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || String(iriOrLabel);
  } catch {
    return String(iriOrLabel ?? "").replace(/^.*[#/]/, "");
  }
}

export function labelWidthPx(text, {
  minW = 44,
  maxW = 180,
  charW = 7.2,
  pad = 12
} = {}) {
  const t = String(text ?? "");
  return Math.min(maxW, Math.max(minW, charW * t.length + pad));
}

export function gsnKindFromTypeIri(typeIri) {
  if (!typeIri) return null;
  const t = String(typeIri);

  if (t.endsWith("#Goal")          || t.endsWith("/Goal"))          return "goal";
  if (t.endsWith("#Strategy")      || t.endsWith("/Strategy"))      return "strategy";
  if (t.endsWith("#Solution")      || t.endsWith("/Solution"))      return "solution";
  if (t.endsWith("#Context")       || t.endsWith("/Context"))       return "context";
  if (t.endsWith("#Assumption")    || t.endsWith("/Assumption"))    return "assumption";
  if (t.endsWith("#Justification") || t.endsWith("/Justification")) return "justification";

  return null;
}

export function inferGsnKind(id, labelText, typeIri) {
  const fromType = gsnKindFromTypeIri(typeIri);
  if (fromType) return fromType;

  const txt = String(labelText || id || "");
  const p2  = txt.slice(0, 2).toUpperCase();
  const p1  = txt.charAt(0).toUpperCase();

  if (p2 === "SN") return "solution";
  if (p1 === "S")  return "strategy";
  if (p1 === "C")  return "context";
  if (p1 === "A")  return "assumption";
  if (p1 === "J")  return "justification";

  return "goal";
}

export function firstEl(selectors, { root = document } = {}) {
  const rootEl = (typeof root === "string") ? document.querySelector(root) : root;
  for (const sel of selectors) {
    const el = (typeof sel === "string") ? rootEl?.querySelector(sel) : sel;
    if (el) return el;
  }
  return null;
}

export function safeInvoke(obj, method, ...args) {
  const fn = obj?.[method];
  if (typeof fn !== "function") return;
  try {
    return fn.apply(obj, args);
  } catch (e) {
    console.warn(`[safeInvoke] ${method} failed:`, e);
  }
}

export function cleanRdfLiteral(x) {
  const s = String(x ?? "").trim();

  // matches: "Text"@en  OR  "Text"^^<datatype>
  const m = s.match(/^"([\s\S]*)"(?:@[\w-]+|\^\^.+)?$/);
  return m ? m[1] : s;
}

export function loadLocalBool(key, { defaultValue = true } = {}) {
  const v = localStorage.getItem(String(key));
  if (v == null) return !!defaultValue;
  return v !== "0" && v !== "false";
}

export function saveLocalBool(key, value) {
  localStorage.setItem(String(key), value ? "1" : "0");
}

// --- Formatting ---------------------------------------------------------

export function fmtBytes(bytes, { decimals = 1, base = 1024 } = {}) {
  const b = Math.max(0, Number(bytes || 0));
  if (!Number.isFinite(b) || b === 0) return "0 B";

  const units = (base === 1000)
    ? ["B", "KB", "MB", "GB", "TB"]
    : ["B", "KiB", "MiB", "GiB", "TiB"];

  let v = b;
  let i = 0;
  while (v >= base && i < units.length - 1) { v /= base; i++; }

  if (i === 0) return `${Math.round(v)} ${units[i]}`;
  const d = Math.max(0, decimals | 0);
  const s = (v >= 10 || d === 0) ? v.toFixed(d) : v.toFixed(Math.max(d, 2));
  return `${s} ${units[i]}`;
}

export function fmtTimeMs(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function fmtTimeSec(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

export function nowStamp({ dateSep = "", timeSep = "", between = "_" } = {}) {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${Y}${dateSep}${M}${dateSep}${D}${between}${h}${timeSep}${m}${timeSep}${s}`;
}

export function extFromMime(mime, { fallback = "bin" } = {}) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("matroska") || m.includes("mkv")) return "mkv";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg")) return "mp3";
  return fallback;
}

export function buildStampedFilename(prefix, mime, {
  stamp = nowStamp({ dateSep: "-", timeSep: "-", between: "_" }),
  ext = null
} = {}) {
  const e = ext || extFromMime(mime, { fallback: "bin" });
  const p = String(prefix || "file").replace(/[^\w.-]+/g, "_");
  return `${p}_${stamp}.${e}`;
}

// --- Blobs / download / object URLs ------------------------------------

export function revokeObjectUrl(url) {
  if (!url) return;
  try { URL.revokeObjectURL(url); } catch {}
}

export function downloadUrl(filename, url, { revoke = false } = {}) {
  if (!url) return;

  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;

  (document.body || document.documentElement).appendChild(a);
  a.click();
  a.remove();

  if (revoke) setTimeout(() => revokeObjectUrl(url), 0);
}

export function downloadBlob(filename, blob) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  downloadUrl(filename, url, { revoke: true });
}

// --- Clipboard ----------------------------------------------------------

export async function copyTextToClipboard(text) {
  const t = String(text ?? "");
  if (!t) return false;

  // Modern API
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(t);
    return true;
  }

  // Fallback (some contexts block clipboard API)
  const ta = document.createElement("textarea");
  ta.value = t;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand?.("copy");
  ta.remove();
  if (!ok) throw new Error("Copy failed");
  return true;
}

// --- Media / permissions ------------------------------------------------

export function isProbablyLocalhost(hostname = location.hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function canUseGetUserMedia() {
  return !!(navigator.mediaDevices?.getUserMedia);
}

export function assertSecureGetUserMediaContext() {
  // getUserMedia requires secure context (HTTPS) or localhost.
  if (window.isSecureContext) return true;
  if (isProbablyLocalhost()) return true;
  throw new Error("getUserMedia requires HTTPS or localhost (secure context).");
}

export function stopMediaStream(stream) {
  if (!stream) return null;
  try { stream.getTracks?.().forEach(t => t.stop()); } catch {}
  return null;
}

export async function tryPlayMedia(el) {
  if (!el?.play) return false;
  try { await el.play(); return true; } catch { return false; }
}

// --- MediaRecorder MIME helpers ----------------------------------------

export function detectSupportedRecorderMimes(candidates) {
  const out = [];
  if (!("MediaRecorder" in window)) return out;

  for (const t of (candidates || [])) {
    try { if (MediaRecorder.isTypeSupported(t)) out.push(t); } catch {}
  }
  return out;
}

export function pickFirstSupportedRecorderMime(candidates) {
  return detectSupportedRecorderMimes(candidates)[0] || "";
}

// --- UI patterns --------------------------------------------------------

export function attachArmConfirm(button, onConfirm, {
  armedText = "Confirm (again)",
  timeoutMs = 1500,
  className = "is-armed",
  ariaLabel = "Click again to confirm",
} = {}) {
  if (!button) return () => {};

  let armed = false;
  let timer = null;
  const defaultText = button.textContent || "";

  const disarm = () => {
    armed = false;
    if (timer) { clearTimeout(timer); timer = null; }
    button.classList.remove(className);
    button.textContent = defaultText;
    button.removeAttribute("aria-label");
  };

  const handler = async (ev) => {
    if (button.disabled) return;

    if (!armed) {
      armed = true;
      button.classList.add(className);
      button.textContent = armedText;
      button.setAttribute("aria-label", ariaLabel);
      if (timer) clearTimeout(timer);
      timer = setTimeout(disarm, timeoutMs);
      return;
    }

    disarm();
    await onConfirm?.(ev);
  };

  button.addEventListener("click", handler);
  return () => {
    try { button.removeEventListener("click", handler); } catch {}
    disarm();
  };
}

// --- Async DOM helpers --------------------------------------------------

export function waitForEvent(target, type, { signal, timeoutMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (!target?.addEventListener) return reject(new Error("waitForEvent: invalid target"));

    let t = null;
    const onAbort = () => done(new DOMException("Aborted", "AbortError"), true);
    const onEvent = (ev) => done(ev, false);

    const done = (value, isErr) => {
      cleanup();
      isErr ? reject(value) : resolve(value);
    };

    const cleanup = () => {
      try { target.removeEventListener(type, onEvent); } catch {}
      if (signal) try { signal.removeEventListener("abort", onAbort); } catch {}
      if (t) { clearTimeout(t); t = null; }
    };

    if (signal?.aborted) return onAbort();
    target.addEventListener(type, onEvent, { once: true });
    if (signal) signal.addEventListener("abort", onAbort, { once: true });

    if (timeoutMs > 0) {
      t = setTimeout(() => done(new Error(`Timed out waiting for "${type}"`), true), timeoutMs);
    }
  });
}

export function wireFileDrop(el, {
  onFile,
  accept = null,          // e.g. /^image\// or (file)=>bool
  hoverClass = "dragover",
  signal,
  preventDefaults = true,
} = {}) {
  if (!el) return () => {};
  const ok = (file) => {
    if (!file) return false;
    if (!accept) return true;
    if (accept instanceof RegExp) return accept.test(file.type || "");
    if (typeof accept === "function") return !!accept(file);
    return true;
  };

  const prevent = (e) => {
    if (!preventDefaults) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const onEnter = (e) => { prevent(e); el.classList.add(hoverClass); };
  const onOver  = (e) => { prevent(e); el.classList.add(hoverClass); };
  const onLeave = (e) => { prevent(e); el.classList.remove(hoverClass); };
  const onDrop  = (e) => {
    prevent(e);
    el.classList.remove(hoverClass);
    const file = e.dataTransfer?.files?.[0] || null;
    if (ok(file)) onFile?.(file);
  };

  el.addEventListener("dragenter", onEnter, { signal });
  el.addEventListener("dragover", onOver, { signal });
  el.addEventListener("dragleave", onLeave, { signal });
  el.addEventListener("drop", onDrop, { signal });

  return () => {
    try { el.removeEventListener("dragenter", onEnter); } catch {}
    try { el.removeEventListener("dragover", onOver); } catch {}
    try { el.removeEventListener("dragleave", onLeave); } catch {}
    try { el.removeEventListener("drop", onDrop); } catch {}
  };
}
