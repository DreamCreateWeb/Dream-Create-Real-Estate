/* =========================================================
   Dream Create — the town
   A three-tier world so a bird's-eye descent and a street-level
   drive can share one scene:

     Tier 1  corridor  — full detail along the car's route
     Tier 2  town body — instanced houses/roads, reads correctly
                         from the air, nearly free to draw
     Tier 3  far field — silhouette hills dissolving into haze

   SCALE — measured, not guessed:
     1 tile = 1 world unit ≈ 8 m of street
     a Kenney house is 1.3 u wide (≈10 m) and 0.8–1.1 u tall
     so a lot is 2 tiles wide and houses sit 1.35 u back from
     the centreline, leaving ~3 m of front garden.
     eye level is 0.2 u (1.6 m). The car kit needs 0.22×.

   ?cam=air | mid | street | route&t=0..1     camera preset
   ========================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { paint, tintByMaterial } from "./rigs.js";

const Q = new URLSearchParams(location.search);
const CAM = Q.get("cam") || "fly";     // fly: the walk-through rig
const T = parseFloat(Q.get("t") || "0.35");
/* asset base — a hosting shell (e.g. the Vercel scout deploy) can point this
   at a CDN copy of the repo before importing the module */
const A = globalThis.__ASSET_BASE || "../assets/";
const hud = document.getElementById("hud");
globalThis.__paintDebug = Q.has("pdbg");

/* ---------------- world constants ---------------- */
export const TILE = 1;
const ROAD_TOP = 0.021;                // the kit tiles stand this proud of the ground
const GRID = 34;
const SETBACK = 1.7;                   // house centre distance from a street centreline
const CAR_SCALE = 0.22;

/* a small deterministic RNG so the town is the same every reload */
let _s = 20260802;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);
const range = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

/* ---------------- renderer ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = parseFloat(Q.get("exp") || "0.7");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.03, 500);

/* dusk atmosphere — haze closes the horizon so the town needs no edges */
/* matched to the sky a few degrees above the horizon away from the sunset —
   a lighter haze made the far fields glow brighter than the lit town */
const HAZE = new THREE.Color(0x1c2a52);
scene.fog = new THREE.FogExp2(HAZE, 0.0245);

/* ---------------- light ---------------- */
/* low warm sun raking across the streets, cool sky bounce filling the shade */
const key = new THREE.DirectionalLight(0xffc79a, 1.25);
key.position.set(-30, 11, 22);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 110;
key.shadow.camera.left = -26; key.shadow.camera.right = 26;
key.shadow.camera.top = 26; key.shadow.camera.bottom = -26;
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.025;
scene.add(key);
scene.add(new THREE.HemisphereLight(0x7fb0e0, 0x161a30, 0.33));

/* ---------------- sky ---------------- */
scene.add(new THREE.Mesh(new THREE.SphereGeometry(380, 32, 20), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top:{value:new THREE.Color(0x0e1638)}, mid:{value:new THREE.Color(0x33325f)},
              low:{value:new THREE.Color(0x76506e)}, hor:{value:new THREE.Color(0xcf7d55)} },
  vertexShader:`varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 p; uniform vec3 top,mid,low,hor;
    void main(){ float h=normalize(p).y;
      vec3 c=mix(hor,low,smoothstep(-0.02,0.12,h));
      c=mix(c,mid,smoothstep(0.08,0.34,h));
      c=mix(c,top,smoothstep(0.3,0.85,h));
      gl_FragColor=vec4(c,1.);}`,
})));

/* ---------------- the dream layer ----------------
   Everything from here to the HDRI is atmosphere: stars, a low moon,
   slow mauve clouds. Its own RNG so the town layout stays untouched. */
const FX = { flies: null, mist: [], clouds: [] };
let _s2 = 424242;
const rnd2 = () => ((_s2 = (_s2 * 1664525 + 1013904223) >>> 0) / 4294967296);
const glowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const cx = c.getContext("2d");
  const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

/* stars in two layers so a scatter of them read brighter; kept above ~15
   degrees so they hang in the deep blue, never in the sunset band */
for (const [count, size, opacity] of [[520, 1.6, 0.5], [130, 2.6, 0.9]]) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = rnd2() * Math.PI * 2, ph = Math.acos(0.26 + rnd2() * 0.72);
    pos[i * 3] = 350 * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = 350 * Math.cos(ph);
    pos[i * 3 + 2] = 350 * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcdd8ff, size, sizeAttenuation: false,
    transparent: true, opacity, depthWrite: false, fog: false })));
}

/* a low moon with a soft halo, hung to the north where the cameras look */
{
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const cx = c.getContext("2d");
  const halo = cx.createRadialGradient(128, 128, 30, 128, 128, 128);
  halo.addColorStop(0, "rgba(255,244,214,0.9)");
  halo.addColorStop(0.25, "rgba(210,220,255,0.28)");
  halo.addColorStop(1, "rgba(210,220,255,0)");
  cx.fillStyle = halo; cx.fillRect(0, 0, 256, 256);
  cx.fillStyle = "rgba(255,248,228,1)";
  cx.beginPath(); cx.arc(128, 128, 30, 0, 7); cx.fill();
  cx.fillStyle = "rgba(222,218,202,0.55)";
  cx.beginPath(); cx.arc(117, 119, 9, 0, 7); cx.fill();
  cx.beginPath(); cx.arc(139, 139, 6, 0, 7); cx.fill();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c),
    transparent: true, depthWrite: false, fog: false }));
  moon.position.set(150, 170, -190); moon.scale.set(60, 60, 1);
  scene.add(moon);
}

/* slow clouds: mauve where they face the sunset, slate where they face night */
for (let i = 0; i < 7; i++) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const cx = c.getContext("2d");
  for (let b = 0; b < 6; b++) {
    const bx = 40 + rnd2() * 176, by = 40 + rnd2() * 48, br = 24 + rnd2() * 34;
    const g = cx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g; cx.beginPath(); cx.arc(bx, by, br, 0, 7); cx.fill();
  }
  const m = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true,
    depthWrite: false, fog: false, opacity: 0.16 + rnd2() * 0.1 });
  m.color.set(rnd2() < 0.5 ? 0x8a6d96 : 0x51547e);
  const sp = new THREE.Sprite(m);
  const a = rnd2() * Math.PI * 2, r = 90 + rnd2() * 140;
  sp.position.set(Math.cos(a) * r, 34 + rnd2() * 46, Math.sin(a) * r);
  sp.scale.set(50 + rnd2() * 60, 14 + rnd2() * 12, 1);
  sp.userData.v = 0.004 + rnd2() * 0.004;
  scene.add(sp); FX.clouds.push(sp);
}

new RGBELoader().setPath(A + "hdri/").load("evening_road_01_puresky_1k.hdr", (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  const p = new THREE.PMREMGenerator(renderer);
  scene.environment = p.fromEquirectangular(t).texture;
  scene.environmentIntensity = 0.32;
  t.dispose(); p.dispose();
}, undefined, () => {});

/* ---------------- ground ---------------- */
const texLoader = new THREE.TextureLoader();
const tex = (f, rep) => { const t = texLoader.load(A + "textures/" + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t; };
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID * TILE * 4, GRID * TILE * 4),
  new THREE.MeshStandardMaterial({
    map: tex("grass_color.jpg", 130), normalMap: tex("grass_norm.jpg", 130),
    color: 0x4f6146, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.006; ground.receiveShadow = true;
scene.add(ground);

/* one flat green reads as a billiard table from the air. A second plane with
   large soft blotches gives the land some grain without another texture. */
const mottle = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const cx = c.getContext("2d");
  cx.clearRect(0, 0, 256, 256);
  let seed = 7;
  const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256, y = r() * 256, rad = 14 + r() * 46;
    const g = cx.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.1 + r() * 0.16;
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rad, 0, 7); cx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 7);
  return t;
})();
const mottlePlane = new THREE.Mesh(ground.geometry, new THREE.MeshBasicMaterial({
  color: 0x22331f, alphaMap: mottle, transparent: true, opacity: 0.34, depthWrite: false }));
mottlePlane.rotation.x = -Math.PI / 2; mottlePlane.position.y = -0.0016; mottlePlane.renderOrder = -1;
scene.add(mottlePlane);

/* ---------------- road network ----------------
   the spine runs north–south at x=15. Cross streets every 6 rows,
   and side streets that stop short at staggered rows so the plan
   never reads as a perfect lattice from the air.               */
const SPINE = 15;
/* verticals every 5 tiles, crosses every 7 — the mismatch alone stops the
   plan reading as graph paper, and the side streets stop short at staggered
   rows so blocks vary in size. Lots need 4 clear tiles between streets. */
const CROSS = [{ z: 4, x0: 5, x1: 25 }, { z: 11, x0: 5, x1: 30 }, { z: 18, x0: 2, x1: 25 },
               { z: 25, x0: 5, x1: 25 }, { z: 32, x0: 10, x1: 20 }];
const SIDE = [
  { x: 5,  z0: 4,  z1: 25 },
  { x: 10, z0: 4,  z1: 32 },
  { x: 20, z0: 4,  z1: 32 },
  { x: 25, z0: 11, z1: 25 },
  { x: 30, z0: 11, z1: 18 },
];
const isRoad = (x, z) => {
  if (x === SPINE && z >= 1 && z <= GRID - 2) return true;
  for (const c of CROSS) if (z === c.z && x >= c.x0 && x <= c.x1) return true;
  for (const s of SIDE) if (x === s.x && z >= s.z0 && z <= s.z1) return true;
  return false;
};
const road = [];
for (let z = 0; z < GRID; z++) { road[z] = []; for (let x = 0; x < GRID; x++) road[z][x] = isRoad(x, z); }
const R = (x, z) => !!(road[z] && road[z][x]);

const gx = (x) => (x - (GRID - 1) / 2) * TILE;      // grid -> world
const gz = (z) => (z - (GRID - 1) / 2) * TILE;

/* ---------------- loading ---------------- */
const gltf = new GLTFLoader();
const load = (p) => new Promise((res, rej) => gltf.load(`${A}models/${p}.glb`, (g) => res(g.scene), undefined, rej));
const firstMesh = (o) => { let m = null; o.traverse((n) => { if (!m && n.isMesh) m = n; }); return m; };

function instancer(src, count, shadows = true) {
  const m = firstMesh(src);
  if (!m) return null;
  const inst = new THREE.InstancedMesh(m.geometry, m.material, count);
  inst.castShadow = shadows; inst.receiveShadow = true;
  inst.count = 0; inst.frustumCulled = false;
  return inst;
}
const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), AX = new THREE.Vector3(0, 1, 0),
      V3 = new THREE.Vector3(), S3 = new THREE.Vector3();
function push(inst, x, y, z, ry, s = 1) {
  if (!inst || inst.count >= inst.instanceMatrix.count) return false;
  QT.setFromAxisAngle(AX, ry);
  M4.compose(V3.set(x, y, z), QT, S3.set(s, s, s));
  inst.setMatrixAt(inst.count++, M4);
  return true;
}

/* lived-in walls, pulled well off white — near-white blows out at
   any exposure that keeps the sky readable (learned on the clinic) */
const HOUSE_SCHEMES = [
  { wall: 0xcdbfa8, roof: 0x2e3441, trim: 0xded6c6, door: 0x35543f },
  { wall: 0xb9c3ba, roof: 0x2a323b, trim: 0xd6ded6, door: 0x7a4b38 },
  { wall: 0xb2bccb, roof: 0x263040, trim: 0xd3dae5, door: 0x274263 },
  { wall: 0xcbae9c, roof: 0x3d3130, trim: 0xdfd0c4, door: 0x5a3728 },
  { wall: 0xc2bcb3, roof: 0x31363d, trim: 0xd9d6d0, door: 0x46505c },
  { wall: 0xd3b6b1, roof: 0x39303a, trim: 0xe2cfcb, door: 0x693a46 },
  { wall: 0xbcc4b1, roof: 0x2b3428, trim: 0xd6dcce, door: 0x415030 },
];

(async function build() {
  const t0 = performance.now();

  /* ---- roads ---- */
  /* Measured off the tile geometry, not guessed from the palette: strip 2 is
     the thin centre line (a strip at z=0 spanning the tile), strip 7 is the
     footpath and kerbs. I had those two the wrong way round, which painted
     the centre line dark and left the footpaths glaring. */
  const ROAD_MAP = { 0: 0x242936, 1: 0x363c4c, 2: 0x9aa08e, 7: 0x565c67 };
  const asphaltN = tex("asphalt_norm.jpg", 1), asphaltR = tex("asphalt_rough.jpg", 1);
  const tiles = {};
  for (const n of ["road-straight", "road-bend", "road-intersection", "road-crossroad", "road-end"]) {
    try {
      const t = await load(`roads/${n}`);
      await paint(t, "roads", ROAD_MAP, A);
      t.traverse((o) => {
        if (!o.isMesh) return;
        o.material.roughness = 0.72; o.material.metalness = 0.0; o.material.envMapIntensity = 0.5;
        /* The tile's own UVs point at a 64px palette cell, so a detail map on
           channel 0 would just smear one colour. Give the geometry a second
           UV set derived from its own XZ and put real asphalt grain there. */
        const g = o.geometry, pos = g.attributes.position, uv1 = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) { uv1[i * 2] = pos.getX(i) * 3; uv1[i * 2 + 1] = pos.getZ(i) * 3; }
        g.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
        o.material.normalMap = asphaltN; o.material.normalMap.channel = 1;
        o.material.normalScale = new THREE.Vector2(0.5, 0.5);
        o.material.roughnessMap = asphaltR; o.material.roughnessMap.channel = 1;
      });
      tiles[n] = t;
    } catch (e) {}
  }
  const roadCount = road.flat().filter(Boolean).length;
  const roadInst = {};
  for (const k of Object.keys(tiles)) {
    const i = instancer(tiles[k], roadCount, false);
    if (i) { i.castShadow = false; roadInst[k] = i; scene.add(i); }
  }

  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    if (!road[z][x]) continue;
    const N = R(x, z - 1), S = R(x, z + 1), E = R(x + 1, z), W = R(x - 1, z);
    const n = [N, E, S, W].filter(Boolean).length;
    const H = Math.PI / 2;
    /* native orientations, measured off the tile geometry rather than guessed:
       straight runs east–west · end opens east · the T is missing north ·
       the bend joins west to south. rotation.y turns +X towards -Z.       */
    let k = "road-straight", ry = 0;
    if (n === 4) k = "road-crossroad";
    else if (n === 3) { k = "road-intersection"; ry = !N ? 0 : !W ? H : !S ? Math.PI : -H; }
    else if (n === 2 && ((N && S) || (E && W))) { k = "road-straight"; ry = (E && W) ? 0 : H; }
    else if (n === 2) { k = "road-bend"; ry = (S && W) ? 0 : (E && S) ? H : (N && E) ? Math.PI : -H; }
    else { k = "road-end"; ry = E ? 0 : N ? H : W ? Math.PI : -H; }
    push(roadInst[k] || roadInst["road-straight"], gx(x), 0, gz(z), ry);
  }

  /* ---- houses: instanced per (type × scheme), lit and unlit twins ----
     Lit-ness used to be a property of the instancer, so every copy of a
     type came on at once and whole streets switched together. Two twins
     per combination lets each house decide for itself.                 */
  const TYPES = ["a", "b", "c", "e", "g", "h", "j", "l", "n", "q"];
  /* Where should each type's driveway go? Measured per model (town space,
     after the b/j normalisation):
       front   — the drive meets a garage-reading wing/panel at local x
       carport — q's open car shelter; the car parks under the canopy
       garage  — j's true garage door on its +X side wall; the drive runs
                 down the side of the house to reach it
       side    — no garage: a parking pad past the house's side edge,
                 s = which side (kept off the front door)                  */
  const DRIVE_SPEC = {
    a: { mode: "side", s: 1 },
    b: { mode: "front", x: 0.55, w: 1.6 },     // lower right wing
    c: { mode: "front", x: -0.37, w: 1.5 },    // lower left wing
    e: { mode: "side", s: -1 },
    g: { mode: "side", s: 1 },
    h: { mode: "side", s: 1 },
    j: { mode: "garage", s: 1 },
    l: { mode: "side", s: -1 },
    n: { mode: "front", x: 0.55, w: 1.5 },     // right wing under the awning
    q: { mode: "carport", x: -0.39, w: 1.3 },  // the car shelter is the left bay
  };
  /* measured from the door vertices: every type fronts -Z except b and j,
     which front +Z — rotate those two at load so placement can assume -Z */
  const FRONT_PLUS_Z = new Set(["b", "j"]);
  const houseInst = [], houseLit = [];
  for (let ti = 0; ti < TYPES.length; ti++) {
    for (let si = 0; si < HOUSE_SCHEMES.length; si++) {
      if ((ti * 3 + si) % 4 !== 0) continue;             // a spread of combinations, not all 70
      const s = HOUSE_SCHEMES[si];
      const pair = [];
      for (const lit of [false, true]) {
        try {
          const src = await load(`houses/building-type-${TYPES[ti]}`);
          if (FRONT_PLUS_Z.has(TYPES[ti])) src.traverse((o) => { if (o.isMesh) o.geometry.rotateY(Math.PI); });
          await paint(src, "houses",
            { 0: s.roof, 1: s.door, 3: s.wall, 5: lit ? 0xffc27a : 0x2b3c56, 7: s.trim }, A);
          if (lit) src.traverse((o) => { if (o.isMesh) { o.material.emissiveMap = o.material.map; o.material.emissive = new THREE.Color(0x6a4a20); } });
          const inst = instancer(src, 90);
          if (!inst) { pair.push(null); continue; }
          inst.geometry.computeBoundingBox();
          const bb = inst.geometry.boundingBox;
          inst.userData.half = [Math.max(-bb.min.x, bb.max.x), Math.max(-bb.min.z, bb.max.z)];
          inst.userData.drive = DRIVE_SPEC[TYPES[ti]];
          scene.add(inst); pair.push(inst);
        } catch (e) { pair.push(null); }
      }
      if (pair[0]) { houseInst.push(pair[0]); houseLit.push(pair[1] || pair[0]); }
    }
  }

  /* ---- greenery: one instancer group per model (2 materials each) ---- */
  const GREEN = [
    ["tree_oak",        0x2c4d38, 0x4b3b2e],
    ["tree_default",    0x2f5840, 0x483828],
    ["tree_fat",        0x356040, 0x413226],
    ["tree_detailed",   0x2a4f3a, 0x4d3c2d],
    ["tree_pineRoundA", 0x22422f, 0x3d3025],
    ["tree_cone",       0x1f3d2d, 0x3a2e24],
    ["tree_oak_dark",   0x30584e, 0x443930],   // dusk-teal — the dream accent
    ["tree_detailed_dark", 0x483845, 0x42322a], // dusty plum, rare and quiet
  ];
  const trees = [];
  for (const [name, leaf, bark] of GREEN) {
    try {
      const src = await load(`nature/${name}`);
      tintByMaterial(src, { leafs: leaf, grass: leaf, wood: bark, bark });
      const parts = []; src.traverse((n) => { if (n.isMesh) parts.push(n); });
      trees.push(parts.map((p) => {
        const i = new THREE.InstancedMesh(p.geometry, p.material, 900);
        i.castShadow = true; i.receiveShadow = true; i.count = 0; i.frustumCulled = false;
        scene.add(i); return i;
      }));
    } catch (e) {}
  }
  const bushes = [], tufts = [];
  for (const [name, c, into] of [["plant_bush", 0x3d6b45, 0], ["plant_bushLarge", 0x436f48, 0],
                                 ["grass_large", 0x456845, 1]]) {
    try {
      const src = await load(`nature/${name}`);
      tintByMaterial(src, { leafs: c, grass: c, wood: 0x40342a, bark: 0x40342a });
      const parts = []; src.traverse((n) => { if (n.isMesh) parts.push(n); });
      (into ? tufts : bushes).push(parts.map((p) => {
        const i = new THREE.InstancedMesh(p.geometry, p.material, into ? 260 : 1100);
        i.castShadow = false; i.receiveShadow = true; i.count = 0; i.frustumCulled = false;
        scene.add(i); return i;
      }));
    } catch (e) {}
  }
  /* nothing gets planted on the tarmac — canopies may overhang, trunks may not.
     Each planting also gets a brightness jitter via instance colour, which is
     what stops a street of identical models reading as copy-paste. */
  const _C = new THREE.Color();
  const plant = (grp, x, z, s, ry) => {
    if (!grp || roadGap(x, z) < 0.06) return false;
    // driveways are hard ground — a tree mid-drive was the giveaway
    for (const [rcx, rcz, rhx, rhz] of driveRects) {
      if (Math.abs(x - rcx) < rhx + 0.07 && Math.abs(z - rcz) < rhz + 0.07) return false;
    }
    _C.setScalar(0.72 + rnd() * 0.28);
    grp.forEach((i) => { if (push(i, x, 0, z, ry, s)) i.setColorAt(i.count - 1, _C); });
    return true;
  };

  /* ---- driveways ---- */
  let driveInst = null;
  try {
    const d = await load("houses/driveway-long");
    await paint(d, "houses", { 0: 0x6b7180, 1: 0x6b7180 }, A);   // driveway samples strips 0+1
    driveInst = instancer(d, 420, false);
    if (driveInst) { driveInst.castShadow = false; scene.add(driveInst); }
  } catch (e) {}

  /* warm pools of window-light spilling onto the lawns — the single
     strongest "someone lives here" signal at dusk, one instanced draw call */
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, color: 0x9a5522, opacity: 0.62 });
  const poolInst = new THREE.InstancedMesh(poolGeo, poolMat, 260);
  poolInst.count = 0; poolInst.frustumCulled = false; poolInst.renderOrder = 1;
  scene.add(poolInst);
  const poolAt = (x, z, ry, w, d) => {
    if (poolInst.count >= poolInst.instanceMatrix.count) return;
    QT.setFromAxisAngle(AX, ry);
    M4.compose(V3.set(x, 0.012, z), QT, S3.set(w, 1, d));
    poolInst.setMatrixAt(poolInst.count++, M4);
  };

  /* ---- lay out the lots ------------------------------------------
     walk every street and drop a house every 2 tiles on each side,
     set back from the kerb, with a driveway to the road and planting
     in the verge. Occupancy stops lots from colliding at corners.  */
  const taken = new Set();
  const claim = (x, z) => { const k = `${x}|${z}`; if (taken.has(k)) return false; taken.add(k); return true; };

  /* How far is this world point from the nearest carriageway? Tile-adjacency
     was never enough: a corner lot is two tiles clear of its own street and
     still hanging over the one round the corner. Measure the real distance
     to every nearby road tile's square instead.                            */
  function roadGap(wx, wz) {
    const x0 = Math.round(wx / TILE + (GRID - 1) / 2), z0 = Math.round(wz / TILE + (GRID - 1) / 2);
    let best = Infinity;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const tx = x0 + a, tz = z0 + b;
      if (!R(tx, tz)) continue;
      const dx = Math.max(0, Math.abs(wx - gx(tx)) - TILE / 2);
      const dz = Math.max(0, Math.abs(wz - gz(tz)) - TILE / 2);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  }
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) if (road[z][x]) {
    claim(x, z);   // road tiles are never buildable
  }

  /* every lit frontage also drops a warm mote here — from the air these
     are what make the town twinkle; up close they melt into the windows */
  const practicals = [];
  const driveSpots = [];                 // [x, z, heading] — cars park nose-in here
  const driveRects = [];                 // [cx, cz, halfX, halfZ] — planting keeps off
  const placed = [];                     // [x, z, half-width] — no two houses may touch
  let houses = 0, hi = 0;
  function lot(sx, sz, dx, dz, along) {
    // sx,sz street tile; dx,dz unit normal pointing away from the street
    const cx = sx + dx * SETBACK, cz = sz + dz * SETBACK;
    // the lot occupies the two tiles behind the kerb — bail if either is road/claimed
    for (let k = 1; k <= 3; k++) {
      const tx = sx + dx * k, tz = sz + dz * k;
      if (tx < 1 || tz < 1 || tx > GRID - 2 || tz > GRID - 2) return false;
      if (R(tx, tz)) return false;
    }
    if (!claim(sx + dx, sz + dz)) return false;
    claim(sx + dx * 2, sz + dz * 2);
    claim(sx + dx * 3, sz + dz * 3);

    /* jitter was ±0.16 — enough for two wide neighbours jittered towards
       each other to close the whole 2-tile gap and touch */
    const jx = along.x * range(-0.07, 0.07), jz = along.z * range(-0.07, 0.07);
    const scale = range(0.86, 1.06);
    const ry = Math.atan2(dx, dz);                      // fronts are -Z; this turns them to the street
    const c = Math.cos(ry), sn = Math.sin(ry);
    /* pick the widest house that fits this spot: clear of every carriageway
       (exact rotated footprint) AND clear of every neighbour (exact AABB —
       all houses are axis-aligned). The old first-tile-only claim let two
       corner lots interpenetrate; the AABB is what actually forbids it. */
    const trySite = (setb, shift) => {
      const wx2 = gx(sx + dx * setb) + jx + along.x * shift,
            wz2 = gz(sz + dz * setb) + jz + along.z * shift;
      const fits = (h) => {
        const [hx, hz] = h.userData.half;
        /* corners AND edge midpoints — a road stub ending mid-wall slips
           between corner samples */
        for (const [ux, uz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const ax = ux * hx * scale, az = uz * hz * scale;
          if (roadGap(wx2 + ax * c + az * sn, wz2 - ax * sn + az * c) < 0.02) return false;
        }
        const axh = (Math.abs(sn) > 0.5 ? hz : hx) * scale, azh = (Math.abs(sn) > 0.5 ? hx : hz) * scale;
        for (const [px2, pz2, pxh, pzh] of placed) {
          if (Math.abs(wx2 - px2) < axh + pxh + 0.04 && Math.abs(wz2 - pz2) < azh + pzh + 0.04) return false;
        }
        return true;
      };
      for (let k = 0; k < houseInst.length; k++) {
        const j = (hi + k) % houseInst.length;
        if (fits(houseInst[j])) return { idx: j, wx2, wz2, adv: k + 1 };
      }
      return null;
    };
    /* a blocked corner lot dodges before giving up: sideways along its own
       street (away from the perpendicular neighbour), then deeper, then both */
    let site = null, deep = false, shift = 0;
    for (const [setb, sh] of [[SETBACK, 0], [SETBACK, 0.55], [SETBACK, -0.55],
                              [SETBACK + 0.42, 0], [SETBACK + 0.42, 0.55], [SETBACK + 0.42, -0.55]]) {
      site = trySite(setb, sh);
      if (site) { deep = setb > SETBACK; shift = sh; break; }
    }
    if (!site) { (globalThis.__lotFail ??= {}).noFit = (globalThis.__lotFail.noFit || 0) + 1; return false; }
    const { idx, wx2: wx, wz2: wz } = site;
    hi += site.adv;
    const evening = rnd() < 0.45;                        // this house, not this type
    if (!push(evening ? houseLit[idx] : houseInst[idx], wx, 0, wz, ry, scale)) return false;
    {
      const [hx2, hz2] = houseInst[idx].userData.half;
      const sn2 = Math.abs(Math.sin(ry)) > 0.5;
      placed.push([wx, wz, (sn2 ? hz2 : hx2) * scale, (sn2 ? hx2 : hz2) * scale]);
    }
    houses++;
    // lit windows spill onto the front garden
    if (evening) {
      poolAt(wx - dx * (0.62 * scale + 0.2), wz - dz * (0.62 * scale + 0.2), ry, 1.9, 1.2);
      practicals.push(wx - dx * 0.68 * scale, 0.34, wz - dz * 0.68 * scale);
    }

    /* the driveway aims at what the house actually offers: its garage-
       reading wing, its carport bay, its true side garage — or failing all
       of those, a pad past its side edge. Local x maps to the world as
       (lx·cos ry, -lx·sin ry).                                            */
    const spec = houseInst[idx].userData.drive || { mode: "side", s: 1 };
    if (Q.has("tlog") && spec.mode !== "side")
      console.log("audit-place:", spec.mode, wx.toFixed(1), wz.toFixed(1), "grid", (wx / TILE + (GRID - 1) / 2).toFixed(1), (wz / TILE + (GRID - 1) / 2).toFixed(1));
    const hxu = houseInst[idx].userData.half[0];
    let lx, dw = 1.0, spotD = 1.02;
    let dlen = deep ? 2.95 : 2.2, dctr = deep ? 1.0 : 0.86;
    if (spec.mode === "front") { lx = spec.x * scale; dw = spec.w; }
    else if (spec.mode === "carport") { lx = spec.x * scale; dw = spec.w; spotD = deep ? 1.9 : 1.48; }
    else if (spec.mode === "garage") {
      lx = (hxu * scale + 0.2) * spec.s;
      dlen += 0.75; dctr += 0.16;                 // the drive runs down the side wall
      spotD = deep ? 1.85 : 1.42;
    } else lx = (hxu * scale + 0.2) * spec.s;
    const ox = lx * c, oz = -lx * sn;
    if (driveInst) {
      const dcx = gx(sx + dx * dctr) + ox + along.x * shift,
            dcz = gz(sz + dz * dctr) + oz + along.z * shift;
      QT.setFromAxisAngle(AX, ry);
      M4.compose(V3.set(dcx, 0.0235, dcz), QT, S3.set(dw, 1, dlen));
      if (driveInst.count < driveInst.instanceMatrix.count) driveInst.setMatrixAt(driveInst.count++, M4);
      driveSpots.push([gx(sx + dx * spotD) + ox + along.x * shift, gz(sz + dz * spotD) + oz + along.z * shift, ry + Math.PI]);
      const wHalf = dw * 0.18, lHalf = dlen * 0.2;
      driveRects.push(Math.abs(sn) > 0.5 ? [dcx, dcz, lHalf, wHalf] : [dcx, dcz, wHalf, lHalf]);
    }
    // a street tree in the verge, on the other side of the frontage
    if (trees.length && rnd() < 0.7) {
      const ts = -Math.sign(lx || 1);
      plant(pick(trees), gx(sx + dx * 0.72) + along.x * ts * 0.5, gz(sz + dz * 0.72) + along.z * ts * 0.5, range(0.4, 0.62), rnd() * 7);
    }
    // shrubs against the frontage — never on the drive
    if (bushes.length) for (let b = 0; b < 2; b++) if (rnd() < 0.6) {
      const off = range(-0.5, 0.5) * hxu * scale;
      if (Math.abs(off - lx) < dw * 0.18 + 0.14) continue;
      plant(pick(bushes), wx - dx * (houseInst[idx].userData.half[1] * scale + 0.16) + along.x * off,
            wz - dz * (houseInst[idx].userData.half[1] * scale + 0.16) + along.z * off, range(0.5, 0.9), rnd() * 7);
    }
    // a hedge down one side boundary — the side the drive doesn't use
    if (bushes.length && rnd() < 0.6) {
      const hs = spec.mode === "front" ? (rnd() < 0.5 ? -1 : 1) : -Math.sign(lx || 1), grp = pick(bushes);
      for (let k = 0; k < 8; k++) {
        const d = 1.0 + k * 0.28;
        plant(grp, gx(sx + dx * d) + along.x * hs * 1.0, gz(sz + dz * d) + along.z * hs * 1.0,
              range(0.5, 0.62), rnd() * 7);
      }
    }
    // the back garden: a canopy tree and some low planting — unless the
    // house itself was dodged deep into the garden and needs the room
    if (!deep && trees.length && rnd() < 0.7) {
      plant(pick(trees), gx(sx + dx * 2.9) + range(-0.45, 0.45), gz(sz + dz * 2.9) + range(-0.45, 0.45), range(0.55, 0.9), rnd() * 7);
    }
    if (bushes.length) for (let b = 0; b < 2; b++) if (rnd() < 0.5) {
      plant(pick(bushes), gx(sx + dx * range(2.2, 3.3)) + range(-0.6, 0.6), gz(sz + dz * range(2.2, 3.3)) + range(-0.6, 0.6), range(0.5, 0.8), rnd() * 7);
    }
    return true;
  }

  /* ---- downtown -------------------------------------------------
     A block of the route where the houses stop and shopfronts meet
     the pavement. Without it the whole drive is one texture, and a
     four-minute scroll through identical bungalows is a long time.
     Terraced: each unit is placed against the last, not on a grid. */
  const shopInst = [];
  const SHOP_WALLS = [0x6f5f57, 0x5c6470, 0x74655a, 0x5a5f56, 0x6b5a5e];
  for (let i = 0; i < 5; i++) {
    const name = ["building-a", "building-c", "building-e", "building-h", "building-k"][i];
    try {
      const src = await load(`commercial/${name}`);
      // strip 1 carries both the dark trim and the warm shop lights — leave it
      await paint(src, "commercial", { 0: SHOP_WALLS[i], 3: 0xcfc7ba, 5: 0xffca86 }, A);
      src.traverse((o) => { if (o.isMesh) { o.material.emissiveMap = o.material.map; o.material.emissive = new THREE.Color(0x3a2c18); } });
      const inst = instancer(src, 24);
      if (!inst) continue;
      inst.geometry.computeBoundingBox();
      const bb = inst.geometry.boundingBox;
      inst.userData.half = [Math.max(-bb.min.x, bb.max.x), Math.max(-bb.min.z, bb.max.z)];
      scene.add(inst); shopInst.push(inst);
    } catch (e) {}
  }
  let awn = null;
  try {
    const aw = await load("commercial/detail-awning-wide");
    await paint(aw, "commercial", { 0: 0x74463e }, A);   // canvas + frame, one worn red
    awn = instancer(aw, 40);
    if (awn) scene.add(awn);
  } catch (e) {}

  const DOWNTOWN = { z0: 12, z1: 17 };
  let shops = 0;
  if (shopInst.length) for (const side of [-1, 1]) {
    let z = DOWNTOWN.z0;
    while (z < DOWNTOWN.z1) {
      const s = pick(shopInst), [hw, hd] = s.userData.half;
      const cx = SPINE + side * (0.74 + hd);             // ~2 m of footpath in front
      if (z + hw * 2 > DOWNTOWN.z1) break;
      const cz = z + hw;
      const ry = side * Math.PI / 2;                     // shopfronts are -Z; turn them to the street
      if (push(s, gx(cx), 0, gz(cz), ry)) {
        shops++;
        poolAt(gx(SPINE + side * 0.62), gz(cz), ry, 0.9, hw * 2.2);
        practicals.push(gx(cx - side * hd * 0.9), 0.3, gz(cz));
        /* awnings hang on the facade plane; the model protrudes streetward
           (z 0.10..0.25 measured), one per ~0.9 u of frontage */
        const nAwn = Math.max(1, Math.round(hw * 2 / 0.95));
        for (let k = 0; k < nAwn; k++) {
          const oz = (k - (nAwn - 1) / 2) * (hw * 2 / nAwn);
          push(awn, gx(cx - side * hd), 0.24, gz(cz) + oz, ry + Math.PI, 0.85);
        }
      }
      for (let t = Math.floor(z); t <= Math.ceil(z + hw * 2); t++) { claim(SPINE + side, t); claim(SPINE + side * 2, t); }
      z += hw * 2 + 0.02;
    }
  }

  /* festoon lights swagged across the downtown street */
  {
    const bulbGeo = new THREE.SphereGeometry(0.012, 6, 5);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    bulbMat.color.multiplyScalar(2.4);                   // past 1 so bloom catches them
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 140);
    bulbs.count = 0; bulbs.frustumCulled = false; scene.add(bulbs);
    const wire = [];
    for (let zz = DOWNTOWN.z0 + 0.4; zz < DOWNTOWN.z1; zz += 0.8) {
      let prev = null;
      for (let k = 0; k <= 14; k++) {
        const t2 = k / 14;
        // the shopfront planes sit at exactly ±0.74 — the wire reaches them
        const wx2 = gx(SPINE) + (t2 - 0.5) * 1.5, wy2 = 0.62 - Math.sin(Math.PI * t2) * 0.13;
        push(bulbs, wx2, wy2, gz(zz), 0, 1);
        if (prev) wire.push(prev[0], prev[1] + 0.014, prev[2], wx2, wy2 + 0.014, gz(zz));
        prev = [wx2, wy2, gz(zz)];
      }
    }
    bulbs.instanceMatrix.needsUpdate = true;
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(wire, 3));
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x10131c })));
  }

  /* ---- the park: one block left green, so the air view has a lung -- */
  const PARK = { x0: 21, x1: 24, z0: 19, z1: 24 };
  for (let x = PARK.x0; x <= PARK.x1; x++) for (let z = PARK.z0; z <= PARK.z1; z++) claim(x, z);

  /* a pond at the heart of the park — still water that mirrors the dusk */
  const pondC = { x: gx(22.5), z: gz(21.5) };
  {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1.45, 40),
      new THREE.MeshStandardMaterial({
        /* mirror-flat water blew out white at grazing angles — a touch of
           roughness and less metal keeps the sky in it without the glare */
        color: 0x16283f, roughness: 0.14, metalness: 0.45, envMapIntensity: 0.75 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(pondC.x, 0.004, pondC.z);
    scene.add(pond);
    for (let a = 0; a < Math.PI * 2; a += 0.32) {
      const r = 1.55 + rnd() * 0.35;
      const px2 = pondC.x + Math.cos(a) * r, pz2 = pondC.z + Math.sin(a) * r * 1.15;
      if (rnd() < 0.75) plant(rnd() < 0.5 && tufts.length ? pick(tufts) : pick(bushes), px2, pz2, range(0.5, 0.85), rnd() * 7);
    }
  }

  for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) {
    if (!road[z][x]) continue;
    const vertical = R(x, z - 1) || R(x, z + 1);
    const along = vertical ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const step = vertical ? z : x;
    if (step % 2) continue;                              // a lot every two tiles
    if (vertical) { lot(x, z, -1, 0, along); lot(x, z, 1, 0, along); }
    else { lot(x, z, 0, -1, along); lot(x, z, 0, 1, along); }
  }

  /* park planting: big canopies round a clear middle, so it reads as
     managed parkland rather than the leftover scrub between blocks */
  for (let x = PARK.x0; x <= PARK.x1; x++) for (let z = PARK.z0; z <= PARK.z1; z++) {
    const pondD = Math.hypot(gx(x) - pondC.x, gz(z) - pondC.z);
    if (pondD < 1.9) continue;
    const edge = x === PARK.x0 || x === PARK.x1 || z === PARK.z0 || z === PARK.z1;
    /* the water needs a vista: no canopy inside the park at all — trees
       live on the outer edge ring only, and the east edge stays open so
       the pond reads from the avenue the route drives down */
    const vista = x === PARK.x1 && Math.abs(gz(z) - pondC.z) < 2.2;
    const n = edge && !vista ? (pondD < 3.4 ? 1 : 2) : 0;
    for (let k = 0; k < n; k++) {
      const tx2 = gx(x) + range(-0.45, 0.45), tz2 = gz(z) + range(-0.45, 0.45);
      if (Math.hypot(tx2 - pondC.x, tz2 - pondC.z) < 2.6) continue;
      plant(pick(trees), tx2, tz2, range(0.65, 1.05), rnd() * 7);
    }
    if (bushes.length && rnd() < 0.5) plant(pick(bushes), gx(x) + range(-0.45, 0.45), gz(z) + range(-0.45, 0.45), range(0.6, 0.95), rnd() * 7);
    if (tufts.length && rnd() < 0.35) plant(pick(tufts), gx(x) + range(-0.45, 0.45), gz(z) + range(-0.45, 0.45), range(0.6, 1.0), rnd() * 7);
  }

  /* ---- placement audit ------------------------------------------
     Squinting at renders is how the driveways-on-the-lawn and
     trees-in-the-road bugs survived three passes. Instead, walk the
     instance matrices and prove nothing overlaps the carriageway.  */
  function audit() {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const onRoad = (wx, wz, clear) => roadGap(wx, wz) <= clear;
    const report = [];
    /* test the four ground corners of each instance's footprint, so a
       house that merely leans over the kerb is caught too */
    const check = (label, insts, clear, shrink = 0.9) => {
      let bad = 0, total = 0;
      for (const i of insts) {
        if (!i) continue;
        i.geometry.computeBoundingBox();
        const bb = i.geometry.boundingBox;
        for (let k = 0; k < i.count; k++) {
          total++;
          i.getMatrixAt(k, m);
          for (const [bx, bz] of [[bb.min.x, bb.min.z], [bb.max.x, bb.min.z], [bb.min.x, bb.max.z], [bb.max.x, bb.max.z]]) {
            p.set(bx * shrink, 0, bz * shrink).applyMatrix4(m);
            if (onRoad(p.x, p.z, clear)) { bad++; break; }
          }
        }
      }
      if (bad) report.push(`${label} ${bad}/${total} over the carriageway`);
    };
    check("houses", [...houseInst, ...houseLit], 0.0, 0.92);
    let badTrunks = 0, trunks = 0;
    for (const g of trees) { const i = g[0]; if (!i) continue;
      for (let k = 0; k < i.count; k++) { trunks++; i.getMatrixAt(k, m); m.decompose(p, q, sc);
        if (roadGap(p.x, p.z) < 0.05) badTrunks++; } }
    if (badTrunks) report.push(`trees ${badTrunks}/${trunks} trunks on the carriageway`);
    if (lampInst) { let badPoles = 0;
      for (let k = 0; k < lampInst.count; k++) { lampInst.getMatrixAt(k, m); m.decompose(p, q, sc);
        // lamps stand on the pavement, so they may sit inside the tile — but
        // never more than a third of the way in towards the centreline
        const x = Math.round(p.x / TILE + (GRID - 1) / 2), z = Math.round(p.z / TILE + (GRID - 1) / 2);
        const vertical = R(x, z - 1) || R(x, z + 1);
        if (Math.abs(vertical ? p.x - gx(x) : p.z - gz(z)) < 0.4) badPoles++; }
      if (badPoles) report.push(`lamps ${badPoles}/${lampInst.count} poles in the lane`); }
    /* orientation: fronts are -Z after normalisation, so every instance's
       front sample point must sit nearer the carriageway than its back.
       This is the check that would have caught the backwards lamps and
       the shops mooning the street. */
    const facing = (label, insts) => {
      let bad = 0, total = 0;
      const f = new THREE.Vector3(), bk = new THREE.Vector3();
      for (const i of insts) {
        if (!i) continue;
        const hz = i.userData.half ? i.userData.half[1] : 0.4;
        for (let k = 0; k < i.count; k++) {
          total++;
          i.getMatrixAt(k, m);
          f.set(0, 0, -hz * 0.8).applyMatrix4(m);
          bk.set(0, 0, hz * 0.8).applyMatrix4(m);
          if (roadGap(f.x, f.z) > roadGap(bk.x, bk.z) + 0.01) bad++;
        }
      }
      if (bad) report.push(`${label} ${bad}/${total} facing away from their street`);
    };
    facing("houses", [...houseInst, ...houseLit]);
    facing("shops", shopInst);
    if (lampInst) {
      let badArm = 0;
      for (let k = 0; k < lampInst.count; k++) {
        lampInst.getMatrixAt(k, m);
        p.set(0, 0.65, -0.15).applyMatrix4(m);
        const lens = roadGap(p.x, p.z);
        p.set(0, 0, 0.02).applyMatrix4(m);
        if (lens > roadGap(p.x, p.z) + 0.005) badArm++;
      }
      if (badArm) report.push(`lamps ${badArm}/${lampInst.count} arms turned away from the road`);
    }
    console.log("audit:", report.length ? report.join(" · ") : "clear");
    return report;
  }

  /* ---- fill the leftover land: block interiors, then open country --- */
  for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) {
    if (taken.has(`${x}|${z}`)) continue;
    const inTown = x > 3 && x < 27 && z > 2 && z < GRID - 3;
    const p = inTown ? 0.45 : 0.3;
    if (trees.length && rnd() < p) {
      plant(pick(trees), gx(x) + range(-0.4, 0.4), gz(z) + range(-0.4, 0.4), range(0.5, 0.95), rnd() * 7);
      if (rnd() < 0.4) plant(pick(trees), gx(x) + range(-0.45, 0.45), gz(z) + range(-0.45, 0.45), range(0.4, 0.7), rnd() * 7);
    }
    if (bushes.length && rnd() < 0.35) plant(pick(bushes), gx(x) + range(-0.45, 0.45), gz(z) + range(-0.45, 0.45), range(0.5, 0.85), rnd() * 7);
    if (tufts.length && rnd() < 0.25) plant(pick(tufts), gx(x) + range(-0.45, 0.45), gz(z) + range(-0.45, 0.45), range(0.5, 0.9), rnd() * 7);
  }

  /* ---- the outskirts ---------------------------------------------
     The grid ends at a hard edge, which from the air looks like the
     world runs out. Beyond it: farmland laid out as one merged mesh
     with per-vertex colour (one draw call for the lot), hedgerows of
     shrubs along the field boundaries, and woodland thickening into
     the haze. Nothing here is ever seen up close.                   */
  const EDGE = (GRID * TILE) / 2;
  const FAR = EDGE + 34;
  {
    /* dusk farmland: pasture, stubble, ploughed earth, rape. The town's grass
       carries a texture map that darkens it, so untextured fields need to be
       mixed well down to belong to the same evening. */
    const FIELDS = [0x6c7a4e, 0x7a7c55, 0x8b8362, 0x5d6c46, 0x847e5c, 0x71794e, 0x536242, 0x808759];
    const verts = [], cols = [], uvs = [];
    const quad = (x0, z0, x1, z1, c) => {
      const col = new THREE.Color(c);
      // wound anticlockwise seen from above, or the normals point at the ground
      const p = [[x0, z0], [x1, z1], [x1, z0], [x0, z0], [x0, z1], [x1, z1]];
      for (const [px, pz] of p) {
        verts.push(px, -0.0028, pz); cols.push(col.r, col.g, col.b);
        uvs.push(px * 0.6, pz * 0.6);          // shared grass map, so fields sit in the same tonal range
      }
    };
    let fields = 0;
    for (let x = -FAR; x < FAR; ) {
      const w = range(4, 9);
      for (let z = -FAR; z < FAR; ) {
        const d = range(4, 9);
        // skip anything that touches the built grid
        const outside = x + w < -EDGE - 1 || x > EDGE + 1 || z + d < -EDGE - 1 || z > EDGE + 1;
        if (outside) {
          const near = THREE.MathUtils.clamp((Math.max(Math.abs(x), Math.abs(z)) - EDGE) / 12, 0, 1);
          const c = new THREE.Color(pick(FIELDS)).lerp(new THREE.Color(0x3c4a33), 1 - near);
          quad(x + 0.12, z + 0.12, x + w - 0.12, z + d - 0.12, c.getHex());
          fields++;
          // hedgerow along two sides, thinning with distance from town
          const far = Math.max(Math.abs(x), Math.abs(z));
          const density = THREE.MathUtils.clamp(1.15 - far / FAR, 0.15, 0.9);
          if (bushes.length) {
            for (let t = 0; t < w; t += 0.6) if (rnd() < density) plant(pick(bushes), x + t, z + 0.1, range(0.6, 0.95), rnd() * 7);
            for (let t = 0; t < d; t += 0.6) if (rnd() < density) plant(pick(bushes), x + 0.1, z + t, range(0.6, 0.95), rnd() * 7);
          }
          // a copse in the corner of some fields
          if (trees.length && rnd() < 0.35) {
            const cx2 = x + range(1, w - 1), cz2 = z + range(1, d - 1);
            for (let k = 0; k < 3 + Math.floor(rnd() * 5); k++) {
              plant(pick(trees), cx2 + range(-1.2, 1.2), cz2 + range(-1.2, 1.2), range(0.7, 1.2), rnd() * 7);
            }
          }
        }
        z += d;
      }
      x += w;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();          // no normals = no lighting = invisible
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex("grass_color.jpg", 1), normalMap: tex("grass_norm.jpg", 1),
      roughness: 1, metalness: 0 }));
    m.receiveShadow = false; m.renderOrder = -2;
    scene.add(m);
    hud.dataset.fields = fields;
  }

  /* the practicals layer: one additive Points cloud for every lit frontage */
  if (practicals.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(practicals, 3));
    /* constant screen-size: from the air these hold as ~4px sparks instead of
       shrinking to nothing; up close they tuck inside the lit windows */
    const m = new THREE.PointsMaterial({ map: glowTex, color: 0xffcf8e, size: 6,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
    m.color.multiplyScalar(2.0);
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    scene.add(pts);
  }

  /* ---- ground mist: a soft breath over the fields and the pond ---- */
  {
    const drop2 = (x, z, w, h, o) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x3d5480,
        transparent: true, opacity: o, depthWrite: false }));
      sp.scale.set(w, h, 1); sp.position.set(x, h * 0.14, z);
      sp.userData.x0 = x; scene.add(sp); FX.mist.push(sp);
    };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = EDGE + 4 + rnd() * 9;
      drop2(Math.cos(a) * r, Math.sin(a) * r, range(9, 16), range(1.2, 1.9), 0.1 + rnd() * 0.05);
    }
    drop2(pondC.x, pondC.z + 0.4, 4.2, 1.1, 0.15);
  }

  /* ---- fireflies: the dream layer — drifting motes in park and gardens */
  {
    const N = 90, base = new Float32Array(N * 3), ph = new Float32Array(N);
    let n = 0;
    const drop = (x, z) => { if (n >= N || roadGap(x, z) < 0.5) return;
      base[n * 3] = x; base[n * 3 + 1] = 0.22 + rnd() * 0.5; base[n * 3 + 2] = z; ph[n] = rnd() * 7; n++; };
    for (let i = 0; i < 42; i++) drop(pondC.x + (rnd() - 0.5) * 3.6, pondC.z + (rnd() - 0.5) * 4.4);
    for (let i = 0; i < 48; i++) {
      const zz = range(3, 31), sd = rnd() < 0.5 ? -1 : 1;
      drop(gx(SPINE + sd * range(1.2, 2.6)), gz(zz));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    const m = new THREE.PointsMaterial({ map: glowTex, color: 0xffe2a0, size: 0.05,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    m.color.multiplyScalar(1.7);
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    scene.add(pts);
    FX.flies = { pts, base, ph };
  }

  /* ---- street lamps: real kit models, lights only near the route ---- */
  let lampInst = null, lamps = 0;
  try {
    const l = await load("roads/light-curved");
    await paint(l, "roads", { 7: 0x1e2433, 0: 0xffb066 }, A);   // dark pole, warm lens
    l.traverse((o) => { if (o.isMesh) { o.material.metalness = 0.55; o.material.roughness = 0.5; } });
    lampInst = instancer(l, 260);
    if (lampInst) scene.add(lampInst);
  } catch (e) {}
  const glowGeo = new THREE.SphereGeometry(0.05, 8, 6);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc98d, fog: true });
  glowMat.color.multiplyScalar(2.0);
  const glowInst = new THREE.InstancedMesh(glowGeo, glowMat, 260);
  glowInst.count = 0; glowInst.frustumCulled = false; scene.add(glowInst);

  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    if (!road[z][x]) continue;
    const vertical = R(x, z - 1) || R(x, z + 1);
    const step = vertical ? z : x;
    if (step % 4) continue;
    const side = ((vertical ? x : z) + step) % 8 < 4 ? 1 : -1;
    const dx = vertical ? side : 0, dz = vertical ? 0 : side;
    // the arm reaches along -Z (lens measured at z=-0.15): atan2(dx,dz)
    // maps -Z onto (-dx,-dz), which is the direction back towards the road
    const ry = Math.atan2(dx, dz);
    const px = gx(x) + dx * 0.47, pz = gz(z) + dz * 0.47;
    if (!push(lampInst, px, 0, pz, ry, 1)) continue;
    lamps++;
    push(glowInst, px - dx * 0.15, 0.65, pz - dz * 0.15, 0, 1);
    // real point lights are expensive — only along the route
    if (Math.abs(x - SPINE) <= 1) {
      const pl = new THREE.PointLight(0xffb877, 1.6, 4.2, 2);
      pl.position.set(px - dx * 0.15, 0.6, pz - dz * 0.15);
      scene.add(pl);
    }
  }

  [...Object.values(roadInst), ...houseInst, ...houseLit, ...shopInst, awn, ...trees.flat(),
   ...bushes.flat(), ...tufts.flat(), lampInst, glowInst, driveInst, poolInst]
    .forEach((i) => { if (i) { i.instanceMatrix.needsUpdate = true;
      if (i.instanceColor) i.instanceColor.needsUpdate = true; } });

  /* ---- far field: silhouette ridges dissolving into the haze ---- */
  const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x1f2946, fog: true });
  for (let r = 0; r < 3; r++) {
    const d = 46 + r * 22, h = 5 + r * 3.5;
    const g = new THREE.CylinderGeometry(d, d, h, 44, 1, true);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) pos.setY(i, h / 2 * (0.35 + Math.abs(Math.sin(i * 1.7 + r) * 0.9)));
    }
    const m = new THREE.Mesh(g, ridgeMat.clone());
    m.material.color.setHSL(0.62, 0.26 - r * 0.07, 0.14 + r * 0.03);
    m.material.side = THREE.BackSide;
    m.position.y = h / 2 - h * 0.42;
    scene.add(m);
  }

  /* ---- contact shadows -------------------------------------------
     A shadow map at town scale can't resolve the gap under a car, so
     every vehicle reads as if it's hovering. A soft blob laid on the
     tarmac fixes the grounding for one draw call.                    */
  const blobTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const cx = c.getContext("2d");
    const g = cx.createRadialGradient(64, 64, 0, 64, 64, 62);
    g.addColorStop(0, "rgba(0,0,0,0.72)");
    g.addColorStop(0.45, "rgba(0,0,0,0.42)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true,
    depthWrite: false, opacity: 0.85, color: 0x0a0d16 });
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobInst = new THREE.InstancedMesh(blobGeo, blobMat, 90);
  blobInst.count = 0; blobInst.frustumCulled = false; blobInst.renderOrder = 2;
  scene.add(blobInst);
  const blobAt = (x, z, ry, w, d, y = ROAD_TOP + 0.005) => {
    if (blobInst.count >= blobInst.instanceMatrix.count) return;
    QT.setFromAxisAngle(AX, ry);
    M4.compose(V3.set(x, y, z), QT, S3.set(w, 1, d));
    blobInst.setMatrixAt(blobInst.count++, M4);
  };

  /* ---- the car ---- */
  let car = null, carBlob = null;
  try {
    car = await load("vehicles/sedan");
    await paint(car, "vehicles", { 6: 0xb9c2d0, 0: 0x131f31, 1: 0xffe3b0, 3: 0x3a3f4c }, A);
    car.scale.setScalar(CAR_SCALE);
    scene.add(car);
    carBlob = new THREE.Mesh(blobGeo, blobMat.clone());
    carBlob.scale.set(0.62, 1, 0.92); carBlob.renderOrder = 2;
    scene.add(carBlob);
  } catch (e) {}

  /* parked cars give the street life for almost nothing */
  const PARKED = [["suv", 0x6c7b8c], ["hatchback-sports", 0x8f5a54], ["van", 0xc9c2b4], ["taxi", 0xd8a44e]];
  for (const [name, col] of PARKED) {
    try {
      const src = await load(`vehicles/${name}`);
      // band 1 is the lamp glass: parked cars keep theirs switched off
      await paint(src, "vehicles", { 6: col, 0: 0x131f31, 1: 0x878d95, 3: 0x3a3f4c }, A);
      src.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(src);
      const lift = -b.min.y * CAR_SCALE,
            bw = (b.max.x - b.min.x) * CAR_SCALE * 1.25, bd = (b.max.z - b.min.z) * CAR_SCALE * 1.1;
      const parts = []; src.traverse((n) => { if (n.isMesh) parts.push(n); });
      /* the wheels are separate meshes placed by NODE transforms — instancing
         the raw geometry collapsed all four onto the origin, which is why
         every parked car in town was riding on its belly. Bake each node's
         world matrix into its geometry first. */
      const grp = parts.map((p) => {
        const g = p.geometry.clone().applyMatrix4(p.matrixWorld);
        const i = new THREE.InstancedMesh(g, p.material, 60);
        i.castShadow = true; i.receiveShadow = true; i.count = 0; i.frustumCulled = false;
        scene.add(i); return i;
      });
      /* an 8 m street has no room for mid-lane parking — cars live on the
         driveways, nose-in, with just a few hugging the kerb elsewhere */
      const ti2 = PARKED.findIndex(([n2]) => n2 === name);
      for (let k = ti2; k < driveSpots.length; k += PARKED.length) {
        if (rnd() > 0.4) continue;
        const [px, pz, hry] = driveSpots[k];
        grp.forEach((i) => push(i, px, lift + 0.034, pz, hry, CAR_SCALE));
        blobAt(px, pz, hry, bw, bd, 0.037);
      }
      const onRoute = (x, z) =>
        (x === SPINE && z <= 18) || (z === 18 && x >= SPINE && x <= 20) || (x === 20 && z >= 18);
      for (let z = 2; z < GRID - 2; z++) for (let x = 1; x < GRID - 1; x++) {
        if (!road[z][x] || onRoute(x, z) || rnd() > 0.02) continue;
        const vertical = R(x, z - 1) || R(x, z + 1);
        const side = rnd() < 0.5 ? 1 : -1;
        const ry = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const px = gx(x) + (vertical ? side * 0.34 : range(-0.28, 0.28));
        const pz = gz(z) + (vertical ? range(-0.28, 0.28) : side * 0.34);
        grp.forEach((i) => push(i, px, lift + ROAD_TOP, pz, ry, CAR_SCALE));
        blobAt(px, pz, ry, bw, bd);
      }
      grp.forEach((i) => { i.instanceMatrix.needsUpdate = true; });
    } catch (e) {}
  }
  blobInst.instanceMatrix.needsUpdate = true;

  /* ---- the route: south down the spine through downtown, a right turn
     at the cross street, then down the avenue past the park ---- */
  const route = new THREE.CatmullRomCurve3([
    [15, 2], [15, 8], [15, 13], [15, 16.6], [15.5, 17.75], [17, 18], [18.8, 18],
    [19.85, 18.3], [20, 19.5], [20, 23], [20, 27], [20, 31.5],
  ].map(([x, z]) => new THREE.Vector3(gx(x), 0, gz(z))), false, "catmullrom", 0.35);

  audit();

  /* ---- stats ---- */
  let tris = 0, draws = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    draws++;
    const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  const treeCount = trees.reduce((a, g) => a + (g[0] ? g[0].count : 0), 0);
  console.log("audit-lots:", JSON.stringify(globalThis.__lotFail || {}));
  hud.innerHTML =
    `<b>town</b>  ${GRID}×${GRID} tiles · 1 tile ≈ 8 m<br>` +
    `<span class="dim">houses</span> ${houses} &nbsp; <span class="dim">shops</span> ${shops} &nbsp; <span class="dim">trees</span> ${treeCount} &nbsp; <span class="dim">lamps</span> ${lamps}<br>` +
    `<span class="dim">draw calls</span> ${draws} &nbsp; <span class="dim">tris</span> ${(tris / 1000).toFixed(0)}k` +
    ` &nbsp; <span class="dim">fields</span> ${hud.dataset.fields || 0}` +
    ` &nbsp; <span class="dim">built in</span> ${((performance.now() - t0) / 1000).toFixed(1)}s<br>` +
    `<span class="dim">cam</span> ${CAM}`;

  /* ---- camera presets (eye level is 0.2 u = 1.6 m) ---- */
  const look = new THREE.Vector3();
  if (FLY.on) {
    hud.innerHTML +=
      `<br><span class="dim">drag</span> look &nbsp; <span class="dim">WASD</span> move &nbsp; ` +
      `<span class="dim">Q/E</span> down/up &nbsp; <span class="dim">shift</span> sprint &nbsp; ` +
      `<span class="dim">scroll</span> speed &nbsp; <span class="dim">dbl-click</span> eye level`;
  } else if (CAM === "roadtop") {
    const rx = parseFloat(Q.get("rx") || SPINE), rz2 = parseFloat(Q.get("rz") || "16");
    camera.position.set(gx(rx), 4.2, gz(rz2 + 0.4));
    look.set(gx(rx), 0, gz(rz2));
  } else if (CAM === "air") {
    camera.position.set(gx(SPINE) + 9, 15, gz(30));
    look.set(gx(SPINE) - 1, 0, gz(14));
  } else if (CAM === "mid") {
    camera.position.set(gx(SPINE) + 3.4, 3.2, gz(26));
    look.set(gx(SPINE), 0.35, gz(15));
  } else if (CAM === "ground") {
    /* debug: stand anywhere — &rx=&rz= grid pos, &ry= heading in degrees */
    const rx = parseFloat(Q.get("rx") || SPINE), rz2 = parseFloat(Q.get("rz") || "22");
    const hd = (parseFloat(Q.get("ry") || "0")) * Math.PI / 180;
    camera.position.set(gx(rx), 0.24, gz(rz2));
    look.set(gx(rx) - Math.sin(hd) * 8, 0.26, gz(rz2) - Math.cos(hd) * 8);
  } else if (CAM === "park") {
    camera.position.set(pondC.x + 2.6, 2.1, pondC.z + 3.4);
    look.set(pondC.x, 0.1, pondC.z);
  } else if (CAM === "street") {
    camera.position.set(gx(SPINE) + 0.2, 0.24, gz(22.4));
    look.set(gx(SPINE) - 0.05, 0.3, gz(11));
  } else {
    /* chase cam: behind the car along the route's own tangent, a shoulder
       width off the centreline, so the framing survives the turn */
    const t = THREE.MathUtils.clamp(T, 0, 1);
    const p = route.getPointAt(t), tg = route.getTangentAt(t);
    const sd = new THREE.Vector3(-tg.z, 0, tg.x);
    camera.position.copy(p).addScaledVector(tg, -1.35).addScaledVector(sd, -0.24);
    camera.position.y = 0.34;
    look.copy(p).addScaledVector(tg, 3.0); look.y = 0.22;
  }
  if (!FLY.on) camera.lookAt(look);

  if (car) {
    const t = THREE.MathUtils.clamp(T, 0, 1);
    const p = route.getPointAt(t), tg = route.getTangentAt(t);
    const sd = new THREE.Vector3(-tg.z, 0, tg.x);
    car.position.copy(p).addScaledVector(sd, 0.22);
    car.rotation.y = Math.atan2(-tg.x, -tg.z);           // model front is -Z
    const b = new THREE.Box3().setFromObject(car);
    car.position.y += -b.min.y + ROAD_TOP;
    /* the light rig rides as children of the car, so it survives any turn */
    const tail = new THREE.MeshBasicMaterial({ color: 0xe0432a, fog: false });
    tail.color.multiplyScalar(1.6);
    for (const sgn of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.04), tail);
      l.position.set(sgn * 0.44, 0.42, 1.26);            // model space: the rear is +Z
      car.add(l);
    }
    const beam = new THREE.SpotLight(0xfff0d0, 6, 6, 0.5, 0.6, 1.6);
    beam.position.set(0, 0.55, -1.1); car.add(beam);
    beam.target.position.set(0, -0.4, -16); car.add(beam.target);
    if (carBlob) {
      carBlob.position.set(car.position.x, ROAD_TOP + 0.005, car.position.z);
      carBlob.rotation.y = car.rotation.y;
      carBlob.scale.set(0.5, 1, 0.75);
    }
    key.target.position.copy(car.position); scene.add(key.target);
  }

  window.__ready = true;
})();

/* ---------------- the fly rig ----------------
   Rough scout controls for walking the scene:
     drag = look · WASD/arrows = move · Q/E = down/up
     Shift = sprint · scroll = speed · double-click = eye level
   Movement runs in the render loop off camera-local axes.   */
const FLY = { on: CAM === "fly", yaw: 0.56, pitch: -0.67, speed: 3.2, keys: {}, last: performance.now() };
if (FLY.on) {
  camera.position.set(gx(SPINE) + 9, 15, gz(30));
  hud.innerHTML = "flying in…";
  const cv = renderer.domElement;
  let drag = null;
  cv.style.cursor = "grab";
  cv.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; cv.style.cursor = "grabbing"; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointerup", (e) => { drag = null; cv.style.cursor = "grab"; cv.releasePointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    FLY.yaw -= (e.clientX - drag[0]) * 0.0034;
    FLY.pitch = THREE.MathUtils.clamp(FLY.pitch - (e.clientY - drag[1]) * 0.0034, -1.45, 1.45);
    drag = [e.clientX, e.clientY];
  });
  addEventListener("keydown", (e) => { FLY.keys[e.code] = true; });
  addEventListener("keyup", (e) => { FLY.keys[e.code] = false; });
  addEventListener("blur", () => { FLY.keys = {}; });
  addEventListener("wheel", (e) => {
    FLY.speed = THREE.MathUtils.clamp(FLY.speed * Math.exp(-e.deltaY * 0.0012), 0.3, 30);
  }, { passive: true });
  cv.addEventListener("dblclick", () => { camera.position.y = 0.24; FLY.pitch = 0; });
}
function flyStep() {
  const now = performance.now(), dt = Math.min((now - FLY.last) / 1000, 0.1);
  FLY.last = now;
  const k = FLY.keys, sp = FLY.speed * (k.ShiftLeft || k.ShiftRight ? 4 : 1) * dt;
  const cy = Math.cos(FLY.yaw), sy = Math.sin(FLY.yaw), cp = Math.cos(FLY.pitch), spt = Math.sin(FLY.pitch);
  const fwd = new THREE.Vector3(-sy * cp, spt, -cy * cp);
  const rt = new THREE.Vector3(cy, 0, -sy);
  if (k.KeyW || k.ArrowUp) camera.position.addScaledVector(fwd, sp);
  if (k.KeyS || k.ArrowDown) camera.position.addScaledVector(fwd, -sp);
  if (k.KeyD || k.ArrowRight) camera.position.addScaledVector(rt, sp);
  if (k.KeyA || k.ArrowLeft) camera.position.addScaledVector(rt, -sp);
  if (k.KeyE || k.Space) camera.position.y += sp;
  if (k.KeyQ || k.KeyC) camera.position.y -= sp;
  camera.position.y = Math.max(camera.position.y, 0.09);   // never under the ground
  camera.quaternion.setFromEuler(new THREE.Euler(FLY.pitch, FLY.yaw, 0, "YXZ"));
}

/* ---------------- compose ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.34, 0.85, 0.82));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 g = c.rgb;
      g = mix(vec3(dot(g, vec3(0.299, 0.587, 0.114))), g, 1.12);
      g += (vec3(0.05, 0.08, 0.14) - g) * (1.0 - smoothstep(vec3(0.0), vec3(0.32), g)) * 0.4;
      float d = distance(vUv, vec2(0.5));
      g *= 1.0 - smoothstep(0.46, 0.9, d) * 0.32;
      gl_FragColor = vec4(g, c.a);
    }`,
}));
composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
(function loop() {
  const t = performance.now() / 1000;
  if (FLY.on) flyStep();
  if (FX.flies) {
    const a = FX.flies.pts.geometry.attributes.position, b = FX.flies.base, ph = FX.flies.ph;
    for (let i = 0; i < ph.length; i++) {
      a.array[i * 3]     = b[i * 3]     + Math.sin(t * 0.5 + ph[i] * 1.7) * 0.16;
      a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.9 + ph[i]) * 0.09;
      a.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(t * 0.4 + ph[i] * 2.3) * 0.16;
    }
    a.needsUpdate = true;
    FX.flies.pts.material.opacity = 0.75 + Math.sin(t * 1.7) * 0.2;
  }
  FX.mist.forEach((sp, i) => { sp.position.x = sp.userData.x0 + Math.sin(t * 0.05 + i) * 1.5; });
  FX.clouds.forEach((sp) => { sp.position.x += sp.userData.v; });
  composer.render(); requestAnimationFrame(loop);
})();
