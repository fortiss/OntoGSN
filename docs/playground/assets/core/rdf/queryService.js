import { fetchRepoText } from "@core/utils.js";
import { isUpdateQuery, bindingsToRows } from "@rdf/sparql.js";

/**
 * @typedef {Object} QueryResult
 * @property {"update"|"rows"} kind
 * @property {string} source
 * @property {string} queryText
 * @property {number} elapsedMs
 * @property {Array<Object>} [rows]
 */

/**
 * Create a small SPARQL service around an existing Oxigraph Store.
 * No DOM, no panes, no graph.
 */
export function createQueryService(store, {
  defaultFetch = { cache: "no-store", bust: true },
} = {}) {
  if (!store) throw new Error("createQueryService(store): store is required");

  const now = () => (globalThis.performance?.now?.() ?? Date.now());

  async function fetchQueryText(path, fetchOpts = {}) {
    return fetchRepoText(path, { ...defaultFetch, ...fetchOpts });
  }

  async function runText(queryText, { source = "inline" } = {}) {

    const t0 = now();

    if (isUpdateQuery(queryText)) {
      // Oxigraph update is sync today, but keep `await` for safety/future.
      await store.update(queryText);
      return /** @type {QueryResult} */ ({
        kind: "update",
        source,
        queryText,
        elapsedMs: now() - t0,
      });
    }

    const iter = store.query(queryText);
    const rows = bindingsToRows(iter);

    return /** @type {QueryResult} */ ({
      kind: "rows",
      source,
      queryText,
      rows,
      elapsedMs: now() - t0,
    });
  }

  async function runPath(path, fetchOpts = {}) {
    const queryText = await fetchQueryText(path, fetchOpts);
    return runText(queryText, { source: path });
  }

  return { fetchQueryText, runText, runPath };
}