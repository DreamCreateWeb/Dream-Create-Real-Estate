/* =========================================================
   Dream Create — environment lab  (magical stylized / twilight)
   Art direction: dusk palette, warm glowing windows against cool
   blue shadows, real HDRI image-based lighting, bloom, haze,
   soft rounded forms. ?s=clinic | hood | truck
   ========================================================= */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const KEY = new URLSearchParams(location.search).get("s") || "hood";
const canvas = document.getElementById("c");
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

/* ---------------- Renderer ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 900);

/* Twilight atmosphere — cool blue haze so distance melts away */
const HAZE = new THREE.Color(0x3a3f6b);
scene.fog = new THREE.FogExp2(HAZE, 0.016);

/* ---------------- Lighting rig ----------------
   The magic formula: one warm low "sun" (rim/key) + cool blue
   ambient fill. Warm highlights, cool shadows.                */
const key = new THREE.DirectionalLight(0xffb579, 2.6);
key.position.set(-34, 16, 26);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 180;
key.shadow.camera.left = -60; key.shadow.camera.right = 60;
key.shadow.camera.top = 60; key.shadow.camera.bottom = -60;
key.shadow.bias = -0.0006; key.shadow.normalBias = 0.6;
key.shadow.radius = 3;
scene.add(key);
scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x1a1a35, 0.55));

/* ---------------- Materials & helpers ---------------- */
const std = (color, rough = 0.8, metal = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

// warm glowing window — the single biggest "magic" ingredient
const litGlass = (warm = 0xffbe63, i = 1.1) =>
  new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.16, metalness: 0.1, emissive: warm, emissiveIntensity: i });
const darkGlass = () =>
  new THREE.MeshStandardMaterial({ color: 0x2b3a5c, roughness: 0.08, metalness: 0.35, emissive: 0x0d1730, emissiveIntensity: 0.5 });
const glowMat = (c, i = 3) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });

function rbox(w, h, d, mat, r = 0.06) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2)), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}
function textTex(txt, bg = "#1d2a4d", fg = "#ffd9a0") {
  const w = 512, h = 128, c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = fg; x.font = "600 52px system-ui,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = fg; x.shadowBlur = 26; x.fillText(txt, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* soft round sprite used for glows, lamp halos, fireflies */
const GLOW_TEX = (() => {
  const s = 128, c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d"), g = x.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.55)");
  g.addColorStop(0.55, "rgba(255,255,255,.14)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function glowSprite(color, size, opacity = 0.85) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(size, size, 1); return s;
}
/* glow sprite placed at a position (position is read-only, so set it properly) */
function glowAt(color, size, opacity, x, y, z) {
  const s = glowSprite(color, size, opacity); s.position.set(x, y, z); return s;
}

/* ---------------- Foliage (soft, layered) ---------------- */
function tree(scale = 1, autumn = false) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * scale, 0.2 * scale, 1.7 * scale, 7), std(0x4a3b34, 0.95));
  trunk.castShadow = true; trunk.position.y = 0.85 * scale; g.add(trunk);
  const pal = autumn ? [0x8a5a3c, 0xa06a3a, 0x6d4a30] : [0x2f5a46, 0x39684e, 0x274c3c, 0x436b4e];
  const col = pick(pal);
  for (let i = 0; i < 4; i++) {
    const r = rnd(0.75, 1.15) * scale * (1 - i * 0.13);
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), std(col, 1));
    f.castShadow = true; f.receiveShadow = true;
    f.position.set(rnd(-0.35, 0.35) * scale, (1.55 + i * 0.55) * scale, rnd(-0.35, 0.35) * scale);
    f.scale.y = rnd(0.8, 1.0);
    g.add(f);
  }
  return g;
}
function bush(scale = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(0.3, 0.5) * scale, 1), std(pick([0x2c5442, 0x35604a]), 1));
    b.castShadow = true; b.receiveShadow = true;
    b.position.set(rnd(-0.3, 0.3) * scale, rnd(0.22, 0.38) * scale, rnd(-0.3, 0.3) * scale);
    g.add(b);
  }
  return g;
}

/* ---------------- Street lamp (warm pool of light) ---------------- */
const lampLights = [];
function streetLamp(h = 4.4) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h, 8), std(0x1d2233, 0.6, 0.5));
  pole.castShadow = true; pole.position.y = h / 2; g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), std(0x1d2233, 0.6, 0.5));
  arm.rotation.z = Math.PI / 2; arm.position.set(0.32, h, 0); g.add(arm);
  const head = rbox(0.44, 0.2, 0.34, glowMat(0xffc06a, 1.8), 0.07);
  head.position.set(0.62, h - 0.1, 0); head.castShadow = false; g.add(head);
  g.add(glowAt(0xffc06a, 2.4, 0.34, 0.62, h - 0.12, 0));
  const l = new THREE.PointLight(0xffb268, 5.5, 13, 2);
  l.position.set(0.62, h - 0.3, 0); g.add(l); lampLights.push(l);
  return g;
}

/* ---------------- Vehicles ---------------- */
function car(color = 0xc94f5a) {
  const g = new THREE.Group();
  const body = rbox(2.15, 0.52, 1.02, std(color, 0.35, 0.35), 0.16);
  body.position.y = 0.56; g.add(body);
  const cabin = rbox(1.18, 0.46, 0.94, darkGlass(), 0.16);
  cabin.position.set(-0.12, 1.0, 0); g.add(cabin);
  // headlights + tail glow
  [[1.03, 0.3], [1.03, -0.3]].forEach(([x, z]) => {
    const hl = rbox(0.08, 0.12, 0.2, glowMat(0xfff0c8, 1.6), 0.04); hl.position.set(x, 0.6, z); g.add(hl);
  });
  const beam = glowSprite(0xffe9b0, 0.9, 0.28); beam.position.set(1.25, 0.6, 0); g.add(beam);
  [[-1.05, 0.32], [-1.05, -0.32]].forEach(([x, z]) => {
    const t = rbox(0.06, 0.1, 0.18, glowMat(0xff5a4a, 2.4), 0.03); t.position.set(x, 0.62, z); g.add(t);
  });
  const wg = new THREE.CylinderGeometry(0.27, 0.27, 0.19, 14), wm = std(0x14151c, 0.85);
  [[0.68, 0.53], [0.68, -0.53], [-0.68, 0.53], [-0.68, -0.53]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wg, wm); w.rotation.x = Math.PI / 2; w.position.set(x, 0.28, z); w.castShadow = true; g.add(w);
  });
  return g;
}

/* ---------------- House (charming, layered silhouette) ---------------- */
const WALLS = [0xe8dcc8, 0xdcd0bc, 0xcfd8dc, 0xe0cfc4, 0xd2dbd0, 0xe6d9d2];
const ROOFS = [0x4a3f52, 0x3f4a5c, 0x533f43, 0x39434f, 0x4d4340];
function gableRoof(w, h, d, mat) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 });
  g.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function windowPane(w, h, lit) {
  const g = new THREE.Group();
  const frame = rbox(w + 0.14, h + 0.14, 0.1, std(0xf3ece0, 0.75), 0.03);
  const pane = rbox(w, h, 0.16, lit ? litGlass(pick([0xffbe63, 0xffcf86, 0xffab55]), rnd(0.9, 1.5)) : darkGlass(), 0.02);
  g.add(frame, pane);
  if (lit) { const s = glowSprite(0xffc074, Math.max(w, h) * 1.5, 0.16); s.position.z = 0.3; g.add(s); }
  return g;
}
function house() {
  const g = new THREE.Group();
  const w = rnd(4.2, 5.4), d = rnd(4.6, 5.8), h = rnd(2.5, 3.1);
  const wall = pick(WALLS), roofC = pick(ROOFS);
  const body = rbox(w, h, d, std(wall, 0.92), 0.09); body.position.y = h / 2; g.add(body);
  const roof = gableRoof(w + 0.65, rnd(1.7, 2.3), d + 0.5, std(roofC, 0.9)); roof.position.y = h; g.add(roof);

  // porch — the detail that makes it read as a *home*
  const pd = 1.5;
  const porchFloor = rbox(w * 0.72, 0.16, pd, std(0xcbbfae, 0.95), 0.03);
  porchFloor.position.set(0, 0.14, d / 2 + pd / 2); g.add(porchFloor);
  const porchRoof = rbox(w * 0.78, 0.14, pd + 0.25, std(roofC, 0.9), 0.04);
  porchRoof.position.set(0, 2.3, d / 2 + pd / 2); g.add(porchRoof);
  [-w * 0.3, w * 0.3].forEach((x) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 7), std(0xf0e8dc, 0.8));
    p.castShadow = true; p.position.set(x, 1.2, d / 2 + pd - 0.15); g.add(p);
  });
  // porch lantern
  const lant = rbox(0.16, 0.24, 0.16, glowMat(0xffb765, 1.8), 0.04);
  lant.position.set(0.75, 2.02, d / 2 + 0.14); g.add(lant);
  g.add(glowAt(0xffb765, 1.0, 0.3, 0.75, 2.0, d / 2 + 0.16));

  // door (warm spill from inside)
  const door = rbox(0.95, 1.85, 0.14, std(pick([0x3d5348, 0x5a3a3c, 0x36445c]), 0.6), 0.04);
  door.position.set(0, 0.95, d / 2 + 0.06); g.add(door);
  const dGlow = rbox(0.6, 0.12, 0.1, glowMat(0xffc27a, 1.2), 0.02);
  dGlow.position.set(0, 1.78, d / 2 + 0.1); g.add(dGlow);

  // windows — most lit at dusk
  const wins = [
    [-w * 0.3, 1.5, d / 2 + 0.06, 0], [w * 0.3, 1.5, d / 2 + 0.06, 0],
    [w / 2 + 0.06, 1.5, -d * 0.18, Math.PI / 2], [-w / 2 - 0.06, 1.5, d * 0.18, -Math.PI / 2],
  ];
  wins.forEach(([x, y, z, ry]) => {
    const p = windowPane(0.82, 0.92, Math.random() < 0.72);
    p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  });
  // dormer
  if (Math.random() < 0.55) {
    const dw = 1.15;
    const db = rbox(dw, 0.85, 0.9, std(wall, 0.92), 0.05);
    db.position.set(rnd(-0.7, 0.7), h + 0.75, d * 0.16); g.add(db);
    const dr = gableRoof(dw + 0.3, 0.6, 1.0, std(roofC, 0.9));
    dr.position.set(db.position.x, h + 1.17, d * 0.16); g.add(dr);
    const dp = windowPane(0.5, 0.5, Math.random() < 0.7);
    dp.position.set(db.position.x, h + 0.78, d * 0.16 + 0.5); g.add(dp);
  }
  // chimney
  const ch = rbox(0.5, 1.5, 0.5, std(0x59484a, 0.95), 0.04);
  ch.position.set(w * 0.3, h + 1.25, -d * 0.2); g.add(ch);
  return g;
}

/* ---------------- Ground helpers ---------------- */
function ground(size, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 3, size * 3, 1, 1), std(color, 1));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
}
function plane(w, l, mat, y = 0.02) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m;
}

/* ---------------- Distant hills ----------------
   Layered silhouettes that dissolve the horizon seam and give
   the world depth — a signature of stylized dusk scenes.      */
function hills() {
  const g = new THREE.Group();
  const layers = [
    { r: 210, h: 26, c: 0x3a3f6b, o: 0.95, y: -2 },
    { r: 165, h: 20, c: 0x333a63, o: 1, y: -2 },
    { r: 125, h: 15, c: 0x2b3157, o: 1, y: -2 },
  ];
  layers.forEach(({ r, h, c, o, y }, li) => {
    const seg = 90, pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = Math.sin(a * (2 + li) + li * 1.7) * 0.5 + Math.sin(a * (5 + li * 2) + li) * 0.28 + Math.sin(a * 9 + li * 3) * 0.14;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y + h * (0.55 + n * 0.45), Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry();
    const verts = [];
    for (let i = 0; i < seg; i++) {
      const p0 = pts[i], p1 = pts[i + 1];
      const b0 = new THREE.Vector3(p0.x, -40, p0.z), b1 = new THREE.Vector3(p1.x, -40, p1.z);
      verts.push(p0.x, p0.y, p0.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
      verts.push(p0.x, p0.y, p0.z, b1.x, b1.y, b1.z, p1.x, p1.y, p1.z);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: o, fog: false, depthWrite: true }));
    g.add(m);
  });
  scene.add(g); return g;
}

/* ---------------- Fireflies / dust motes ---------------- */
function motes(count, spread, y0, y1, color = 0xffd79a) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const s = glowSprite(color, rnd(0.18, 0.4), rnd(0.4, 0.9));
    s.position.set(rnd(-spread, spread), rnd(y0, y1), rnd(-spread, spread));
    s.userData = { phase: Math.random() * 7, amp: rnd(0.3, 1.1), base: s.position.clone() };
    g.add(s);
  }
  scene.add(g); return g;
}

/* ========================================================
   SCENES
   ======================================================== */
function buildHood() {
  scene.add(ground(400, 0x2f4636));
  hills();
  const roadMat = std(0x24263a, 0.82);
  scene.add(plane(7.5, 150, roadMat, 0.02));
  const cross = plane(7.5, 150, roadMat, 0.021); cross.rotation.z = Math.PI / 2; scene.add(cross);
  const swMat = std(0x5a5f70, 0.9);
  [-5.4, 5.4].forEach((x) => { const s = plane(1.5, 150, swMat, 0.05); s.position.x = x; scene.add(s); });
  const dashMat = glowMat(0xd8c48a, 0.5);
  for (let z = -60; z <= 60; z += 9) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 3), dashMat);
    d.rotation.x = -Math.PI / 2; d.position.set(0, 0.06, z); scene.add(d);
  }

  const lots = [];
  for (let z = -46; z <= 46; z += 13) { lots.push({ x: -13.5, z, ry: Math.PI / 2 }); lots.push({ x: 13.5, z, ry: -Math.PI / 2 }); }
  lots.forEach((l) => {
    if (Math.abs(l.z) < 7) return;
    const h = house(); h.position.set(l.x, 0, l.z); h.rotation.y = l.ry; scene.add(h);
    const side = l.x > 0 ? -1 : 1;
    const dv = plane(2.5, 5.5, std(0x3d4152, 0.9), 0.04);
    dv.position.set(l.x + side * 3.6, 0.04, l.z + 3.2); scene.add(dv);
    if (Math.random() < 0.55) {
      const c = car(pick([0xc94f5a, 0x44618f, 0x2b2f3c, 0xd8d3c8, 0x3f7a63]));
      c.position.set(l.x + side * 3.6, 0, l.z + 3.2); c.rotation.y = Math.PI / 2; scene.add(c);
    }
    for (let i = 0; i < 2; i++) { const t = tree(rnd(0.85, 1.25), Math.random() < 0.25); t.position.set(l.x + side * rnd(2, 5), 0, l.z + rnd(-5, 5)); scene.add(t); }
    const b = bush(rnd(0.9, 1.3)); b.position.set(l.x + side * 3.0, 0, l.z - 2.4); scene.add(b);
  });

  // street lamps + trees along the sidewalks
  for (let z = -45; z <= 45; z += 15) {
    const a = streetLamp(); a.position.set(-6.6, 0, z); a.rotation.y = Math.PI; scene.add(a);
    const b = streetLamp(); b.position.set(6.6, 0, z + 7.5); scene.add(b);
  }
  for (let z = -50; z <= 50; z += 11) {
    [-8.4, 8.4].forEach((x) => { const t = tree(rnd(0.9, 1.35)); t.position.set(x, 0, z + 3.5); scene.add(t); });
  }
  // moving cars on the road
  const traffic = [];
  [[-1.8, -22, 0], [1.8, 26, Math.PI]].forEach(([x, z, ry]) => {
    const c = car(pick([0xc94f5a, 0x44618f, 0xd8d3c8])); c.position.set(x, 0, z); c.rotation.y = ry;
    scene.add(c); traffic.push({ c, dir: ry === 0 ? 1 : -1 });
  });

  motes(120, 45, 1, 12);
  camera.position.set(40, 24, 44);
  return { title: "Neighborhood — Dream Create Real Estate", sub: "twilight · glowing windows, street lamps, porches & haze", target: new THREE.Vector3(0, 2, 0), traffic };
}

function buildClinic() {
  scene.add(ground(400, 0x2f4636));
  hills();
  scene.add(plane(52, 44, std(0x3a3f52, 0.92), 0.02));
  scene.add(plane(30, 13, std(0x24263a, 0.85), 0.03).translateZ(0));
  const park = plane(30, 13, std(0x24263a, 0.85), 0.031); park.position.z = 13; scene.add(park);
  const lineMat = glowMat(0xcbb98a, 0.4);
  for (let i = -4; i <= 4; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5.4), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(i * 3.2, 0.05, 13); scene.add(l); }

  const b = new THREE.Group();
  // glass ground floor, glowing from within
  const g0 = rbox(15, 3.6, 9.5, darkGlass(), 0.12); g0.position.y = 1.8; b.add(g0);
  // warm interior spill — a few glowing strips instead of one huge emissive slab
  [-5.2, -1.7, 1.8, 5.3].forEach((x) => {
    const strip = rbox(2.6, 1.5, 0.12, litGlass(0xffcf8a, 0.9), 0.04);
    strip.position.set(x, 1.9, 4.82); b.add(strip);
  });
  b.add(glowAt(0xffcf8a, 7, 0.16, 0, 1.6, 5.4));
  const colMat = std(0xe9e4da, 0.6);
  [-7.2, -3.6, 0, 3.6, 7.2].forEach((x) => { const c = rbox(0.42, 3.6, 0.42, colMat, 0.06); c.position.set(x, 1.8, 4.86); b.add(c); });
  // upper floors
  const upper = rbox(15, 6.8, 9.5, std(0xdfe3e8, 0.75), 0.12); upper.position.y = 3.6 + 3.4; b.add(upper);
  // window grid, most lit
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
    const p = windowPane(1.25, 1.35, Math.random() < 0.66);
    p.position.set(-6.4 + c * 2.55, 5.4 + r * 2.7, 4.82); b.add(p);
    const p2 = windowPane(1.25, 1.35, Math.random() < 0.5);
    p2.position.set(7.56, 5.4 + r * 2.7, -3.2 + c * 1.3); p2.rotation.y = Math.PI / 2; b.add(p2);
  }
  const par = rbox(15.5, 0.45, 10, std(0xcfd5dc, 0.8), 0.06); par.position.y = 3.6 + 6.8 + 0.22; b.add(par);
  [[-3.6, 2], [3.4, -1.4]].forEach(([x, z]) => { const u = rbox(2.4, 1.05, 2.1, std(0x8f96a3, 0.9), 0.08); u.position.set(x, 3.6 + 6.8 + 0.75, z); b.add(u); });
  // canopy + doors
  const can = rbox(5.4, 0.28, 2.6, std(0xd8dde4, 0.7), 0.06); can.position.set(0, 3.25, 5.9); b.add(can);
  b.add(glowAt(0xffd9a0, 3, 0.22, 0, 2.9, 6.0));
  const dr = rbox(2.6, 2.7, 0.18, litGlass(0xffd9a0, 1.2), 0.05); dr.position.set(0, 1.35, 4.86); b.add(dr);
  // sign — glowing
  const signMat = new THREE.MeshStandardMaterial({ map: textTex("Dream Dental", "#16224a", "#ffd9a0"), emissive: 0xffc27a, emissiveIntensity: 1.5, roughness: 0.5 });
  const sign = new THREE.Mesh(new RoundedBoxGeometry(6.4, 1.3, 0.28, 2, 0.1), signMat);
  sign.position.set(0, 8.6, 4.95); sign.castShadow = true; b.add(sign);
  b.add(glowAt(0xffc27a, 4.5, 0.22, 0, 8.6, 5.2));
  scene.add(b);

  for (let i = 0; i < 10; i++) { const t = tree(rnd(1.1, 1.7)); t.position.set(rnd(-22, 22), 0, rnd(-18, -7)); scene.add(t); }
  [-9.6, -6.4, 6.4, 9.6].forEach((x) => { const c = car(pick([0xc94f5a, 0x44618f, 0x2b2f3c, 0xd8d3c8])); c.position.set(x, 0, 13); c.rotation.y = Math.PI / 2; scene.add(c); });
  [[-13, 6], [13, 6]].forEach(([x, z]) => { const l = streetLamp(5); l.position.set(x, 0, z); scene.add(l); });
  motes(70, 26, 1, 10);
  camera.position.set(19, 10, 24);
  return { title: "Dental clinic — DreamCRM", sub: "twilight · glowing interior, lit signage, lamp-lit lot", target: new THREE.Vector3(0, 4.4, 0) };
}

function buildTruck() {
  scene.add(ground(400, 0x2f4636));
  hills();
  scene.add(plane(300, 17, std(0x24263a, 0.82), 0.02));
  const dashMat = glowMat(0xd8c48a, 0.5);
  for (let x = -70; x <= 70; x += 9) { const l = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.26), dashMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.05, 0); scene.add(l); }

  const g = new THREE.Group();
  const orange = std(0xd97a2b, 0.42, 0.3), dark = std(0x1e2230, 0.6, 0.3);
  const chassis = rbox(9, 0.5, 2.4, dark, 0.07); chassis.position.y = 0.95; g.add(chassis);
  const cab = rbox(2.7, 2.25, 2.5, orange, 0.18); cab.position.set(2.9, 2.12, 0); g.add(cab);
  const hood = rbox(1.5, 1.2, 2.45, orange, 0.16); hood.position.set(4.9, 1.6, 0); g.add(hood);
  const ws = rbox(0.16, 1.15, 2.2, darkGlass(), 0.05); ws.position.set(4.28, 2.55, 0); g.add(ws);
  [1.28, -1.28].forEach((z) => { const w = rbox(2.2, 1.0, 0.12, darkGlass(), 0.05); w.position.set(2.9, 2.55, z); g.add(w); });
  // flatbed + rails
  const bed = rbox(5.4, 0.32, 2.5, std(0xb9bfc6, 0.5, 0.5), 0.05); bed.position.set(-1.7, 1.4, 0); g.add(bed);
  [1.22, -1.22].forEach((z) => { const r = rbox(5.4, 0.36, 0.14, dark, 0.04); r.position.set(-1.7, 1.74, z); g.add(r); });
  // boom
  const boom = rbox(2.6, 0.34, 0.34, dark, 0.08); boom.position.set(0.7, 2.5, 0); boom.rotation.z = 0.55; g.add(boom);
  const hook = rbox(0.26, 0.5, 0.26, std(0x9aa1ab, 0.4, 0.7), 0.05); hook.position.set(-0.5, 2.0, 0); g.add(hook);
  // amber beacon — the magic touch
  const beacon = rbox(0.7, 0.16, 0.35, glowMat(0xffa32b, 4), 0.06); beacon.position.set(2.9, 3.3, 0); g.add(beacon);
  g.add(glowAt(0xffa32b, 2.8, 0.5, 2.9, 3.35, 0));
  const beaconLight = new THREE.PointLight(0xffa02b, 7, 22, 2); beaconLight.position.set(2.9, 3.5, 0); g.add(beaconLight);
  // headlights
  [[5.6, 0.8], [5.6, -0.8]].forEach(([x, z]) => {
    const hl = rbox(0.14, 0.26, 0.4, glowMat(0xfff2d0, 2), 0.05); hl.position.set(x, 1.5, z); g.add(hl);
    g.add(glowAt(0xfff0cc, 1.5, 0.3, x + 0.3, 1.5, z));
  });
  const dsign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.85), new THREE.MeshStandardMaterial({ map: textTex("DREAM TOWING", "#d97a2b", "#231a10"), roughness: 0.5 }));
  dsign.position.set(1.53, 2.05, 0); dsign.rotation.y = -Math.PI / 2; g.add(dsign);
  const wg = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 18), wm = std(0x14151c, 0.85), hub = std(0x9aa1ab, 0.35, 0.7);
  [[3.4, 1.3], [3.4, -1.3], [-2.2, 1.3], [-2.2, -1.3], [-3.6, 1.3], [-3.6, -1.3]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wg, wm); w.rotation.x = Math.PI / 2; w.position.set(x, 0.62, z); w.castShadow = true; g.add(w);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.53, 10), hub); h.rotation.x = Math.PI / 2; h.position.set(x, 0.62, z); g.add(h);
  });
  g.position.set(-1, 0, 0); scene.add(g);

  const towed = car(0x44618f); towed.position.set(-6.4, 0.25, 0); towed.rotation.y = Math.PI; towed.scale.setScalar(0.95); scene.add(towed);
  for (let x = -50; x <= 50; x += 13) {
    [11, -11].forEach((z) => { const t = tree(rnd(1, 1.6)); t.position.set(x + rnd(-3, 3), 0, z); scene.add(t); });
  }
  for (let x = -36; x <= 36; x += 24) { const l = streetLamp(5); l.position.set(-9.5, 0, x); scene.add(l); }
  motes(60, 24, 0.6, 7);
  camera.position.set(7.5, 3.6, 12.5);
  return { title: "Tow truck — Dream Towing", sub: "twilight · amber beacon, headlight glow, lamp-lit road", target: new THREE.Vector3(-1, 1.6, 0) };
}

/* ---------------- Boot ---------------- */
const meta = KEY === "clinic" ? buildClinic() : KEY === "truck" ? buildTruck() : buildHood();
document.getElementById("title").textContent = meta.title;
document.getElementById("sub").textContent = meta.sub;
document.getElementById("t-" + KEY)?.classList.add("on");

/* HDRI image-based lighting — real reflections & ambient bounce */
new RGBELoader().setPath("../assets/hdri/").load("evening_road_01_puresky_1k.hdr", (tex) => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  scene.environmentIntensity = 0.55;
  tex.dispose(); pmrem.dispose();
  window.__hdri = true;
}, undefined, () => { window.__hdri = false; });

/* Gradient twilight backdrop (our own — keeps the art direction) */
(function backdrop() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x121a44) }, mid: { value: new THREE.Color(0x3d3a72) }, low: { value: new THREE.Color(0x8a5d7e) }, hor: { value: new THREE.Color(0xe0895c) } },
    vertexShader: `varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 p; uniform vec3 top,mid,low,hor;
      void main(){ float h=normalize(p).y;
        vec3 c=mix(hor,low,smoothstep(-0.02,0.12,h));
        c=mix(c,mid,smoothstep(0.08,0.34,h));
        c=mix(c,top,smoothstep(0.3,0.85,h));
        gl_FragColor=vec4(c,1.); }`,
  }));
  scene.add(m);
})();

/* Bloom — what makes every warm light feel magical */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.7, 0.92));
composer.addPass(new OutputPass());
composer.setPixelRatio(Math.min(devicePixelRatio, 1.6));

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

const rad = Math.hypot(camera.position.x, camera.position.z);
let ang = Math.atan2(camera.position.z, camera.position.x);
const camY = camera.position.y;
const clock = new THREE.Clock();
function loop() {
  const t = clock.getElapsedTime(), dt = Math.min(clock.getDelta(), 0.05);
  ang += 0.0011;
  camera.position.set(Math.cos(ang) * rad, camY + Math.sin(t * 0.25) * 0.5, Math.sin(ang) * rad);
  camera.lookAt(meta.target);
  scene.traverse((o) => {
    if (o.isSprite && o.userData.base) {
      o.position.y = o.userData.base.y + Math.sin(t * 0.6 + o.userData.phase) * o.userData.amp;
      o.position.x = o.userData.base.x + Math.cos(t * 0.4 + o.userData.phase) * o.userData.amp * 0.6;
    }
  });
  if (meta.traffic) meta.traffic.forEach((tr) => { tr.c.position.z += tr.dir * 7 * dt; if (tr.c.position.z > 60) tr.c.position.z = -60; if (tr.c.position.z < -60) tr.c.position.z = 60; });
  composer.render();
  requestAnimationFrame(loop);
}
loop();
window.__ready = true;
