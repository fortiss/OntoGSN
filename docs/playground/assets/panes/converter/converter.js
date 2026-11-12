import {
  mountTemplate,
  downloadText,
  resolveEl,
  readFileText,
  turtleEscapeLiteral,
  turtleEscapeMultilineLiteral
} from "@core/utils.js";

// module-relative URLs (works on localhost + GH Pages)
const HTML = new URL("./converter.html", import.meta.url);
const CSS  = new URL("./converter.css",  import.meta.url);

// --- XML → ASCE instance Turtle -------------------------------------------

function xmlToAsceTurtle(xmlText, options = {}) {
  const baseIri = options.baseIri || "https://example.org/kettle#";

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  // Quick error check
  const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("XML parsing error: " + parserError.textContent);
  }

  const nodeSelector = "Node, node";
  const linkSelector = "Link, link";

  const header = [
    "@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .",
    "@prefix asce: <https://fortiss.github.io/OntoGSN/ontology/asce#> .",
    "@prefix asce_m: <https://fortiss.github.io/OntoGSN/ontology/asce_mappings#> .",
    "@prefix gsn:  <https://w3id.org/OntoGSN/ontology#> .",
    ""
  ].join("\n");

  let body = "";

  // Helper to get trimmed text of a child element if present
  const getChildText = (el, tag) => {
    const child = el.querySelector(tag);
    return child ? child.textContent.trim() : null;
  };

  // --- Map nodes ----------------------------------------------------------
  const nodeElements = Array.from(xmlDoc.querySelectorAll(nodeSelector));
  nodeElements.forEach((el) => {
    const id =
      el.getAttribute("id") ||
      el.getAttribute("reference") ||
      getChildText(el, "reference");

    if (!id) return;

    const typeStr =
      el.getAttribute("type") ||
      getChildText(el, "type");

    const userId =
      el.getAttribute("user-id") ||
      getChildText(el, "user-id");

    const rawUserTitle =
      el.getAttribute("user-title") ||
      getChildText(el, "user-title");

    let statement = null;

    if (rawUserTitle && rawUserTitle.trim() !== "") {
      statement = rawUserTitle.trim();
    } else {
      statement =
        getChildText(el, "Text") ||
        getChildText(el, "text") ||
        null;
    }

    const nodeIri = `<${baseIri}node/${encodeURIComponent(id)}>`;
    const lines = [];

    lines.push(`${nodeIri} a asce:Node`);

    if (userId) {
      lines.push(`  ; asce:userId "${turtleEscapeLiteral(userId)}"`);
    }

    if (typeStr != null && typeStr !== "") {
      const n = Number(typeStr);
      if (Number.isInteger(n) && n >= 0) {
        lines.push(`  ; asce:type "${n}"^^xsd:nonNegativeInteger`);
      } else {
        lines.push(`  ; asce:type "${turtleEscapeLiteral(typeStr)}"`);
      }
    }

    if (statement) {
      lines.push(
        `  ; asce:userTitle """${turtleEscapeMultilineLiteral(statement)}"""`
      );
    }

    lines.push("  .");
    body += lines.join("\n") + "\n\n";
  });

  // --- Map links ----------------------------------------------------------
  const linkElements = Array.from(xmlDoc.querySelectorAll(linkSelector));
  linkElements.forEach((el) => {
    const source =
      el.getAttribute("source") ||
      getChildText(el, "source-reference");

    const target =
      el.getAttribute("target") ||
      getChildText(el, "destination-reference");

    if (!source || !target) return;

    const typeStr =
      el.getAttribute("type") ||
      getChildText(el, "type");

    let linkId =
      el.getAttribute("id") ||
      el.getAttribute("reference") ||
      getChildText(el, "reference");

    if (!linkId) {
      linkId = `auto-${source}-${target}`;
    }

    const srcIri  = `<${baseIri}node/${encodeURIComponent(source)}>`;
    const tgtIri  = `<${baseIri}node/${encodeURIComponent(target)}>`;
    const linkIri = `<${baseIri}link/${encodeURIComponent(linkId)}>`;
    const lines   = [];

    lines.push(`${linkIri} a asce:Link, gsn:Relationship`);
    lines.push(`  ; asce:startReference ${srcIri}`);
    lines.push(`  ; asce:endReference ${tgtIri}`);

    let typeNum = null;
    if (typeStr != null && typeStr !== "") {
      const n = Number(typeStr);
      if (Number.isInteger(n) && n >= 0) {
        typeNum = n;
        lines.push(`  ; asce:type "${n}"^^xsd:nonNegativeInteger`);
      } else {
        lines.push(`  ; asce:type "${turtleEscapeLiteral(typeStr)}"`);
      }
    }

    lines.push("  .");
    body += lines.join("\n") + "\n\n";

    // Materialize direct GSN edges between nodes
    if (typeNum === 1) {
      body += `${tgtIri} gsn:supportedBy ${srcIri} .\n\n`;
    } else if (typeNum === 2) {
      body += `${tgtIri} gsn:inContextOf ${srcIri} .\n\n`;
    }
  });

  return header + body;
}

// --- high-level conversion for a single XML file --------------------------

async function convertXmlFile(file, { baseIri } = {}) {
  const xmlText = await readFileText(file);
  return xmlToAsceTurtle(xmlText, { baseIri });
}

// --- module state / lifecycle ---------------------------------------------

let _root = null;

let _fileInput = null;
let _convertBtn = null;
let _downloadBtn = null;
let _logEl = null;

let _baseIri = "https://example.org/kettle#";
let _lastConvertedTtl = null;

let _onConvert = null;
let _onDownload = null;

let _cleanup = null;

function log(msg) {
  if (_logEl) _logEl.textContent = String(msg ?? "");
}

function updateDownloadEnabled() {
  if (_downloadBtn) _downloadBtn.disabled = !_lastConvertedTtl;
}

// --- PaneManager lifecycle exports ----------------------------------------

export async function mount({ root, payload }) {
  _root = root;

  // optional: allow caller to override baseIri
  _baseIri = String(payload?.baseIri || _baseIri);

  await mountTemplate(root, {
    templateUrl: HTML,
    cssUrl: CSS,
    cache: "no-store",
    bust: true,
    replace: true
  });

  _fileInput    = root.querySelector("#kettle-axml-input");
  _convertBtn   = root.querySelector("#kettle-convert-btn");
  _downloadBtn  = root.querySelector("#kettle-download-btn");
  _logEl        = root.querySelector("#kettle-log");

  if (_downloadBtn) _downloadBtn.disabled = true;
  log("Ready.");

  _onConvert = async (ev) => {
    ev?.preventDefault?.();

    const file = _fileInput?.files?.[0] || null;
    if (!file) {
      log("Please select an .axml/.xml file first.");
      return;
    }

    _convertBtn && (_convertBtn.disabled = true);
    _downloadBtn && (_downloadBtn.disabled = true);
    log("Converting…");

    try {
      _lastConvertedTtl = await convertXmlFile(file, { baseIri: _baseIri });
      log(`Conversion succeeded. TTL size: ${_lastConvertedTtl.length.toLocaleString()} characters.`);
      updateDownloadEnabled();
    } catch (err) {
      console.error("[converter] Conversion failed:", err);
      _lastConvertedTtl = null;
      log("Conversion failed: " + (err?.message || String(err)));
      updateDownloadEnabled();
    } finally {
      _convertBtn && (_convertBtn.disabled = false);
    }
  };

  _onDownload = (ev) => {
    ev?.preventDefault?.();
    if (!_lastConvertedTtl) return;

    const originalName = _fileInput?.files?.[0]?.name || "kettle.axml";
    const ttlName = originalName.replace(/\.[^.]+$/, "") + ".ttl";
    downloadText(ttlName, _lastConvertedTtl, { mime: "text/turtle;charset=utf-8" });
  };

  _convertBtn?.addEventListener("click", _onConvert);
  _downloadBtn?.addEventListener("click", _onDownload);

  _cleanup = () => {
    try { _convertBtn?.removeEventListener("click", _onConvert); } catch {}
    try { _downloadBtn?.removeEventListener("click", _onDownload); } catch {}

    _root = null;

    _fileInput = null;
    _convertBtn = null;
    _downloadBtn = null;
    _logEl = null;

    _onConvert = null;
    _onDownload = null;
  };

  return _cleanup;
}

export async function resume() {
  // keep whatever the user last did
  if (_lastConvertedTtl) {
    log(`Conversion ready. TTL size: ${_lastConvertedTtl.length.toLocaleString()} characters.`);
  } else {
    log("Ready.");
  }
  updateDownloadEnabled();
}

export async function suspend() {
  // nothing special to stop
}

export async function unmount() {
  try { _cleanup?.(); } catch {}
  _cleanup = null;
}
