// assets/panes/document/document.render.js

import { marked } from "@vendor/marked.esm.js";
import DOMPurify from "@vendor/purify.es.js";
import { escapeHtml } from "@core/utils.js";

marked.setOptions({ gfm: true, breaks: false });
const baseRenderer = new marked.Renderer();

function preprocessDocMarkers(mdText) {
  return String(mdText || "")
    .replace(
      /<!--\s*dl:start\s+([A-Za-z0-9._:-]+)\s*-->/g,
      '\n<div class="doc-dl-boundary" data-doc-boundary="start" data-doc-marker-key="$1" hidden></div>\n'
    )
    .replace(
      /<!--\s*dl:end\s+([A-Za-z0-9._:-]+)\s*-->/g,
      '\n<div class="doc-dl-boundary" data-doc-boundary="end" data-doc-marker-key="$1" hidden></div>\n'
    );
}

marked.use({
  renderer: {
    link(href, title, text) {
      const rawHref = href ? String(href) : "";
      const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";

      if (rawHref.startsWith("$")) {
        const tag = rawHref.slice(1);
        const safeTag = escapeHtml(tag);
        const safeText = escapeHtml(text || "");

        return `
          <button
            type="button"
            class="doc-entity"
            data-doc-tag="${safeTag}"${safeTitle}
          >${safeText}</button>
        `;
      }

      if (rawHref.startsWith("#p:")) {
        const key = escapeHtml(rawHref.slice(3));
        return `
          <span
            class="doc-dl-p-marker"
            data-doc-marker="p"
            data-doc-marker-key="${key}"
          >${text || ""}</span>
        `;
      }

      if (rawHref.startsWith("#s:")) {
        const key = escapeHtml(rawHref.slice(3));
        return `
          <span
            class="doc-dl-s-marker"
            data-doc-marker="s"
            data-doc-marker-key="${key}"
          >${text || ""}</span>
        `;
      }

      return baseRenderer.link.call(this, href, title, text);
    }
  }
});

export function renderMarkdown(mdText) {
  const preprocessed = preprocessDocMarkers(mdText);
  const dirty = marked.parse(preprocessed);
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
}

function wrapInlineRange(parent, nodes, keys) {
  const first = nodes.find((n) => n?.parentNode === parent);
  if (!first) return null;

  const uniq = [...new Set((keys || []).map(String).filter(Boolean))];
  if (!uniq.length) return null;

  const span = document.createElement("span");
  span.className = "doc-dl-inline-range";
  span.setAttribute("data-doc-keys", uniq.join(" "));
  if (uniq.length === 1) span.setAttribute("data-doc-key", uniq[0]);

  parent.insertBefore(span, first);

  for (const n of nodes) {
    if (n?.parentNode === parent) span.appendChild(n);
  }

  return span;
}

function wrapBlockRange(parent, firstNode, stopNode, key, cls = "doc-dl-block-range") {
  if (!parent || !firstNode || firstNode === stopNode || !key) return null;

  const box = document.createElement("div");
  box.className = cls;
  box.setAttribute("data-doc-key", String(key));
  parent.insertBefore(box, firstNode);

  let n = firstNode;
  while (n && n !== stopNode) {
    const next = n.nextSibling;
    box.appendChild(n);
    n = next;
  }

  return box;
}

function decorateBlockRanges(root) {
  const starts = Array.from(
    root.querySelectorAll('.doc-dl-boundary[data-doc-boundary="start"]')
  );

  for (const start of starts) {
    if (!start.isConnected) continue;

    const key = start.getAttribute("data-doc-marker-key");
    const parent = start.parentNode;
    if (!(parent instanceof Element) || !key) continue;

    let end = start.nextSibling;
    while (end) {
      if (
        end.nodeType === Node.ELEMENT_NODE &&
        end.matches('.doc-dl-boundary[data-doc-boundary="end"]') &&
        end.getAttribute("data-doc-marker-key") === key
      ) {
        break;
      }
      end = end.nextSibling;
    }

    const firstNode = start.nextSibling;
    start.remove();

    if (!end) continue;
    if (firstNode && firstNode !== end) {
      wrapBlockRange(parent, firstNode, end, key, "doc-dl-block-range");
    }
    end.remove();
  }
}

function findSectionStopNode(heading) {
  const level = Number(heading.tagName.slice(1));
  let n = heading.nextSibling;

  while (n) {
    if (
      n.nodeType === Node.ELEMENT_NODE &&
      /^H[1-6]$/.test(n.tagName)
    ) {
      const nextLevel = Number(n.tagName.slice(1));
      if (nextLevel <= level) return n;
    }
    n = n.nextSibling;
  }

  return null;
}

function decorateSectionRanges(root) {
  const markers = Array.from(root.querySelectorAll(".doc-dl-s-marker"));

  for (const marker of markers) {
    if (!marker.isConnected) continue;

    const key = marker.getAttribute("data-doc-marker-key");
    const heading = marker.closest("h1,h2,h3,h4,h5,h6");
    if (!key || !heading) continue;

    const parent = heading.parentNode;
    if (!(parent instanceof Element)) continue;

    const stopNode = findSectionStopNode(heading);
    wrapBlockRange(parent, heading, stopNode, key, "doc-dl-section-range");
  }
}

function isWhitespaceText(node) {
  return node?.nodeType === Node.TEXT_NODE && !String(node.nodeValue || "").trim();
}

function decorateParagraphRanges(root) {
  const parents = new Set(
    Array.from(root.querySelectorAll(".doc-dl-p-marker"))
      .map((el) => el.parentElement)
      .filter(Boolean)
  );

  for (const parent of parents) {
    const snapshot = Array.from(parent.childNodes);

    let pendingKeys = [];
    let segmentNodes = [];
    let hasRealContent = false;

    const flush = () => {
      if (pendingKeys.length && segmentNodes.length && hasRealContent) {
        wrapInlineRange(parent, segmentNodes, pendingKeys);
      }
      pendingKeys = [];
      segmentNodes = [];
      hasRealContent = false;
    };

    for (const node of snapshot) {
      if (!node.isConnected || node.parentNode !== parent) continue;

      const isMarker =
        node.nodeType === Node.ELEMENT_NODE &&
        node.classList?.contains("doc-dl-p-marker");

      const isBreak =
        node.nodeType === Node.ELEMENT_NODE &&
        node.tagName === "BR";

      if (isMarker) {
        const key = node.getAttribute("data-doc-marker-key");

        if (hasRealContent) flush();

        if (key) pendingKeys.push(key);
        segmentNodes.push(node);
        if (String(node.textContent || "").trim()) hasRealContent = true;
        continue;
      }

      if (isBreak) {
        flush();
        continue;
      }

      if (!pendingKeys.length) continue;

      segmentNodes.push(node);
      if (!isWhitespaceText(node)) hasRealContent = true;
    }

    flush();
  }
}

export function decorateDocRanges(root) {
  if (!root) return;
  decorateBlockRanges(root);
  decorateSectionRanges(root);
  decorateParagraphRanges(root);
}