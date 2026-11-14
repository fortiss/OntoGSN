import app from "@core/queries.js";
import { bus as coreBus } from "@core/events.js";

import {
  mountTemplate,
  resolveEl,
  fetchRepoText,
  fetchRepoTextCached,
  shortenIri,
  safeInvoke,
  splitTokens,
  applyTemplate,
  asBool,
  asBoolText,
  pickBindingValue,
  sparqlIri
} from "@core/utils.js";

const HTML = new URL("./checklist.html", import.meta.url);
const CSS  = new URL("./checklist.css",  import.meta.url);

const GOALS_QUERY_PATH   = "data/queries/read_goalsForChecklist.sparql";
const PARENTS_QUERY_PATH = "data/queries/read_goalParentsForChecklist.sparql";
const UPDATE_DONE_PATH   = "data/queries/update_doneForChecklist.sparql";

// --- UI persistence --------------------------------------------------------
const COLLAPSE_KEY = "ontogsn_checklist_collapsed_v1";

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed(set) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(set)));
  } catch { /* ignore */ }
}

// --- module state ----------------------------------------------------------
let _root = null;
let _bus = null;

let _listEl = null;
let _emptyEl = null;
let _statsEl = null;

let _searchEl = null;
let _refreshEl = null;
let _clearEl = null;

let _items = [];
let _state = {};

let _collapsed = new Set();
let _parentOf = new Map();
let _childrenOf = new Map();

let _rerender = null;
let _refresh = null;

let _cleanup = null;

// --- data normalization ----------------------------------------------------
function normalizeItem(row) {
  const goal = pickBindingValue(row, "goal", "");
  const kind = (pickBindingValue(row, "kind", "") || "").trim(); // "Goal" | "Solution"
  const id   = pickBindingValue(row, "id", "") || shortenIri(goal);
  const stmt = pickBindingValue(row, "stmt", "") || "";

  const valid       = asBoolText(pickBindingValue(row, "valid", ""));
  const undeveloped = asBoolText(pickBindingValue(row, "undeveloped", ""));
  const supportedBy = pickBindingValue(row, "supportedBy", "");
  const modules     = pickBindingValue(row, "modules", "");

  const doneRaw = pickBindingValue(row, "done", null);
  const done    = asBool(doneRaw) ?? false;

  const displayId = `${(modules && modules.trim()) ? modules.trim() : "—"}: ${id}`;

  return { goal, kind, id, displayId, modules, stmt, valid, undeveloped, supportedBy, done };
}

async function getUpdateDoneTemplate() {
  return fetchRepoTextCached(UPDATE_DONE_PATH, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });
}

async function updateDoneInStore(goalIri, doneBool) {
  await app.init();

  const subj = sparqlIri(goalIri);
  if (!subj) throw new Error("updateDoneInStore: missing goal IRI");

  const lit = doneBool
    ? `"true"^^<http://www.w3.org/2001/XMLSchema#boolean>`
    : `"false"^^<http://www.w3.org/2001/XMLSchema#boolean>`;

  const tpl = await getUpdateDoneTemplate();
  const update = applyTemplate(tpl, { SUBJ: subj, LIT: lit }).trim();

  await app.store.update(update);
}

// --- filtering -------------------------------------------------------------
function matchesFilter(item, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    item.displayId.toLowerCase().includes(s) ||
    item.modules.toLowerCase().includes(s) ||
    item.id.toLowerCase().includes(s) ||
    item.stmt.toLowerCase().includes(s) ||
    item.goal.toLowerCase().includes(s) ||
    (item.supportedBy || "").toLowerCase().includes(s)
  );
}

// --- selection -------------------------------------------------------------
function emitSelect(goalIri) {
  safeInvoke(_bus, "emit", "checklist:select", { iri: goalIri });
  window.dispatchEvent(new CustomEvent("checklist:select", { detail: { iri: goalIri } }));
}

// --- queries ---------------------------------------------------------------
async function queryGoals() {
  await app.init();
  const queryText = await fetchRepoText(GOALS_QUERY_PATH, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });
  const bindings = await app.selectBindings(queryText);
  return (bindings || []).map(normalizeItem).filter(x => x.goal);
}

async function queryGoalParents() {
  await app.init();
  const queryText = await fetchRepoText(PARENTS_QUERY_PATH, {
    from: import.meta.url,
    upLevels: 2,
    cache: "no-store",
    bust: true
  });

  const bindings = await app.selectBindings(queryText);
  const parentsByChild = new Map();

  for (const row of (bindings || [])) {
    const child = pickBindingValue(row, "child", "");
    const parentsRaw = pickBindingValue(row, "parents", "");
    if (!child) continue;
    parentsByChild.set(child, splitTokens(parentsRaw));
  }

  return parentsByChild;
}

function applyHierarchy(rawItems, parentsByChild) {
  const items = Array.from(rawItems || []);
  const byIri = new Map(items.map(it => [it.goal, it]));

  const sortKey = (it) => {
    const m = String(it?.modules ?? "").toLowerCase();
    const id = String(it?.id ?? "").toLowerCase();
    const iri = String(it?.goal ?? "");
    return `${m}|||${id}|||${iri}`;
  };

  const primaryParent = new Map(); // childIri -> parentIri|null

  for (const it of items) {
    const parents = (parentsByChild.get(it.goal) || [])
      .filter(p => byIri.has(p) && p !== it.goal);

    if (!parents.length) {
      primaryParent.set(it.goal, null);
      continue;
    }

    parents.sort((a, b) => {
      const ka = sortKey(byIri.get(a)) || a;
      const kb = sortKey(byIri.get(b)) || b;
      return ka.localeCompare(kb);
    });

    primaryParent.set(it.goal, parents[0]);
  }

  const childrenOf = new Map(); // parentIri -> childIri[]
  for (const [child, parent] of primaryParent.entries()) {
    if (!parent) continue;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(child);
  }

  for (const [p, arr] of childrenOf.entries()) {
    arr.sort((a, b) => sortKey(byIri.get(a)).localeCompare(sortKey(byIri.get(b))));
    childrenOf.set(p, arr);
  }

  const roots = items
    .filter(it => !primaryParent.get(it.goal))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const ordered = [];
  const visited = new Set();
  const stack = new Set();

  function dfs(goalIri, depth) {
    if (!goalIri || visited.has(goalIri)) return;
    if (stack.has(goalIri)) return;

    const it = byIri.get(goalIri);
    if (!it) return;

    stack.add(goalIri);
    visited.add(goalIri);

    it.depth = depth;
    ordered.push(it);

    const kids = childrenOf.get(goalIri) || [];
    for (const k of kids) dfs(k, depth + 1);

    stack.delete(goalIri);
  }

  for (const r of roots) dfs(r.goal, 0);

  const leftovers = items
    .filter(it => !visited.has(it.goal))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  for (const it of leftovers) {
    it.depth = 0;
    ordered.push(it);
  }

  return { ordered, parentOf: primaryParent, childrenOf };
}

// --- collapse helpers ------------------------------------------------------
function isHiddenByCollapse(goalIri, parentOf = new Map(), collapsed = new Set()) {
  let p = parentOf.get(goalIri);
  while (p) {
    if (collapsed.has(p)) return true;
    p = parentOf.get(p);
  }
  return false;
}

function computeTriState(items, childrenOf, state) {
  const tri = new Map();

  for (let i = (items?.length ?? 0) - 1; i >= 0; i--) {
    const iri = items[i]?.goal;
    if (!iri) continue;

    const kids = childrenOf?.get?.(iri) || [];
    if (!kids.length) {
      const on = !!state[iri];
      tri.set(iri, { all: on, some: on });
      continue;
    }

    let all = true;
    let some = false;

    for (const k of kids) {
      const kt = tri.get(k) || { all: !!state[k], some: !!state[k] };
      all = all && kt.all;
      some = some || kt.some;
    }

    tri.set(iri, { all, some });
  }

  return tri;
}

function collectDescendants(rootIri, childrenOf) {
  const out = [];
  const stack = [rootIri];
  const seen = new Set();

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);

    const kids = childrenOf?.get?.(cur) || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }

  return out;
}

// --- rendering -------------------------------------------------------------
function renderList(listEl, emptyEl, statsEl, items, state, filterText, {
  collapsed,
  parentOf,
  childrenOf
} = {}) {
  const q = (filterText || "").trim();

  const visible = (items || []).filter(it => {
    if (!matchesFilter(it, q)) return false;

    // normal mode: collapse hides descendants
    // filter mode: show matches regardless of collapse
    if (!q) return !isHiddenByCollapse(it.goal, parentOf, collapsed);
    return true;
  });

  const tri = computeTriState(items, childrenOf, state);
  const isLeaf = (iri) => ((childrenOf?.get?.(iri) || []).length === 0);

  const leafTotal = visible.reduce((n, it) => n + (isLeaf(it.goal) ? 1 : 0), 0);
  const leafDone  = visible.reduce((n, it) => n + (isLeaf(it.goal) && state[it.goal] ? 1 : 0), 0);
  const fullDone  = visible.reduce((n, it) => n + (tri.get(it.goal)?.all ? 1 : 0), 0);

  if (statsEl) {
    statsEl.textContent = leafTotal
      ? `${leafDone} / ${leafTotal} leaves done • ${fullDone} / ${visible.length} nodes complete`
      : `0 / 0 leaves done`;
  }

  if (!listEl) return;
  listEl.replaceChildren();

  if (!visible.length) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const frag = document.createDocumentFragment();

  for (const it of visible) {
    const row = document.createElement("div");
    row.className = "chk-row";
    row.setAttribute("role", "listitem");
    row.style.setProperty("--depth", String(it.depth ?? 0));

    const kids = childrenOf?.get?.(it.goal) || [];
    const hasKids = kids.length > 0;
    const isCollapsed = collapsed?.has?.(it.goal);

    row.classList.toggle("is-collapsed", hasKids && !!isCollapsed);

    // twisty
    let twisty;
    if (hasKids) {
      twisty = document.createElement("button");
      twisty.type = "button";
      twisty.className = "chk-twisty";
      twisty.textContent = isCollapsed ? "▸" : "▾";
      twisty.title = isCollapsed ? "Expand" : "Collapse";
      twisty.setAttribute("aria-label", isCollapsed ? "Expand" : "Collapse");

      twisty.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (collapsed.has(it.goal)) collapsed.delete(it.goal);
        else collapsed.add(it.goal);

        saveCollapsed(collapsed);
        renderList(listEl, emptyEl, statsEl, items, state, q, { collapsed, parentOf, childrenOf });
      });
    } else {
      twisty = document.createElement("span");
      twisty.className = "chk-twisty chk-twisty--empty";
      twisty.textContent = "▾";
    }

    const cb = document.createElement("input");
    cb.type = "checkbox";
    const t = tri.get(it.goal) || { all: !!state[it.goal], some: !!state[it.goal] };

    cb.checked = !!t.all;
    cb.indeterminate = !t.all && !!t.some;

    cb.addEventListener("change", async () => {
      const next = cb.checked;
      cb.disabled = true;

      const targets = hasKids ? collectDescendants(it.goal, childrenOf) : [it.goal];

      try {
        for (const iri of targets) {
          await updateDoneInStore(iri, next);
          state[iri] = next;
        }
      } catch (e) {
        console.error("[Checklist] failed to update xyz:done:", e);
      } finally {
        cb.disabled = false;
        renderList(listEl, emptyEl, statsEl, items, state, q, { collapsed, parentOf, childrenOf });
      }
    });

    const id = document.createElement("div");
    id.className = "chk-id";
    id.textContent = it.displayId || (it.id || shortenIri(it.goal));

    const main = document.createElement("div");
    main.className = "chk-main";

    const stmt = document.createElement("div");
    stmt.className = "chk-stmt";
    stmt.textContent = it.stmt || "";

    const meta = document.createElement("div");
    meta.className = "chk-meta";

    if (it.kind) {
      const b = document.createElement("span");
      b.className = "chk-badge";
      b.textContent = `kind: ${it.kind}`;
      meta.appendChild(b);
    }
    if (it.valid) {
      const b = document.createElement("span");
      b.className = "chk-badge";
      b.textContent = `valid: ${it.valid}`;
      meta.appendChild(b);
    }
    if (it.undeveloped) {
      const b = document.createElement("span");
      b.className = "chk-badge";
      b.textContent = `undeveloped: ${it.undeveloped}`;
      meta.appendChild(b);
    }
    if (it.supportedBy) {
      const b = document.createElement("span");
      b.className = "chk-badge";
      b.textContent = `supportedBy: ${it.supportedBy}`;
      meta.appendChild(b);
    }

    if (meta.childNodes.length) main.appendChild(meta);
    main.insertBefore(stmt, meta.childNodes.length ? meta : null);

    row.addEventListener("click", (ev) => {
      if (ev.target === cb) return;
      if (twisty && twisty.contains(ev.target)) return;
      emitSelect(it.goal);
    });

    row.appendChild(twisty);
    row.appendChild(cb);
    row.appendChild(id);
    row.appendChild(main);

    frag.appendChild(row);
  }

  listEl.appendChild(frag);
}

// --- PaneManager lifecycle exports ----------------------------------------

export async function mount({ root, bus }) {
  _root = root;
  _bus = bus || coreBus;

  await mountTemplate(root, {
    templateUrl: HTML,
    cssUrl: CSS,
    cache: "no-store",
    bust: true,
    replace: true
  });

  _listEl  = resolveEl("#checklist-list",  { root, required: false });
  _emptyEl = resolveEl("#checklist-empty", { root, required: false });
  _statsEl = resolveEl("#checklist-stats", { root, required: false });

  _searchEl  = resolveEl("#checklist-search",  { root, required: false });
  _refreshEl = resolveEl("#checklist-refresh", { root, required: false });
  _clearEl   = resolveEl("#checklist-clear",   { root, required: false });

  _collapsed = loadCollapsed();
  _items = [];
  _state = {};
  _parentOf = new Map();
  _childrenOf = new Map();

  _rerender = () => {
    const q = (_searchEl?.value ?? "").trim();
    renderList(_listEl, _emptyEl, _statsEl, _items, _state, q, {
      collapsed: _collapsed,
      parentOf: _parentOf,
      childrenOf: _childrenOf
    });
  };

  _refresh = async () => {
    try {
      getUpdateDoneTemplate().catch(() => {});

      const [raw, parentsByChild] = await Promise.all([
        queryGoals(),
        queryGoalParents()
      ]);

      const h = applyHierarchy(raw, parentsByChild);
      _items = h.ordered;
      _parentOf = h.parentOf;
      _childrenOf = h.childrenOf;

      // prune collapsed items that no longer exist
      const present = new Set(_items.map(it => it.goal));
      _collapsed = new Set(Array.from(_collapsed).filter(iri => present.has(iri)));
      saveCollapsed(_collapsed);

      _state = {};
      for (const it of _items) _state[it.goal] = !!it.done;

      _rerender();
    } catch (e) {
      console.error("[Checklist] refresh failed:", e);
      if (_statsEl) _statsEl.textContent = `Error: ${e?.message || String(e)}`;
      if (_listEl) _listEl.replaceChildren();
      if (_emptyEl) _emptyEl.hidden = true;
    }
  };

  const onRefreshClick = (ev) => {
    ev.preventDefault();
    _refresh?.();
  };

  const onClearClick = async (ev) => {
    ev.preventDefault();

    for (const it of _items) {
      try { await updateDoneInStore(it.goal, false); }
      catch (e) { console.warn("[Checklist] clear failed for", it.goal, e); }

      _state[it.goal] = false;
      it.done = false;
    }
    _rerender?.();
  };

  const onSearchInput = () => _rerender?.();

  _refreshEl?.addEventListener("click", onRefreshClick);
  _clearEl?.addEventListener("click", onClearClick);
  _searchEl?.addEventListener("input", onSearchInput);

  // initial load (important because left:tab happens *before* mount in PaneManager)
  await _refresh();

  _cleanup = () => {
    try { _refreshEl?.removeEventListener("click", onRefreshClick); } catch {}
    try { _clearEl?.removeEventListener("click", onClearClick); } catch {}
    try { _searchEl?.removeEventListener("input", onSearchInput); } catch {}

    _root = null;
    _listEl = _emptyEl = _statsEl = null;
    _searchEl = _refreshEl = _clearEl = null;

    _rerender = null;
    _refresh = null;
  };

  return _cleanup;
}

export async function resume() {
  // old behavior: refresh whenever user comes back to the checklist pane
  await _refresh?.();
}

export async function suspend() {
  // nothing long-running to stop here
}

export async function unmount() {
  try { _cleanup?.(); } catch {}
  _cleanup = null;
}
