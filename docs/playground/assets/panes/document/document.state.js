export let docRoot = null;
export let currentDocPath = null;
export let pendingHighlight = null;

let docReq = 0;

export function setDocRoot(root) {
  docRoot = root;
}

export function setCurrentDocPath(path) {
  currentDocPath = path || null;
}

export function setPendingHighlight(detail) {
  pendingHighlight = detail || null;
}

export function nextDocReq() {
  docReq += 1;
  return docReq;
}

export function isLatestDocReq(reqId) {
  return reqId === docReq;
}

export function resetDocState() {
  docRoot = null;
  currentDocPath = null;
  pendingHighlight = null;
  docReq = 0;
}

export const cssEsc = (s) =>
  (globalThis.CSS?.escape
    ? globalThis.CSS.escape(String(s))
    : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));