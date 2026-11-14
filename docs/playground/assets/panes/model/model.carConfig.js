// assets/panes/model/model.carConfig.js
import { fetchText, resolveEl } from "@core/utils.js";
import { SCHEMA, EX, RDF } from "./model.constants.js";

// RDF / Turtle handling via N3 (global from index.html)
const { Parser, Store, DataFactory } = N3;
const { namedNode } = DataFactory;

let _carConfig = null;

// -------------------------
// Small literal helpers
// -------------------------
function firstObj(store, s, p) {
  const objs = store.getObjects(s, p, null);
  return objs.length ? objs[0] : null;
}

function litStr(node) {
  return node && node.termType === "Literal" ? node.value : null;
}

function litBool(node) {
  if (!node || node.termType !== "Literal") return null;
  if (node.datatype?.value === "http://www.w3.org/2001/XMLSchema#boolean") {
    return node.value === "true";
  }
  // tolerate "true"/"false" without datatype
  if (node.value === "true") return true;
  if (node.value === "false") return false;
  return null;
}

function litFloat(node) {
  if (!node || node.termType !== "Literal") return null;
  const n = parseFloat(node.value);
  return Number.isFinite(n) ? n : null;
}

function getFloat(store, s, pIri) {
  return litFloat(firstObj(store, s, namedNode(pIri)));
}

function getStr(store, s, pIri) {
  return litStr(firstObj(store, s, namedNode(pIri)));
}

function getBool(store, s, pIri) {
  return litBool(firstObj(store, s, namedNode(pIri)));
}

function getNode(store, s, pIri) {
  return firstObj(store, s, namedNode(pIri));
}

function getTypes(store, s) {
  return store.getObjects(s, namedNode(RDF + "type"), null)
    .filter(t => t?.termType === "NamedNode")
    .map(t => t.value);
}

function inferShapeKind(store, shapeNode) {
  if (!shapeNode) return null;
  const types = getTypes(store, shapeNode);

  if (types.includes(EX + "BoxShape")) return "box";
  if (types.includes(EX + "CylinderShape")) return "cylinder";
  if (types.includes(EX + "PlaneShape")) return "plane";

  // fallback: guess from IRI fragment if any
  if (shapeNode.termType === "NamedNode") {
    const iri = shapeNode.value.toLowerCase();
    if (iri.includes("wheel") || iri.includes("cyl")) return "cylinder";
    if (iri.includes("plate") || iri.includes("plane")) return "plane";
  }
  return null;
}

function getInt(store, s, pIri) {
  const v = getFloat(store, s, pIri);
  return v == null ? null : Math.max(0, Math.trunc(v));
}

// If a part is typed as a class carrying defaults (like your ex:StandardWheel),
// allow reading value from the rdf:type resource if not present on the instance.
function getFloatWithTypeFallback(store, s, pIri) {
  const direct = getFloat(store, s, pIri);
  if (direct != null) return direct;

  const typeNode = firstObj(store, s, namedNode(RDF + "type"));
  if (!typeNode || typeNode.termType !== "NamedNode") return null;

  const fromType = getFloat(store, typeNode, pIri);
  return fromType;
}

// -------------------------
// Main loader
// -------------------------
export async function loadCarConfigFromTTL(url) {
  const ttl = await fetchText(url, { cache: "no-store", bust: true });
  const parser = new Parser({ format: "text/turtle" });
  const store = new Store(parser.parse(ttl));

  // Pick the first schema:Car found (model-agnostic).
  const carCandidates = store.getSubjects(
    namedNode(RDF + "type"),
    namedNode(SCHEMA + "Car"),
    null
  );

  if (!carCandidates.length) {
    throw new Error("No schema:Car found in TTL.");
  }

  const carNode = carCandidates[0];

  const vin = getStr(store, carNode, SCHEMA + "vehicleIdentificationNumber");
  const name = getStr(store, carNode, SCHEMA + "name");

  // Parts: union of ex:hasPart links and schema:isPartOf backlinks
  const partSet = new Map(); // iri -> NamedNode
  const hasPartPred = namedNode(EX + "hasPart");

  // ?car ex:hasPart ?part
  for (const obj of store.getObjects(carNode, hasPartPred, null)) {
    if (obj?.termType === "NamedNode") partSet.set(obj.value, obj);
  }

  // ?part schema:isPartOf ?car
  const isPartOfPred = namedNode(SCHEMA + "isPartOf");
  for (const subj of store.getSubjects(isPartOfPred, carNode, null)) {
    if (subj?.termType === "NamedNode") partSet.set(subj.value, subj);
  }

  const parts = [];
  const sceneParts = [];

  for (const partNode of partSet.values()) {
    const label =
      getStr(store, partNode, SCHEMA + "name") ||
      getStr(store, partNode, SCHEMA + "identifier") ||
      partNode.value;

    parts.push({ iri: partNode.value, label });

    // --- follow your ontology structure ------------------------------------

    // pose is a blank node: part ex:hasPose [ ... ]
    const poseNode = getNode(store, partNode, EX + "hasPose") ?? partNode;

    // shape is a resource: part ex:hasShape ex:shapeBody
    const shapeNode = getNode(store, partNode, EX + "hasShape") ?? null;

    // style is a resource: part ex:hasStyle ex:styleSolidClickable
    const styleNode = getNode(store, partNode, EX + "hasStyle") ?? partNode;

    // infer shape kind from rdf:type of the shape node (BoxShape/CylinderShape/PlaneShape)
    const shapeKind = inferShapeKind(store, shapeNode);

    // pose
    const position = {
      x: getFloat(store, poseNode, EX + "posX") ?? 0,
      y: getFloat(store, poseNode, EX + "posY") ?? 0,
      z: getFloat(store, poseNode, EX + "posZ") ?? 0
    };

    const rotation = {
      x: getFloat(store, poseNode, EX + "rotX") ?? 0,
      y: getFloat(store, poseNode, EX + "rotY") ?? 0,
      z: getFloat(store, poseNode, EX + "rotZ") ?? 0
    };

    // dims live on the SHAPE node in your TTL
    let width = null, height = null, depth = null;
    let radius = null, cylHeight = null, segments = null, axis = null;

    if (shapeNode) {
      if (shapeKind === "box") {
        width = getFloat(store, shapeNode, EX + "sizeX") ?? getFloat(store, shapeNode, EX + "width");
        height = getFloat(store, shapeNode, EX + "sizeY") ?? getFloat(store, shapeNode, EX + "height");
        depth = getFloat(store, shapeNode, EX + "sizeZ") ?? getFloat(store, shapeNode, EX + "depth");
      } else if (shapeKind === "plane") {
        width = getFloat(store, shapeNode, EX + "width");
        // your TTL uses height2 for planes
        height = getFloat(store, shapeNode, EX + "height2") ?? getFloat(store, shapeNode, EX + "height");
        depth = null;
      } else if (shapeKind === "cylinder") {
        radius = getFloat(store, shapeNode, EX + "radius");
        cylHeight = getFloat(store, shapeNode, EX + "height");
        segments = getInt(store, shapeNode, EX + "segments");
        axis = getStr(store, shapeNode, EX + "axis"); // "x"|"y"|"z"
      }
    }

    // BACKWARD COMPAT (if you ever had a “flat” TTL older version)
    if (!shapeNode) {
      width = getFloatWithTypeFallback(store, partNode, EX + "width") ?? getFloatWithTypeFallback(store, partNode, EX + "sizeX");
      height = getFloatWithTypeFallback(store, partNode, EX + "height") ?? getFloatWithTypeFallback(store, partNode, EX + "sizeY");
      depth = getFloatWithTypeFallback(store, partNode, EX + "depth") ?? getFloatWithTypeFallback(store, partNode, EX + "sizeZ");
      radius = getFloatWithTypeFallback(store, partNode, EX + "radius");
      cylHeight = getFloatWithTypeFallback(store, partNode, EX + "cylinderHeight") ??
        getFloatWithTypeFallback(store, partNode, EX + "height");
      segments = getInt(store, partNode, EX + "segments");
    }

    // style lives on the STYLE node in your TTL
    const fillColor = getStr(store, styleNode, EX + "fillColor") ?? "#ffffff";
    const opacity = getFloat(store, styleNode, EX + "opacity");
    const transparent = getBool(store, styleNode, EX + "transparent");

    // toggles / UI identity
    const uiToggleKey = getStr(store, partNode, EX + "uiToggleKey");

    // “isActive” in your TTL is effectively initial visibility for toggleable loads
    const isActive = getBool(store, partNode, EX + "isActive");
    const defaultVisible = (isActive === false) ? false : null;

    // optional text mapping
    let text = getStr(store, partNode, EX + "textLiteral");
    const textFrom = getStr(store, partNode, EX + "textFrom");
    if (!text && textFrom === "vin") text = vin;

    // store a simple shape hint for the renderer
    const shape = shapeKind; // "box"|"plane"|"cylinder"|null

    sceneParts.push({
      iri: partNode.value,
      label,
      shape,
      size: { width, height, depth, radius, cylHeight, segments, axis },
      position,
      rotation,
      material: { opacity, transparent, color: fillColor },
      uiToggleKey: uiToggleKey || null,
      defaultVisible,
      text: text || null
    });
  }

  return {
    store,
    carNode,
    vin,
    name,
    parts, // for label->iri mapping / UI display
    scene: {
      parts: sceneParts
    }
  };
}

// Load carConfig once (from TTL if available)
export async function ensureCarConfig({ root = document } = {}) {
  if (_carConfig) return _carConfig;

  try {
    _carConfig = await loadCarConfigFromTTL(
      new URL("../../data/ontologies/car.ttl", import.meta.url)
    );
    console.log("Loaded car config from TTL:", _carConfig);
  } catch (err) {
    console.error("Failed to load car config from TTL:", err);

    const msg =
      resolveEl("#status-message", { root, required: false, name: "Model view: #status-message" }) ||
      document.getElementById("status-message");

    if (msg) msg.textContent = "Could not load car.ttl – check console/logs.";
  }

  return _carConfig;
}

export function getCarConfig() {
  return _carConfig;
}