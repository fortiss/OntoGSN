export function getFirstKeyword(queryText) {
  const lines = String(queryText).split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;                 // skip empty
    if (t.startsWith("#")) continue;  // skip comments
    if (/^(PREFIX|BASE)\b/i.test(t)) continue; // skip PREFIX/BASE
    return t.split(/\s+/)[0].toUpperCase();
  }
  return "";
}

export function isUpdateQuery(queryText) {
  const kw = getFirstKeyword(queryText);
  // basic set of SPARQL UPDATE operations
  return ["INSERT", "DELETE", "LOAD", "CREATE", "DROP", "CLEAR", "COPY", "MOVE", "ADD"].includes(kw);
}

export function termToDisplay(t) {
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
    default:
      return t.value ?? String(t);
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

export function shortenIri(iriOrLabel) {
  try {
    const u = new URL(iriOrLabel);
    if (u.hash && u.hash.length > 1) return u.hash.slice(1);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || iriOrLabel;
  } catch {
    return String(iriOrLabel).replace(/^.*[#/]/, "");
  }
}
