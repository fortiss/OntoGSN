// Content types
export const MIME_TTL = "text/turtle";

// Base IRIs / prefixes
export const BASE_ONTO = "https://w3id.org/OntoGSN/ontology#";
export const BASE_CASE = "https://w3id.org/OntoGSN/cases/ACT-FAST-robust-llm#";
export const BASE_CAR  = "https://example.org/car-demo#";
export const BASE_CODE = "https://example.org/python-code#";

export const BASES = {
  onto: BASE_ONTO,
  case: BASE_CASE,
  car : BASE_CAR,
  code: BASE_CODE,
};

// Paths to data files
export const PATHS = {
  // Ontologies
  onto    : "./assets/data/ontologies/ontogsn.ttl",
  did     : "./assets/data/ontologies/defence_in_depth.ttl",
  example : "./assets/data/ontologies/example_ac.ttl",
  car_ac  : "./assets/data/ontologies/car_assurance.ttl",
  car     : "./assets/data/ontologies/car.ttl",
  doclinks: "./assets/data/ontologies/docLinks.ttl",
  code    : "./assets/data/ontologies/example_python_code.ttl",
  check   : "./assets/data/ontologies/example_checklist.ttl",

  // Base queries
  q: {
    nodes          : "./assets/data/queries/read_all_nodes.sparql",
    rels           : "./assets/data/queries/read_all_relations.sparql",
    visualize      : "./assets/data/queries/visualize_graph.sparql",
    propCtx        : "./assets/data/queries/propagate_context.sparql",
    propDef        : "./assets/data/queries/propagate_defeater.sparql",
    listModules    : "./assets/data/queries/list_modules.sparql",
    visualizeByMod : "./assets/data/queries/visualize_graph_by_module.sparql",

    bridge_nodeToDoc : "./assets/data/queries/read_graphToDoc.sparql",
    bridge_docToGraph: "./assets/data/queries/bridge_doc_hit_to_graph.sparql",
    read_docLinkIndex: "./assets/data/queries/read_docLinkIndex.sparql",
  },
};

// --- Runtime overrides (UI writes JSON here) -------------------------------
export const RUNTIME_CONFIG_KEY = "ontogsn_config_overrides_v1";

function _isPlainObject(x) {
  return !!x && typeof x === "object" && (x.constructor === Object || Object.getPrototypeOf(x) === null);
}

function _deepMergeStrings(target, src) {
  if (!_isPlainObject(target) || !_isPlainObject(src)) return;

  for (const [k, v] of Object.entries(src)) {
    if (_isPlainObject(v)) {
      if (!_isPlainObject(target[k])) target[k] = {};
      _deepMergeStrings(target[k], v);
      continue;
    }
    // We only accept strings as config leaf values (paths/iris)
    if (typeof v === "string") target[k] = v;
  }
}

function _buildDefaultDatasets() {
  return [
    { path: PATHS.onto,    base: BASES.onto },
    { path: PATHS.did,     base: BASES.onto },
    { path: PATHS.example, base: BASES.case },
    { path: PATHS.car_ac,  base: BASES.car  },
    { path: PATHS.car,     base: BASES.car  },
    { path: PATHS.doclinks, base: BASES.car },
    { path: PATHS.code,    base: BASES.code },
    { path: PATHS.check,   base: BASES.case },
  ];
}

// Convenience: ordered datasets for load loops in store.js
export const DATASETS = _buildDefaultDatasets();

export function getConfigSnapshot() {
  // Avoid structuredClone for older browsers
  const clone = (x) => JSON.parse(JSON.stringify(x));
  return {
    MIME_TTL,
    BASES: clone(BASES),
    PATHS: clone(PATHS),
    DATASETS: clone(DATASETS),
  };
}

export function loadConfigOverrides(key = RUNTIME_CONFIG_KEY) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return _isPlainObject(obj) ? obj : null;
  } catch {
    return null;
  }
}

export function saveConfigOverrides(overrides, key = RUNTIME_CONFIG_KEY) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(key, JSON.stringify(overrides ?? {}));
    return true;
  } catch {
    return false;
  }
}

export function clearConfigOverrides(key = RUNTIME_CONFIG_KEY) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function applyConfigOverrides(overrides) {
  if (!_isPlainObject(overrides)) {
    // Even if nothing provided, ensure DATASETS reflect current PATHS/BASES
    const def = _buildDefaultDatasets();
    DATASETS.splice(0, DATASETS.length, ...def);
    return { applied: false, reason: "no-overrides" };
  }

  // Apply BASES overrides
  if (_isPlainObject(overrides.BASES)) {
    for (const k of ["onto", "case", "car", "code"]) {
      if (typeof overrides.BASES[k] === "string") BASES[k] = overrides.BASES[k];
    }
  }

  // Apply PATHS overrides
  if (_isPlainObject(overrides.PATHS)) {
    _deepMergeStrings(PATHS, overrides.PATHS);
  }

  // Apply DATASETS overrides OR rebuild defaults from (possibly changed) PATHS/BASES
  if (Array.isArray(overrides.DATASETS)) {
    const next = [];
    for (const ds of overrides.DATASETS) {
      if (!_isPlainObject(ds)) continue;
      if (typeof ds.path !== "string") continue;
      const base = (typeof ds.base === "string") ? ds.base : "";
      next.push({ path: ds.path, base });
    }
    DATASETS.splice(0, DATASETS.length, ...next);
  } else {
    const def = _buildDefaultDatasets();
    DATASETS.splice(0, DATASETS.length, ...def);
  }

  return { applied: true };
}

// Apply saved overrides immediately at module evaluation time (before store loads)
applyConfigOverrides(loadConfigOverrides());