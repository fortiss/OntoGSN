class PaneManager {
  constructor() {
    /** @type {HTMLElement|null} */
    this.leftPane = null;
    /** @type {HTMLElement|null} */
    this.rightPane = null;

    /** @type {{id:string, controller:any}|null} */
    this.currentRight = null;

    /** @type {((ev:UIEvent)=>void)|null} */
    this._resizeHandler = null;

    // --- left-side tabs/panes --------------------------------------------
    this._leftTabsInit = false;
    /** @type {HTMLButtonElement[]} */
    this._leftTabs = [];
    /** @type {HTMLElement[]} */
    this._leftPanes = [];
    /** @type {Record<string,string>} tab-id → pane-id */
    this._tabToPane = {
      "tab-welcome":    "welcome-root",
      "tab-table":      "results",
      "tab-editor":     "editor-root",
      "tab-doc":        "doc-root",
      "tab-code":       "code-root",
      "tab-converter":  "converter-root",
      "tab-chat":       "chat-root"
    };
  }

  // --- DOM helpers -------------------------------------------------------
  getLeftPane() {
    if (this.leftPane && document.body.contains(this.leftPane)) {
      return this.leftPane;
    }
    this.leftPane = document.getElementById("leftPane");
    if (!this.leftPane) {
      console.warn("[PaneManager] #leftPane not found");
    }
    return this.leftPane;
  }

  getRightPane() {
    if (this.rightPane && document.body.contains(this.rightPane)) {
      return this.rightPane;
    }
    this.rightPane =
      document.getElementById("rightPane") ||
      // fallback for older markup
      document.getElementById("graph") ||
      document.querySelector(".gsn-host");

    if (!this.rightPane) {
      console.warn("[PaneManager] #rightPane / .gsn-host not found");
    }
    return this.rightPane;
  }

  // --- Left pane: tabs + content ----------------------------------------

  /**
   * Initialise left-side tab behaviour (Table / Editor / Document / Code / Converter).
   * Safe to call multiple times; later calls are ignored.
   */
  initLeftTabs() {
    if (this._leftTabsInit) return;
    this._leftTabsInit = true;

    // All tab buttons (top-left bar). We intentionally don't rely on #leftButtons,
    // because there is a second "Rules" block later.
    const leftButtons = document.getElementById("leftButtons");
    const tabs = leftButtons
      ? Array.from(leftButtons.querySelectorAll(".tab"))
      : [];
    if (!tabs.length) {
      console.warn("[PaneManager] No .tab buttons found for left panes.");
      return;
    }
    this._leftTabs = tabs;

    // Collect pane elements that actually exist in the DOM
    const paneIds = Object.values(this._tabToPane);
    this._leftPanes = paneIds
      .map(id => document.getElementById(id))
      .filter(Boolean);

    const activate = (tabId) => {
      if (!tabId) tabId = "tab-table";

      // Toggle active class on tab buttons
      this._leftTabs.forEach(btn => {
        btn.classList.toggle("active", btn.id === tabId);
      });

      const targetPaneId = this._tabToPane[tabId];

      // Show only the pane mapped from tabId; hide others
      this._leftPanes.forEach(p => {
        if (!p) return;
        p.style.display = (p.id === targetPaneId ? "" : "none");
      });
    };

    // Store activator for external callers (document.js, etc.)
    this._activateLeftTab = activate;

    // Wire click handlers for all tab buttons
    this._leftTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.id;
        if (!this._tabToPane[id]) {
          // Not one of the managed tabs; ignore
          return;
        }
        this.activateLeftTab(id);
      });
    });

    // Initial active tab: whichever already has .active, or fallback to Table
    const initiallyActive =
      tabs.find(b => b.classList.contains("active"))?.id ||
      "tab-table";
    if (this._tabToPane[initiallyActive]) {
      activate(initiallyActive);
    }
  }

  /**
   * Public helper for other modules: activate a given left tab
   * (and therefore hide all other left panes).
   */
  activateLeftTab(tabId) {
    if (!this._leftTabsInit) {
      this.initLeftTabs();
    }
    if (typeof this._activateLeftTab === "function") {
      this._activateLeftTab(tabId);
    }
  }

  // --- Right pane controller lifecycle -----------------------------------
  setRightController(id, controller) {
    // Tear down any existing controller first
    this._teardownRight();

    this.currentRight = { id, controller };

    // Expose for console debugging, if you like
    if (controller) {
      window.graphCtl = controller;
    } else {
      window.graphCtl = null;
    }

    // Wire up auto-resize if the controller supports it
    if (controller && typeof controller.fit === "function") {
      this._resizeHandler = () => {
        try {
          controller.fit();
        } catch (e) {
          console.warn("[PaneManager] controller.fit() failed:", e);
        }
      };
      window.addEventListener("resize", this._resizeHandler);
    }
  }

  clearRightPane() {
    this._teardownRight();
  }

  _teardownRight() {
    const current = this.currentRight;
    this.currentRight = null;

    if (this._resizeHandler) {
      window.removeEventListener("resize", this._resizeHandler);
      this._resizeHandler = null;
    }

    if (current && current.controller && typeof current.controller.destroy === "function") {
      try {
        current.controller.destroy();
      } catch (e) {
        console.warn("[PaneManager] controller.destroy() failed:", e);
      }
    }

    if (window.graphCtl) {
      window.graphCtl = null;
    }
  }
}

function wireTabGroups() {
  document.querySelectorAll('[data-tab-group]').forEach(group => {
    group.addEventListener('click', (event) => {
      const button = event.target.closest('button.tab');
      if (!button || !group.contains(button)) return;

      // Optional: ignore disabled buttons
      if (button.disabled) return;

      // Remove .active from all tabs in THIS group…
      group.querySelectorAll('button.tab.active')
           .forEach(b => b.classList.remove('active'));

      // …and add it to the clicked one
      button.classList.add('active');
    });
  });
}

window.addEventListener('DOMContentLoaded', wireTabGroups);


export const panes = new PaneManager();
export default panes;
