// assets/panes/model/model.controller.js
import app from "@core/queries.js";
import panes from "@core/panes.js";
import { mountTemplate, resolveEl } from "@core/utils.js";
import { bus } from "@core/events.js";

import { ensureCarConfig } from "./model.carConfig.js";
import { createCarScene } from "./model.scene.js";
import { EX } from "./model.constants.js";
import {
  ensureModelQueriesCached,
  setLoadActive,
  getOverloadedQueryTextPromise,
  getCarLoadWeightQueryTextPromise
} from "./model.queries.js";

const HTML = new URL("./model.html", import.meta.url);
const CSS  = new URL("./model.css",  import.meta.url);

let offOverload = null;
let overloadEventListener = null;
let currentSceneCtl = null;

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export async function renderModelView({ mount = null, height = 520 } = {}) {
  const host =
    mount ??
    panes.getRightPane?.("model") ??
    "#model-root";

  const rootEl = resolveEl(host, { name: "renderModelView: mount", required: true });
  if (!rootEl) throw new Error(`Model view: mount host not found`);

  if (app?.graphCtl && typeof app.graphCtl.destroy === "function") {
    app.graphCtl.destroy();
    app.graphCtl = null;
  }

  await mountTemplate(rootEl, { templateUrl: HTML, cssUrl: CSS });
  ensureModelQueriesCached();

  const wrapper = rootEl.querySelector("#scene-wrapper");
  if (wrapper) wrapper.style.height = `${height}px`;

  const overloadWarningEl = rootEl.querySelector("#overload-warning");
  const loadCurrentEl     = rootEl.querySelector("#load-current");
  const loadMaxEl         = rootEl.querySelector("#load-max");

  if (currentSceneCtl?.destroy) {
    currentSceneCtl.destroy();
    currentSceneCtl = null;
  }

  const cfg = await ensureCarConfig({ root: rootEl });
  const sceneCtl = createCarScene(cfg, { root: rootEl });
  currentSceneCtl = sceneCtl;

  // Register controller
  app.graphCtl = sceneCtl;
  const _destroy = sceneCtl.destroy?.bind(sceneCtl);
  sceneCtl.destroy = () => {
    offOverload?.();
    offOverload = null;
    _destroy?.();
  };

  panes.setRightController("model", sceneCtl);

  // Wire up toggles + overloaded rule checkbox
  const boxToggle     = rootEl.querySelector("#toggle-roof-box");
  const luggageToggle = rootEl.querySelector("#toggle-roof-luggage");

  // The pane is mounted again on each visit. The store holds which loads are active.
  function readActiveLoads() {
    const active = new Set();
    if (!app?.store) return active;
    try {
      const res = app.store.query(
        `PREFIX ex: <${EX}> SELECT ?key WHERE { ?load ex:uiToggleKey ?key ; ex:isActive true . }`
      );
      for (const b of res) {
        const key = b.get("key");
        if (key) active.add(key.value);
      }
    } catch (err) {
      console.error("Failed to read the active loads:", err);
    }
    return active;
  }

  // The overload rule is on when its challenge is in the store.
  function overloadChallengeExists() {
    if (!app?.store) return false;
    try {
      return !!app.store.query(`ASK { <${EX}car_D1_2> ?p ?o }`);
    } catch (err) {
      console.error("Failed to read the overload challenge:", err);
      return false;
    }
  }

  const activeLoads = readActiveLoads();
  if (boxToggle) boxToggle.checked = activeLoads.has("roofBox");
  if (luggageToggle) luggageToggle.checked = activeLoads.has("roofLuggage");

  const overloadCheckbox = document.querySelector(
    'input[type="checkbox"][data-queries*="propagate_overloadedCar.sparql"]'
  );

  function syncOverloadFromRoofToggles() {
    if (!overloadCheckbox) return;
    const shouldBeChecked = !!(boxToggle?.checked && luggageToggle?.checked);
    if (overloadCheckbox.checked === shouldBeChecked) return;

    overloadCheckbox.checked = shouldBeChecked;
    overloadCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateLoadInfo(current, max) {
    if (!loadCurrentEl || !loadMaxEl) return;
    loadCurrentEl.textContent = current != null ? current.toFixed(1) : "–";
    loadMaxEl.textContent     = max != null ? max.toFixed(1) : "–";
  }

  async function refreshLoadInfo() {
    if (!app?.store) return;

    try {
      const queryText = await getCarLoadWeightQueryTextPromise();
      const res = app.store.query(queryText);

      let current = 0;
      let max = null;

      for (const bindings of res) {
        const cl = bindings.get("currentLoadWeight") || bindings.get("?currentLoadWeight");
        const ml = bindings.get("maxLoadWeight") || bindings.get("?maxLoadWeight");

        if (cl?.termType === "Literal") current = parseFloat(cl.value);
        if (ml?.termType === "Literal") max = parseFloat(ml.value);
        break;
      }

      updateLoadInfo(current, max);
    } catch (err) {
      console.error("Failed to read car load weights:", err);
      updateLoadInfo(null, null);
    }
  }

  await refreshLoadInfo();

  if (sceneCtl && boxToggle && typeof sceneCtl.setBoxVisible === "function") {
    sceneCtl.setBoxVisible(boxToggle.checked);
    boxToggle.addEventListener("change", async () => {
      sceneCtl.setBoxVisible(boxToggle.checked);
      syncOverloadFromRoofToggles();
      await setLoadActive("Box", boxToggle.checked);
      await refreshLoadInfo();
    });
  }

  if (sceneCtl && luggageToggle && typeof sceneCtl.setLuggageVisible === "function") {
    sceneCtl.setLuggageVisible(luggageToggle.checked);
    luggageToggle.addEventListener("change", async () => {
      sceneCtl.setLuggageVisible(luggageToggle.checked);
      syncOverloadFromRoofToggles();
      await setLoadActive("Luggage", luggageToggle.checked);
      await refreshLoadInfo();
    });
  }

  // --- Overload propagation → color car parts + sync UI ------------------

  overloadEventListener = async (ev) => {
    const active = !!ev.detail?.active;
    if (!sceneCtl?.setOverloadedPartsByIri) return;

    if (overloadWarningEl) {
      overloadWarningEl.style.display = active ? "block" : "none";
    }

    // Sync roof toggles from rule state
    if (boxToggle && luggageToggle) {
      boxToggle.checked = active;
      luggageToggle.checked = active;
      sceneCtl.setBoxVisible?.(active);
      sceneCtl.setLuggageVisible?.(active);
    }

    if (!active) {
      sceneCtl.setOverloadedPartsByIri([]);
      await refreshLoadInfo();
      return;
    }

    if (!app?.store) return;

    const queryText = await getOverloadedQueryTextPromise();
    const res = app.store.query(queryText);

    const iris = [];
    for (const b of res) {
      for (const [, term] of b) {
        if (term?.termType === "NamedNode") iris.push(term.value);
      }
    }

    console.log("[car overload] IRIs from SPARQL:", iris);
    sceneCtl.setOverloadedPartsByIri(iris);
    await refreshLoadInfo();
  };

  offOverload?.();
  offOverload = bus?.on?.("car:overloadChanged", overloadEventListener) ?? null;

  // Initial sync
  if (overloadCheckbox?.checked || overloadChallengeExists()) {
    overloadEventListener({ detail: { active: true } });
  }
}

// ---------------------------------------------------------------------------
// PaneManager lifecycle (lazy-load safe)
// ---------------------------------------------------------------------------

let _offRightTab = null;
let _mountedRoot = null;
let _suspended = false;

function onRightTab(ev) {
  if (_suspended) return;
  const d = ev?.detail || {};
  if (d.view !== "model") return;

  const height = d.height ?? 520;

  renderModelView({ mount: _mountedRoot, height }).catch((err) =>
    console.warn("[model] right:tab render failed:", err)
  );
}

export async function mount({ root } = {}) {
  _mountedRoot = root ?? resolveEl("#model-root", { required: true, name: "Model pane root" });

  if (!_offRightTab) {
    _offRightTab = bus.on("right:tab", onRightTab);
  }

  await renderModelView({ mount: _mountedRoot, height: 520 });
  return () => unmount();
}

export async function resume() {
  _suspended = false;
  try { currentSceneCtl?.fit?.(); } catch {}
}

export async function suspend() {
  _suspended = true;
}

export async function unmount() {
  _suspended = true;

  try { _offRightTab?.(); } catch {}
  _offRightTab = null;

  try { currentSceneCtl?.destroy?.(); } catch {}
  currentSceneCtl = null;

  try { offOverload?.(); } catch {}
  offOverload = null;

  overloadEventListener = null;
  _mountedRoot = null;
}