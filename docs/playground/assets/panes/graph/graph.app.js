// assets/panes/graph/graph.app.js

import { resolveEl, splitTokens, exposeForDebug } from "@core/utils.js";
import { emitCompat } from "@core/events.js";

import { DEFAULT_GRAPH_RENDER_OPTS } from "./graph.config.js";
import { visualizeSPO } from "./graph.renderer.js";

export function createGraphApp({
  panes,
  bus,
  qs = null,
  paths,
  labelFn = (x) => x,
  renderOpts = {},
} = {}) {
  return new GraphApp({ panes, bus, qs, paths, labelFn, renderOpts });
}

class GraphApp {
  constructor({ panes, bus, qs, paths, labelFn, renderOpts }) {
    if (!panes) throw new Error("createGraphApp: panes is required");
    if (!bus) throw new Error("createGraphApp: bus is required");
    if (!paths) throw new Error("createGraphApp: paths is required");

    this.panes = panes;
    this.bus = bus;
    this.qs = qs;
    this.paths = paths;

    this.rootEl = null;
    this.graphCtl = null;

    this.overlays = new Map();
    this._unsubs = [];

    this._wired = false;
    this._renderSeq = 0;
    this._busyCount = 0;

    this._activeModuleIri = null;

    this.renderOpts = {
      ...DEFAULT_GRAPH_RENDER_OPTS,
      ...renderOpts,
      label: labelFn || DEFAULT_GRAPH_RENDER_OPTS.label,
    };
  }

  async init({ qs, rootEl } = {}) {
    this.rootEl =
      rootEl || resolveEl("#graph-root", {
        required: true,
        name: "GraphApp root",
      });

    if (qs) this.qs = qs;
    if (!this.qs) throw new Error("GraphApp.init: qs is required");

    if (this._wired) return;

    this._wired = true;
    this._wireGraphBus();
    this._attachUI();
  }

  destroy() {
    this._unsubs.forEach((off) => off?.());
    this._unsubs = [];

    if (this._onDocClick) {
      this.rootEl?.removeEventListener("click", this._onDocClick);
      this._onDocClick = null;
    }

    if (this._onDocChange) {
      this.rootEl?.removeEventListener("change", this._onDocChange);
      this._onDocChange = null;
    }

    try {
      this.graphCtl?.destroy?.();
    } catch {}

    this.graphCtl = null;
    this.overlays.clear();

    this._wired = false;
    this._busyCount = 0;
    this._syncBusyUi();
  }

  async run(queryPath, overlayClass = null) {
    if (!this.qs) throw new Error("GraphApp.run: call init({qs}) first");

    // Main "All" graph query resets module highlight
    if (queryPath === this.paths?.q?.visualize) {
      this._activeModuleIri = null;
    }

    this._beginBusy();
    try {
      const res = await this.qs.runPath(queryPath, {
        cache: "no-store",
        bust: true,
      });

      await this._handleQueryResult(res, overlayClass);
      return res;
    } finally {
      this._endBusy();
    }
  }

  async runInline(queryText, overlayClass = null, { source = "inline" } = {}) {
    if (!this.qs) throw new Error("GraphApp.runInline: call init({qs}) first");

    this._beginBusy();
    try {
      const res = await this.qs.runText(queryText, { source });
      await this._handleQueryResult(res, overlayClass);
    } finally {
      this._endBusy();
    }
  }

  async _handleQueryResult(result, overlayClass = null) {
    if (!result) return;

    if (result.kind === "update") {
      // By design: update queries do not directly mutate the graph UI here.
      return;
    }

    const rows = result.rows || [];
    if (!rows.length) return;

    const r0 = rows[0];
    const hasS = Object.prototype.hasOwnProperty.call(r0, "s");
    const hasP = Object.prototype.hasOwnProperty.call(r0, "p");
    const hasO = Object.prototype.hasOwnProperty.call(r0, "o");
    const hasCollectionsShape =
      Object.prototype.hasOwnProperty.call(r0, "ctx") &&
      Object.prototype.hasOwnProperty.call(r0, "clt") &&
      Object.prototype.hasOwnProperty.call(r0, "item");

    // 1) Collections overlay
    if (hasCollectionsShape) {
      if (!this.graphCtl?.addCollections) return;

      this.graphCtl.addCollections(rows, { dx: 90, dy: 26 });
      this.graphCtl?.fit?.();

      exposeForDebug("graphCtl", this.graphCtl);
      return;
    }

    // 2) Full graph render
    if (hasS && hasP && hasO) {
      await this._renderGraph(rows);
      return;
    }

    // 3) Overlay highlight rows: single ?s
    if (hasS && !hasP && !hasO) {
      if (!this.graphCtl?.highlightByIds) return;

      const ids = rows.map((r) => r.s).filter(Boolean);
      const cls = overlayClass || "overlay";

      this.overlays.set(cls, new Set(ids));
      this._reapplyOverlays();

      exposeForDebug("graphCtl", this.graphCtl);
      return;
    }

    // Otherwise intentionally ignored (graph-only controller)
  }

  async _renderGraph(rows) {
    const seq = ++this._renderSeq;
    const host = this.rootEl;
    if (!host) return;

    // The template is mounted again on each render. Keep what the user selected.
    const checked = [...host.querySelectorAll('input[type="checkbox"]')].map((el) => el.checked);

    this.panes.clearRightPane?.();
    this.graphCtl = null;
    host.innerHTML = "";

    const newCtl = await visualizeSPO(rows, {
      mount: host,
      eventBus: this.bus,
      ...this.renderOpts,
    });

    if (seq !== this._renderSeq) {
      try {
        newCtl?.destroy?.();
      } catch {}
      return;
    }

    this.graphCtl = newCtl;

    host.querySelectorAll('input[type="checkbox"]').forEach((el, i) => {
      if (i < checked.length) el.checked = checked[i];
    });

    this.graphCtl?.fit?.();
    this._applyVisibility();
    this._reapplyOverlays();

    await this._buildModulesBar(this._activeModuleIri);

    exposeForDebug("graphCtl", this.graphCtl);
    console.debug("[GraphApp] render", rows.length, performance.now());
  }

  async _buildModulesBar(activeModuleIri = null) {
    if (!this.qs) return;

    const rightRoot = this.rootEl ?? this.panes.getRightPane?.() ?? document;

    let bar =
      (rightRoot !== document ? rightRoot.querySelector?.("#modulesBar") : null) ??
      document.getElementById("modulesBar");

    if (!bar) return;

    if (rightRoot !== document && !rightRoot.contains(bar)) {
      const hud = rightRoot.querySelector?.(".gsn-graph-hud") ?? rightRoot;
      hud.appendChild(bar);
    }

    const res = await this.qs.runPath(this.paths.q.listModules, {
      cache: "no-store",
      bust: true,
    });

    const rows = res.rows ?? [];
    bar.innerHTML = "";

    // All
    const btnAll = document.createElement("button");
    btnAll.classList.add("tab");
    if (!activeModuleIri) btnAll.classList.add("active");
    btnAll.textContent = "All";
    btnAll.addEventListener("click", () => {
      this._activeModuleIri = null;
      void this.run(this.paths.q.visualize);
    });
    bar.appendChild(btnAll);

    // Per module
    for (const r of rows) {
      const iri = r.module;
      if (!iri) continue;

      const label = r.label || this.renderOpts.label?.(iri) || iri;

      const b = document.createElement("button");
      b.classList.add("tab");
      if (activeModuleIri === iri) b.classList.add("active");

      b.textContent = label;
      b.title = iri;

      b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();

        await this._renderModule(iri);
      });

      bar.appendChild(b);
    }
  }

  async _renderModule(iri) {
    this._activeModuleIri = iri;

    const tmpl = await this.qs.fetchQueryText(this.paths.q.visualizeByMod, {
      cache: "no-store",
      bust: true,
    });

    let q = tmpl;
    q = q.replaceAll("<{{MODULE_IRI}}>", `<${iri}>`);
    q = q.replaceAll("{{MODULE_IRI}}", `<${iri}>`);

    await this.runInline(q, null, { source: this.paths.q.visualizeByMod });
  }

  // Draw the current view again, after an update query changed the data.
  async _rerender() {
    if (this._activeModuleIri) {
      await this._renderModule(this._activeModuleIri);
    } else {
      await this.run(this.paths.q.visualize);
    }
  }

  _applyVisibility() {
    const root = this.rootEl;
    if (!root) return;

    const ctx = root.querySelector?.("#toggle-context");
    const df = root.querySelector?.("#toggle-defeat");

    const showCtx = ctx ? ctx.checked : true;
    const showDef = df ? df.checked : true;

    root.classList.toggle("hide-ctx", !showCtx);
    root.classList.toggle("hide-def", !showDef);

    this.graphCtl?.fit?.();
  }

  _reapplyOverlays() {
    if (!this.graphCtl) return;

    this.graphCtl.clearAll?.();

    for (const [cls, idSet] of this.overlays.entries()) {
      if (idSet && idSet.size > 0) {
        this.graphCtl.highlightByIds?.(Array.from(idSet), cls);
      }
    }
  }

  _wireGraphBus() {
    // Context click -> propagate context relation
    this._unsubs.push(
      this.bus.on("gsn:contextClick", async (ev) => {
        const iri = ev?.detail?.id;
        if (!iri || !this.graphCtl) return;

        const tmpl = await this.qs.fetchQueryText(this.paths.q.propCtx);
        const q = tmpl.replaceAll("{{CTX_IRI}}", `<${iri}>`);

        const { rows } = await this.qs.runText(q, { source: this.paths.q.propCtx });
        const ids = (rows ?? []).map((r) => r.nodeIRI).filter(Boolean);

        this.graphCtl?.clearAll?.();
        this.graphCtl?.highlightByIds?.(ids, "in-context");
      })
    );

    // Defeater click -> propagate defeated / challenged relation
    this._unsubs.push(
      this.bus.on("gsn:defeaterClick", async (ev) => {
        const iri = ev?.detail?.id;
        if (!iri || !this.graphCtl) return;

        const tmpl = await this.qs.fetchQueryText(this.paths.q.propDef);
        const q = tmpl.replaceAll("{{DFT_IRI}}", `<${iri}>`);

        const { rows } = await this.qs.runText(q, { source: this.paths.q.propDef });
        const ids = (rows ?? []).map((r) => r.hitIRI).filter(Boolean);

        this.graphCtl?.clearAll?.();
        this.graphCtl?.highlightByIds?.(ids, "def-prop");
      })
    );

    // External highlight command
    this._unsubs.push(
      this.bus.on("graph:highlight", (ev) => {
        const { ids = [], cls = "overlay", replace = true } = ev.detail || {};

        if (replace) {
          this.overlays.set(cls, new Set(ids));
        } else {
          const cur = this.overlays.get(cls) ?? new Set();
          ids.forEach((x) => cur.add(x));
          this.overlays.set(cls, cur);
        }

        if (this.graphCtl) {
          this._reapplyOverlays();
        }
      })
    );

    // External clear command
    this._unsubs.push(
      this.bus.on("graph:clearHighlights", () => {
        this.overlays.clear();
        this._reapplyOverlays();
      })
    );
  }

  _attachUI() {
    this._onDocClick = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const act = target.closest("[data-act]");
      if (act?.dataset?.act === "toggle-overlay") {
        const collapsed = this.rootEl.classList.toggle("gsn-overlay-collapsed");
        act.setAttribute("aria-expanded", String(!collapsed));
        act.title = collapsed ? "Show legend & rules" : "Hide legend & rules";
        return;
      }

      const btn = target.closest("[data-query]:not(input)");
      if (!btn) return;

      const path = btn.getAttribute("data-query");
      if (!path) return;

      void this.run(path);
    };

    this._onDocChange = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      // Visibility checkboxes
      if (target.matches("#toggle-context, #toggle-defeat")) {
        this._applyVisibility();
        return;
      }

      const el = target.closest('input[type="checkbox"][data-class]');
      if (!el) return;

      const cls = el.getAttribute("data-class") || "overlay";
      const raw = el.getAttribute("data-queries") ?? el.getAttribute("data-query");
      if (!raw) return;

      const paths = splitTokens(raw);
      if (!paths.length) return;

      const deletePath = el.getAttribute("data-delete-query");
      const eventName = el.getAttribute("data-event");
      const isOverloadRule = paths.some((p) => p.includes("propagate_overloadedCar.sparql"));

      if (el.checked) {
        void (async () => {
          let updated = false;
          for (const path of paths) {
            const res = await this.run(path, cls);
            if (res?.kind === "update") updated = true;
          }
          if (updated) await this._rerender();

          if (isOverloadRule) {
            emitCompat(this.bus, "car:overloadChanged", { active: true });
          }

          if (eventName) {
            emitCompat(this.bus, eventName, { active: true });
          }
        })();
      } else {
        void (async () => {
          if (deletePath) {
            await this.run(deletePath, cls);
          }

          this.overlays.set(cls, new Set());
          this._reapplyOverlays();

          if (deletePath) await this._rerender();

          if (cls === "collection") {
            this.graphCtl?.clearCollections?.();
          }

          if (isOverloadRule) {
            emitCompat(this.bus, "car:overloadChanged", { active: false });
          }

          if (eventName) {
            emitCompat(this.bus, eventName, { active: false });
          }
        })();
      }
    };

    this.rootEl.addEventListener("click", this._onDocClick);
    this.rootEl.addEventListener("change", this._onDocChange);
  }

  _beginBusy() {
    this._busyCount += 1;
    this._syncBusyUi();
  }

  _endBusy() {
    this._busyCount = Math.max(0, this._busyCount - 1);
    this._syncBusyUi();
  }

  _syncBusyUi() {
    const busy = this._busyCount > 0;

    document.body.toggleAttribute("aria-busy", busy);

    const scope = this.rootEl ?? document;
    const controls = scope.querySelectorAll("[data-query], [data-queries]");

    controls.forEach((el) => {
      el.toggleAttribute("disabled", busy);
    });
  }
}