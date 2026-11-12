// assets/panes/model/model.queries.js
import app from "@core/queries.js";
import { fetchText } from "@core/utils.js";

const BOX_ON_QUERY      = new URL("../../data/queries/update_box_on.sparql", import.meta.url);
const BOX_OFF_QUERY     = new URL("../../data/queries/update_box_off.sparql", import.meta.url);
const LUGGAGE_ON_QUERY  = new URL("../../data/queries/update_luggage_on.sparql", import.meta.url);
const LUGGAGE_OFF_QUERY = new URL("../../data/queries/update_luggage_off.sparql", import.meta.url);

let overloadedQueryTextPromise = null;
let carLoadWeightQueryTextPromise = null;

export async function setLoadActive(name, active) {
  if (!app?.store) return; // safety guard

  let path = null;
  if (name === "Box") {
    path = active ? BOX_ON_QUERY : BOX_OFF_QUERY;
  } else if (name === "Luggage") {
    path = active ? LUGGAGE_ON_QUERY : LUGGAGE_OFF_QUERY;
  }
  if (!path) return;

  // Reuse QueryApp.run so it handles UPDATE vs SELECT automatically
  await app.run(String(path), null, { noTable: true });
}

export function ensureModelQueriesCached() {
  if (!overloadedQueryTextPromise) {
    overloadedQueryTextPromise = fetchText(
      new URL("../../data/queries/propagate_overloadedCar.sparql", import.meta.url),
      { cache: "force-cache" }
    );
  }
  if (!carLoadWeightQueryTextPromise) {
    carLoadWeightQueryTextPromise = fetchText(
      new URL("../../data/queries/read_carLoadWeight.sparql", import.meta.url),
      { cache: "force-cache" }
    );
  }
}

export function getOverloadedQueryTextPromise() {
  ensureModelQueriesCached();
  return overloadedQueryTextPromise;
}

export function getCarLoadWeightQueryTextPromise() {
  ensureModelQueriesCached();
  return carLoadWeightQueryTextPromise;
}