import { initStore } from "@rdf/store.js";
import { createQueryService } from "@rdf/queryService.js";

class QueriesApp {
  constructor() {
    this.store = null;
    this.qs = null;
    this._initPromise = null;
  }

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      this.store = await initStore();
      this.qs = createQueryService(this.store);
    })();
    return this._initPromise;
  }

  // Convenience: run a query file and get a QueryResult back (rows/update)
  async runPath(queryPath, fetchOpts = { cache: "no-store", bust: true }) {
    await this.init();
    return this.qs.runPath(queryPath, fetchOpts);
  }

  // Convenience: run inline query text and get a QueryResult back (rows/update)
  async runText(queryText, { source = "inline" } = {}) {
    await this.init();
    return this.qs.runText(queryText, { source });
  }

  // Backwards-compat aliases (in case any pane still calls app.run / app.runInline)
  // NOTE: graph rendering / overlays are now handled by graph.js, so these return results only.
  async run(queryPath, _overlayClass = null, fetchOpts = { cache: "no-store", bust: true }) {
    return this.runPath(queryPath, fetchOpts);
  }

  async runInline(queryText, _overlayClass = null, opts = {}) {
    return this.runText(queryText, { source: "inline", ...opts });
  }

  // Keep this exactly (Table/Editor panes often want raw binding terms)
  async selectBindings(queryText) {
    await this.init();

    const q = String(queryText || "").trim();
    const res = this.store.query(q);

    const rows = [];
    for (const binding of res) {
      const row = {};
      for (const [name, term] of binding) {
        row[name] = { value: term.value, term };
      }
      rows.push(row);
    }
    return rows;
  }
}

export default new QueriesApp();
