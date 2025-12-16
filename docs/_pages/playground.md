---
layout: default
title: OntoGSN Playground
permalink: /playground/
body_class: page-playground
styles: 
  - /assets/css/playground.css
  - /assets/vendor/github.min.css
---

<script>
window.addEventListener('load', async () => {
  if ('caches' in window) (await caches.keys()).forEach(k => caches.delete(k));
  if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
  localStorage.clear(); sessionStorage.clear();
});
</script>

<div class="split">
  <div id="leftButtons" class="btns" data-tab-group="left-main">
    <button id = "tab-welcome"  class = "tab active" data-doc-query = "/assets/data/queries/read_welcomeDoc.sparql" data-doc-var = "doc"> Welcome   </button>
    <button id = "tab-table"  class = "tab"> Table   </button>
    <button id = "tab-editor" class = "tab"       > Editor  </button> 
    <button id = "tab-doc"    class = "tab" data-doc-query = "/assets/data/queries/read_document.sparql" data-doc-var = "doc"> Document </button>
    <button id = "tab-code"   class = "tab"> Code </button>
    <button id="tab-converter" class="tab">Converter</button>
    <button id="tab-chat"      class="tab">Chat</button>
  </div>
  <div id="rightButtons" class="btns" data-tab-group="right-main">
    <button data-query="/assets/data/queries/visualize_graph.sparql" data-no-table="1" class = "tab active"> Tree </button>
    <button id="btn-layered-view" data-no-table="1" class = "tab"> Layer </button>
    <button data-query="/assets/data/queries/read_carLoadWeight.sparql" id="btn-model-view" data-no-table="1" class = "tab"> Model </button>
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
      data-class="collection" data-no-table="1"> Artefacts</label>
  </div>    
</div>

<div class="split">
  <div id="leftPane" class="pane pane-left">
    <div id = "results"></div>
    <!-- -->
    <div id = "welcome-root"   style = "display: none;"></div> 
    <div id = "editor-root"    style = "display: none;"></div>
    <div id = "doc-root"       style = "display: none;"></div>
    <div id = "converter-root" style = "display: none;"></div>
    <div id = "code-root"      style = "display: none;"></div>
    <div id = "chat-root"      style = "display: none;"></div>
  </div>
  <div id="rightPane" class="pane pane-right gsn-host"></div>
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
    <div id="modulesBar" class="modules-bar" data-tab-group="modules"></div>
  </div>
</div>

<!-- Important: serve this file with a local web server (e.g., `python -m http.server`) -->
<script src  = "/assets/vendor/n3.min.js"></script>
<script type = "importmap">{"imports": {"three": "/assets/vendor/three.module.js"}}</script>
<script src = "/assets/vendor/highlight.min.js"></script>

<script type = "module" src = "/assets/js/welcome.js" ></script>
<script type = "module" src = "/assets/js/queries.js" ></script>
<script type = "module" src = "/assets/js/layers.js"  ></script>
<script type = "module" src = "/assets/js/model.js"   ></script>
<script type = "module" src = "/assets/js/editor.js"  ></script>
<script type = "module" src = "/assets/js/table.js"   ></script>
<script type = "module" src = "/assets/js/document.js"></script>
<script type = "module" src = "/assets/js/converter.js"></script>
<script type = "module" src = "/assets/js/code.js"    ></script>
<script type = "module" src = "/assets/js/chat.js"    ></script>