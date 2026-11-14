// assets/panes/graph/graph.config.js

export const HTML = new URL("./graph.html", import.meta.url);
export const CSS = new URL("./graph.css", import.meta.url);

export const NODE_H = 26;

export const LAYOUT = {
  dx: 200,
  dy: 80,

  ctxOffsetX: 80,
  ctxOffsetY: 50,

  defOffsetX: 80,
  defOffsetY: 50,
};

export const DEFAULT_GRAPH_RENDER_OPTS = {
  height: 520,
  label: (x) => x,

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
};