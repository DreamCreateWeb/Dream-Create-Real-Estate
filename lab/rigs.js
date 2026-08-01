/* =========================================================
   Dream Create — asset rigs
   Bespoke assets built by kitbashing CC0 base models with
   custom geometry + proper materials. Each rig returns a
   THREE.Group ready to drop into a scene.
   ========================================================= */
import * as THREE from "three";

/* ---------- shared material library ---------- */
export const M = {
  paint: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0.25 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x6a7180, roughness: 0.42, metalness: 0.85 }),
  darkSteel: () => new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.5, metalness: 0.7 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: 0.12, metalness: 1.0 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.92, metalness: 0 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0x223247, roughness: 0.06, metalness: 0.4,
    emissive: 0x0a1420, emissiveIntensity: 0.6 }),
  glow: (c, i = 3) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.35 }),
};

/* rounded box without needing the addon */
function rbox(w, h, d, mat, seg = 2) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}
function at(o, x, y, z) { o.position.set(x, y, z); return o; }

/* ---------------------------------------------------------
   Repaint a kit atlas.
   Kenney vehicles use one shared colormap; the paintable body
   panels are the near-white, low-saturation texels. We remap
   ONLY those to the target colour (keeping their shading), so
   glass, tyres, lights and trim keep their own colours.
   --------------------------------------------------------- */
const _atlasCache = new Map();
const BAND = 64;                       // Kenney palette strips are 64px wide

/* Repaint whole palette STRIPS (they are vertical gradients, so we scale
   each texel by its own luminance to keep the shading). `bands` maps a
   strip index -> target colour (or "debug" to flood it flat).            */
function repaintAtlas(url, bands, debug = false) {
  const key = url + "|" + JSON.stringify(bands) + "|" + debug;
  if (_atlasCache.has(key)) return _atlasCache.get(key);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      const id = cx.getImageData(0, 0, c.width, c.height), d = id.data;
      // per-strip peak luminance, so we can normalise the gradient
      const peak = {};
      for (const b of Object.keys(bands)) peak[b] = 1e-6;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const b = Math.floor(x / BAND);
          if (!(b in bands)) continue;
          const i = (y * c.width + x) * 4;
          const l = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
          if (l > peak[b]) peak[b] = l;
        }
      }
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const b = Math.floor(x / BAND);
          if (!(b in bands)) continue;
          const i = (y * c.width + x) * 4;
          if (d[i + 3] === 0) continue;
          const t = new THREE.Color(bands[b]);
          if (debug) { d[i] = t.r * 255; d[i + 1] = t.g * 255; d[i + 2] = t.b * 255; continue; }
          const l = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
          const k = 0.42 + 0.72 * (l / peak[b]);        // keep the strip's shading
          d[i]     = Math.min(255, t.r * 255 * k);
          d[i + 1] = Math.min(255, t.g * 255 * k);
          d[i + 2] = Math.min(255, t.b * 255 * k);
        }
      }
      cx.putImageData(id, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
      res(tex);
    };
    img.onerror = rej;
    img.src = url;
  });
  _atlasCache.set(key, p);
  return p;
}

/* Kenney car-kit palette strips actually used by vehicle bodies
   (measured from truck-flat UVs).                                */
/* verified by flooding each strip and rendering (lab/asset.html?rig=..&bands=1):
   0 = window glass · 1 = lights · 3 = lower cladding/bumpers ·
   5 = wheel hubs · 6 = main body paint                                   */
export const VEHICLE_BANDS = { GLASS: 0, LIGHTS: 1, CLADDING: 3, HUBS: 5, PAINT: 6 };

/* Paint a kit model by swapping its atlas for a repainted one. */
export async function paint(obj, kit, bands, base = "../assets/", debug = false) {
  const tex = await repaintAtlas(`${base}models/${kit}/Textures/colormap.png`, bands, debug);
  obj.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.map) return;
    o.material = o.material.clone();
    o.material.map = tex;
    o.material.color = new THREE.Color(0xffffff);   // let the texture carry the colour
    o.material.roughness = 0.62;
    o.material.metalness = 0.06;
    o.material.needsUpdate = true;
  });
  return obj;
}

/* =========================================================
   RIG: Dream Towing wrecker
   Kenney flatbed truck as the base, with a properly modelled
   wrecker assembly: boom, hydraulic ram, winch drum, cable,
   hook block, stabilisers, light bar, stack & mirrors.
   ========================================================= */
async function towtruck({ loadGLB, debugBands }) {
  const AMBER = 0xff9c3d;
  const DEBUG_BANDS = !!debugBands;
  const g = new THREE.Group();

  const base = await loadGLB("vehicles/truck-flat");
  const BANDS = DEBUG_BANDS
    ? { 0: 0xff0000, 1: 0x00ff00, 2: 0x0000ff, 3: 0xff00ff, 4: 0x00ffff, 5: 0xffff00, 6: 0xffffff, 7: 0xff8800 }
    : { 6: AMBER, 0: 0x16283f, 3: 0x4a4f5e };   // paint · glass · cladding
  await paint(base, "vehicles", BANDS, "../assets/", DEBUG_BANDS);
  g.add(base);

  // measure the base so every added part is proportional & seated
  const bb = new THREE.Box3().setFromObject(base);
  const sz = new THREE.Vector3(); bb.getSize(sz);
  const noseZ = bb.max.z, tailZ = bb.min.z;      // model nose is +Z
  const halfW = sz.x / 2;
  // measured from truck-flat: bed floor y=0.45, interior x ±0.65, z -1.32..-0.63
  const bedY     = bb.min.y + sz.y * 0.517;
  const bedHalfX = sz.x * 0.385;
  const bedZ0    = tailZ + sz.z * 0.02;           // tail end of the bed
  const bedZ1    = tailZ + sz.z * 0.27;           // front end of the bed
  const bedMidZ  = (bedZ0 + bedZ1) / 2;
  const bedLen   = bedZ1 - bedZ0;

  const steel = M.steel(), dark = M.darkSteel(), chrome = M.chrome();

  /* --- deck plate over the flatbed --- */
  const deck = rbox(bedHalfX * 1.86, 0.04, bedLen * 0.94, steel);
  at(deck, 0, bedY + 0.022, bedMidZ);
  g.add(deck);
  // deck ribs, kept inside the bed walls
  const ribN = 6;
  for (let i = 0; i < ribN; i++) {
    const rib = rbox(bedHalfX * 1.7, 0.018, 0.028, dark);
    at(rib, 0, bedY + 0.05, bedZ0 + bedLen * ((i + 0.5) / ribN));
    g.add(rib);
  }

  /* --- tower the boom pivots from --- */
  const towerH = sz.y * 0.62;
  const towerZ = bedZ1 + sz.z * 0.03;
  [-1, 1].forEach((s) => {
    const leg = rbox(0.06, towerH, 0.09, dark);
    at(leg, s * bedHalfX * 0.62, bedY + towerH / 2, towerZ);
    g.add(leg);
  });
  const towerTop = rbox(bedHalfX * 1.5, 0.07, 0.12, dark);
  at(towerTop, 0, bedY + towerH, towerZ);
  g.add(towerTop);
  // winch drum between the legs
  const drum = cyl(0.085, 0.085, bedHalfX * 1.1, chrome, 14);
  drum.rotation.z = Math.PI / 2;
  at(drum, 0, bedY + towerH * 0.55, towerZ - 0.02);
  g.add(drum);

  /* --- the boom: two beams angled back over the bed --- */
  const boomLen = sz.z * 0.52;
  const boomAngle = 0.46;                         // +ve so the tip rises toward the tail
  const boom = new THREE.Group();
  [-1, 1].forEach((s) => {
    const beam = rbox(0.085, 0.17, boomLen, steel);
    at(beam, s * 0.13, 0, -boomLen / 2);
    boom.add(beam);
  });
  // lattice between the beams
  for (let i = 1; i < 5; i++) {
    const x = rbox(0.24, 0.035, 0.035, dark);
    at(x, 0, 0, -boomLen * (i / 5));
    boom.add(x);
  }
  // boom tip sheave
  const sheave = cyl(0.07, 0.07, 0.06, chrome, 12);
  sheave.rotation.z = Math.PI / 2;
  at(sheave, 0, 0, -boomLen);
  boom.add(sheave);
  boom.position.set(0, bedY + towerH + 0.03, towerZ);
  boom.rotation.x = boomAngle;
  g.add(boom);

  /* --- hydraulic ram pushing the boom --- */
  const ramLen = sz.z * 0.26;
  const ram = new THREE.Group();
  const barrel = cyl(0.055, 0.055, ramLen, dark, 12);
  barrel.rotation.x = Math.PI / 2; at(barrel, 0, 0, -ramLen / 2); ram.add(barrel);
  const rod = cyl(0.028, 0.028, ramLen * 0.75, chrome, 12);
  rod.rotation.x = Math.PI / 2; at(rod, 0, 0, -ramLen * 0.95); ram.add(rod);
  ram.position.set(0, bedY + towerH * 0.42, towerZ + 0.02);
  ram.rotation.x = 0.62;
  g.add(ram);

  /* --- cable + hook block hanging from the boom tip --- */
  const tip = new THREE.Vector3(0, 0, -boomLen).applyEuler(boom.rotation).add(boom.position);
  const drop = sz.y * 0.42;
  const cable = cyl(0.018, 0.018, drop, chrome, 6);
  at(cable, tip.x, tip.y - drop / 2, tip.z);
  g.add(cable);
  const block = rbox(0.13, 0.2, 0.11, dark);
  at(block, tip.x, tip.y - drop - 0.05, tip.z);
  g.add(block);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 10, 18, Math.PI * 1.45), chrome);
  hook.rotation.set(Math.PI / 2, 0, 0.4);
  at(hook, tip.x, tip.y - drop - 0.17, tip.z);
  hook.castShadow = true;
  g.add(hook);

  /* --- stabiliser legs at the tail --- */
  const groundY = bb.min.y;                        // wheels touch here
  [-1, 1].forEach((s) => {
    const x = s * bedHalfX * 1.06;
    const hip = rbox(0.16, 0.09, 0.09, dark);      // bracket off the chassis
    at(hip, x * 0.86, bedY - sz.y * 0.10, bedZ0 + 0.06);
    g.add(hip);
    const legTop = bedY - sz.y * 0.10, legLen = legTop - (groundY + 0.05);
    const leg = rbox(0.07, legLen, 0.07, steel);
    at(leg, x, legTop - legLen / 2, bedZ0 + 0.06);
    g.add(leg);
    const foot = cyl(0.085, 0.085, 0.045, M.darkSteel(), 12);
    at(foot, x, groundY + 0.045, bedZ0 + 0.06);
    g.add(foot);
  });

  /* --- cab details: light bar, stack, mirrors --- */
  const cabZ = noseZ - sz.z * 0.28;
  const cabTop = bb.max.y;
  const bar = rbox(halfW * 1.05, 0.07, 0.13, dark);
  at(bar, 0, cabTop + 0.05, cabZ);
  g.add(bar);
  [-1, 1].forEach((s) => {
    const lamp = rbox(halfW * 0.34, 0.06, 0.1, M.glow(0xffa32b, 3.2));
    at(lamp, s * halfW * 0.32, cabTop + 0.055, cabZ);
    g.add(lamp);
  });
  // exhaust stack
  const stack = cyl(0.042, 0.048, sz.y * 0.46, chrome, 10);
  at(stack, halfW * 0.62, bb.min.y + sz.y * 0.78, cabZ - sz.z * 0.10);
  g.add(stack);
  const stackTip = cyl(0.05, 0.042, 0.06, M.darkSteel(), 10);
  at(stackTip, halfW * 0.62, bb.min.y + sz.y * 0.78 + sz.y * 0.25, cabZ - sz.z * 0.10);
  g.add(stackTip);
  // mirrors
  const mirrorZ = noseZ - sz.z * 0.24, mirrorY = bb.min.y + sz.y * 0.70;
  [-1, 1].forEach((s) => {
    const armM = rbox(0.10, 0.018, 0.018, dark);
    at(armM, s * (halfW * 0.74), mirrorY, mirrorZ);
    g.add(armM);
    const face = rbox(0.025, 0.10, 0.055, M.chrome());
    at(face, s * (halfW * 0.74 + 0.05), mirrorY, mirrorZ);
    g.add(face);
  });

  /* --- lights --- */
  [-1, 1].forEach((s) => {
    const hl = rbox(0.1, 0.07, 0.05, M.glow(0xfff2d0, 3));
    at(hl, s * halfW * 0.62, bb.min.y + sz.y * 0.36, noseZ + 0.01);
    g.add(hl);
  });
  [-1, 1].forEach((s) => {
    const tl = rbox(0.08, 0.05, 0.04, M.glow(0xff5a4a, 2.6));
    at(tl, s * halfW * 0.66, bb.min.y + sz.y * 0.34, tailZ - 0.01);
    g.add(tl);
  });

  g.userData.beacon = { y: cabTop + 0.09, z: cabZ };
  return g;
}

/* =========================================================
   RIG: parts — lay named kit pieces out in a row so we can
   see what each one actually is.  ?rig=parts&parts=modular/building-window,...
   ========================================================= */
async function parts({ loadGLB, partList, debugBands }) {
  const g = new THREE.Group();
  const names = (partList || "").split(",").map((s) => s.trim()).filter(Boolean);
  const cols = Math.ceil(Math.sqrt(names.length));
  const DBG = { 0: 0xff0000, 1: 0x00ff00, 2: 0x0000ff, 3: 0xff00ff, 4: 0x00ffff, 5: 0xffff00, 6: 0xffffff, 7: 0xff8800 };
  for (let i = 0; i < names.length; i++) {
    let o;
    try { o = await loadGLB(names[i]); } catch (e) { continue; }
    if (debugBands) { const kit = names[i].split("/")[0]; await paint(o, kit, DBG, "../assets/", true); }
    const col = i % cols, row = Math.floor(i / cols);
    o.position.set((col - (cols - 1) / 2) * 1.35, 0, (row - (cols - 1) / 2) * 1.35);
    g.add(o);
  }
  return g;
}


/* =========================================================
   RIG: DreamCRM dental clinic — modern two-storey
   Built from the modular building kit on its 1x1 x 0.62 grid,
   repainted into the DreamCRM palette pulled from
   dreamcreatestudio.com.
   ========================================================= */
export const DREAMCRM = {
  surface:  0xf4f7fd,   // near-white facade  (--color-surface-1 #f8faff)
  ink:      0x1a2440,   // deep navy          (--color-ink-900)
  inkSoft:  0x33405f,   // (--color-ink-700)
  accent:   0x4c7df0,   // brand blue         (27x in the site CSS)
  glassLit: 0x9dc0ff,
};

/* modular-kit palette strips, verified with ?bands=1:
   0 = awnings · 3 = detail/AC · 5 = window glass · 6 = roof · 7 = wall */
const MOD_BANDS = {
  7: DREAMCRM.surface,
  5: DREAMCRM.glassLit,
  6: DREAMCRM.ink,
  0: DREAMCRM.accent,
  3: DREAMCRM.inkSoft,
};

function signTexture(title, sub) {
  const w = 1024, h = 256, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = "#10182e"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#4c7df0"; x.fillRect(0, h - 10, w, 10);
  x.textAlign = "left"; x.textBaseline = "middle";
  x.fillStyle = "#f4f7fd";
  x.font = "600 96px 'Geist Sans', Inter, system-ui, sans-serif";
  x.shadowColor = "#4c7df0"; x.shadowBlur = 26;
  x.fillText(title, 56, h / 2 - 14);
  x.shadowBlur = 0;
  x.fillStyle = "#7ca5ff";
  x.font = "500 38px 'Geist Mono', ui-monospace, monospace";
  x.fillText(sub, 58, h / 2 + 62);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function clinic({ loadGLB, debugBands }) {
  const g = new THREE.Group();
  const CELL = 1.0, STOREY = 0.62;
  const W = 6, D = 4;                       // footprint in cells
  const DBG = { 0: 0xff0000, 1: 0x00ff00, 2: 0x0000ff, 3: 0xff00ff, 4: 0x00ffff, 5: 0xffff00, 6: 0xffffff, 7: 0xff8800 };
  const bands = debugBands ? DBG : MOD_BANDS;

  // preload the pieces we need, pre-painted
  const NEED = {
    win:    "modular/building-window",
    winL:   "modular/building-window-large",
    door:   "modular/building-door-window",
    corner: "modular/building-corner-window",
    block:  "modular/building-block",
    rBord:  "modular/roof-flat-border-straight",
    rCorn:  "modular/roof-flat-corner",
    rCent:  "modular/roof-flat-center",
    ac:     "modular/detail-ac-a",
  };
  const P = {};
  for (const [k, path] of Object.entries(NEED)) {
    try {
      const o = await loadGLB(path);
      await paint(o, "modular", bands, "../assets/", !!debugBands);
      P[k] = o;
    } catch (e) { /* piece missing — skip */ }
  }
  const use = (k) => (P[k] ? P[k].clone(true) : null);

  const px = (ix) => (ix - (W - 1) / 2) * CELL;
  const pz = (iz) => (iz - (D - 1) / 2) * CELL;

  // ---- two storeys of perimeter wall ----
  for (let s = 0; s < 2; s++) {
    const y = s * STOREY;
    for (let ix = 0; ix < W; ix++) {
      for (let iz = 0; iz < D; iz++) {
        const edgeX = ix === 0 || ix === W - 1;
        const edgeZ = iz === 0 || iz === D - 1;
        if (!edgeX && !edgeZ) continue;               // hollow interior
        let key = "win", ry = 0;
        if (iz === D - 1) ry = 0;                      // front faces +Z
        else if (iz === 0) ry = Math.PI;               // back
        else if (ix === W - 1) ry = Math.PI / 2;       // right
        else ry = -Math.PI / 2;                        // left
        if (edgeX && edgeZ) key = "corner";
        else if (iz === D - 1) {
          // glazed ground-floor frontage, big windows above
          const mid = ix === 2 || ix === 3;
          key = s === 0 ? (mid ? "door" : "winL") : "winL";
        }
        const o = use(key) || use("block");
        if (!o) continue;
        o.rotation.y = ry;
        o.position.set(px(ix), y, pz(iz));
        g.add(o);
      }
    }
  }

  // ---- flat roof: a solid deck + a slim parapet (kit roof tiles don't
  //      tile on this grid, and left the interior open to the sky) ----
  const roofY = 2 * STOREY;
  const spanX = W * CELL, spanZ = D * CELL;
  const deckMat = new THREE.MeshStandardMaterial({ color: DREAMCRM.inkSoft, roughness: 0.92 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.06, spanZ), deckMat);
  deck.castShadow = true; deck.receiveShadow = true;
  deck.position.set(0, roofY + 0.03, 0);
  g.add(deck);

  const parapetMat = new THREE.MeshStandardMaterial({ color: DREAMCRM.surface, roughness: 0.85 });
  const capMat = new THREE.MeshStandardMaterial({ color: DREAMCRM.accent, roughness: 0.5, metalness: 0.1 });
  const PH = 0.15, PT = 0.09;
  [[spanX, PT, 0, spanZ / 2 - PT / 2], [spanX, PT, 0, -spanZ / 2 + PT / 2]].forEach(([w, t, ox, oz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, PH, t), parapetMat);
    p.castShadow = true; p.position.set(ox, roofY + PH / 2, oz); g.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, t * 1.25), capMat);
    cap.position.set(ox, roofY + PH, oz); g.add(cap);
  });
  [[PT, spanZ, spanX / 2 - PT / 2, 0], [PT, spanZ, -spanX / 2 + PT / 2, 0]].forEach(([t, d, ox, oz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(t, PH, d), parapetMat);
    p.castShadow = true; p.position.set(ox, roofY + PH / 2, oz); g.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(t * 1.25, 0.022, d), capMat);
    cap.position.set(ox, roofY + PH, oz); g.add(cap);
  });

  // slim brand-blue band between the storeys (modern medical look)
  [[spanZ / 2 + 0.005, 0], [-spanZ / 2 - 0.005, Math.PI]].forEach(([oz]) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.045, 0.02), capMat);
    band.position.set(0, STOREY - 0.015, oz); g.add(band);
  });
  [[spanX / 2 + 0.005], [-spanX / 2 - 0.005]].forEach(([ox]) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, spanZ), capMat);
    band.position.set(ox, STOREY - 0.015, 0); g.add(band);
  });

  // ---- rooftop plant ----
  [[1.2, -0.6], [-1.6, 0.4]].forEach(([ax, az]) => {
    const o = use("ac");
    if (!o) return;
    o.position.set(ax, roofY + 0.06, az);
    g.add(o);
  });

  // ---- entrance canopy in brand blue ----
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(CELL * 2.6, 0.07, 0.9),
    new THREE.MeshStandardMaterial({ color: DREAMCRM.accent, roughness: 0.45, metalness: 0.1 }));
  canopy.castShadow = true;
  canopy.position.set(0, STOREY * 0.78, pz(D - 1) + CELL / 2 + 0.42);
  g.add(canopy);
  [-1.1, 1.1].forEach((cx) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, STOREY * 0.78, 10),
      new THREE.MeshStandardMaterial({ color: DREAMCRM.inkSoft, roughness: 0.4, metalness: 0.6 }));
    post.castShadow = true;
    post.position.set(cx, STOREY * 0.39, pz(D - 1) + CELL / 2 + 0.8);
    g.add(post);
  });

  // ---- lit signage ----
  const tex = signTexture("Dream Dental", "powered by DreamCRM");
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.15, roughness: 0.6 }));
  sign.position.set(0, STOREY * 1.62, pz(D - 1) + CELL / 2 + 0.02);
  g.add(sign);

  // soft wash of brand light on the frontage
  const wash = new THREE.PointLight(DREAMCRM.accent, 2.2, 6, 2);
  wash.position.set(0, STOREY * 1.2, pz(D - 1) + 1.2);
  g.add(wash);

  return g;
}

export const RIGS = { towtruck, parts, clinic };

export async function buildRig(name, ctx) {
  const fn = RIGS[name];
  if (!fn) throw new Error(`unknown rig "${name}" — have: ${Object.keys(RIGS).join(", ")}`);
  return await fn(ctx);
}
