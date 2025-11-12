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
    <button data-query="/assets/data/read_all_nodes.sparql">See Node Info</button>
    <button data-query="/assets/data/read_all_relations.sparql">See Relations</button>
  </div>
  <div id="rightButtons" class="btns">
    <button data-query = "/assets/data/visualize_graph.sparql" data-no-table = "1"> Tree View</button>
    <button id="btn-layered-view" data-q="{{ '/assets/data/visualize_graph.sparql' | relative_url }}" data-no-table="1"> Layer View</button>
    <label><input id="toggle-context" type="checkbox" checked data-no-table="1"> Contextual</label>
    <label><input id="toggle-defeat" type="checkbox" checked data-no-table="1"> Dialectic</label>
    <label><input type="checkbox"
      data-query="/assets/data/visualize_undev_nodes.sparql"
      data-class="undev" data-no-table="1"> Undeveloped</label>
    <label><input type="checkbox"
      data-query="/assets/data/visualize_invalid_nodes.sparql"
      data-class="invalid" data-no-table="1"> Invalid</label>
    <label><input type="checkbox"
      data-query="/assets/data/visualize_valid_nodes.sparql"
      data-class="valid" data-no-table="1"> Valid</label>
    <label><input type="checkbox"
      data-query="/assets/data/read_all_collections.sparql"
      data-class="collection" data-no-table="1"> Collections</label>
  </div>    
</div>


<div class="split">
  <div id="results"></div>
  <div id="graph"></div>
</div>
<pre id="out"></pre>

<div class="split">
  <div id="ruleButtons" class="btns">
    Rules:
    <label><input type="checkbox"
      data-query="/assets/data/rule_assumptionInvalidation.sparql"
      data-class="rule" data-no-table="1">
      Invalid Assumptions
    </label>
    <label><input type="checkbox"
      data-query="/assets/data/rule_truthContradiction.sparql"
      data-class="rule" data-no-table="1">
      Contradicting Truth
    </label>
    <label><input type="checkbox"
      data-query="/assets/data/rule_untrueSolution.sparql"
      data-class="rule" data-no-table="1">
      Untrue Solution
    </label>
  </div>
  <div id="moduleButtons" class="btns">
    <span class="gsn-hint">scroll: zoom • drag: pan</span>
    <div id="modulesBar" class="modules-bar">
      <span class="label">Modules:</span>
    </div>
  </div>
</div>

<script type="module" src="{{'/assets/js/queries.js' | relative_url}}"></script>
<script type="module" src="{{'/assets/js/layers.js' | relative_url}}"></script>
