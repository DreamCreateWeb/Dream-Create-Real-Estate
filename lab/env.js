/* =========================================================
   Dream Create — environment proof-of-concept
   Procedural, stylized "miniature diorama" environments with
   real sunlight + soft shadows, under the dreamy sky.
   ?s=clinic | hood | truck
   ========================================================= */
import * as THREE from "three";

const KEY = new URLSearchParams(location.search).get("s") || "hood";
const canvas = document.getElementById("c");
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ---------- Renderer ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color(0xcfe6f2), 60, 240);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);

/* ---------- Lights ---------- */
const hemi = new THREE.HemisphereLight(0xdbeeff, 0x6a7358, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2df, 2.5);
sun.position.set(38, 54, 26);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbcd6ff, 0.5);
fill.position.set(-30, 20, -20); scene.add(fill);

/* ---------- Sky dome + clouds ---------- */
(function sky() {
  const uni = { top: { value: new THREE.Color(0x2b6fb2) }, mid: { value: new THREE.Color(0x86bfe4) }, bot: { value: new THREE.Color(0xe4f2f8) } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: uni,
    vertexShader: `varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 p; uniform vec3 top,mid,bot; void main(){ float h=normalize(p).y; vec3 c=mix(bot,mid,smoothstep(-0.1,0.28,h)); c=mix(c,top,smoothstep(0.25,0.9,h)); gl_FragColor=vec4(c,1.); }`,
  }));
  scene.add(m);
  // clouds
  const s = 256, cv = document.createElement("canvas"); cv.width = cv.height = s; const x = cv.getContext("2d");
  for (let i = 0; i < 20; i++) { const r = s * rnd(0.12, 0.32), px = s * rnd(0.2, 0.8), py = s * rnd(0.3, 0.7); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, "rgba(255,255,255,0.22)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  const fade = x.createRadialGradient(s/2, s/2, s*0.15, s/2, s/2, s*0.5); fade.addColorStop(0, "#fff"); fade.addColorStop(1, "rgba(255,255,255,0)"); x.globalCompositeOperation = "destination-in"; x.fillStyle = fade; x.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: rnd(0.4, 0.85), depthWrite: false })); sp.position.set(rnd(-160, 160), rnd(40, 90), rnd(-160, 120)); const sc = rnd(30, 70); sp.scale.set(sc, sc * 0.6, 1); scene.add(sp); }
})();

/* ---------- Material + mesh helpers ---------- */
const std = (color, rough = 0.85, metal = 0.0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const glass = () => new THREE.MeshStandardMaterial({ color: 0x9cc7dd, roughness: 0.08, metalness: 0.1, emissive: 0x0a1a24, envMapIntensity: 1 });
function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function textTexture(txt, bg = "#0b2a4a", fg = "#eaf6ff") {
  const w = 512, h = 128, c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = "600 54px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(txt, w/2, h/2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// window facade texture
function facadeTexture(cols, rows, wall = "#eef3f6") {
  const W = 512, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = wall; x.fillRect(0, 0, W, H);
  const mx = W * 0.08, my = H * 0.12, gw = (W - mx * 2) / cols, gh = (H - my * 2) / rows;
  for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) {
    const px = mx + cc * gw + gw * 0.16, py = my + r * gh + gh * 0.16, ww = gw * 0.68, hh = gh * 0.66;
    const lit = Math.random() < 0.25;
    const g = x.createLinearGradient(px, py, px, py + hh);
    if (lit) { g.addColorStop(0, "#ffe9b8"); g.addColorStop(1, "#ffcf82"); }
    else { g.addColorStop(0, "#bfe0ee"); g.addColorStop(1, "#6f9fb8"); }
    x.fillStyle = g; x.fillRect(px, py, ww, hh);
    x.strokeStyle = "#2a3f4d"; x.lineWidth = 2; x.strokeRect(px, py, ww, hh);
    x.beginPath(); x.moveTo(px + ww/2, py); x.lineTo(px + ww/2, py + hh); x.moveTo(px, py + hh/2); x.lineTo(px + ww, py + hh/2); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function tree(scale = 1) {
  const g = new THREE.Group();
  const trunk = box(0.4 * scale, 1.6 * scale, 0.4 * scale, std(0x6b4a2f, 0.9)); trunk.position.y = 0.8 * scale; g.add(trunk);
  const green = pick([0x4f7a3a, 0x5f8f45, 0x6fa050, 0x477036]);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(rnd(0.9, 1.3) * scale, 0), std(green, 0.95)); f.castShadow = true; f.receiveShadow = true; f.position.set(rnd(-0.3, 0.3) * scale, (1.7 + i * 0.7) * scale, rnd(-0.3, 0.3) * scale); g.add(f); }
  return g;
}
function car(color = 0xd94f4f) {
  const g = new THREE.Group();
  const body = box(2.1, 0.6, 1.05, std(color, 0.4, 0.2)); body.position.y = 0.55; g.add(body);
  const cabin = box(1.1, 0.5, 0.95, glass()); cabin.position.set(-0.1, 1.02, 0); g.add(cabin);
  const wheelG = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 16); const wm = std(0x1a1a1e, 0.7);
  [[0.7, 0.55], [0.7, -0.55], [-0.7, 0.55], [-0.7, -0.55]].forEach(([x, z]) => { const w = new THREE.Mesh(wheelG, wm); w.rotation.x = Math.PI/2; w.position.set(x, 0.28, z); w.castShadow = true; g.add(w); });
  return g;
}
function groundPlane(size, color) { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), std(color, 1)); m.rotation.x = -Math.PI/2; m.receiveShadow = true; return m; }
function roadStrip(w, l, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.x = -Math.PI/2; m.position.y = 0.02; m.receiveShadow = true; return m; }

/* ---------- House (gable-roof) ---------- */
function gableRoof(w, h, d, mat) {
  const s = new THREE.Shape(); s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(0, h); s.lineTo(-w/2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d/2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function house() {
  const g = new THREE.Group();
  const w = rnd(4, 5.4), d = rnd(4.4, 5.8), h = rnd(2.4, 3.2);
  const wall = pick([0xf1e7d6, 0xe8d5c0, 0xdfe6e2, 0xf0dcdc, 0xd9e3ea, 0xe9e2d0]);
  const roofC = pick([0x8a5a44, 0x5a6b6e, 0x7a4b3e, 0x44525a, 0x6a4636]);
  const body = box(w, h, d, std(wall, 0.9)); body.position.y = h/2; g.add(body);
  const roof = gableRoof(w + 0.5, rnd(1.5, 2.2), d + 0.5, std(roofC, 0.85)); roof.position.y = h; g.add(roof);
  // door
  const door = box(0.95, 1.7, 0.12, std(pick([0x3a5a4a, 0x5a3a3a, 0x394a5a, 0x6b4a2f]), 0.6)); door.position.set(rnd(-w*0.2, w*0.2), 0.85, d/2 + 0.02); g.add(door);
  // windows (front + sides)
  const winMat = glass(), frame = std(0xffffff, 0.7);
  const addWin = (x, y, z, ry) => { const fr = box(1.05, 1.05, 0.1, frame); fr.position.set(x, y, z); fr.rotation.y = ry; g.add(fr); const gl = box(0.85, 0.85, 0.14, winMat); gl.position.set(x, y, z); gl.rotation.y = ry; g.add(gl); };
  addWin(-w*0.3, 1.5, d/2 + 0.02, 0); addWin(w*0.3, 1.5, d/2 + 0.02, 0);
  addWin(w/2 + 0.02, 1.5, 0, Math.PI/2);
  // chimney
  const ch = box(0.5, 1.2, 0.5, std(roofC, 0.9)); ch.position.set(w*0.28, h + 1.1, -d*0.1); g.add(ch);
  return g;
}

/* ========================================================
   SCENE BUILDERS
   ======================================================== */
function buildHood() {
  scene.add(groundPlane(300, 0x84a45f)); // grass
  const roadMat = std(0x3f444c, 0.95);
  // main street + cross street
  scene.add(roadStrip(7, 120, roadMat));
  const cross = roadStrip(7, 120, roadMat); cross.rotation.z = Math.PI/2; scene.add(cross);
  // sidewalks
  const swMat = std(0xb9beba, 0.95);
  [-5.2, 5.2].forEach((x) => { const s = roadStrip(1.4, 120, swMat); s.position.x = x; s.position.y = 0.03; scene.add(s); });
  // lane dashes
  const dash = std(0xf2e9c0, 0.9);
  for (let z = -54; z <= 54; z += 8) { const dsh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), dash); dsh.rotation.x = -Math.PI/2; dsh.position.set(0, 0.04, z); scene.add(dsh); }
  // houses along both sides of the main street, facing it
  const lots = [];
  for (let z = -44; z <= 44; z += 12.5) { lots.push({ x: -13, z, ry: Math.PI/2 }); lots.push({ x: 13, z, ry: -Math.PI/2 }); }
  lots.forEach((l) => {
    if (Math.abs(l.z) < 6) return; // keep the intersection clear
    const h = house(); h.position.set(l.x, 0, l.z); h.rotation.y = l.ry; scene.add(h);
    // driveway
    const dv = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5), std(0x9a9ea1, 0.95)); dv.rotation.x = -Math.PI/2; dv.position.set(l.x + (l.x > 0 ? -3.4 : 3.4), 0.03, l.z + 3); scene.add(dv);
    if (Math.random() < 0.5) { const c = car(pick([0xd94f4f, 0x4f74d9, 0x2b2f36, 0xe0e3e6, 0x4faf7a])); c.position.set(l.x + (l.x > 0 ? -3.4 : 3.4), 0, l.z + 3); c.rotation.y = Math.PI/2; scene.add(c); }
    // yard trees
    for (let i = 0; i < 2; i++) { const t = tree(rnd(0.8, 1.2)); t.position.set(l.x + rnd(-2.5, 2.5) + (l.x > 0 ? 3 : -3), 0, l.z + rnd(-4, 4)); scene.add(t); }
  });
  // street trees along sidewalks
  for (let z = -50; z <= 50; z += 10) { [-6.4, 6.4].forEach((x) => { const t = tree(rnd(0.9, 1.3)); t.position.set(x, 0, z + 2); scene.add(t); }); }
  // a couple cars on the road
  [ [0.0, -20, 0], [0.0, 24, Math.PI] ].forEach(([x, z, ry]) => { const c = car(pick([0xd94f4f, 0x4f74d9, 0xe0e3e6])); c.position.set(x - 1.6, 0, z); c.rotation.y = ry; scene.add(c); });
  camera.position.set(46, 34, 52); camera.lookAt(0, 1, 0);
  return { title: "Neighborhood — Dream Create Real Estate", sub: "aerial orbit · procedural houses, streets, trees & cars with soft shadows" };
}

function buildClinic() {
  scene.add(groundPlane(300, 0x8aa863));
  // lot / concrete
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(48, 40), std(0xc7c9c4, 0.96)); lot.rotation.x = -Math.PI/2; lot.position.y = 0.01; lot.receiveShadow = true; scene.add(lot);
  // parking area
  const park = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), std(0x45484d, 0.96)); park.rotation.x = -Math.PI/2; park.position.set(0, 0.02, 12); park.receiveShadow = true; scene.add(park);
  const line = std(0xe8e2c8, 0.9);
  for (let i = -4; i <= 4; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 5), line); l.rotation.x = -Math.PI/2; l.position.set(i * 3, 0.03, 12); scene.add(l); }

  const b = new THREE.Group();
  // ground floor — glass
  const g0 = box(14, 3.4, 9, glass()); g0.position.y = 1.7; b.add(g0);
  // white frame columns on ground floor
  const colMat = std(0xf3f5f6, 0.7);
  [-7, -3.5, 0, 3.5, 7].forEach((x) => { const c = box(0.5, 3.4, 0.4, colMat); c.position.set(x, 1.7, 4.55); b.add(c); });
  // upper floors — white with window facade
  const fac = facadeTexture(7, 2, "#eef3f6");
  const facMat = new THREE.MeshStandardMaterial({ map: fac, roughness: 0.7 });
  const wallMat = std(0xeef3f6, 0.8);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(14, 6.5, 9), [wallMat, wallMat, wallMat, wallMat, facMat, facMat]);
  upper.castShadow = true; upper.receiveShadow = true; upper.position.y = 3.4 + 3.25; b.add(upper);
  // parapet
  const par = box(14.4, 0.5, 9.4, std(0xdfe4e6, 0.8)); par.position.y = 3.4 + 6.5 + 0.25; b.add(par);
  // rooftop units
  [[-3, 2], [3, -1]].forEach(([x, z]) => { const u = box(2.4, 1, 2, std(0xb9beba, 0.9)); u.position.set(x, 3.4 + 6.5 + 0.7, z); b.add(u); });
  // entrance canopy
  const can = box(5, 0.3, 2.4, std(0xdfe4e6, 0.7)); can.position.set(0, 3.1, 5.5); b.add(can);
  // doors
  const dr = box(2.4, 2.6, 0.2, glass()); dr.position.set(0, 1.3, 4.6); b.add(dr);
  // sign
  const signMat = new THREE.MeshStandardMaterial({ map: textTexture("Dream Dental", "#0b3a63", "#eaf6ff"), emissive: 0x11324f, emissiveIntensity: 0.4, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.3), signMat); sign.position.set(0, 8.2, 4.7); sign.castShadow = true; b.add(sign);
  scene.add(b);

  // landscaping
  for (let i = 0; i < 8; i++) { const t = tree(rnd(1, 1.5)); t.position.set(rnd(-20, 20), 0, rnd(-16, -6)); scene.add(t); }
  [-9, -6, 6, 9].forEach((x, i) => { const c = car(pick([0xd94f4f, 0x4f74d9, 0x2b2f36, 0xe0e3e6])); c.position.set(x, 0, 12); c.rotation.y = 0; scene.add(c); });
  // sidewalk
  const sw = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.4), std(0xc9cdc8, 0.95)); sw.rotation.x = -Math.PI/2; sw.position.set(0, 0.02, 7.5); scene.add(sw);

  camera.position.set(20, 11, 22); camera.lookAt(0, 4, 0);
  return { title: "Dental clinic — DreamCRM", sub: "glass ground floor, window facade, signage, parking & landscaping" };
}

function buildTruck() {
  scene.add(groundPlane(300, 0x8aa863));
  // road
  const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 16), std(0x3f444c, 0.95)); road.rotation.x = -Math.PI/2; road.position.y = 0.01; road.receiveShadow = true; scene.add(road);
  const line = std(0xf2e9c0, 0.9);
  for (let x = -60; x <= 60; x += 8) { const l = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.3), line); l.rotation.x = -Math.PI/2; l.position.set(x, 0.03, 0); scene.add(l); }

  const g = new THREE.Group();
  const orange = std(0xe98a2b, 0.5, 0.15), dark = std(0x2a2d33, 0.6);
  // chassis
  const chassis = box(9, 0.5, 2.4, dark); chassis.position.y = 0.95; g.add(chassis);
  // cab
  const cab = box(2.6, 2.2, 2.5, orange); cab.position.set(3, 2.1, 0); g.add(cab);
  const hood = box(1.4, 1.2, 2.5, orange); hood.position.set(4.9, 1.6, 0); g.add(hood);
  // windshield + windows
  const ws = box(0.2, 1.1, 2.2, glass()); ws.position.set(4.35, 2.5, 0); g.add(ws);
  [1.26, -1.26].forEach((z) => { const sw = box(2.2, 1.0, 0.14, glass()); sw.position.set(3, 2.5, z); g.add(sw); });
  // flatbed
  const bed = box(5.4, 0.35, 2.5, std(0xcfd3d6, 0.6, 0.3)); bed.position.set(-1.6, 1.4, 0); g.add(bed);
  const bedRail = box(5.4, 0.4, 0.15, dark); bedRail.position.set(-1.6, 1.75, 1.2); g.add(bedRail); const bedRail2 = bedRail.clone(); bedRail2.position.z = -1.2; g.add(bedRail2);
  // boom / hook
  const boom = box(0.4, 0.4, 0.4, dark); boom.scale.set(1, 6, 1); boom.position.set(0.6, 2.6, 0); boom.rotation.z = -0.5; g.add(boom);
  const hook = box(0.3, 0.6, 0.3, std(0x9a9ea1, 0.5, 0.5)); hook.position.set(-1.4, 2.0, 0); g.add(hook);
  // door sign
  const dsign = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 2.0), new THREE.MeshStandardMaterial({ map: textTexture("DREAM TOWING", "#e98a2b", "#2a2d33"), roughness: 0.5 })); dsign.position.set(1.68, 2.0, 0); g.add(dsign);
  // wheels
  const wheelG = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 20); const wm = std(0x17181c, 0.7);
  const hub = std(0xbfc3c6, 0.4, 0.6);
  [[3.4, 1.3], [3.4, -1.3], [-2.2, 1.3], [-2.2, -1.3], [-3.6, 1.3], [-3.6, -1.3]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheelG, wm); w.rotation.x = Math.PI/2; w.position.set(x, 0.62, z); w.castShadow = true; g.add(w);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.52, 12), hub); hb.rotation.x = Math.PI/2; hb.position.set(x, 0.62, z); g.add(hb);
  });
  g.position.set(-2, 0, 0); scene.add(g);

  // a small car being towed (on a ramp behind)
  const towed = car(0x4f74d9); towed.position.set(-6.5, 0.2, 0); towed.rotation.y = Math.PI; towed.scale.setScalar(0.95); scene.add(towed);
  // roadside trees
  for (let x = -40; x <= 40; x += 12) { [10, -10].forEach((z) => { const t = tree(rnd(1, 1.5)); t.position.set(x + rnd(-3, 3), 0, z); scene.add(t); }); }

  camera.position.set(6, 4.4, 13); camera.lookAt(-1, 1.6, 0);
  return { title: "Tow truck — Dream Towing", sub: "stylized truck with boom & hook, towing a car down the road" };
}

/* ---------- Boot ---------- */
let meta;
if (KEY === "clinic") meta = buildClinic();
else if (KEY === "truck") meta = buildTruck();
else meta = buildHood();
document.getElementById("title").textContent = meta.title;
document.getElementById("sub").textContent = meta.sub;
document.getElementById("t-" + KEY)?.classList.add("on");

const target = new THREE.Vector3(0, KEY === "hood" ? 1 : (KEY === "clinic" ? 4 : 1.6), 0);
let ang = Math.atan2(camera.position.z, camera.position.x);
const rad = Math.hypot(camera.position.x, camera.position.z);
const camY = camera.position.y;
const clock = new THREE.Clock();
addEventListener("resize", () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
function loop() {
  const t = clock.getElapsedTime();
  ang += 0.0009 * (KEY === "hood" ? 1 : 0.7);
  camera.position.set(Math.cos(ang) * rad, camY + Math.sin(t * 0.3) * 0.4, Math.sin(ang) * rad);
  camera.lookAt(target);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
window.__ready = true;
