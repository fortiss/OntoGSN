---
layout: default
title: OntoGSN Playground
permalink: /playground/
body_class: page-playground
styles: 
  - /assets/css/playground.css
---

<script>
window.addEventListener('load', async () => {
  if ('caches' in window) (await caches.keys()).forEach(k => caches.delete(k));
  if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
  localStorage.clear(); sessionStorage.clear();
});
</script>

<div class="split">
  <div id="leftButtons" class="btns">
    <button id="reset-cache">Reset cache</button>
      <script type="module">
      document.getElementById('reset-cache').addEventListener('click', async () => {
        try {
          if ('caches' in window) for (const n of await caches.keys()) await caches.delete(n);
          localStorage.clear(); sessionStorage.clear();
          if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
          if (window.indexedDB && indexedDB.databases) {
            for (const db of await indexedDB.databases()) {
              if (!db.name) continue;
              await new Promise(res => { const req = indexedDB.deleteDatabase(db.name); req.onblocked=req.onerror=req.onsuccess=()=>res(); });
            }
          }
          location.reload();
        } catch (e) { console.error(e); alert('Reset error: '+e.message); }
      });
      </script>
    <button data-query="/assets/data/queries/read_all_nodes.sparql">See Node Info</button>
    <button data-query="/assets/data/queries/read_all_relations.sparql">See Relations</button>
  </div>
  <div id="rightButtons" class="btns">
    <button data-query="/assets/data/queries/visualize_graph.sparql" data-no-table="1">Tree View</button>
    <button id="btn-layered-view" data-no-table="1">Layer View</button>
    <button data-query="/assets/data/queries/read_carLoadWeight.sparql" id="btn-model-view" data-no-table="1">Model View</button>
    <label><input id="toggle-context" type="checkbox" checked data-no-table="1"> Contextual</label>
    <label><input id="toggle-defeat" type="checkbox" checked data-no-table="1"> Dialectic</label>
    <label><input type="checkbox"
      data-query="/assets/data/queries/visualize_undev_nodes.sparql"
      data-class="undev" data-no-table="1"> Undeveloped</label>
    <label><input type="checkbox"
      data-query="/assets/data/queries/visualize_invalid_nodes.sparql"
      data-class="invalid" data-no-table="1"> Invalid</label>
    <label><input type="checkbox"
      data-query="/assets/data/queries/visualize_valid_nodes.sparql"
      data-class="valid" data-no-table="1"> Valid</label>
    <label><input type="checkbox"
      data-query="/assets/data/queries/read_all_collections.sparql"
      data-class="collection" data-no-table="1"> Evidence</label>
  </div>    
</div>


<div class="split">
  <div id="results"></div>
  <div id="graph"></div>
</div>
<pre id="out"></pre>

<div class="split">
  <div id="leftButtons" class="btns">
    Rules:
    <label><input type="checkbox"
      data-query="/assets/data/queries/rule_assumptionInvalidation.sparql"
      data-class="rule" data-no-table="1">
      Invalid assumptions
    </label>
    <label><input type="checkbox"
      data-query="/assets/data/queries/rule_truthContradiction.sparql"
      data-class="rule" data-no-table="1">
      Contradicting truth
    </label>
    <label><input type="checkbox"
      data-query="/assets/data/queries/rule_untrueSolution.sparql"
      data-class="rule" data-no-table="1">
      Untrue solution
    </label>
    <label><input type="checkbox"
      data-queries="/assets/data/queries/rule_checkLoadWeight.sparql;
                    /assets/data/queries/propagate_overloadedCar.sparql;
                    /assets/data/queries/write_defeater_overloadedCar.sparql"
      data-delete-query="/assets/data/queries/delete_defeater_overloadedCar.sparql"
      data-class="rule" data-no-table="1"
      data-event="car:overloadChanged">
      Overloaded car
    </label>
  </div>
  <div id="rightButtons" class="btns">
    <span class="gsn-hint">scroll: zoom • drag: pan</span>
    Modules: 
    <div id="modulesBar" class="modules-bar"></div>
  </div>
</div>

<!-- Important: serve this file with a local web server (e.g., `python -m http.server`) -->
<script type = "module" src = "/assets/js/queries.js" ></script>
<script type = "module" src = "/assets/js/layers.js"  ></script>

<script src  = "https://unpkg.com/n3@1.17.0/browser/n3.min.js"></script>
<script type = "importmap">{"imports": {"three": "https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>
<script type = "module" src = "/assets/js/model.js"   ></script>

<script type="module" src="{{'/assets/js/queries.js' | relative_url}}"></script>
<script type="module" src="{{'/assets/js/layers.js' | relative_url}}"></script>
