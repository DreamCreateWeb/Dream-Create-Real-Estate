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
import { paint, tintByMaterial } from "./rigs.js";

const Q = new URLSearchParams(location.search);
const CAM = Q.get("cam") || "air";
const T = parseFloat(Q.get("t") || "0.35");
const A = "../assets/";
const hud = document.getElementById("hud");
globalThis.__paintDebug = Q.has("pdbg");

/* ---------------- world constants ---------------- */
export const TILE = 1;
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
const HAZE = new THREE.Color(0x2b3a63);
scene.fog = new THREE.FogExp2(HAZE, 0.021);

/* ---------------- light ---------------- */
/* low warm sun raking across the streets, cool sky bounce filling the shade */
const key = new THREE.DirectionalLight(0xffc79a, 1.25);
key.position.set(-26, 17, 20);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 110;
key.shadow.camera.left = -26; key.shadow.camera.right = 26;
key.shadow.camera.top = 26; key.shadow.camera.bottom = -26;
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.025;
scene.add(key);
scene.add(new THREE.HemisphereLight(0x8fa6e8, 0x14182c, 0.28));

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
  /* strips 0/1/2/7 — 7 is the white ramp the markings and kerbs share,
     so fresh-paint white becomes worn grey and stops shouting from the air */
  const ROAD_MAP = { 0: 0x272c3b, 1: 0x373d50, 2: 0x4f545f, 7: 0x8b919b };
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

  /* ---- houses: instanced per (type × scheme) ---- */
  const TYPES = ["a", "b", "c", "e", "g", "h", "j", "l", "n", "q"];
  const houseInst = [];
  for (let ti = 0; ti < TYPES.length; ti++) {
    for (let si = 0; si < HOUSE_SCHEMES.length; si++) {
      if ((ti * 3 + si) % 4 !== 0) continue;             // a spread of combinations, not all 70
      const s = HOUSE_SCHEMES[si];
      try {
        const src = await load(`houses/building-type-${TYPES[ti]}`);
        const lit = (ti + si) % 3 === 0;
        await paint(src, "houses",
          { 0: s.roof, 1: s.door, 3: s.wall, 5: lit ? 0xffc27a : 0x2b3c56, 7: s.trim }, A);
        if (lit) src.traverse((o) => { if (o.isMesh) { o.material.emissiveMap = o.material.map; o.material.emissive = new THREE.Color(0x3a2a12); } });
        const inst = instancer(src, 130);
        if (inst) {
          inst.geometry.computeBoundingBox();
          const bb = inst.geometry.boundingBox;
          inst.userData.half = [Math.max(-bb.min.x, bb.max.x), Math.max(-bb.min.z, bb.max.z)];
          houseInst.push(inst); scene.add(inst);
        }
      } catch (e) {}
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
  ];
  const trees = [];
  for (const [name, leaf, bark] of GREEN) {
    try {
      const src = await load(`nature/${name}`);
      tintByMaterial(src, { leafs: leaf, grass: leaf, wood: bark, bark });
      const parts = []; src.traverse((n) => { if (n.isMesh) parts.push(n); });
      trees.push(parts.map((p) => {
        const i = new THREE.InstancedMesh(p.geometry, p.material, 460);
        i.castShadow = true; i.receiveShadow = true; i.count = 0; i.frustumCulled = false;
        scene.add(i); return i;
      }));
    } catch (e) {}
  }
  const bushes = [];
  for (const [name, c] of [["plant_bush", 0x5c8a5f], ["plant_bushLarge", 0x639166], ["grass_large", 0x6c9862]]) {
    try {
      const src = await load(`nature/${name}`);
      tintByMaterial(src, { leafs: c, grass: c, wood: 0x40342a, bark: 0x40342a });
      const parts = []; src.traverse((n) => { if (n.isMesh) parts.push(n); });
      bushes.push(parts.map((p) => {
        const i = new THREE.InstancedMesh(p.geometry, p.material, 320);
        i.castShadow = false; i.receiveShadow = true; i.count = 0; i.frustumCulled = false;
        scene.add(i); return i;
      }));
    } catch (e) {}
  }
  /* nothing gets planted on the tarmac — canopies may overhang, trunks may not */
  const plant = (grp, x, z, s, ry) => {
    if (!grp || roadGap(x, z) < 0.06) return false;
    grp.forEach((i) => push(i, x, 0, z, ry, s));
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

    const jx = along.x * range(-0.16, 0.16), jz = along.z * range(-0.16, 0.16);
    const wx = gx(cx) + jx, wz = gz(cz) + jz;
    const scale = range(0.86, 1.06);
    const ry = Math.atan2(dx, dz);                      // house front (+Z) faces the street
    const c = Math.cos(ry), sn = Math.sin(ry);
    /* test the real rotated footprint, not a bounding circle — a deep narrow
       house fits a corner lot that a circle test would reject outright */
    const fits = (h) => {
      const [hx, hz] = h.userData.half;
      for (const sx2 of [-1, 1]) for (const sz2 of [-1, 1]) {
        const ax = sx2 * hx * scale, az = sz2 * hz * scale;
        if (roadGap(wx + ax * c + az * sn, wz - ax * sn + az * c) < 0.02) return false;
      }
      return true;
    };
    // a tight corner lot gets a narrower house rather than no house at all
    let inst = null;
    for (let k = 0; k < houseInst.length; k++) {
      const cand = houseInst[(hi + k) % houseInst.length];
      if (fits(cand)) { inst = cand; hi += k + 1; break; }
    }
    if (!inst) return false;
    if (!push(inst, wx, 0, wz, ry, scale)) return false;
    houses++;

    // driveway from the kerb to the house, offset to one side of the frontage
    const side = rnd() < 0.5 ? -1 : 1;
    const ox = along.x * side * 0.42, oz = along.z * side * 0.42;
    if (driveInst) {
      QT.setFromAxisAngle(AX, ry);
      M4.compose(V3.set(gx(sx + dx * 0.82) + ox, 0.004, gz(sz + dz * 0.82) + oz), QT, S3.set(1.0, 1, 2.1));
      if (driveInst.count < driveInst.instanceMatrix.count) driveInst.setMatrixAt(driveInst.count++, M4);
    }
    // a street tree in the verge, opposite the drive
    if (trees.length && rnd() < 0.7) {
      plant(pick(trees), gx(sx + dx * 0.72) - ox * 1.15, gz(sz + dz * 0.72) - oz * 1.15, range(0.4, 0.62), rnd() * 7);
    }
    // shrubs against the frontage
    if (bushes.length) for (let b = 0; b < 2; b++) if (rnd() < 0.6) {
      plant(pick(bushes), gx(cx) + range(-0.45, 0.45) - dx * 0.78, gz(cz) + range(-0.45, 0.45) - dz * 0.78, range(0.5, 0.9), rnd() * 7);
    }
    // a big tree in the back garden
    if (trees.length && rnd() < 0.55) {
      plant(pick(trees), gx(sx + dx * 2.9) + range(-0.45, 0.45), gz(sz + dz * 2.9) + range(-0.45, 0.45), range(0.55, 0.9), rnd() * 7);
    }
    return true;
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
    check("houses", houseInst, 0.0, 0.92);
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
    if (bushes.length && rnd() < 0.3) plant(pick(bushes), gx(x) + range(-0.45, 0.45), gz(z) + range(-0.45, 0.45), range(0.5, 1.0), rnd() * 7);
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
  const glowGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xf6b877, fog: true });
  const glowInst = new THREE.InstancedMesh(glowGeo, glowMat, 260);
  glowInst.count = 0; glowInst.frustumCulled = false; scene.add(glowInst);

  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    if (!road[z][x]) continue;
    const vertical = R(x, z - 1) || R(x, z + 1);
    const step = vertical ? z : x;
    if (step % 4) continue;
    const side = ((vertical ? x : z) + step) % 8 < 4 ? 1 : -1;
    const dx = vertical ? side : 0, dz = vertical ? 0 : side;
    // the lamp model's arm reaches out along -Z, so face it at the road
    const ry = Math.atan2(-dx, -dz);
    const px = gx(x) + dx * 0.47, pz = gz(z) + dz * 0.47;
    if (!push(lampInst, px, 0, pz, ry, 1)) continue;
    lamps++;
    push(glowInst, px - dx * 0.17, 0.64, pz - dz * 0.17, 0, 1);
    // real point lights are expensive — only along the route
    if (Math.abs(x - SPINE) <= 1) {
      const pl = new THREE.PointLight(0xffb877, 1.6, 4.2, 2);
      pl.position.set(px - dx * 0.17, 0.6, pz - dz * 0.17);
      scene.add(pl);
    }
  }

  [...Object.values(roadInst), ...houseInst, ...trees.flat(), ...bushes.flat(), lampInst, glowInst, driveInst]
    .forEach((i) => { if (i) i.instanceMatrix.needsUpdate = true; });

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

  /* ---- the car ---- */
  let car = null;
  try {
    car = await load("vehicles/sedan");
    await paint(car, "vehicles", { 6: 0xb9c2d0, 0: 0x131f31, 1: 0xffe3b0, 3: 0x3a3f4c }, A);
    car.scale.setScalar(CAR_SCALE);
    scene.add(car);
  } catch (e) {}

  /* parked cars give the street life for almost nothing */
  const PARK = [["suv", 0x6c7b8c], ["hatchback-sports", 0x8f5a54], ["van", 0xc9c2b4], ["taxi", 0xd8a44e]];
  for (const [name, col] of PARK) {
    try {
      const src = await load(`vehicles/${name}`);
      await paint(src, "vehicles", { 6: col, 0: 0x131f31, 1: 0xffe3b0, 3: 0x3a3f4c }, A);
      src.scale.setScalar(CAR_SCALE);
      src.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(src);
      const lift = -b.min.y;
      const parts = []; src.traverse((n) => { if (n.isMesh) parts.push(n); });
      const grp = parts.map((p) => {
        const i = new THREE.InstancedMesh(p.geometry, p.material, 60);
        i.castShadow = true; i.receiveShadow = true; i.count = 0; i.frustumCulled = false;
        scene.add(i); return i;
      });
      for (let z = 2; z < GRID - 2; z++) for (let x = 1; x < GRID - 1; x++) {
        if (!road[z][x] || rnd() > 0.055) continue;
        const vertical = R(x, z - 1) || R(x, z + 1);
        const side = rnd() < 0.5 ? 1 : -1;
        const ry = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const px = gx(x) + (vertical ? side * 0.36 : range(-0.28, 0.28));
        const pz = gz(z) + (vertical ? range(-0.28, 0.28) : side * 0.36);
        grp.forEach((i) => push(i, px, lift, pz, ry, CAR_SCALE));
      }
      grp.forEach((i) => { i.instanceMatrix.needsUpdate = true; });
    } catch (e) {}
  }

  /* ---- the route: down the spine ---- */
  const route = new THREE.CatmullRomCurve3([
    new THREE.Vector3(gx(SPINE), 0, gz(2)),
    new THREE.Vector3(gx(SPINE), 0, gz(11)),
    new THREE.Vector3(gx(SPINE), 0, gz(20)),
    new THREE.Vector3(gx(SPINE), 0, gz(GRID - 2)),
  ]);

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
  hud.innerHTML =
    `<b>town</b>  ${GRID}×${GRID} tiles · 1 tile ≈ 8 m<br>` +
    `<span class="dim">houses</span> ${houses} &nbsp; <span class="dim">trees</span> ${treeCount} &nbsp; <span class="dim">lamps</span> ${lamps}<br>` +
    `<span class="dim">draw calls</span> ${draws} &nbsp; <span class="dim">tris</span> ${(tris / 1000).toFixed(0)}k` +
    ` &nbsp; <span class="dim">built in</span> ${((performance.now() - t0) / 1000).toFixed(1)}s<br>` +
    `<span class="dim">cam</span> ${CAM}`;

  /* ---- camera presets (eye level is 0.2 u = 1.6 m) ---- */
  const look = new THREE.Vector3();
  if (CAM === "roadtop") {
    camera.position.set(gx(SPINE), 4.2, gz(16.4));
    look.set(gx(SPINE), 0, gz(16));
  } else if (CAM === "air") {
    camera.position.set(gx(SPINE) + 9, 15, gz(30));
    look.set(gx(SPINE) - 1, 0, gz(14));
  } else if (CAM === "mid") {
    camera.position.set(gx(SPINE) + 3.4, 3.2, gz(26));
    look.set(gx(SPINE), 0.35, gz(15));
  } else if (CAM === "street") {
    camera.position.set(gx(SPINE) + 0.2, 0.24, gz(22.4));
    look.set(gx(SPINE) - 0.05, 0.3, gz(11));
  } else {
    const t = THREE.MathUtils.clamp(T, 0, 1);
    const p = route.getPointAt(t), tg = route.getTangentAt(t);
    camera.position.set(p.x + 0.75, 0.3, p.z - 1.5);
    look.copy(p).addScaledVector(tg, 2.5); look.y = 0.2;
  }
  camera.lookAt(look);

  if (car) {
    const p = route.getPointAt(THREE.MathUtils.clamp(T, 0, 1));
    car.position.set(p.x + 0.22, 0, p.z);
    car.rotation.y = Math.PI;
    const b = new THREE.Box3().setFromObject(car);
    car.position.y = -b.min.y;
    key.target.position.copy(car.position); scene.add(key.target);
  }

  window.__ready = true;
})();

/* ---------------- compose ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.8, 0.9));
composer.addPass(new OutputPass());
composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
(function loop() { composer.render(); requestAnimationFrame(loop); })();
