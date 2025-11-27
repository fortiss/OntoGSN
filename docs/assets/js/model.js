import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import app from "./queries.js";

// RDF / Turtle handling via N3 (global from index.html)
const { Parser, Store, DataFactory, Writer } = N3;
const { namedNode, literal, blankNode } = DataFactory;

// --- RDF constants --------------------------------------------------------

const SCHEMA = "https://schema.org/";
const EX     = "https://example.org/car-demo#";
const RDF    = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD    = "http://www.w3.org/2001/XMLSchema#";

// Global-ish state: current car config + clickable meshes
let carConfig = null;
const clickable = [];
let overloadEventListener = null;
let currentSceneCtl = null;

const BOX_ON_QUERY      = "/OntoGSN/assets/data/queries/update_box_on.sparql";
const BOX_OFF_QUERY     = "/OntoGSN/assets/data/queries/update_box_off.sparql";
const LUGGAGE_ON_QUERY  = "/OntoGSN/assets/data/queries/update_luggage_on.sparql";
const LUGGAGE_OFF_QUERY = "/OntoGSN/assets/data/queries/update_luggage_off.sparql";

async function setLoadActive(name, active) {
  if (!app?.store) return;        // safety guard

  let path = null;
  if (name === "Box") {
    path = active ? BOX_ON_QUERY : BOX_OFF_QUERY;
  } else if (name === "Luggage") {
    path = active ? LUGGAGE_ON_QUERY : LUGGAGE_OFF_QUERY;
  }
  if (!path) return;

  // Reuse QueryApp.run so it handles UPDATE vs SELECT automatically
  await app.run(path, null, { noTable: true });
}

// --- TTL → JS: load & parse car.ttl --------------------------------------

async function loadCarConfigFromTTL(url) {
  const res = await fetch(url);
  if (!res.ok) { throw new Error(`Failed to fetch TTL: ${res.status} ${res.statusText}`); }
  
  const ttl     = await res.text();
  const parser  = new Parser({ format: "text/turtle" });
  const quads   = parser.parse(ttl);
  const store   = new Store(quads);
  const carNode = namedNode(EX + "car1");

  function getOne(subject, predicate) {
    const objs = store.getObjects(subject, predicate, null);
    return objs.length ? objs[0] : null;
  }

  function getQuantValue(subject, predicateIri) {
    const qv = getOne(subject, namedNode(predicateIri));
    if (!qv) return null;
    const valueNode = getOne(qv, namedNode(SCHEMA + "value"));
    if (!valueNode) return null;
    const num = parseFloat(valueNode.value);
    return Number.isFinite(num) ? num : null;
  }

  function getLiteralNumber(subject, predicateIri, parseFn, expectedTypeName) {
    const obj = getOne(subject, namedNode(predicateIri));

    if (!obj) {throw new Error(`Missing required ${expectedTypeName} literal ${predicateIri} for subject ${subject.value}`);}
    if (obj.termType !== "Literal") {throw new Error(`Expected a literal for ${predicateIri} on ${subject.value}, got ${obj.termType}`);}

    const num = parseFn(obj.value);
    if (!Number.isFinite(num)) {throw new Error(`Invalid ${expectedTypeName} value "${obj.value}" for ${predicateIri} on ${subject.value}`);}
    return num;
  }

  const getLiteralFloat = (subject, predicateIri) =>
    getLiteralNumber(subject, predicateIri, parseFloat, "float");

  const getLiteralInt = (subject, predicateIri) =>
    getLiteralNumber(subject, predicateIri, v => parseInt(v, 10), "int");

  // BASIC CAR DATA (schema:Car)
  const vinNode  = getOne(carNode, namedNode(SCHEMA + "vehicleIdentificationNumber"));
  const nameNode = getOne(carNode, namedNode(SCHEMA + "name"));

  // Body
  const width  = getQuantValue(carNode, SCHEMA + "width");
  const height = getQuantValue(carNode, SCHEMA + "height");
  const depth  = getQuantValue(carNode, SCHEMA + "depth");

  // Parts
  const partPred  = namedNode(EX + "hasPart");
  const partNodes = store.getObjects(carNode, partPred, null);
  const parts     = partNodes.map(node => {
    const labelNode = getOne(node, namedNode(SCHEMA + "name"));
    return {iri:   node.value,
            label: labelNode ? labelNode.value : node.value };
  });

  // Helper: find a part resource by its schema:name
  function findPartNodeByLabel(label) {
    const part = parts.find(p => p.label === label);
    return part ? namedNode(part.iri) : null;
  }

  // License plate geometry (from ex:frontLicensePlate)
  const frontPlateNode = findPartNodeByLabel("Front license plate");
  if (!frontPlateNode) {
    throw new Error("No front license plate part found in TTL (schema:name 'Front license plate').");
  }

  const licensePlateParams = {
    width:  getLiteralFloat(frontPlateNode, EX + "width"),
    height: getLiteralFloat(frontPlateNode, EX + "height")
  };

  // Wheels
  const wheelTypeNode = namedNode(EX + "StandardWheel");
  const wheelParams = {
    radius:   getLiteralFloat(wheelTypeNode, EX + "radius"),
    width:    getLiteralFloat(wheelTypeNode, EX + "width"),
    segments: getLiteralInt  (wheelTypeNode, EX + "segments"),
    y:        getLiteralFloat(wheelTypeNode, EX + "y"),
    offsetX:  getLiteralFloat(wheelTypeNode, EX + "offsetX"),
    offsetZ:  getLiteralFloat(wheelTypeNode, EX + "offsetZ")
  };

  // Geometry from ex:car1
  const geometry = {
    // Body
    BODY_LENGTH:   getLiteralFloat(carNode, EX + "bodyLength"),
    BODY_HEIGHT:   getLiteralFloat(carNode, EX + "bodyHeight"),
    BODY_DEPTH:    getLiteralFloat(carNode, EX + "bodyDepth"),
    BODY_CENTER_Y: getLiteralFloat(carNode, EX + "bodyCenterY"),
    // Bumper
    BUMPER_THICKNESS_X: getLiteralFloat(carNode, EX + "bumperThicknessX"),
    BUMPER_HEIGHT_Y:    getLiteralFloat(carNode, EX + "bumperHeightY"),
    BUMPER_DEPTH_Z:     getLiteralFloat(carNode, EX + "bumperDepthZ"),
    BUMPER_CENTER_Y:    getLiteralFloat(carNode, EX + "bumperCenterY"),
    // Doors
    DOOR_BOTTOM_Y: getLiteralFloat(carNode, EX + "doorBottomY"),
    DOOR_TOP_Y:    getLiteralFloat(carNode, EX + "doorTopY"),
    DOOR_FRONT_X:  getLiteralFloat(carNode, EX + "doorFrontX"),
    DOOR_BACK_X:   getLiteralFloat(carNode, EX + "doorBackX"),
    DOOR_DEPTH_Z:  getLiteralFloat(carNode, EX + "doorDepthZ"),
    DOOR_Z_OFFSET: getLiteralFloat(carNode, EX + "doorDepthOffset"),
    // Cabin
    CABIN_WIDTH_X:  getLiteralFloat(carNode, EX + "cabinWidthX"),
    CABIN_HEIGHT_Y: getLiteralFloat(carNode, EX + "cabinHeightY"),
    CABIN_DEPTH_Z:  getLiteralFloat(carNode, EX + "cabinDepthZ"),
    CABIN_CENTER_X: getLiteralFloat(carNode, EX + "cabinCenterX"),
    CABIN_CENTER_Y: getLiteralFloat(carNode, EX + "cabinCenterY"),
    // Windshields
    WS_WIDTH_X:   getLiteralFloat(carNode, EX + "windshieldWidthX"),
    WS_HEIGHT_Y:  getLiteralFloat(carNode, EX + "windshieldHeightY"),
    WS_DEPTH_Z:   getLiteralFloat(carNode, EX + "windshieldDepthZ"),
    // Front Windshield
    FRONT_WS_CENTER_X:  getLiteralFloat(carNode, EX + "frontWindshieldCenterX"),
    FRONT_WS_CENTER_Y:  getLiteralFloat(carNode, EX + "frontWindshieldCenterY"),
    // Rear Windshield
    REAR_WS_CENTER_X:   getLiteralFloat(carNode, EX + "rearWindshieldCenterX"),
    REAR_WS_CENTER_Y:   getLiteralFloat(carNode, EX + "rearWindshieldCenterY"),
    WS_CENTER_Z:        getLiteralFloat(carNode, EX + "windshieldCenterZ"),
    LIGHT_WIDTH_X:      getLiteralFloat(carNode, EX + "lightWidthX"),
    LIGHT_HEIGHT_Y:     getLiteralFloat(carNode, EX + "lightHeightY"),
    LIGHT_DEPTH_Z:      getLiteralFloat(carNode, EX + "lightDepthZ"),
    FRONT_LIGHT_CENTER_X: getLiteralFloat(carNode, EX + "frontLightCenterX"),
    REAR_LIGHT_CENTER_X:  getLiteralFloat(carNode, EX + "rearLightCenterX"),
    LIGHT_CENTER_Y:       getLiteralFloat(carNode, EX + "lightCenterY"),
    LIGHT_CENTER_Z_ABS:   getLiteralFloat(carNode, EX + "lightCenterZAbs"),
    // Roof Rack
    ROOFRACK_WIDTH:   getLiteralFloat(carNode, EX + "roofRackWidth"),
    ROOFRACK_DEPTH:   getLiteralFloat(carNode, EX + "roofRackDepth"),
    ROOFRACK_HEIGHT:  getLiteralFloat(carNode, EX + "roofRackHeight"),
    ROOFRACK_CENTER_Y:getLiteralFloat(carNode, EX + "roofRackCenterY"),
    // Roof load: Box
    BOX_WIDTH:   getLiteralFloat(carNode, EX + "boxWidth"),
    BOX_DEPTH:   getLiteralFloat(carNode, EX + "boxDepth"),
    BOX_HEIGHT:  getLiteralFloat(carNode, EX + "boxHeight"),
    BOX_CENTER_Y:getLiteralFloat(carNode, EX + "boxCenterY"),
    // Roof load: Luggage
    LUGGAGE_WIDTH:   getLiteralFloat(carNode, EX + "luggageWidth"),
    LUGGAGE_DEPTH:   getLiteralFloat(carNode, EX + "luggageDepth"),
    LUGGAGE_HEIGHT:  getLiteralFloat(carNode, EX + "luggageHeight"),
    LUGGAGE_CENTER_Y:getLiteralFloat(carNode, EX + "luggageCenterY")
  };

  return {
    store,
    carNode,
    vin:  vinNode  ? vinNode.value  : null,
    name: nameNode ? nameNode.value : null,
    dimensions: { width, height, depth },
    parts,
    wheelParams,
    geometry,
    licensePlateParams
  };
}


// Look up a part IRI by its schema:name label
function findPartIriByName(name) {
  if (!carConfig || !carConfig.parts) return null;
  const part = carConfig.parts.find(p => p.label === name);
  return part ? part.iri : null;
}

// --- Three.js scene creation ----------------------------------------------

function createCarScene(config) {
  const {geometry: g,
         wheelParams: wp,
         licensePlateParams: lp,
         vin} = config;

  const roofLoadMeshes = [];
  let roofBoxMesh = null;
  let roofLuggageMesh = null;

  const overloadMeshes = new Set();
  const BASE_COLOR     = 0xffffff;
  const HIGHLIGHT_COLOR = 0xcf4040;

  // ---------- CONFIG / CONSTANTS ----------

  const {
    BODY_LENGTH, BODY_HEIGHT, BODY_DEPTH, BODY_CENTER_Y,
    BUMPER_THICKNESS_X, BUMPER_HEIGHT_Y, BUMPER_DEPTH_Z, BUMPER_CENTER_Y,
    DOOR_BOTTOM_Y, DOOR_TOP_Y, DOOR_FRONT_X, DOOR_BACK_X,
    DOOR_DEPTH_Z, DOOR_Z_OFFSET, CABIN_WIDTH_X, CABIN_HEIGHT_Y, 
    CABIN_DEPTH_Z, CABIN_CENTER_X, CABIN_CENTER_Y,
    WS_WIDTH_X, WS_HEIGHT_Y, WS_DEPTH_Z,
    FRONT_WS_CENTER_X, FRONT_WS_CENTER_Y,
    REAR_WS_CENTER_X, REAR_WS_CENTER_Y, WS_CENTER_Z,
    LIGHT_WIDTH_X, LIGHT_HEIGHT_Y, LIGHT_DEPTH_Z, FRONT_LIGHT_CENTER_X,
    REAR_LIGHT_CENTER_X, LIGHT_CENTER_Y, LIGHT_CENTER_Z_ABS,
    ROOFRACK_WIDTH, ROOFRACK_DEPTH, ROOFRACK_HEIGHT, ROOFRACK_CENTER_Y,
    BOX_WIDTH, BOX_DEPTH, BOX_HEIGHT, BOX_CENTER_Y,
    LUGGAGE_WIDTH, LUGGAGE_DEPTH, LUGGAGE_HEIGHT, LUGGAGE_CENTER_Y
  } = g;  

  const LICENSE_PLATE_TEXT = config.vin;
  const BODY_FRONT_X  = BODY_LENGTH / 2;
  const BODY_BOTTOM_Y = BODY_CENTER_Y - BODY_HEIGHT / 2;

  // Wheels
  const {
    radius:   WHEEL_RADIUS,
    width:    WHEEL_WIDTH,
    segments: WHEEL_SEGMENTS,
    y:        WHEEL_Y,
    offsetX:  WHEEL_OFFSET_X,
    offsetZ:  WHEEL_OFFSET_Z
  } = wp;

  // ---------- DOM / RENDERER / CAMERA ----------

  const container = document.getElementById("scene-container");

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

  const ortho_left   = -d * aspect;
  const ortho_right  =  d * aspect;
  const ortho_top    =  d;
  const ortho_bottom = -d;
  const ortho_near   = 0.1;
  const ortho_far    = 100;

  const camera = new THREE.OrthographicCamera(ortho_left, 
                                              ortho_right, 
                                              ortho_top, 
                                              ortho_bottom, 
                                              ortho_near, 
                                              ortho_far);

  camera.position.set(6, 6, 6);
  camera.lookAt(0, 1, 0);

  // ---------- INTERACTION (RAYCASTING) ----------

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedMesh = null;
  const selectedOriginalColor = new THREE.Color();
  const infoEl = document.getElementById("part-label");

  // ---------- LIGHTS ----------

  scene.add(new THREE.AmbientLight(0x888888));

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // ---------- MATERIALS ----------

  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });

  const baseFillMaterial = new THREE.MeshBasicMaterial({
    color:                0xffffff,
    side:                 THREE.FrontSide,
    polygonOffset:        true,
    polygonOffsetFactor:  1,
    polygonOffsetUnits:   1
  });

  // ---------- CAR GROUP & HELPERS ----------

  const car = new THREE.Group();
  scene.add(car);

  // generic "filled box + outline" builder, now with optional IRI

  function outlinedBox(geometry, position, label, iri = null, material = baseFillMaterial) {
    const mesh  = new THREE.Mesh(geometry, material.clone());
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      edgeMaterial
    );

    mesh.position.copy(position);
    edges.position.copy(position);

    car.add(mesh);
    car.add(edges);

    mesh.userData.label = label;
    mesh.userData.iri   = iri;
    mesh.userData.edges = edges;
    clickable.push(mesh);

    return mesh;
  }

  // ---------- LICENSE PLATE ----------

  function addFrontLicensePlate(text) {
    if (!lp) {throw new Error("Missing licensePlateParams from TTL.");}
    
    const plateWidth = lp.width;
    const plateHeight = lp.height;

    const canvas  = document.createElement("canvas");
    canvas.width  = 512;
    canvas.height = 128;
    const ctx     = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // text
    ctx.fillStyle     = "#000000";
    ctx.font          = 'bold 100px "Courier New", monospace';
    ctx.textAlign     = "center";
    ctx.textBaseline  = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture       = new THREE.CanvasTexture(canvas);
    const plateMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide
    });

    const plateGeometry = new THREE.PlaneGeometry(plateWidth, plateHeight);
    const plateMesh     = new THREE.Mesh(plateGeometry, plateMaterial);

    const plateEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(plateGeometry),
      edgeMaterial
    );
    plateMesh.add(plateEdges);

    // plate sits slightly in front of the bumper
    const bumperCenterX = BODY_FRONT_X + BUMPER_THICKNESS_X / 2;
    const plateOffsetX  = 0.03;
    const plateOffsetY  = 0.22;

    const plateCenterX = bumperCenterX + BUMPER_THICKNESS_X / 2 + plateOffsetX;
    const plateCenterY = BODY_BOTTOM_Y + plateOffsetY;
    const plateCenterZ = 0;

    plateMesh.position.set(plateCenterX, plateCenterY, plateCenterZ);
    plateMesh.rotation.y = Math.PI / 2; // face +X

    plateMesh.userData.label = "Front license plate";
    plateMesh.userData.iri   = findPartIriByName("Front license plate");
    clickable.push(plateMesh);

    car.add(plateMesh);
  }

  function addLight(xSign, zSign, label) {
    outlinedBox(
      new THREE.BoxGeometry(LIGHT_WIDTH_X, LIGHT_HEIGHT_Y, LIGHT_DEPTH_Z),
      new THREE.Vector3(
        xSign > 0 ? FRONT_LIGHT_CENTER_X : REAR_LIGHT_CENTER_X,
        LIGHT_CENTER_Y,
        zSign > 0 ? LIGHT_CENTER_Z_ABS : -LIGHT_CENTER_Z_ABS
      ),
      label,
      findPartIriByName(label)
    );
  }

  function addRoofRack() {
    const rackGeom = new THREE.BoxGeometry(
      ROOFRACK_WIDTH,
      ROOFRACK_HEIGHT,
      ROOFRACK_DEPTH
    );

    // Put it on top of the body, centered in X/Z:
    const rackCenterX = CABIN_CENTER_X;
    const rackCenterY = CABIN_HEIGHT_Y + ROOFRACK_CENTER_Y;    // or BODY_CENTER_Y + BODY_HEIGHT/2 + 0.1
    const rackCenterZ = 0;

    outlinedBox(
      rackGeom,
      new THREE.Vector3(rackCenterX, rackCenterY, rackCenterZ),
      "Roof rack",
      findPartIriByName("Roof rack")
    );
  }

  function clearOverloadHighlight() {
    for (const mesh of overloadMeshes) {
      mesh.material.color.set(BASE_COLOR);
      // keep the selection's "original" color in sync
      if (mesh === selectedMesh) {
        selectedOriginalColor.copy(mesh.material.color);
      }
    }
    overloadMeshes.clear();
  }

  function setOverloadedPartsByIri(iris) {
    clearOverloadHighlight();

    const iriSet = new Set(iris);
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


  // ---------- CAR GEOMETRY ----------

  // Body
  outlinedBox(
    new THREE.BoxGeometry(BODY_LENGTH, BODY_HEIGHT, BODY_DEPTH),
    new THREE.Vector3(0, BODY_CENTER_Y, 0),
    "Body", findPartIriByName("Body")
  );

  // Cabin
  outlinedBox(
    new THREE.BoxGeometry(CABIN_WIDTH_X, CABIN_HEIGHT_Y, CABIN_DEPTH_Z),
    new THREE.Vector3(CABIN_CENTER_X, CABIN_CENTER_Y, 0),
    "Cabin",
    findPartIriByName("Cabin")
  );

  // Windshields
  outlinedBox(
    new THREE.BoxGeometry(WS_WIDTH_X, WS_HEIGHT_Y, WS_DEPTH_Z).rotateZ(Math.PI / 1.4),
    new THREE.Vector3(FRONT_WS_CENTER_X, FRONT_WS_CENTER_Y, WS_CENTER_Z),
    "Front windshield",
    findPartIriByName("Front windshield")
  );

  outlinedBox(
    new THREE.BoxGeometry(WS_WIDTH_X, WS_HEIGHT_Y, WS_DEPTH_Z).rotateZ(-Math.PI / 1.4),
    new THREE.Vector3(REAR_WS_CENTER_X, REAR_WS_CENTER_Y, WS_CENTER_Z),
    "Rear windshield",
    findPartIriByName("Rear windshield")
  );

  // Lights
  addLight(true,  true,  "Front-right light");
  addLight(true,  false, "Front-left light");
  addLight(false, true,  "Rear-right light");
  addLight(false, false, "Rear-left light");

  // Roof rack
  addRoofRack();

  // Roof load
  roofBoxMesh = outlinedBox(
    new THREE.BoxGeometry(BOX_WIDTH, BOX_HEIGHT, BOX_DEPTH),
    new THREE.Vector3(CABIN_CENTER_X, CABIN_HEIGHT_Y + ROOFRACK_CENTER_Y + BOX_CENTER_Y, 0.25),
    "Roof load",
    findPartIriByName("Box")
  );
  roofLoadMeshes.push(roofBoxMesh);

  roofLuggageMesh = outlinedBox(
    new THREE.BoxGeometry(LUGGAGE_WIDTH, LUGGAGE_HEIGHT, LUGGAGE_DEPTH),
    new THREE.Vector3(CABIN_CENTER_X, CABIN_HEIGHT_Y + ROOFRACK_CENTER_Y + LUGGAGE_CENTER_Y, -0.35),
    "Roof load",
    findPartIriByName("Luggage")
  );
  roofLoadMeshes.push(roofLuggageMesh);

  // Front bumper
  outlinedBox(
    new THREE.BoxGeometry(BUMPER_THICKNESS_X, BUMPER_HEIGHT_Y, BUMPER_DEPTH_Z),
    new THREE.Vector3(BODY_FRONT_X + BUMPER_THICKNESS_X / 2, BUMPER_CENTER_Y, 0),
    "Front bumper",
    findPartIriByName("Front bumper")
  );

  // License plate
  addFrontLicensePlate(LICENSE_PLATE_TEXT);

  // Wheels
  const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS,
                                                   WHEEL_RADIUS,
                                                   WHEEL_WIDTH,
                                                   WHEEL_SEGMENTS);
  wheelGeometry.rotateZ(Math.PI / 2);
  wheelGeometry.rotateY(Math.PI / 2);

  const wheelEdgesGeometry = new THREE.EdgesGeometry(wheelGeometry);

  const wheelFillMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  function addWheel(x, z, label, iri = null) {
    const wheelMesh = new THREE.Mesh(wheelGeometry, wheelFillMaterial.clone());
    wheelMesh.position.set(x, WHEEL_Y, z);
    car.add(wheelMesh);

    const wheelLines = new THREE.LineSegments(
      wheelEdgesGeometry,
      edgeMaterial
    );
    wheelLines.position.set(x, WHEEL_Y, z);
    car.add(wheelLines);

    wheelMesh.userData.label = label;
    wheelMesh.userData.iri   = iri;
    clickable.push(wheelMesh);
  }

  addWheel(-WHEEL_OFFSET_X, -WHEEL_OFFSET_Z, "Front-left wheel",
    findPartIriByName("Front-left wheel"));
  addWheel( WHEEL_OFFSET_X, -WHEEL_OFFSET_Z, "Front-right wheel",
    findPartIriByName("Front-right wheel"));
  addWheel(-WHEEL_OFFSET_X,  WHEEL_OFFSET_Z, "Rear-left wheel",
    findPartIriByName("Rear-left wheel"));
  addWheel( WHEEL_OFFSET_X,  WHEEL_OFFSET_Z, "Rear-right wheel",
    findPartIriByName("Rear-right wheel"));

  // Doors
  function addDoorBox(zSide, label) {
    const doorWidthX  = DOOR_FRONT_X - DOOR_BACK_X;
    const doorHeightY = DOOR_TOP_Y   - DOOR_BOTTOM_Y;

    const centerX = (DOOR_FRONT_X + DOOR_BACK_X) / 2 - 0.32;
    const centerY = (DOOR_TOP_Y + DOOR_BOTTOM_Y) / 2;

    const sideOffset = zSide > 0 ? zSide + 0.01 : zSide - 0.01;

    outlinedBox(
      new THREE.BoxGeometry(doorWidthX, doorHeightY, DOOR_DEPTH_Z),
      new THREE.Vector3(centerX, centerY, sideOffset),
      label,
      findPartIriByName(label)
    );

    // handle as thin box
    const handleFrontX   = 0.7;
    const handleBackX    = 0.4;
    const handleCenterX  = (handleFrontX + handleBackX) / 2 - 0.3;
    const handleWidthX   = handleFrontX - handleBackX;
    const handleHeightY  = 0.06;
    const handleDepthZ   = DOOR_DEPTH_Z + 0.02;

    const handleGeom = new THREE.BoxGeometry(
      handleWidthX,
      handleHeightY,
      handleDepthZ
    );

    outlinedBox(
      handleGeom,
      new THREE.Vector3(handleCenterX, 1.1, sideOffset),
      label + " handle",
      findPartIriByName(label + " handle")
    );
  }

  addDoorBox( DOOR_Z_OFFSET,  "Right door");
  addDoorBox(-DOOR_Z_OFFSET, "Left door");

  // Mirrors
  function addMirror(zSide, label) {
    const mirrorY = DOOR_TOP_Y + 0.1;
    const mirrorX = DOOR_FRONT_X - 0.2;

    const mirrorWidthX  = 0.28;
    const mirrorHeightY = 0.16;
    const mirrorDepthZ  = 0.1;

    const sideOffset = zSide > 0 ? zSide + 0.15 : zSide - 0.15;

    outlinedBox(
      new THREE.BoxGeometry(mirrorWidthX, mirrorHeightY, mirrorDepthZ),
      new THREE.Vector3(mirrorX - 0.15, mirrorY, sideOffset),
      label,
      findPartIriByName(label)
    );
    
    // stem
    const stemWidthX  = 0.08;
    const stemHeightY = 0.08;
    const stemDepthZ  = 0.18;
    const stemZ       = zSide > 0 ? zSide + 0.09 : zSide - 0.09;

    outlinedBox(
      new THREE.BoxGeometry(stemWidthX, stemHeightY, stemDepthZ),
      new THREE.Vector3(mirrorX - 0.08, mirrorY - 0.05, stemZ),
      label + " stem",
      findPartIriByName(label + " stem")
    );
  }

  addMirror( DOOR_Z_OFFSET,  "Right mirror");
  addMirror(-DOOR_Z_OFFSET, "Left mirror");

  // Side windows (derived from door + cabin geometry)
  function addSideWindow(zSide, label) {
    const doorWidthX = DOOR_FRONT_X - DOOR_BACK_X;

    const windowWidthX  = doorWidthX - 0.1;
    const windowHeightY = 0.65;

    const windowCenterX =
      ((DOOR_FRONT_X + DOOR_BACK_X) / 2) - 0.32;

    const windowCenterY = DOOR_TOP_Y + windowHeightY / 2 - 0.05;

    const windowDepthZ = 0.07;
    const sideOffset   = zSide > 0 ? zSide - 0.1 : zSide + 0.1;

    const windowGeom = new THREE.BoxGeometry(
      windowWidthX,
      windowHeightY,
      windowDepthZ
    );

    const windowMesh = outlinedBox(
      windowGeom,
      new THREE.Vector3(windowCenterX, windowCenterY, sideOffset),
      label,
      findPartIriByName(label)
    );

    windowMesh.material.color.set(0xffffff);
    windowMesh.material.transparent = true;
    windowMesh.material.opacity = 0.5;

    return windowMesh;
  }

  addSideWindow( DOOR_Z_OFFSET,  "Right side window");
  addSideWindow(-DOOR_Z_OFFSET, "Left side window");

  // ---------- CONTROLS ----------

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.target.set(0, 0.8, 0);
  controls.update();

  // ---------- EVENTS ----------

  function onWindowResize() {
    const width  = container.clientWidth;
    const height = container.clientHeight;
    camera.left  = -d * (width / height);
    camera.right =  d * (width / height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    render();
  }
  window.addEventListener("resize", onWindowResize);

  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickable, false);

    if (intersects.length === 0) return;

    const mesh = intersects[0].object;

    if (selectedMesh && selectedMesh !== mesh) {
      selectedMesh.material.color.copy(selectedOriginalColor);
    }

    selectedMesh = mesh;
    selectedOriginalColor.copy(mesh.material.color);
    mesh.material.color.set(HIGHLIGHT_COLOR); // highlight

    if (infoEl) {
      const label = mesh.userData.label || "Unknown part";
      const iri   = mesh.userData.iri;
      infoEl.textContent = iri ? `${label} (${iri})` : label;
    }

    if (mesh.userData.iri) {
      console.log("Clicked RDF resource:", mesh.userData.iri);
    }

    render();
  }

  // ---------- ANIMATION LOOP ----------

  /*
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
  */

  function render() {
    renderer.render(scene, camera);
  }

  render();

  controls.addEventListener("change", render);

  // --- Roof load visibility API ------------------------------------------
  function setBoxVisible(visible) {
    if (!roofBoxMesh) return;
    roofBoxMesh.visible = visible;
    if (roofBoxMesh.userData && roofBoxMesh.userData.edges) {
      roofBoxMesh.userData.edges.visible = visible;
    }
    render();
  }

  function setLuggageVisible(visible) {
    if (!roofLuggageMesh) return;
    roofLuggageMesh.visible = visible;
    if (roofLuggageMesh.userData && roofLuggageMesh.userData.edges) {
      roofLuggageMesh.userData.edges.visible = visible;
    }
    render();
  }

  function setRoofLoadVisible(visible) {
    setBoxVisible(visible);
    setLuggageVisible(visible);
  }

  function destroy() {
    // Remove listeners
    window.removeEventListener("resize", onWindowResize);
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    controls.removeEventListener("change", render);
    controls.dispose();
    infoEl.textContent = "None";

    // Dispose WebGL resources
    renderer.dispose();
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose && m.dispose());
        } else {
          obj.material.dispose && obj.material.dispose();
        }
      }
    });
  }

  return {
    setBoxVisible,
    setLuggageVisible,
    setRoofLoadVisible,
    setOverloadedPartsByIri,
    destroy
  };
}

// --- JS → TTL: export current scene as Turtle -----------------------------

function exportCarSnapshotToTTL() {
  if (!carConfig) {
    return Promise.reject("No carConfig loaded");
  }

  const writer  = new Writer({ prefixes: { schema: SCHEMA, ex: EX } });
  const carNode = carConfig.carNode;

  // Basic car info
  writer.addQuad(carNode,
    namedNode(RDF + "type"),
    namedNode(SCHEMA + "Car")
  );

  if (carConfig.name) {
    writer.addQuad(carNode,
      namedNode(SCHEMA + "name"),
      literal(carConfig.name)
    );
  }

  if (carConfig.vin) {
    writer.addQuad(carNode,
      namedNode(SCHEMA + "vehicleIdentificationNumber"),
      literal(carConfig.vin)
    );
  }

  const dims = carConfig.dimensions;

  function addQuant(predicateIri, value, unitCode) {
    if (value == null) return;
    const qv = blankNode();
    writer.addQuad(carNode, namedNode(predicateIri), qv);
    writer.addQuad(qv,
      namedNode(RDF + "type"),
      namedNode(SCHEMA + "QuantitativeValue")
    );
    writer.addQuad(qv,
      namedNode(SCHEMA + "value"),
      literal(String(value), namedNode(XSD + "float"))
    );
    writer.addQuad(qv,
      namedNode(SCHEMA + "unitCode"),
      literal(unitCode)
    );
  }

  addQuant(SCHEMA + "width",  dims.width,  "MTR");
  addQuant(SCHEMA + "height", dims.height, "MTR");
  addQuant(SCHEMA + "depth",  dims.depth,  "MTR");

  // Geometry parameters back into ex:*
  const geom = carConfig.geometry || {};

  function addGeomFloat(localName, value) {
    if (value == null) return;
    writer.addQuad(carNode,
      namedNode(EX + localName),
      literal(String(value), namedNode(XSD + "float"))
    );
  }

  function addGeomInt(localName, value) {
    if (value == null) return;
    writer.addQuad(carNode,
      namedNode(EX + localName),
      literal(String(value), namedNode(XSD + "int"))
    );
  }

  addGeomFloat("bodyLength",   geom.BODY_LENGTH);
  addGeomFloat("bodyHeight",   geom.BODY_HEIGHT);
  addGeomFloat("bodyDepth",    geom.BODY_DEPTH);
  addGeomFloat("bodyCenterY",  geom.BODY_CENTER_Y);

  addGeomFloat("bumperThicknessX", geom.BUMPER_THICKNESS_X);
  addGeomFloat("bumperHeightY",    geom.BUMPER_HEIGHT_Y);
  addGeomFloat("bumperDepthZ",     geom.BUMPER_DEPTH_Z);

  addGeomFloat("doorBottomY",     geom.DOOR_BOTTOM_Y);
  addGeomFloat("doorTopY",        geom.DOOR_TOP_Y);
  addGeomFloat("doorFrontX",      geom.DOOR_FRONT_X);
  addGeomFloat("doorBackX",       geom.DOOR_BACK_X);
  addGeomFloat("doorDepthZ",      geom.DOOR_DEPTH_Z);
  addGeomFloat("doorDepthOffset", geom.DOOR_Z_OFFSET);

  addGeomFloat("cabinWidthX",   geom.CABIN_WIDTH_X);
  addGeomFloat("cabinHeightY",  geom.CABIN_HEIGHT_Y);
  addGeomFloat("cabinDepthZ",   geom.CABIN_DEPTH_Z);
  addGeomFloat("cabinCenterX",  geom.CABIN_CENTER_X);
  addGeomFloat("cabinCenterY",  geom.CABIN_CENTER_Y);

  // Parts: only export those that actually have an IRI
  clickable.forEach(mesh => {
    if (!mesh.userData || !mesh.userData.iri) return;
    const partNode = namedNode(mesh.userData.iri);
    writer.addQuad(carNode,
      namedNode(EX + "hasPart"),
      partNode
    );
    if (mesh.userData.label) {
      writer.addQuad(partNode,
        namedNode(SCHEMA + "name"),
        literal(mesh.userData.label)
      );
    }
  });

  return new Promise((resolve, reject) => {
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Wire up the "Download TTL" button
function setupDownloadButton() {
  const btn    = document.getElementById("download-ttl");
  const output = document.getElementById("ttl-output");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      const ttl = await exportCarSnapshotToTTL();
      if (output) output.textContent = ttl;

      // Download as file
      const blob = new Blob([ttl], { type: "text/turtle" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = "car-snapshot.ttl";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("TTL export failed:", err);
      if (output) {
        output.textContent = "TTL export failed: " + err;
      }
    }
  });
}

// --- MAIN / INTEGRATION WITH OntoGSN UI ---------------------------------

// Load carConfig once (from TTL if available, otherwise fallback)
async function ensureCarConfig() {
  if (carConfig) return carConfig;

  try {
    carConfig = await loadCarConfigFromTTL("/OntoGSN/assets/data/ontologies/car.ttl");
    console.log("Loaded car config from TTL:", carConfig);
  } catch (err) {
    console.error("Failed to load car config from TTL:", err);
    const msg = document.getElementById("status-message");
    if (msg) {msg.textContent = "Could not load car.ttl – check console/logs.";}
  }

  return carConfig;
}

// Public entry point: render the car into the right-hand #graph block
export async function renderModelView({
  mount  = "#graph",
  height = 520
} = {}) {
  const rootEl = typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!rootEl) throw new Error(`Model view: mount "${mount}" not found`);

  // Clean previous GSN graph / layered SVG if present
  if (app?.graphCtl && typeof app.graphCtl.destroy === "function") {
    app.graphCtl.destroy();
    app.graphCtl = null;
  }
  window.graphCtl = null;

  // Inject the car viewer UI into the right-hand block
  rootEl.innerHTML = `
    <style>
      .car-ui { 
        position: absolute; 
        left: 0; right: 0; bottom: 0; 
        box-sizing: border-box; 
        padding: 0.4rem 0.7rem; 
        display: flex; 
        flex-direction: column; 
        gap: 0.25rem; 
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(4px); 
        font-size: 0.85rem;
        }

      /* 🔴 red warning bar, hidden by default */
      .car-warning {
        padding: 0.25rem 0.5rem;
        background: #c62828;
        color: #ffffff;
        font-weight: bold;
        border-radius: 4px;
        display: none;
      }

      /* bottom-right load info */
      .car-load-info {
        align-self: flex-end;
        text-align: right;
        font-size: 0.8rem;
        opacity: 0.85;
      }
      .car-load-info .value {
        font-weight: bold;
      }
    </style>
    <div id="scene-wrapper" style="position: relative; width:100%; height:${height}px;">
      <div id="scene-container" style="width:100%; height:100%;"></div>

      <div id="ui" class="car-ui">
        <!-- 🔴 warning text -->
        <div id="overload-warning" class="car-warning">
          Warning: Car roof is overloaded!
        </div>
        <div>
          Selected part:
          <span id="part-label">None</span>
        </div>
        <div style="margin-top: 0.5rem; display: flex; gap: 1rem; flex-wrap: wrap;">
          <div id="load-info" class="car-load-info">
                Roof load (<span id="load-current" class="value">–</span> /
                <span id="load-max" class="value">–</span> kg):
          </div>
          <label style="display: inline-flex; align-items: center; gap: 0.25rem;">
            <input id="toggle-roof-box" type="checkbox">
            Box
          </label>
          <label style="display: inline-flex; align-items: center; gap: 0.25rem;">
            <input id="toggle-roof-luggage" type="checkbox">
            Luggage
          </label>
        </div>
        <!-- <button id="download-ttl">Download TTL snapshot</button> -->
      </div>
    </div>

    <pre id="ttl-output" class="car-ttl-output"></pre>
  `;

  const overloadWarningEl = document.getElementById("overload-warning");
  const loadCurrentEl     = document.getElementById("load-current");
  const loadMaxEl         = document.getElementById("load-max");

  // Before creating a new scene:
  if (currentSceneCtl && typeof currentSceneCtl.destroy === "function") {
    currentSceneCtl.destroy();
  }
  
  // Reset clickable meshes for a fresh scene
  clickable.length = 0;

  const cfg = await ensureCarConfig();
  const sceneCtl = createCarScene(cfg);
  currentSceneCtl = sceneCtl;
  setupDownloadButton();
  await refreshLoadInfo();

  // Wire up box / luggage toggles
  // Wire up box / luggage toggles + overloaded rule checkbox
  const boxToggle     = document.getElementById("toggle-roof-box");
  const luggageToggle = document.getElementById("toggle-roof-luggage");
  const overloadCheckbox = document.querySelector(
    'input[type="checkbox"][data-queries*="propagate_overloadedCar.sparql"]'
  );

  // Keep "Overloaded car" rule in sync with both roof-load toggles
  function syncOverloadFromRoofToggles() {
    if (!overloadCheckbox) return;
    const shouldBeChecked = !!(boxToggle?.checked && luggageToggle?.checked);

    // Nothing to do if it's already in the correct state
    if (overloadCheckbox.checked === shouldBeChecked) return;

    // Update the rule checkbox and let queries.js handle SPARQL + events
    overloadCheckbox.checked = shouldBeChecked;
    overloadCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (sceneCtl) {
    if (boxToggle && typeof sceneCtl.setBoxVisible === "function") {
      sceneCtl.setBoxVisible(boxToggle.checked); // initial
      boxToggle.addEventListener("change", async () => {
        sceneCtl.setBoxVisible(boxToggle.checked);
        syncOverloadFromRoofToggles();
        await setLoadActive("Box", boxToggle.checked);
        await refreshLoadInfo();
      });
    }

    if (luggageToggle && typeof sceneCtl.setLuggageVisible === "function") {
      sceneCtl.setLuggageVisible(luggageToggle.checked); // initial
      luggageToggle.addEventListener("change", async () => {
        sceneCtl.setLuggageVisible(luggageToggle.checked);
        syncOverloadFromRoofToggles();
        await setLoadActive("Luggage", luggageToggle.checked);
        await refreshLoadInfo();
      });
    }
  }

  // --- Overload propagation → color car parts + sync UI ------------------
  if (overloadEventListener) {
    window.removeEventListener("car:overloadChanged", overloadEventListener);
  }

  function updateLoadInfo(current, max) {
    if (!loadCurrentEl || !loadMaxEl) return;
    // show “–” when unknown
    loadCurrentEl.textContent = current != null ? current.toFixed(1) : "–";
    loadMaxEl.textContent     = max != null ? max.toFixed(1) : "–";
  }

  async function refreshLoadInfo() {
    if (!app?.store) return;

    try {
      const queryText = await carLoadWeightQueryTextPromise;
      const res = app.store.query(queryText);

      let current = 0;
      let max     = null;

      // take the first result row
      for (const bindings of res) {
        const cl =
          bindings.get("currentLoadWeight") || bindings.get("?currentLoadWeight");
        const ml =
          bindings.get("maxLoadWeight") || bindings.get("?maxLoadWeight");

        if (cl && cl.termType === "Literal") {
          current = parseFloat(cl.value);
        }
        if (ml && ml.termType === "Literal") {
          max = parseFloat(ml.value);
        }
        break;
      }

      updateLoadInfo(current, max);
    } catch (err) {
      console.error("Failed to read car load weights:", err);
      updateLoadInfo(null, null);
    }
  }


  overloadEventListener = async (ev) => {
    const active = !!ev.detail?.active;
    if (!sceneCtl || typeof sceneCtl.setOverloadedPartsByIri !== "function") return;

    // 🔴 show / hide warning
    if (overloadWarningEl) {
      overloadWarningEl.style.display = active ? "block" : "none";
    }

    // Sync Box + Luggage visibility and checkboxes from rule state
    if (boxToggle && luggageToggle) {
      boxToggle.checked   = active;
      luggageToggle.checked = active;

      if (typeof sceneCtl.setBoxVisible === "function") {
        sceneCtl.setBoxVisible(active);
      }
      if (typeof sceneCtl.setLuggageVisible === "function") {
        sceneCtl.setLuggageVisible(active);
      }
    }

    // If rule is turned off, just clear highlights
    if (!active) {
      sceneCtl.setOverloadedPartsByIri([]);
      await refreshLoadInfo();
      return;
    }

    // Rule is ON → ask the OntoGSN store which car elements are concerned
    if (!app?.store) return;

    const queryText = await overloadedQueryTextPromise;
    const res = app.store.query(queryText);

    const iris = [];
    for (const b of res) {
      for (const [, term] of b) {
        if (term && term.termType === "NamedNode") {
          iris.push(term.value);
        }
      }
    }

    console.log("[car overload] IRIs from SPARQL:", iris);
    sceneCtl.setOverloadedPartsByIri(iris);

    await refreshLoadInfo();
  };

  window.addEventListener("car:overloadChanged", overloadEventListener);

  // Initial sync: if rule is already on when Model View opens, apply it
  if (overloadCheckbox && overloadCheckbox.checked) {
    overloadEventListener({ detail: { active: true } });
  }
}

const overloadedQueryTextPromise =
  fetch("/OntoGSN/assets/data/queries/propagate_overloadedCar.sparql").then(r => r.text());

const carLoadWeightQueryTextPromise =
  fetch("/OntoGSN/assets/data/queries/read_carLoadWeight.sparql").then(r => r.text());

// Wire the “Model View” button
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-model-view");
  if (!btn) return;
  btn.addEventListener("click", () => {
    renderModelView();
  });
});

ensureCarConfig();