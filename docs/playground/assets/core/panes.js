import { bus } from "@core/events.js";
import { firstEl, resolveEl, safeInvoke } from "@core/utils.js";

class PaneManager {
  constructor() {
    this.leftPane = null;
    this.rightPane = null;

    this.currentRight = null;
    this._resizeHandler = null;
    this.bus = null;

    this._leftTabsInit = false;
    this._rightTabsInit = false;

    this._leftTabs = [];
    this._rightTabs = [];
    this._leftPanes = [];
    this._rightPanes = [];

    this._activateLeftTab = null;
    this._activateRightTab = null;

    this._loadingUI = {
      left: { wrap: null, text: null, seq: 0 },
      right: { wrap: null, text: null, seq: 0 },
    };

    this.ctx = {};
    this._paneDefs = { left: new Map(), right: new Map() };
    this._paneState = { left: new Map(), right: new Map() };
    this._activePaneId = { left: null, right: null };
    this._activateSeq = { left: 0, right: 0 };
  }

  setContext(ctx) {
    this.ctx = { ...(this.ctx || {}), ...(ctx || {}) };
  }

  registerPane(slot, paneId, loader, { cache = true } = {}) {
    this._paneDefs[slot]?.set(paneId, { loader, cache });
  }

  async _deactivatePane(slot, paneId) {
    if (!paneId) return;

    const state = this._paneState[slot].get(paneId);
    if (!state) return;

    const def = this._paneDefs[slot].get(paneId);

    const shouldUnmount = (def && def.cache === false);

    try {
      if (state.mod?.suspend) {
        await state.mod.suspend({ ...this.ctx, bus: this.bus, panes: this, slot, paneId });
      }

      if (shouldUnmount) {
        if (typeof state.cleanup === "function") {
          state.cleanup();
        } else if (state.mod?.unmount) {
          await state.mod.unmount({ ...this.ctx, bus: this.bus, panes: this, slot, paneId });
        }
      }
    } catch (e) {
      console.warn(`[PaneManager] deactivate failed for ${slot}:${paneId}`, e);
    }

    if (shouldUnmount) {
      state.cleanup = null;
      state.mounted = false;

      this._paneState[slot].delete(paneId);
    } else {

      this._paneState[slot].set(paneId, state);
    }
  }

  async _activatePane(slot, paneId, payload) {
    if (!paneId) return;

    const seq = ++this._activateSeq[slot];

    if (this._activePaneId[slot] === paneId) {
      const state = this._paneState[slot].get(paneId);
      if (state?.mod?.resume) {
        try { await state.mod.resume({ ...this.ctx, bus: this.bus, panes: this, slot, paneId, payload }); } catch { }
      }
      return;
    }

    const prev = this._activePaneId[slot];
    this._activePaneId[slot] = paneId;
    await this._deactivatePane(slot, prev);

    if (seq !== this._activateSeq[slot]) return;

    const def = this._paneDefs[slot].get(paneId);
    if (!def?.loader) return;

    let state = this._paneState[slot].get(paneId) || { mod: null, cleanup: null, mounted: false };

    const label = payload?.label || payload?.view || paneId;
    this._showLoading(slot, label, seq);

    try {
      if (!state.mod) {
        state.mod = await def.loader();
      }

      const root = document.getElementById(paneId);
      if (!root) {
        console.warn(`[PaneManager] pane root #${paneId} not found`);
        return;
      }

      if (!state.mounted && state.mod?.mount) {
        const cleanup = await state.mod.mount({
          ...this.ctx, bus: this.bus, panes: this, slot, paneId, root, payload
        });
        state.cleanup = (typeof cleanup === "function") ? cleanup : null;
        state.mounted = true;
      } else if (state.mod?.resume) {
        await state.mod.resume({
          ...this.ctx, bus: this.bus, panes: this, slot, paneId, root, payload
        });
      }

      this._paneState[slot].set(paneId, state);

    } catch (e) {
      console.error(`[PaneManager] mount failed for ${slot}:${paneId}`, e);

    } finally {
      if (seq === this._activateSeq[slot] && this._activePaneId[slot] === paneId) {
        this._hideLoading(slot, seq);
      }
    }
    this._paneState[slot].set(paneId, state);
  }

  _ensureLoadingUI(slot) {
    const ui = this._loadingUI?.[slot];
    if (!ui) return null;

    const host = (slot === "left") ? this.getLeftPane() : this.getRightPane();
    if (!host) return null;

    if (!ui.wrap || !host.contains(ui.wrap)) {
      const wrap = document.createElement("div");
      wrap.className = "pane-loading";
      wrap.hidden = true;

      const inner = document.createElement("div");
      inner.className = "pane-loading-inner";

      const spinner = document.createElement("div");
      spinner.className = "pane-spinner";
      spinner.setAttribute("aria-hidden", "true");

      const text = document.createElement("div");
      text.className = "pane-loading-text";
      text.textContent = "Loading pane ...";

      inner.appendChild(spinner);
      inner.appendChild(text);
      wrap.appendChild(inner);

      host.appendChild(wrap);

      ui.wrap = wrap;
      ui.text = text;
    }

    return ui;
  }

  _showLoading(slot, label, seq) {
    const ui = this._ensureLoadingUI(slot);
    if (!ui) return;

    ui.seq = seq;
    if (ui.text) ui.text.textContent = `Loading ${label || "pane"} pane ...`;
    ui.wrap.hidden = false;
  }

  _hideLoading(slot, seq) {
    const ui = this._loadingUI?.[slot];
    if (!ui?.wrap) return;

    if (seq && ui.seq !== seq) return;

    ui.wrap.hidden = true;
  }

  // --- DOM helpers -------------------------------------------------------
  getLeftPane() {
    if (this.leftPane && document.body.contains(this.leftPane)) return this.leftPane;
    this.leftPane = resolveEl("#leftPane", { required: false, name: "PaneManager leftPane" });
    if (!this.leftPane) console.warn("[PaneManager] #leftPane not found");
    return this.leftPane;
  }

  getRightPane(viewOrPaneId = null) {
    const root =
      (this.rightPane && document.body.contains(this.rightPane))
        ? this.rightPane
        : (this.rightPane = firstEl(["#rightPane", "#graph", ".gsn-host"]));

    if (!root) {
      console.warn("[PaneManager] #rightPane / .gsn-host not found");
      return null;
    }

    if (!viewOrPaneId) return root;

    const tryIds = [
      `#${viewOrPaneId}`,
      `#${viewOrPaneId}-root`,
    ];

    return firstEl(tryIds, { root }) ?? root;

  }

  setBus(bus) { this.bus = bus || null; }
  getRightController() { return this.currentRight?.controller ?? null; }

  // --- Shared tab wiring --------------------------------------------------
  _initTabGroup({
    groupName,
    slot,
    paneDefaultSelector = null
  }) {
    const groupEl = document.querySelector(`[data-tab-group="${groupName}"]`);

    const allButtons = groupEl ? Array.from(groupEl.querySelectorAll("button.tab")) : [];
    const tabs = allButtons.filter((btn) => {
      if (btn.dataset.tabIgnore) return false;
      // only treat "real tabs" as tabs (must map to a pane/view)
      return !!(btn.dataset.pane || btn.dataset.view || (paneDefaultSelector ? paneDefaultSelector(btn) : null));
    });


    if (!tabs.length) {
      console.warn(`[PaneManager] No ${slot} tab buttons found.`);
      return { tabs: [], panes: [], activate: () => { } };
    }

    const paneIdOf = (btn) => {
      const raw =
        btn.dataset.pane ||
        btn.dataset.view ||
        (paneDefaultSelector ? paneDefaultSelector(btn) : null);

      if (!raw) return null;

      if (document.getElementById(raw)) return raw;
      const rootId = `${raw}-root`;
      if (document.getElementById(rootId)) return rootId;

      return raw;
    };

    // --- optional dropdown wiring for this tab group --------------------------
    const dropdown = groupEl?.querySelector("[data-dropdown]");
    const ddTrigger = dropdown?.querySelector("[data-dropdown-trigger]");
    const ddMenu = dropdown?.querySelector("[data-dropdown-menu]");
    const ddLabel = dropdown?.querySelector("[data-dropdown-label]");

    const ddOpen = () => {
      if (!dropdown || !ddTrigger || !ddMenu) return;
      ddMenu.hidden = false;
      ddTrigger.setAttribute("aria-expanded", "true");
      dropdown.classList.add("open");
    };

    const ddClose = () => {
      if (!dropdown || !ddTrigger || !ddMenu) return;
      ddMenu.hidden = true;
      ddTrigger.setAttribute("aria-expanded", "false");
      dropdown.classList.remove("open");
    };

    const ddToggle = () => {
      if (!ddMenu) return;
      ddMenu.hidden ? ddOpen() : ddClose();
    };

    const ddSetLabel = (btn) => {
      if (!ddLabel || !btn) return;
      ddLabel.textContent = ((btn.dataset.label || btn.textContent || "").trim() || "Select");
    };

    if (ddTrigger && ddMenu && dropdown) {
      ddTrigger.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ddToggle();
      });

      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) ddClose();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") ddClose();
      });
    }


    const paneIds = tabs.map(paneIdOf).filter(Boolean);
    const panes = paneIds
      .map(id => document.getElementById(id))
      .filter(Boolean);

    const showOnlyPaneId = (targetId) => {
      if (!targetId || !panes.length) return;
      panes.forEach(p => { p.hidden = (p.id !== targetId); });
    };

    const emitPayload = (btn, paneId) => ({
      slot,
      tabId: btn.id || null,
      view: btn.dataset.view || null,
      paneId: paneId || null,
      label: (btn.dataset.label || btn.textContent || "").trim() || paneId || null,
      query: btn.dataset.query || null,
      docQuery: btn.dataset.docQuery || null,
      docVar: btn.dataset.docVar || null,
    });

    const activate = (btnOrId) => {
      const btn = (typeof btnOrId === "string")
        ? tabs.find(b => b.id === btnOrId)
        : btnOrId;

      const b = btn || tabs[0];
      if (!b) return Promise.resolve(null);

      tabs.forEach(x => x.classList.toggle("active", x === b));

      ddSetLabel?.(b);
      ddClose?.();

      const paneId = paneIdOf(b);
      showOnlyPaneId(paneId);

      const payload = emitPayload(b, paneId);

      console.log("[PaneManager] activating", { slot, paneId, tabId: b.id, label: b.textContent });

      return Promise.resolve(this._activatePane(slot, paneId, payload))
        .then(() => {
          safeInvoke(this.bus, "emit", `${slot}:tab`, payload);
          safeInvoke(this.bus, "emit", "pane:tab", payload);
          return payload;
        })
        .catch((e) => {
          console.error(`[PaneManager] activatePane failed ${slot}:${paneId}`, e);
          return null;
        });
    };

    tabs.forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        void activate(btn);
      });
    });

    const initiallyActive = tabs.find(b => b.classList.contains("active")) || tabs[0];
    void activate(initiallyActive);

    return { tabs, panes, activate };
  }

  // --- Left pane ----------------------------------------------------------
  initLeftTabs() {
    if (this._leftTabsInit) return;
    this._leftTabsInit = true;

    const { tabs, panes, activate } = this._initTabGroup({
      groupName: "left-main",
      slot: "left",
    });

    this._leftTabs = tabs;
    this._leftPanes = panes;
    this._activateLeftTab = activate;
  }

  activateLeftTab(tabId) {
    if (!this._leftTabsInit) this.initLeftTabs();
    return this._activateLeftTab?.(tabId);
  }

  // --- Right pane ---------------------------------------------------------
  initRightTabs() {
    if (this._rightTabsInit) return;
    this._rightTabsInit = true;

    const { tabs, panes, activate } = this._initTabGroup({
      groupName: "right-main",
      slot: "right",
    });

    this._rightTabs = tabs;
    this._rightPanes = panes;
    this._activateRightTab = activate;
  }

  activateRightTab(tabId) {
    if (!this._rightTabsInit) this.initRightTabs();
    return this._activateRightTab?.(tabId);
  }

  // --- Right pane controller lifecycle -----------------------------------
  setRightController(id, controller) {
    this._teardownRight();
    this.currentRight = { id, controller };

    safeInvoke(this.bus, "emit", "right:controllerChanged", { id, controller });
    if (id === "graph" || id === "gsn-graph") {
      safeInvoke(this.bus, "emit", "graph:ready", { controller });
    }

    if (controller && typeof controller.fit === "function") {
      this._resizeHandler = () => safeInvoke(controller, "fit");
      window.addEventListener("resize", this._resizeHandler);
    }
  }

  clearRightPane() { this._teardownRight(); }

  _teardownRight() {
    const current = this.currentRight;
    this.currentRight = null;

    safeInvoke(this.bus, "emit", "right:controllerChanged", { id: null, controller: null });

    if (this._resizeHandler) {
      window.removeEventListener("resize", this._resizeHandler);
      this._resizeHandler = null;
    }

    safeInvoke(current?.controller, "destroy");
  }
}

export const panes = new PaneManager();
panes.setBus(bus);
export default panes;
