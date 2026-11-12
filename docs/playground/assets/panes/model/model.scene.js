// assets/panes/model/model.scene.js
import * as THREE from "@vendor/three.module.js";
import { OrbitControls } from "@vendor/OrbitControls.js";
import { resolveEl } from "@core/utils.js";

function indexParts(config) {
  const byLabel = new Map();
  const byIri = new Map();
  const byToggleKey = new Map();

  for (const p of config?.scene?.parts || []) {
    if (p?.label) byLabel.set(p.label, p);
    if (p?.iri) byIri.set(p.iri, p);
    if (p?.uiToggleKey) byToggleKey.set(p.uiToggleKey, p);
  }

  return { byLabel, byIri, byToggleKey };
}

function makeTextTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000000";
  ctx.font = 'bold 100px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text || ""), canvas.width / 2, canvas.height / 2);

  return new THREE.CanvasTexture(canvas);
}

function inferGeometry(part) {
  const s = part?.size || {};
  const shape = (part?.shape || "").toLowerCase();

  // explicit shape hints
  if (shape.includes("cylinder")) {
    const r = s.radius ?? 0.2;
    const h = s.cylHeight ?? 0.2;
    const seg = Math.max(3, Math.floor(s.segments ?? 16));
    const geom = new THREE.CylinderGeometry(r, r, h, seg);

    const axis = (s.axis || "y").toLowerCase();
    // CylinderGeometry is along Y by default
    if (axis === "x") geom.rotateZ(Math.PI / 2);
    else if (axis === "z") geom.rotateX(Math.PI / 2);

    return { kind: "cylinder", geom };
  }

  if (shape.includes("plane")) {
    const w = s.width ?? 0.5;
    const h = s.height ?? 0.2;
    return { kind: "plane", geom: new THREE.PlaneGeometry(w, h) };
  }

  if (shape.includes("box")) {
    const w = s.width ?? 0.5;
    const h = s.height ?? 0.5;
    const d = s.depth ?? 0.5;
    return { kind: "box", geom: new THREE.BoxGeometry(w, h, d) };
  }

  // heuristic: cylinder if radius exists
  if (s.radius != null) {
    const r = s.radius ?? 0.2;
    const h = s.cylHeight ?? s.height ?? 0.2;
    const seg = Math.max(3, Math.floor(s.segments ?? 16));
    return { kind: "cylinder", geom: new THREE.CylinderGeometry(r, r, h, seg) };
  }

  // heuristic: plane if has width+height but no depth
  if (s.width != null && s.height != null && (s.depth == null)) {
    return { kind: "plane", geom: new THREE.PlaneGeometry(s.width, s.height) };
  }

  // default: box
  const w = s.width ?? 0.5;
  const h = s.height ?? 0.5;
  const d = s.depth ?? 0.5;
  return { kind: "box", geom: new THREE.BoxGeometry(w, h, d) };
}

export function createCarScene(config, { root = document } = {}) {
  const sceneSpec = config?.scene?.parts || [];
  if (!sceneSpec.length) {
    throw new Error("No config.scene.parts found. Scene renderer expects ontology-driven parts.");
  }

  const { byToggleKey } = indexParts(config);

  const clickable = [];
  const overloadMeshes = new Set();
  const meshByIri = new Map();
  const meshByToggleKey = new Map();

  const BASE_COLOR = 0xffffff;
  const HIGHLIGHT_COLOR = 0xcf4040;

  // ---------- DOM / RENDERER / CAMERA ----------
  const container = resolveEl("#scene-container", {
    root,
    name: "Model view: #scene-container"
  });

  const renderer = new THREE.WebGLRenderer({
    antialias: !/Mobile|Android/.test(navigator.userAgent)
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0xffffff, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const aspect = container.clientWidth / container.clientHeight;
  const d = 2.3;
  const camera = new THREE.OrthographicCamera(
    -d * aspect, d * aspect, d, -d, 0.1, 100
  );
  camera.position.set(6, 6, 6);
  camera.lookAt(0, 1, 0);

  // ---------- INTERACTION ----------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedMesh = null;
  const selectedOriginalColor = new THREE.Color();
  const infoEl = resolveEl("#part-label", {
    root,
    required: false,
    name: "Model view: #part-label"
  });

  function isEffectivelyVisible(obj) {
    for (let o = obj; o; o = o.parent) {
      if (o.visible === false) return false;
    }
    return true;
  }

  // ---------- LIGHTS ----------
  scene.add(new THREE.AmbientLight(0x888888));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // ---------- MATERIALS ----------
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });

  function makeMaterialForPart(part, { useText = false } = {}) {
    const baseColor = part?.material?.color || "#ffffff";
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(baseColor),
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });

    const opacity = part?.material?.opacity;
    const transparent = part?.material?.transparent;

    if (transparent === true || (opacity != null && opacity < 1)) {
      m.transparent = true;
    }
    if (opacity != null) {
      m.opacity = opacity;
    }

    if (useText && part?.text) {
      m.map = makeTextTexture(part.text);
    }

    return m;
  }

  // ---------- GROUP ----------
  const car = new THREE.Group();
  scene.add(car);

  function addOutlinedMesh(part) {
    const { geom } = inferGeometry(part);

    // For planes with text (license plate), you likely set part.text
    const isTextPlane = (part?.text != null) && (inferGeometry(part).kind === "plane");
    const material = makeMaterialForPart(part, { useText: isTextPlane });

    const mesh = new THREE.Mesh(geom, material);

    // edges as child so rotation matches automatically
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMaterial);
    mesh.add(edges);

    // pose
    const p = part.position || {};
    const r = part.rotation || {};
    mesh.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    mesh.rotation.set(r.x ?? 0, r.y ?? 0, r.z ?? 0);

    // defaults
    if (part.defaultVisible === false) mesh.visible = false;

    // metadata
    mesh.userData.label = part.label || "Unknown part";
    mesh.userData.iri = part.iri || null;
    mesh.userData.uiToggleKey = part.uiToggleKey || null;
    mesh.userData.pickable = true;

    car.add(mesh);
    clickable.push(mesh);

    if (mesh.userData.iri) meshByIri.set(mesh.userData.iri, mesh);
    if (mesh.userData.uiToggleKey) meshByToggleKey.set(mesh.userData.uiToggleKey, mesh);

    return mesh;
  }

  // Build scene from ontology parts
  for (const part of sceneSpec) addOutlinedMesh(part);

  // ---------- CONTROLS ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.target.set(0, 0.8, 0);
  controls.update();

  // ---------- EVENTS ----------
  function onWindowResize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.left = -d * (width / height);
    camera.right = d * (width / height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    render();
  }

  function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickable, false);
    if (!intersects.length) return;

    // pick the first hit that is actually visible
    let mesh = null;
    for (const hit of intersects) {
      const obj = hit.object;
      if (obj.userData?.pickable === false) continue;
      if (isEffectivelyVisible(hit.object)) {
        mesh = hit.object;
        break;
      }
    }
    if (!mesh) return;

    if (selectedMesh && selectedMesh !== mesh) {
      selectedMesh.material.color.copy(selectedOriginalColor);
    }

    selectedMesh = mesh;
    selectedOriginalColor.copy(mesh.material.color);
    mesh.material.color.set(HIGHLIGHT_COLOR);

    if (infoEl) {
      const label = mesh.userData.label || "Unknown part";
      const iri = mesh.userData.iri;
      infoEl.textContent = iri ? `${label} (${iri})` : label;
    }

    if (mesh.userData.iri) {
      console.log("Clicked RDF resource:", mesh.userData.iri);
    }

    render();
  }

  function render() {
    renderer.render(scene, camera);
  }

  onWindowResize();
  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  controls.addEventListener("change", render);
  render();

  // ---------- API: overload highlights ----------
  function clearOverloadHighlight() {
    for (const mesh of overloadMeshes) {
      mesh.material.color.set(BASE_COLOR);
      if (mesh === selectedMesh) {
        selectedOriginalColor.copy(mesh.material.color);
      }
    }
    overloadMeshes.clear();
  }

  function setOverloadedPartsByIri(iris) {
    clearOverloadHighlight();
    const iriSet = new Set(iris || []);
    for (const mesh of clickable) {
      const iri = mesh.userData?.iri;
      if (!iri) continue;
      if (iriSet.has(iri)) {
        mesh.material.color.set(HIGHLIGHT_COLOR);
        overloadMeshes.add(mesh);
      }
    }
    render();
  }

  // ---------- API: visibility (generic + compat wrappers) ----------
  function setVisibleByToggleKey(key, visible) {
    const mesh = meshByToggleKey.get(key);
    if (!mesh) return;
    const v = !!visible;
    mesh.visible = v;
    mesh.userData.pickable = v;
    render();
  }

  function setVisibleByIri(iri, visible) {
    const mesh = meshByIri.get(iri);
    if (!mesh) return;
    mesh.visible = !!visible;
    render();
  }

  // Backward-compatible names used by your controller
  function setBoxVisible(visible) {
    // assumes your TTL uses ex:uiToggleKey "roofBox"
    setVisibleByToggleKey("roofBox", visible);
  }

  function setLuggageVisible(visible) {
    // assumes your TTL uses ex:uiToggleKey "roofLuggage"
    setVisibleByToggleKey("roofLuggage", visible);
  }

  function setRoofLoadVisible(visible) {
    setBoxVisible(visible);
    setLuggageVisible(visible);
  }

  function destroy() {
    window.removeEventListener("resize", onWindowResize);
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    controls.removeEventListener("change", render);
    controls.dispose();

    if (infoEl) infoEl.textContent = "None";

    renderer.dispose();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose && m.dispose());
        else obj.material.dispose && obj.material.dispose();
      }
    });
  }

  return {
    clickable,
    setOverloadedPartsByIri,

    // new generic API
    setVisibleByToggleKey,
    setVisibleByIri,

    // compat API (controller already uses these)
    setBoxVisible,
    setLuggageVisible,
    setRoofLoadVisible,

    fit: onWindowResize,
    destroy
  };
}