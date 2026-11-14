import {
  docRoot,
  pendingHighlight,
  setPendingHighlight,
  cssEsc
} from "./document.state.js";

export function clearDocHighlights(root = docRoot) {
  if (!root) return;

  root.querySelectorAll('mark[data-doc-hit-gen="1"]').forEach((m) => {
    const t = document.createTextNode(m.textContent || "");
    m.replaceWith(t);
  });

  root.querySelectorAll(".doc-hit").forEach((el) => {
    el.classList.remove("doc-hit");
    el.removeAttribute("data-doc-hit-key");
  });
}

function highlightEls(els, { key = null, add = false, scroll = true } = {}) {
  if (!docRoot) return [];
  if (!add) clearDocHighlights(docRoot);

  const out = [];
  for (const el of els) {
    if (!el) continue;
    el.classList.add("doc-hit");
    if (key != null) el.setAttribute("data-doc-hit-key", String(key));
    out.push(el);
  }

  if (scroll && out[0]) {
    out[0].scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return out;
}

function highlightBySelector(selector, opts = {}) {
  if (!docRoot || !selector) return [];
  const els = Array.from(docRoot.querySelectorAll(selector));
  return highlightEls(els, opts);
}

function highlightByTag(tag, opts = {}) {
  if (!tag) return [];
  return highlightBySelector(
    `.doc-entity[data-doc-tag="${cssEsc(tag)}"]`,
    { key: tag, ...opts }
  );
}

function highlightByHeadingId(headingId, opts = {}) {
  if (!docRoot || !headingId) return [];
  const h = docRoot.querySelector(`#${cssEsc(headingId)}`);
  if (!h) return [];

  const els = [h];
  let n = h.nextElementSibling;
  while (n && !/^H[1-6]$/.test(n.tagName)) {
    els.push(n);
    n = n.nextElementSibling;
  }

  return highlightEls(els, { key: headingId, ...opts });
}

function highlightByText(text, { key = null, add = false, scroll = true } = {}) {
  if (!docRoot) return [];
  const needle = String(text || "").trim();
  if (!needle) return [];

  if (!add) clearDocHighlights(docRoot);

  const article = docRoot.querySelector(".doc-view");
  if (!article) return [];

  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest("script, style, noscript")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const hay = node.nodeValue;
    const idx = hay.indexOf(needle);
    if (idx === -1) continue;

    const range = document.createRange();
    range.setStart(node, idx);
    range.setEnd(node, idx + needle.length);

    const mark = document.createElement("mark");
    mark.className = "doc-hit";
    mark.setAttribute("data-doc-hit-gen", "1");
    if (key != null) mark.setAttribute("data-doc-hit-key", String(key));

    range.surroundContents(mark);

    if (scroll) mark.scrollIntoView({ block: "center", behavior: "smooth" });
    return [mark];
  }

  return [];
}

function highlightByDocKey(docKey, opts = {}) {
  if (!docRoot || !docKey) return [];

  const key = String(docKey);
  const sel =
    `[data-doc-key="${cssEsc(key)}"], [data-doc-keys~="${cssEsc(key)}"]`;

  const els = Array.from(docRoot.querySelectorAll(sel));
  return highlightEls(els, { key, ...opts });
}

export function applyHighlight(detail = {}) {
  const {
    selector = null,
    tag = null,
    headingId = null,
    text = null,
    docKey = null,
    key = null,
    add = false,
    scroll = true
  } = detail;

  if (!docRoot || !docRoot.querySelector(".doc-view")) return [];

  if (selector) return highlightBySelector(selector, { key, add, scroll });
  if (docKey) return highlightByDocKey(docKey, { key: key ?? docKey, add, scroll });
  if (tag) return highlightByTag(tag, { key: key ?? tag, add, scroll });
  if (headingId) return highlightByHeadingId(headingId, { key: key ?? headingId, add, scroll });
  if (text) return highlightByText(text, { key, add, scroll });

  return [];
}

export function flushPendingHighlight() {
  if (!pendingHighlight) return;
  const hits = applyHighlight(pendingHighlight);
  if (hits.length) setPendingHighlight(null);
}