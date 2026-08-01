/* =========================================================
   Dream Create — asset studio
   Inspect a single asset (or a built rig) under clean studio
   lighting on a turntable, so we can judge/refine it in
   isolation before any world building.

     ?m=vehicles/truck-flat      load one GLB
     ?rig=towtruck               load a built rig from rigs.js
     &env=studio|dusk            lighting preset (default studio)
     &grid=0                     hide the ground grid
   ========================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildRig, RIGS } from "./rigs.js";

const Q = new URLSearchParams(location.search);
const MODEL = Q.get("m");
const RIG = Q.get("rig");
const ENV = Q.get("env") || "studio";
const SHOW_GRID = Q.get("grid") !== "0";
const A = "../assets/";
const hud = document.getElementById("hud");
if (Q.get("hud") === "0") hud.style.display = "none";

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = ENV === "dusk" ? 0.95 : 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 400);

/* ---- backdrop ---- */
const BG = ENV === "dusk"
  ? { a: 0x141a3a, b: 0x2a2350, floor: 0x1a1e3a }
  : { a: 0x1a1e33, b: 0x0d0f1c, floor: 0x22263c };
scene.background = new THREE.Color(BG.b);
scene.fog = new THREE.Fog(new THREE.Color(BG.b), 30, 90);

/* soft gradient dome so the object reads against something */
scene.add(new THREE.Mesh(new THREE.SphereGeometry(160, 32, 20), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(BG.a) }, bot: { value: new THREE.Color(BG.b) } },
  vertexShader: `varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec3 p; uniform vec3 top,bot;
    void main(){ float h=normalize(p).y; gl_FragColor=vec4(mix(bot,top,smoothstep(-.3,.7,h)),1.); }`,
})));

/* ---- studio lighting rig: key / fill / rim ---- */
const key = new THREE.DirectionalLight(ENV === "dusk" ? 0xffb478 : 0xfff2e2, ENV === "dusk" ? 2.6 : 2.9);
key.position.set(6, 9, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5; key.shadow.camera.far = 60;
key.shadow.camera.left = -12; key.shadow.camera.right = 12;
key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9ab4ff, 0.7); fill.position.set(-7, 4, 5); scene.add(fill);
const rim  = new THREE.DirectionalLight(0xffd9a0, 1.5); rim.position.set(-4, 5, -8); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x14162a, 0.5));

/* ---- ground ---- */
const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64),
  new THREE.MeshStandardMaterial({ color: BG.floor, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
if (SHOW_GRID) {
  const grid = new THREE.GridHelper(40, 40, 0x4a5480, 0x2b3050);
  grid.material.transparent = true; grid.material.opacity = 0.5; grid.position.y = 0.002;
  scene.add(grid);
}

/* ---- HDRI for real reflections ---- */
new RGBELoader().setPath(A + "hdri/").load("evening_road_01_puresky_1k.hdr", (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  const p = new THREE.PMREMGenerator(renderer);
  scene.environment = p.fromEquirectangular(t).texture;
  scene.environmentIntensity = ENV === "dusk" ? 0.35 : 0.55;
  t.dispose(); p.dispose();
}, undefined, () => {});

/* ---- load ---- */
const gltf = new GLTFLoader();
function loadGLB(path) {
  return new Promise((res, rej) => gltf.load(A + "models/" + path + ".glb",
    (g) => res(g.scene), undefined, rej));
}

function report(obj, label, extra = "") {
  const b = new THREE.Box3().setFromObject(obj);
  const sz = new THREE.Vector3(); b.getSize(sz);
  let meshes = 0, tris = 0, mats = new Set();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    mats.add(o.material.name || o.material.uuid.slice(0, 6));
  });
  hud.innerHTML =
    `<b>${label}</b><br>` +
    `<span class="dim">size</span> ${sz.x.toFixed(2)} × ${sz.y.toFixed(2)} × ${sz.z.toFixed(2)}<br>` +
    `<span class="dim">meshes</span> ${meshes} &nbsp; <span class="dim">tris</span> ${Math.round(tris)}<br>` +
    `<span class="dim">materials</span> ${mats.size}<br>` +
    `<span class="dim">env</span> ${ENV}` + (extra ? `<br>${extra}` : "");
  return { box: b, size: sz };
}

function frame(obj) {
  const b = new THREE.Box3().setFromObject(obj);
  const sz = new THREE.Vector3(); b.getSize(sz);
  const ctr = new THREE.Vector3(); b.getCenter(ctr);
  obj.position.y -= b.min.y;                       // sit on the floor
  ctr.y -= b.min.y;
  const r = Math.max(sz.x, sz.y, sz.z);
  return { ctr, dist: r * 1.55 + 0.6, r };
}

let target = new THREE.Vector3(0, 1, 0), dist = 8;
(async () => {
  try {
    let obj, label, extra = "";
    if (RIG) {
      obj = await buildRig(RIG, { loadGLB, THREE, debugBands: Q.get('bands') === '1' });
      label = "rig: " + RIG;
      extra = `<span class="dim">rigs</span> ${Object.keys(RIGS).join(", ")}`;
    } else if (MODEL) {
      obj = await loadGLB(MODEL);
      label = MODEL;
    } else {
      hud.innerHTML = `<b>asset studio</b><br><span class="dim">?m=vehicles/truck-flat</span><br>` +
        `<span class="dim">?rig=${Object.keys(RIGS).join(" | ")}</span>`;
      return;
    }
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(obj);
    if (Q.get("wire") === "1") {
      const adds = [];
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const w = new THREE.LineSegments(
          new THREE.WireframeGeometry(o.geometry),
          new THREE.LineBasicMaterial({ color: 0x7dffea, transparent: true, opacity: 0.55, depthTest: true }));
        w.applyMatrix4(o.matrixWorld);
        adds.push(w);
      });
      obj.updateMatrixWorld(true);
      adds.forEach((w) => scene.add(w));
    }
    if (Q.get("xray") === "1") {
      obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.material.depthWrite = false; } });
    }
    const f = frame(obj);
    target = f.ctr; dist = f.dist;
    report(obj, label, extra);
  } catch (e) {
    hud.innerHTML = `<b class="err">failed</b><br>${String(e).slice(0, 200)}`;
    console.error(e);
  }
  window.__ready = true;
})();

/* ---- bloom (subtle — this is an inspection view) ---- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.6, 0.95));
composer.addPass(new OutputPass());
composer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

/* ---- camera controls: ?a=<deg> azimuth, ?el=<deg> elevation, ?zoom=<mult> ---- */
const FIXED = Q.get("a");
const EL = Q.get("el") !== null ? parseFloat(Q.get("el")) * Math.PI / 180 : 0.30;
const ZOOM = parseFloat(Q.get("zoom") || "1");
const clock = new THREE.Clock();
(function loop() {
  const t = clock.getElapsedTime();
  const ang = FIXED !== null ? (parseFloat(FIXED) * Math.PI / 180) : (0.6 + t * 0.18);
  const el = EL;
  const d = dist / ZOOM;
  camera.position.set(
    target.x + Math.cos(ang) * d * Math.cos(el),
    target.y + d * Math.sin(el) * 0.9,
    target.z + Math.sin(ang) * d * Math.cos(el),
  );
  camera.lookAt(target);
  composer.render();
  requestAnimationFrame(loop);
})();
