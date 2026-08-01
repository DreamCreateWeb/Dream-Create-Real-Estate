/* =========================================================
   Dream Create — environment lab v3
   Real CC0 artist-made models (Kenney kits) + real CC0 PBR
   textures (ambientCG) + HDRI lighting (Poly Haven), lit for
   a magical twilight.  ?s=clinic | hood | truck
   ========================================================= */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const KEY = new URLSearchParams(location.search).get("s") || "hood";
const canvas = document.getElementById("c");
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const A = "../assets/";

/* ---------------- Renderer ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 900);
const HAZE = new THREE.Color(0x3a3f6b);
scene.fog = new THREE.FogExp2(HAZE, 0.014);

/* ---------------- Twilight lighting ---------------- */
const key = new THREE.DirectionalLight(0xffa96a, 2.9);
key.position.set(-40, 20, 28);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 200;
key.shadow.camera.left = -55; key.shadow.camera.right = 55;
key.shadow.camera.top = 55; key.shadow.camera.bottom = -55;
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.4; key.shadow.radius = 3;
scene.add(key);
scene.add(new THREE.HemisphereLight(0x93aaff, 0x16162e, 0.26));

/* ---------------- Helpers ---------------- */
const GLOW_TEX = (() => {
  const s = 128, c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.25, "rgba(255,255,255,.55)");
  g.addColorStop(.55, "rgba(255,255,255,.14)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function glowAt(color, size, opacity, x, y, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(size, size, 1); s.position.set(x, y, z); return s;
}
const glowMat = (c, i = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: .4 });

const texLoader = new THREE.TextureLoader();
function pbr({ color, norm, rough, repeat = 8, roughness = 0.9 }) {
  const m = new THREE.MeshStandardMaterial({ roughness });
  const set = (t, srgb) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  if (color) m.map = set(texLoader.load(A + "textures/" + color), true);
  if (norm) { m.normalMap = set(texLoader.load(A + "textures/" + norm), false); m.normalScale.set(.7, .7); }
  if (rough) m.roughnessMap = set(texLoader.load(A + "textures/" + rough), false);
  return m;
}

/* ---------------- Model loading ---------------- */
const gltf = new GLTFLoader();
const emissiveCache = {};
function emissiveTex(kit) {
  if (!emissiveCache[kit]) {
    const t = texLoader.load(`${A}models/${kit}/Textures/emissive.png`);
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    emissiveCache[kit] = t;
  }
  return emissiveCache[kit];
}
function load(kit, name) {
  return new Promise((res, rej) => {
    gltf.load(`${A}models/${kit}/${name}.glb`, (g) => {
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const m = o.material;
        if (m && m.isMeshStandardMaterial) m.envMapIntensity = 0.5;
      });
      res(g.scene);
    }, undefined, rej);
  });
}
const clone = (o) => { const c = o.clone(true); c.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); return c; };
function fit(obj, targetHeight) {
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(obj).getSize(size);
  obj.scale.setScalar(targetHeight / (size.y || 1));
  return obj;
}
const safeLoad = (kit, n) => load(kit, n).catch(() => null);
const loadMany = async (kit, names) => (await Promise.all(names.map((n) => safeLoad(kit, n)))).filter(Boolean);

/* ---------------- Distant hills ---------------- */
function hills() {
  const g = new THREE.Group();
  [{ r: 230, h: 30, c: 0x3a3f6b }, { r: 180, h: 22, c: 0x333a63 }, { r: 138, h: 16, c: 0x2b3157 }].forEach(({ r, h, c }, li) => {
    const seg = 96, pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = Math.sin(a * (2 + li) + li * 1.7) * .5 + Math.sin(a * (5 + li * 2) + li) * .28 + Math.sin(a * 9 + li * 3) * .14;
      pts.push(new THREE.Vector3(Math.cos(a) * r, -2 + h * (.55 + n * .45), Math.sin(a) * r));
    }
    const verts = [];
    for (let i = 0; i < seg; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      verts.push(p0.x, p0.y, p0.z, p0.x, -50, p0.z, p1.x, -50, p1.z);
      verts.push(p0.x, p0.y, p0.z, p1.x, -50, p1.z, p1.x, p1.y, p1.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: false })));
  });
  scene.add(g);
}

/* ---------------- Street lamp ---------------- */
function streetLamp(h = 5) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2030, roughness: .55, metalness: .6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.055, .09, h, 10), dark);
  pole.castShadow = true; pole.position.y = h / 2; g.add(pole);
  const arm = new THREE.Mesh(new THREE.TorusGeometry(.5, .05, 8, 16, Math.PI / 2), dark);
  arm.position.set(0, h - .5, 0); arm.rotation.y = Math.PI / 2; g.add(arm);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .3, 4, 10), glowMat(0xffc06a, 2.2));
  head.rotation.z = Math.PI / 2; head.position.set(.5, h - .05, 0); g.add(head);
  g.add(glowAt(0xffc06a, 2.6, .3, .5, h - .08, 0));
  const l = new THREE.PointLight(0xffb268, 6, 15, 2); l.position.set(.5, h - .3, 0); g.add(l);
  return g;
}

/* ---- warm "lived-in" glow on a building's street-facing face ---- */
function windowGlow(obj, towardX, towardZ, count) {
  const b = new THREE.Box3().setFromObject(obj);
  const c = new THREE.Vector3(), sz = new THREE.Vector3();
  b.getCenter(c); b.getSize(sz);
  const dir = new THREE.Vector3(towardX - c.x, 0, towardZ - c.z).normalize();
  const reach = (Math.abs(dir.x) * sz.x + Math.abs(dir.z) * sz.z) / 2;
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const span = Math.max(sz.x, sz.z) * 0.55;
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : ((i / (count - 1)) - 0.5) * span * 1.5;
    const y = b.min.y + sz.y * rnd(0.26, 0.5);
    const p = new THREE.Vector3().copy(c).addScaledVector(dir, reach * 0.97).addScaledVector(perp, t);
    p.y = y;
    g.add(glowAt(pick([0xffb765, 0xffc98a, 0xffa94f]), rnd(1.5, 2.3), rnd(0.3, 0.5), p.x, p.y, p.z));
  }
  scene.add(g);
  return g;
}

/* ---------------- Fireflies ---------------- */
function motes(n, spread, y0, y1, color = 0xffd79a) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const s = glowAt(color, rnd(.16, .36), rnd(.35, .85), rnd(-spread, spread), rnd(y0, y1), rnd(-spread, spread));
    s.userData = { phase: Math.random() * 7, amp: rnd(.3, 1.1), base: s.position.clone() };
    g.add(s);
  }
  scene.add(g);
}

/* ---------------- Ground ---------------- */
function groundPlane(size, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
}
function strip(w, l, mat, y = .02) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m;
}
const grassMat = () => { const m = pbr({ color: "grass_color.jpg", norm: "grass_norm.jpg", repeat: 60, roughness: 1 }); m.color = new THREE.Color(0x47575e); return m; };
const asphaltMat = (r = 14) => { const m = pbr({ color: "asphalt_color.jpg", norm: "asphalt_norm.jpg", rough: "asphalt_rough.jpg", repeat: r, roughness: .85 }); m.color = new THREE.Color(0x2e3350); return m; };
const concreteMat = (r = 10) => { const m = pbr({ color: "concrete_color.jpg", norm: "concrete_norm.jpg", rough: "concrete_rough.jpg", repeat: r, roughness: .92 }); m.color = new THREE.Color(0x4a4d68); return m; };

/* ========================================================
   SCENES
   ======================================================== */
async function buildHood() {
  hills();
  scene.add(groundPlane(600, grassMat()));
  scene.add(strip(8, 160, asphaltMat()));
  const cross = strip(8, 160, asphaltMat()); cross.rotation.z = Math.PI / 2; cross.position.y = .021; scene.add(cross);
  [-5.7, 5.7].forEach((x) => {
    const s = strip(1.7, 160, (() => { const m = pbr({ color: "paving_color.jpg", norm: "paving_norm.jpg", repeat: 24, roughness: .95 }); m.color = new THREE.Color(0x585d78); return m; })(), .05);
    s.position.x = x; scene.add(s);
  });
  const dash = glowMat(0xd8c48a, .35);
  for (let z = -70; z <= 70; z += 9) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(.24, 3), dash);
    d.rotation.x = -Math.PI / 2; d.position.set(0, .06, z); scene.add(d);
  }

  const houses = await loadMany("houses", ["a", "b", "c", "e", "g", "h", "j", "l", "n", "q"].map((k) => `building-type-${k}`));
  const trees = await loadMany("nature", ["tree_default", "tree_oak", "tree_fat", "tree_detailed", "tree_cone", "tree_default_dark", "tree_oak_dark"]);
  const cars = await loadMany("vehicles", ["sedan", "suv", "van", "taxi", "hatchback-sports", "delivery"]);

  const lots = [];
  for (let z = -50; z <= 50; z += 13) { lots.push({ x: -14, z, ry: Math.PI / 2 }); lots.push({ x: 14, z, ry: -Math.PI / 2 }); }
  lots.forEach((l) => {
    if (Math.abs(l.z) < 7 || !houses.length) return;
    const h = clone(pick(houses)); fit(h, rnd(4.6, 6.4));
    h.position.set(l.x, 0, l.z); h.rotation.y = l.ry; scene.add(h);
    windowGlow(h, 0, l.z, 3);
    const side = l.x > 0 ? -1 : 1;
    const dv = strip(2.6, 6, concreteMat(3), .04);
    dv.position.set(l.x + side * 4.2, .04, l.z + 3.4); scene.add(dv);
    if (cars.length && Math.random() < .55) {
      const c = clone(pick(cars)); fit(c, 1.5);
      c.position.set(l.x + side * 4.2, 0, l.z + 3.4); c.rotation.y = (Math.PI / 2) * side; scene.add(c);
    }
    if (trees.length) for (let i = 0; i < 2; i++) {
      const t = clone(pick(trees)); fit(t, rnd(3.4, 5.2));
      t.position.set(l.x + side * rnd(2.5, 5.5), 0, l.z + rnd(-5, 5)); t.rotation.y = Math.random() * 7; scene.add(t);
    }
  });
  for (let z = -48; z <= 48; z += 16) {
    const a = streetLamp(); a.position.set(-6.8, 0, z); a.rotation.y = Math.PI; scene.add(a);
    const b = streetLamp(); b.position.set(6.8, 0, z + 8); scene.add(b);
  }
  if (trees.length) for (let z = -55; z <= 55; z += 11) [-9, 9].forEach((x) => {
    const t = clone(pick(trees)); fit(t, rnd(3.6, 5.4)); t.position.set(x, 0, z + 4); t.rotation.y = Math.random() * 7; scene.add(t);
  });
  const traffic = [];
  if (cars.length) [[-2, -24, Math.PI / 2], [2, 28, -Math.PI / 2]].forEach(([x, z, ry]) => {
    const c = clone(pick(cars)); fit(c, 1.5); c.position.set(x, 0, z); c.rotation.y = ry; scene.add(c);
    traffic.push({ c, dir: ry > 0 ? 1 : -1 });
  });
  motes(130, 48, 1, 13);
  camera.position.set(38, 22, 42);
  return { target: new THREE.Vector3(0, 2, 0), traffic, title: "Neighborhood — Dream Create Real Estate", sub: "real CC0 models · PBR ground · twilight lighting" };
}

async function buildClinic() {
  hills();
  scene.add(groundPlane(600, grassMat()));
  scene.add(strip(56, 46, concreteMat(10), .02));
  const park = strip(34, 15, asphaltMat(8), .03); park.position.z = 15; scene.add(park);
  const line = glowMat(0xcbb98a, .3);
  for (let i = -5; i <= 5; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.16, 6), line);
    l.rotation.x = -Math.PI / 2; l.position.set(i * 3.1, .05, 15); scene.add(l);
  }

  const b = (await loadMany("commercial", ["building-e", "building-a", "building-c"]))[0];
  let bb = null;
  if (b) {
    fit(b, 11); b.position.set(0, 0, 0); scene.add(b);
    bb = new THREE.Box3().setFromObject(b);
    windowGlow(b, 0, 40, 5);
    const inner = new THREE.PointLight(0xffcf8a, 12, 30, 2);
    inner.position.set(0, 2.2, bb.max.z * .6); scene.add(inner);
  }

  // lit signage
  const sc = document.createElement("canvas"); sc.width = 512; sc.height = 128;
  const sx = sc.getContext("2d");
  sx.fillStyle = "#16224a"; sx.fillRect(0, 0, 512, 128);
  sx.fillStyle = "#ffd9a0"; sx.font = "600 54px system-ui,sans-serif";
  sx.textAlign = "center"; sx.textBaseline = "middle";
  sx.shadowColor = "#ffd9a0"; sx.shadowBlur = 24; sx.fillText("Dream Dental", 256, 66);
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.6),
    new THREE.MeshStandardMaterial({ map: stex, emissiveMap: stex, emissive: 0xffffff, emissiveIntensity: 1.4 }));
  sign.position.set(0, bb ? bb.max.y * .74 : 7, (bb ? bb.max.z : 5) + .15);
  scene.add(sign);
  scene.add(glowAt(0xffc27a, 5, .2, sign.position.x, sign.position.y, sign.position.z + .3));

  const trees = await loadMany("nature", ["tree_default", "tree_oak", "tree_detailed", "tree_fat"]);
  if (trees.length) for (let i = 0; i < 12; i++) {
    const t = clone(pick(trees)); fit(t, rnd(3.8, 5.6));
    t.position.set(rnd(-24, 24), 0, rnd(-20, -8)); t.rotation.y = Math.random() * 7; scene.add(t);
  }
  const cars = await loadMany("vehicles", ["sedan", "suv", "van", "taxi"]);
  if (cars.length) [-10.5, -7, 7, 10.5].forEach((x) => {
    const c = clone(pick(cars)); fit(c, 1.5); c.position.set(x, 0, 15); c.rotation.y = Math.PI; scene.add(c);
  });
  [[-15, 8], [15, 8]].forEach(([x, z]) => { const l = streetLamp(5.5); l.position.set(x, 0, z); scene.add(l); });
  motes(80, 28, 1, 11);
  camera.position.set(18, 10, 26);
  return { target: new THREE.Vector3(0, 4.5, 0), title: "Dental clinic — DreamCRM", sub: "real CC0 building · PBR concrete & asphalt · lit signage" };
}

async function buildTruck() {
  hills();
  scene.add(groundPlane(600, grassMat()));
  scene.add(strip(320, 18, asphaltMat(30), .02));
  const dash = glowMat(0xd8c48a, .35);
  for (let x = -80; x <= 80; x += 9) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(3, .24), dash);
    l.rotation.x = -Math.PI / 2; l.position.set(x, .05, 0); scene.add(l);
  }

  const truck = (await loadMany("vehicles", ["truck-flat", "truck", "delivery"]))[0];
  if (truck) {
    fit(truck, 2.6); truck.position.set(0, 0, 0); truck.rotation.y = -Math.PI / 2; scene.add(truck);
    const tb = new THREE.Box3().setFromObject(truck);
    const beacon = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .34, 4, 10), glowMat(0xffa32b, 3));
    beacon.rotation.z = Math.PI / 2; beacon.position.set(.9, tb.max.y + .12, 0); scene.add(beacon);
    scene.add(glowAt(0xffa32b, 2.6, .45, .9, tb.max.y + .15, 0));
    const bl = new THREE.PointLight(0xffa02b, 6, 20, 2); bl.position.set(.9, tb.max.y + .4, 0); scene.add(bl);
    [-.7, .7].forEach((z) => scene.add(glowAt(0xfff0cc, 1.5, .3, tb.min.x - .2, .8, z)));
  }
  const towed = (await loadMany("vehicles", ["sedan"]))[0];
  if (towed) { fit(towed, 1.5); towed.position.set(5.6, .1, 0); towed.rotation.y = -Math.PI / 2; scene.add(towed); }

  const trees = await loadMany("nature", ["tree_default", "tree_oak", "tree_fat", "tree_detailed"]);
  if (trees.length) for (let x = -60; x <= 60; x += 12) [12, -12].forEach((z) => {
    const t = clone(pick(trees)); fit(t, rnd(3.8, 5.8)); t.position.set(x + rnd(-3, 3), 0, z); t.rotation.y = Math.random() * 7; scene.add(t);
  });
  for (let x = -40; x <= 40; x += 26) { const l = streetLamp(5.5); l.position.set(x, 0, -11); scene.add(l); }
  motes(70, 26, .6, 8);
  camera.position.set(9, 4, 13);
  return { target: new THREE.Vector3(0, 1.4, 0), title: "Tow truck — Dream Towing", sub: "real CC0 truck model · PBR asphalt · amber beacon" };
}

/* ---------------- Backdrop + HDRI ---------------- */
scene.add(new THREE.Mesh(new THREE.SphereGeometry(520, 32, 20), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: new THREE.Color(0x121a44) }, mid: { value: new THREE.Color(0x3d3a72) },
    low: { value: new THREE.Color(0x8a5d7e) }, hor: { value: new THREE.Color(0xe0895c) },
  },
  vertexShader: `varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec3 p; uniform vec3 top,mid,low,hor;
    void main(){ float h=normalize(p).y;
      vec3 c=mix(hor,low,smoothstep(-0.02,0.12,h));
      c=mix(c,mid,smoothstep(0.08,0.34,h));
      c=mix(c,top,smoothstep(0.3,0.85,h));
      gl_FragColor=vec4(c,1.); }`,
})));
new RGBELoader().setPath(A + "hdri/").load("evening_road_01_puresky_1k.hdr", (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  const p = new THREE.PMREMGenerator(renderer);
  scene.environment = p.fromEquirectangular(t).texture;
  scene.environmentIntensity = .22;
  t.dispose(); p.dispose(); window.__hdri = true;
}, undefined, () => { window.__hdri = false; });

/* ---------------- Compose & run ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .4, .7, .85));
composer.addPass(new OutputPass());
composer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

const builder = KEY === "clinic" ? buildClinic : KEY === "truck" ? buildTruck : buildHood;
builder().then((meta) => {
  document.getElementById("title").textContent = meta.title;
  document.getElementById("sub").textContent = meta.sub;
  document.getElementById("t-" + KEY)?.classList.add("on");
  const rad = Math.hypot(camera.position.x, camera.position.z);
  let ang = Math.atan2(camera.position.z, camera.position.x);
  const camY = camera.position.y;
  const clock = new THREE.Clock();
  (function loop() {
    const t = clock.getElapsedTime(), dt = Math.min(clock.getDelta(), .05);
    ang += .0011;
    camera.position.set(Math.cos(ang) * rad, camY + Math.sin(t * .25) * .5, Math.sin(ang) * rad);
    camera.lookAt(meta.target);
    scene.traverse((o) => {
      if (o.isSprite && o.userData.base) {
        o.position.y = o.userData.base.y + Math.sin(t * .6 + o.userData.phase) * o.userData.amp;
        o.position.x = o.userData.base.x + Math.cos(t * .4 + o.userData.phase) * o.userData.amp * .6;
      }
    });
    if (meta.traffic) meta.traffic.forEach((tr) => {
      tr.c.position.z += tr.dir * 7 * dt;
      if (tr.c.position.z > 70) tr.c.position.z = -70;
      if (tr.c.position.z < -70) tr.c.position.z = 70;
    });
    composer.render();
    requestAnimationFrame(loop);
  })();
  window.__ready = true;
}).catch((e) => { console.error(e); window.__err = String(e); });
