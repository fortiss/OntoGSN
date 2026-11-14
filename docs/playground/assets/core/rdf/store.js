import init, { Store } from "https://cdn.jsdelivr.net/npm/oxigraph@0.5.2/web.js";
import { MIME_TTL, DATASETS } from "@rdf/config.js";
import { fetchRepoText } from "@core/utils.js";

let _store = null;
let _initPromise = null;

async function fetchTTL(pathOrUrl, { cache = "no-store", bust = true } = {}) {
  const txt = await fetchRepoText(pathOrUrl, { cache, bust });

  const first = txt.split(/\r?\n/).find(l => l.trim().length) || "";
  if (first.startsWith("<!")) {
    throw new Error(`Got HTML instead of Turtle from ${pathOrUrl}. Check the path.`);
  }
  return txt;
}

export async function initStore({ cache = "no-store", bust = true } = {}) {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    await init();
    const store = new Store();

    for (const ds of DATASETS) {
      const ttl = await fetchTTL(ds.path, { cache, bust });
      try {
        store.load(ttl, MIME_TTL, ds.base);
      } catch (e) {
        const preview = ttl.slice(0, 300);
        throw new Error(
          `Parse error while loading TTL from ${ds.path}: ${e?.message || e}\n\nPreview:\n${preview}`
        );
      }
    }

    _store = store;
    return store;
  })();

  return _initPromise;
}

export function getStore() {
  if (!_store) throw new Error("Store not initialized. Call initStore() first.");
  return _store;
}

// Optional dev helper (only use if you need hot-reload reset)
export function _resetStoreForDev() { _store = null; _initPromise = null; }
