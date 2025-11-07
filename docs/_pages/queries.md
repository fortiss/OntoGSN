---
layout: default
title: SPARQL queries
permalink: /queries/
---

<script>
window.addEventListener('load', async () => {
  if ('caches' in window) (await caches.keys()).forEach(k => caches.delete(k));
  if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
  localStorage.clear(); sessionStorage.clear();
});
</script>

<div class="btns">
  <button data-query="/assets/data/read_all_nodes.sparql">See All Nodes</button>
  <button data-query="/assets/data/read_all_relations.sparql">See All Relations</button>
  <button data-query="/assets/data/visualize_graph.sparql">Visualize Graph</button>
</div>

<div class="split">
  <div id="results"></div>
  <div id="graph"></div>
</div>

<div id="results">Click a button to continue.</div>
<div id="graph" style="height:520px; margin-top:.75rem; border-top:1px solid #eee;"></div>

<script type="module" src="{{ site.baseurl }}/assets/js/queries.js"></script>
