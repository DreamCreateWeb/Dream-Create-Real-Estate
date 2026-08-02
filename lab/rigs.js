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
  surface:  0xd9e0ee,   // facade — pulled off pure white so form reads
  ink:      0x1a2440,   // deep navy          (--color-ink-900)
  inkSoft:  0x33405f,   // (--color-ink-700)
  accent:   0x4c7df0,   // brand blue         (27x in the site CSS)
  glassLit: 0x9dc0ff,
};

/* modular-kit palette strips, verified with ?bands=1:
   0 = awnings · 3 = detail/AC · 5 = window glass · 6 = roof · 7 = wall */
const MOD_WALL = 0xdfe6f2;
/* Two glazing variants so elevations aren't a grid of identical blue panels:
   most windows are dark glass; a minority are warm-lit from inside. */
const MOD_BANDS     = { 7: MOD_WALL, 5: 0x24395c, 6: DREAMCRM.ink, 0: DREAMCRM.accent, 3: DREAMCRM.inkSoft };
const MOD_BANDS_LIT = { 7: MOD_WALL, 5: 0xffcf94, 6: DREAMCRM.ink, 0: DREAMCRM.accent, 3: DREAMCRM.inkSoft };

/* stacked monument-sign face, drawn at the panel's real aspect */
function monumentTexture(title, sub) {
  const w = 512, h = 384, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = "#10182e"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#4c7df0"; x.fillRect(0, 0, w, 12);
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = "#f4f7fd";
  x.font = "600 76px 'Geist Sans', Inter, system-ui, sans-serif";
  x.shadowColor = "#4c7df0"; x.shadowBlur = 22;
  x.fillText("Dream", w / 2, h * 0.36);
  x.fillText("Dental", w / 2, h * 0.58);
  x.shadowBlur = 0;
  x.fillStyle = "#7ca5ff";
  x.font = "500 26px 'Geist Mono', ui-monospace, monospace";
  x.fillText(sub, w / 2, h * 0.82);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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
  const W = 6, D = 4;
  const halfX = (W * CELL) / 2, halfZ = (D * CELL) / 2;
  const TOP = 2 * STOREY;
  const DBG = { 0: 0xff0000, 1: 0x00ff00, 2: 0x0000ff, 3: 0xff00ff, 4: 0x00ffff, 5: 0xffff00, 6: 0xffffff, 7: 0xff8800 };
  const bands = debugBands ? DBG : MOD_BANDS;

  const tl = new THREE.TextureLoader();
  const tex = (f, rep) => {
    const t = tl.load("../assets/textures/" + f);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
    return t;
  };
  const mat = {
    wall:    new THREE.MeshStandardMaterial({ color: DREAMCRM.surface, roughness: 0.88 }),
    wall2:   new THREE.MeshStandardMaterial({ color: 0xc3ccdd, roughness: 0.9 }),
    ink:     new THREE.MeshStandardMaterial({ color: DREAMCRM.ink, roughness: 0.8 }),
    inkSoft: new THREE.MeshStandardMaterial({ color: DREAMCRM.inkSoft, roughness: 0.85 }),
    accent:  new THREE.MeshStandardMaterial({ color: DREAMCRM.accent, roughness: 0.45, metalness: 0.12 }),
    mullion: new THREE.MeshStandardMaterial({ color: 0x2b3654, roughness: 0.4, metalness: 0.55 }),
    glass:   new THREE.MeshStandardMaterial({
      color: 0x223b5e, roughness: 0.1, metalness: 0.25,
      transparent: true, opacity: 0.2, emissive: 0x243a63, emissiveIntensity: 0.3,
      depthWrite: false }),
    warm:    new THREE.MeshStandardMaterial({ color: 0xffeacb, emissive: 0xffc98a, emissiveIntensity: 2.6, roughness: 0.9 }),
  };
  const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; o.receiveShadow = true; return o; };
  const put = (o, x, y, z) => { o.position.set(x, y, z); g.add(o); return o; };

  // ---------- kit pieces ----------
  const NEED = { win: "modular/building-window", winL: "modular/building-window-large",
                 corner: "modular/building-corner-window", block: "modular/building-block",
                 ac: "modular/detail-ac-a" };
  const P = {}, PL = {};
  for (const [k, path] of Object.entries(NEED)) {
    try { const o = await loadGLB(path); await paint(o, "modular", bands, "../assets/", !!debugBands); P[k] = o; } catch (e) {}
    try { const o = await loadGLB(path); await paint(o, "modular", debugBands ? bands : MOD_BANDS_LIT, "../assets/", !!debugBands); PL[k] = o; } catch (e) {}
  }
  const use = (k) => (P[k] ? P[k].clone(true) : null);
  const useVar = (k) => {                       // ~28% of windows lit
    const src = (!debugBands && Math.random() < 0.28 && PL[k]) ? PL[k] : P[k];
    return src ? src.clone(true) : null;
  };
  const px = (ix) => (ix - (W - 1) / 2) * CELL;
  const pz = (iz) => (iz - (D - 1) / 2) * CELL;

  // the centre two cells of the front are the glazed lobby slot — leave them open
  const isLobby = (ix, iz) => iz === D - 1 && (ix === 2 || ix === 3);

  // ---------- plinth ----------
  const PL_H = 0.2;                                    // plinth height = the rise the steps/ramp serve
  put(box(W * CELL + 0.26, PL_H, D * CELL + 0.26, mat.ink), 0, PL_H / 2, 0);

  // ---------- two storeys of perimeter wall ----------
  for (let s = 0; s < 2; s++) {
    const y = PL_H + s * STOREY;
    for (let ix = 0; ix < W; ix++) {
      for (let iz = 0; iz < D; iz++) {
        const edgeX = ix === 0 || ix === W - 1, edgeZ = iz === 0 || iz === D - 1;
        if (!edgeX && !edgeZ) continue;
        if (isLobby(ix, iz)) continue;                    // glazed slot
        let key = "win", ry = 0;
        if (iz === D - 1) ry = 0;
        else if (iz === 0) ry = Math.PI;
        else if (ix === W - 1) ry = Math.PI / 2;
        else ry = -Math.PI / 2;
        if (edgeX && edgeZ) key = "corner";
        else if (iz === D - 1) key = "winL";
        const o = useVar(key) || use("block");
        if (!o) continue;
        o.rotation.y = ry; put(o, px(ix), y, pz(iz));
      }
    }
  }

  // ---------- recessed double-height glazed lobby ----------
  const LOB_W = 2 * CELL, LOB_Z = halfZ - 0.45;           // set back from the facade
  // back wall of the recess (so we never see through the building)
  put(box(LOB_W, TOP, 0.08, mat.inkSoft), 0, PL_H + TOP / 2, LOB_Z - 0.06);
  // ---- lobby interior: floor, ceiling, reception desk, columns, backlit wall ----
  const inFloorY = PL_H + 0.02, inDepth = 0.42;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb8916a, roughness: 0.75 });
  put(box(LOB_W - 0.1, 0.03, inDepth, woodMat), 0, inFloorY, LOB_Z - inDepth / 2 + 0.02);
  // backlit feature wall (the warm source)
  put(box(LOB_W - 0.24, TOP * 0.8, 0.03, mat.warm), 0, PL_H + TOP * 0.48, LOB_Z - 0.05);
  // ceiling cove + downlights spilling onto the floor
  put(box(LOB_W - 0.3, 0.03, 0.3, mat.warm), 0, PL_H + TOP - 0.1, LOB_Z - 0.18);
  // ceiling with a recessed cove
  put(box(LOB_W - 0.1, 0.035, inDepth, mat.wall), 0, PL_H + TOP - 0.06, LOB_Z - inDepth / 2 + 0.02);
  // reception desk
  const deskMat = new THREE.MeshStandardMaterial({ color: DREAMCRM.ink, roughness: 0.6 });
  put(box(0.9, 0.2, 0.16, deskMat), -0.15, PL_H + 0.12, LOB_Z - 0.16);
  put(box(0.96, 0.03, 0.2, mat.accent), -0.15, PL_H + 0.225, LOB_Z - 0.16);
  // two slim interior columns
  [-0.62, 0.62].forEach((cx) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, TOP - 0.1, 10), mat.wall);
    put(col, cx, PL_H + (TOP - 0.1) / 2, LOB_Z - 0.2);
  });
  // seating blocks
  [[0.66, -0.3], [0.66, -0.05]].forEach(([sx, sz]) => put(box(0.16, 0.09, 0.16, mat.inkSoft), sx, PL_H + 0.07, LOB_Z + sz));
  const lobbyLight = new THREE.PointLight(0xffd6a0, 5.5, 5.0, 2);
  put(lobbyLight, 0, PL_H + TOP * 0.6, LOB_Z + 0.2);
  const lobbyLight2 = new THREE.PointLight(0xffe0b0, 3.0, 3.0, 2);
  put(lobbyLight2, 0, PL_H + 0.35, LOB_Z - 0.08);
  const spill = new THREE.PointLight(0xffd9a8, 2.2, 3.2, 2);
  put(spill, 0, PL_H + 0.18, halfZ + 0.3);
  // reveals: side walls + soffit of the recess
  [-1, 1].forEach((s) => put(box(0.08, TOP, 0.45, mat.wall), s * (LOB_W / 2 + 0.04), PL_H + TOP / 2, LOB_Z + 0.225));
  put(box(LOB_W + 0.16, 0.08, 0.45, mat.wall), 0, PL_H + TOP + 0.04, LOB_Z + 0.225);
  // full-height curtain wall
  const glass = box(LOB_W, TOP - 0.06, 0.03, mat.glass);
  glass.castShadow = false; put(glass, 0, PL_H + TOP / 2, LOB_Z + 0.02);
  // mullions
  for (let i = -1; i <= 1; i++) put(box(0.045, TOP - 0.06, 0.05, mat.mullion), i * (LOB_W / 3), PL_H + TOP / 2, LOB_Z + 0.04);
  put(box(LOB_W, 0.05, 0.06, mat.mullion), 0, PL_H + STOREY, LOB_Z + 0.04);   // transom
  // entrance doors
  put(box(0.62, STOREY * 0.62, 0.05, mat.mullion), 0, PL_H + STOREY * 0.31, LOB_Z + 0.05);

  // ---------- brand portal frame around the slot (gives the facade depth) ----------
  const FR = 0.14, portalZ = halfZ + 0.02;
  [-1, 1].forEach((s) => put(box(FR, TOP + FR, 0.5, mat.accent), s * (LOB_W / 2 + FR / 2), PL_H + (TOP + FR) / 2 - FR / 2, portalZ - 0.25));
  put(box(LOB_W + FR * 2, FR, 0.5, mat.accent), 0, PL_H + TOP + FR / 2, portalZ - 0.25);

  // ---------- raised entrance volume: vertical accent over the lobby ----------
  const TOW_H = 0.5, TOW_W = LOB_W + FR * 2 + 0.3, TOW_D = 0.62;
  const towZ = halfZ - TOW_D / 2 + 0.06;
  put(box(TOW_W, TOW_H, TOW_D, mat.wall2), 0, PL_H + TOP + TOW_H / 2, towZ);
  put(box(TOW_W + 0.08, 0.05, TOW_D + 0.08, mat.accent), 0, PL_H + TOP + TOW_H + 0.02, towZ);
  // slim blue reveal down each side of the tower
  [-1, 1].forEach((s) => put(box(0.045, TOW_H * 0.8, TOW_D + 0.02, mat.accent),
    s * (TOW_W / 2 - 0.06), PL_H + TOP + TOW_H * 0.45, towZ));

  // ---------- entrance canopy ----------
  const canY = PL_H + STOREY * 1.02;
  put(box(LOB_W + 0.25, 0.03, 0.42, mat.accent), 0, canY + 0.06, halfZ + 0.17);
  put(box(LOB_W + 0.25, 0.035, 0.035, mat.mullion), 0, canY + 0.045, halfZ + 0.37);   // leading edge
  [-1, 1].forEach((s) => {                                    // neat brackets under the blade
    put(box(0.03, 0.16, 0.2, mat.mullion), s * (LOB_W / 2 - 0.05), canY - 0.02, halfZ + 0.06);
  });

  // ---------- steps + forecourt ----------
  const paveMat = new THREE.MeshStandardMaterial({
    map: tex("paving_color.jpg", 4), normalMap: tex("paving_norm.jpg", 4),
    color: 0xb9c2d4, roughness: 0.95 });
  const courtW = W * CELL + 1.2, courtD = 2.4;
  const court = new THREE.Mesh(new THREE.BoxGeometry(courtW, 0.07, courtD), paveMat);
  court.receiveShadow = true; put(court, 0, 0.035, halfZ + courtD / 2 - 0.05);
  // curb around the forecourt edge
  const curb = new THREE.MeshStandardMaterial({ color: 0x8f99ad, roughness: 0.95 });
  put(box(courtW + 0.12, 0.11, 0.06, curb), 0, 0.055, halfZ + courtD - 0.08);
  [-1, 1].forEach((s) => put(box(0.06, 0.11, courtD, curb), s * (courtW / 2 + 0.03), 0.055, halfZ + courtD / 2 - 0.05));
  // landing in front of the lobby, level with the floor inside
  const LAND_D = 0.5, landZ = halfZ + LAND_D / 2;
  put(box(LOB_W + 1.5, PL_H, LAND_D, mat.wall), 0, PL_H / 2, landZ);
  // three steps down the front edge, centred on the doors
  const stepN = 3, riser = (PL_H - 0.07) / stepN;
  for (let i = 0; i < stepN; i++) {
    put(box(LOB_W + 0.5, riser, 0.16, mat.wall),
        0, 0.07 + riser * (stepN - i) - riser / 2, halfZ + LAND_D + 0.08 + i * 0.16);
  }
  // low planters flanking the STEPS — kept clear of the ramp run
  const planterZ = halfZ + LAND_D + 0.42, planterX = LOB_W / 2 + 0.5;
  [-1, 1].forEach((s) => {
    put(box(0.42, 0.2, 0.42, mat.inkSoft), s * planterX, 0.17, planterZ);
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1),
      new THREE.MeshStandardMaterial({ color: 0x3f6f58, roughness: 1 }));
    shrub.castShadow = true; put(shrub, s * planterX, 0.34, planterZ);
  });

  // ---------- accessible ramp: parallel to the facade, off the landing edge ----------
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xc2cadb, roughness: 0.95 });
  const rampLen = 1.6, rampW = 0.5;
  const rampX0 = LOB_W / 2 + 0.75;                 // high end, meets the landing
  const rampCx = rampX0 + rampLen / 2;
  const rise = PL_H - 0.07;
  const ramp = box(rampLen, 0.04, rampW, rampMat);
  ramp.rotation.z = Math.atan2(rise, rampLen);     // slopes down away from the landing
  put(ramp, rampCx, 0.07 + rise / 2, landZ);
  // kerb rails both sides, following the slope
  [-1, 1].forEach((s) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, rampLen, 8), mat.mullion);
    rail.rotation.z = Math.PI / 2 + Math.atan2(rise, rampLen);
    put(rail, rampCx, 0.07 + rise / 2 + 0.24, landZ + s * (rampW / 2));
    [-0.62, 0, 0.62].forEach((o) => {
      const t = (o + rampLen / 2) / rampLen;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), mat.mullion);
      put(p, rampCx + o, 0.07 + rise * (1 - t) + 0.12, landZ + s * (rampW / 2));
    });
  });
  // bollards along the forecourt edge
  [-2.2, -1.6, 1.6, 2.2].forEach((bx) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 10), mat.inkSoft);
    b.castShadow = true; put(b, bx, 0.2, halfZ + 1.85);
    put(box(0.1, 0.02, 0.1, mat.accent), bx, 0.335, halfZ + 1.85);
  });
  // bike rack
  [0, 0.28].forEach((o) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 8, 16, Math.PI), mat.mullion);
    hoop.castShadow = true; put(hoop, -2.6, 0.07, halfZ + 1.0 + o);
  });

  // ---------- projecting upper volume on one wing (breaks the box) ----------
  const wingW = 2 * CELL;
  put(box(wingW, STOREY * 0.92, 0.3, mat.wall2), -halfX + wingW / 2 + 0.2, PL_H + STOREY * 1.5, halfZ + 0.15);
  put(box(wingW, 0.05, 0.34, mat.accent), -halfX + wingW / 2 + 0.2, PL_H + STOREY * 1.96, halfZ + 0.17);

  // ---------- vertical fins: rhythm across the long elevations ----------
  const finMat = new THREE.MeshStandardMaterial({ color: DREAMCRM.surface, roughness: 0.8 });
  for (let ix = 0; ix <= W; ix++) {
    const x = -halfX + ix * CELL;
    if (Math.abs(x) < LOB_W / 2 + 0.2) continue;             // clear of the lobby
    [halfZ + 0.05, -halfZ - 0.05].forEach((z) => {
      const fin = box(0.07, TOP - 0.04, 0.1, finMat);
      fin.castShadow = true; put(fin, x, PL_H + TOP / 2, z);
    });
  }
  for (let iz = 0; iz <= D; iz++) {
    const z = -halfZ + iz * CELL;
    [halfX + 0.05, -halfX - 0.05].forEach((x) => {
      const fin = box(0.1, TOP - 0.04, 0.07, finMat);
      fin.castShadow = true; put(fin, x, PL_H + TOP / 2, z);
    });
  }

  // ---------- shadow reveal at the base (grounds the building) ----------
  put(box(W * CELL + 0.02, 0.07, D * CELL + 0.02, mat.ink), 0, 0.115, 0);

  // ---------- service side: stops the back/left reading as wallpaper ----------
  const doorMat = new THREE.MeshStandardMaterial({ color: DREAMCRM.inkSoft, roughness: 0.6, metalness: 0.3 });
  // staff/service door + small canopy on the back elevation
  put(box(0.42, STOREY * 0.74, 0.05, doorMat), -1.4, PL_H + STOREY * 0.37, -halfZ - 0.03);
  put(box(0.62, 0.035, 0.24, mat.accent), -1.4, PL_H + STOREY * 0.8, -halfZ - 0.14);
  // condenser bank + screen on a concrete pad at the rear
  const padMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.96 });
  put(box(1.5, 0.04, 0.7, padMat), 1.2, 0.03, -halfZ - 0.45);
  [0.75, 1.2, 1.65].forEach((cx) => {
    put(box(0.34, 0.28, 0.34, mat.inkSoft), cx, 0.19, -halfZ - 0.45);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12), mat.mullion);
    put(fan, cx, 0.335, -halfZ - 0.45);
  });
  // louvred screen wall hiding the plant
  for (let i = 0; i < 6; i++)
    put(box(1.7, 0.035, 0.02, mat.wall), 1.2, 0.1 + i * 0.07, -halfZ - 0.78);
  [-1, 1].forEach((s) => put(box(0.05, 0.48, 0.05, mat.inkSoft), 1.2 + s * 0.85, 0.26, -halfZ - 0.78));

  // secondary/emergency exit on the left elevation
  put(box(0.05, STOREY * 0.72, 0.4, doorMat), -halfX - 0.03, PL_H + STOREY * 0.36, -0.6);
  put(box(0.2, 0.03, 0.55, mat.accent), -halfX - 0.12, PL_H + STOREY * 0.78, -0.6);

  // ---------- roof deck + parapet ----------
  const roofY = PL_H + TOP;
  const spanX = W * CELL, spanZ = D * CELL;
  put(box(spanX, 0.06, spanZ, mat.inkSoft), 0, roofY + 0.03, 0);
  const PH = 0.16, PT = 0.09;
  [[spanX, PT, 0, spanZ / 2 - PT / 2], [spanX, PT, 0, -spanZ / 2 + PT / 2]].forEach(([w, t, ox, oz]) => {
    put(box(w, PH, t, mat.wall), ox, roofY + PH / 2, oz);
    put(box(w, 0.022, t * 1.3, mat.accent), ox, roofY + PH, oz);
  });
  [[PT, spanZ, spanX / 2 - PT / 2, 0], [PT, spanZ, -spanX / 2 + PT / 2, 0]].forEach(([t, d, ox, oz]) => {
    put(box(t, PH, d, mat.wall), ox, roofY + PH / 2, oz);
    put(box(t * 1.3, 0.022, d, mat.accent), ox, roofY + PH, oz);
  });
  [[1.4, -0.5], [-1.7, 0.4]].forEach(([ax, az]) => { const o = use("ac"); if (o) put(o, ax, roofY + 0.06, az); });
  // rooftop plant enclosure + access hatch
  put(box(1.15, 0.34, 0.8, mat.wall), 0.5, roofY + 0.23, -0.9);
  put(box(1.19, 0.03, 0.84, mat.accent), 0.5, roofY + 0.41, -0.9);
  put(box(0.42, 0.16, 0.42, mat.inkSoft), -1.9, roofY + 0.14, -1.0);
  // roof-edge drainage scuppers
  [-2.0, 2.0].forEach((sx) => put(box(0.12, 0.05, 0.1, mat.mullion), sx, roofY + 0.09, spanZ / 2 - 0.02));

  // inter-storey brand band on the side/back elevations
  [[spanZ / 2 + 0.01, spanX, 0.02, 0, 1], [-spanZ / 2 - 0.01, spanX, 0.02, 0, 1]].forEach(([oz, w, t, ox]) => {
    const band = box(w, 0.04, t, mat.accent); band.castShadow = false; put(band, ox, PL_H + STOREY - 0.02, oz);
  });
  [[spanX / 2 + 0.01], [-spanX / 2 - 0.01]].forEach(([ox]) => {
    const band = box(0.02, 0.04, spanZ, mat.accent); band.castShadow = false; put(band, ox, PL_H + STOREY - 0.02, 0);
  });

  // ---------- signage: fascia + pylon ----------
  const t1 = signTexture("Dream Dental", "powered by DreamCRM");
  const fascia = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 0.42),
    new THREE.MeshStandardMaterial({ map: t1, emissiveMap: t1, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.6 }));
  put(fascia, 0, PL_H + TOP + TOW_H * 0.52, halfZ + 0.075);
  const signLight = new THREE.PointLight(0x9dc0ff, 1.4, 2.6, 2);
  put(signLight, 0, PL_H + TOP + TOW_H * 0.5, halfZ + 0.5);

  // monument sign at the street edge: a real slab on a base, faces both ways
  const monX = courtW / 2 - 0.8, monZ = halfZ + 1.4;   // fully on the pavement
  const MON_W = 0.95, MON_H = 0.72, MON_D = 0.16;
  put(box(MON_W + 0.16, 0.1, MON_D + 0.14, mat.inkSoft), monX, 0.12, monZ);      // base
  put(box(MON_W, MON_H, MON_D, mat.ink), monX, 0.17 + MON_H / 2, monZ);          // slab
  put(box(MON_W + 0.06, 0.035, MON_D + 0.06, mat.accent), monX, 0.17 + MON_H, monZ); // cap
  const mTex = monumentTexture("Dream Dental", "powered by DreamCRM");
  const mMat = new THREE.MeshStandardMaterial({
    map: mTex, emissiveMap: mTex, emissive: 0xffffff, emissiveIntensity: 1.35, roughness: 0.6 });
  [1, -1].forEach((s) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(MON_W * 0.86, MON_H * 0.78), mMat);
    face.rotation.y = s === 1 ? 0 : Math.PI;
    put(face, monX, 0.17 + MON_H / 2, monZ + s * (MON_D / 2 + 0.008));
  });
  const monLight = new THREE.PointLight(0x9dc0ff, 1.1, 1.8, 2);
  put(monLight, monX, 0.17 + MON_H + 0.12, monZ);

  const wash = new THREE.PointLight(DREAMCRM.accent, 2.0, 5.5, 2);
  put(wash, 0, PL_H + TOP * 0.85, halfZ + 1.0);
  return g;
}


/* =========================================================
   Suburban houses + nature
   Palette strips verified with ?bands=1:
     0 = roof · 1 = door/accent · 3 = wall · 5 = window glass · 7 = trim
   ========================================================= */
export const HOUSE_BANDS = { ROOF: 0, DOOR: 1, WALL: 3, GLASS: 5, TRIM: 7 };

/* warm, lived-in schemes that sit well under a dusk sky */
const HOUSE_SCHEMES = [
  { wall: 0xe7dccb, roof: 0x39404f, trim: 0xf6f2ea, door: 0x3f6353 },  // cream / slate
  { wall: 0xd3dcd5, roof: 0x333d47, trim: 0xf1f5f2, door: 0x8d5a45 },  // sage
  { wall: 0xccd6e4, roof: 0x2e3a49, trim: 0xeff3f9, door: 0x2f4f74 },  // dusty blue
  { wall: 0xe6cfc2, roof: 0x4a3b3a, trim: 0xf7efe9, door: 0x6b4130 },  // soft terracotta
  { wall: 0xdcd8d2, roof: 0x3c4148, trim: 0xf5f4f1, door: 0x54606e },  // warm grey
  { wall: 0xefdcd8, roof: 0x453741, trim: 0xfaf1ef, door: 0x7d4552 },  // blush
  { wall: 0xd9e0d2, roof: 0x35402f, trim: 0xf2f6ee, door: 0x4d5f3a },  // olive
];
const GLASS_DARK = 0x2a3c58, GLASS_LIT = 0xffc98a;

/* trees carry plain material colours (no atlas) — recolour by material name */
export function tintByMaterial(obj, map) {
  obj.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const key = Object.keys(map).find((k) => (o.material.name || "").toLowerCase().includes(k.toLowerCase()));
    if (!key) return;
    o.material = o.material.clone();
    o.material.color = new THREE.Color(map[key]);
    o.material.roughness = 0.95;
  });
  return obj;
}

const FOLIAGE = [0x2f5d43, 0x386b4b, 0x2a5340, 0x436b45, 0x53743f, 0x8a6a35, 0x9a5f34];
const BARK    = [0x5b4636, 0x4c3a2d, 0x63503c];

/* one house, painted with a scheme; some windows lit */
export async function makeHouse(loadGLB, type, scheme, lit, base = "../assets/") {
  const o = await loadGLB(`houses/building-type-${type}`);
  await paint(o, "houses", {
    0: scheme.roof, 1: scheme.door, 3: scheme.wall,
    5: lit ? GLASS_LIT : GLASS_DARK, 7: scheme.trim,
  }, base);
  return o;
}

async function houses({ loadGLB, debugBands }) {
  const g = new THREE.Group();
  const types = ["a", "b", "c", "e", "g", "h", "j", "l", "n", "q"];
  const cols = 5, gap = 2.7;
  for (let i = 0; i < types.length; i++) {
    const scheme = HOUSE_SCHEMES[i % HOUSE_SCHEMES.length];
    let o;
    try {
      o = debugBands
        ? await (async () => { const m = await loadGLB(`houses/building-type-${types[i]}`);
            await paint(m, "houses", { 0:0xff0000,1:0x00ff00,3:0xff00ff,5:0xffff00,7:0xff8800 }, "../assets/", true); return m; })()
        : await makeHouse(loadGLB, types[i], scheme, i % 3 === 0);
    } catch (e) { continue; }
    const col = i % cols, row = Math.floor(i / cols);
    o.position.set((col - (cols - 1) / 2) * gap, 0, (row - 0.5) * gap * 1.05);
    o.rotation.y = Math.PI;                       // face the camera
    g.add(o);
  }
  return g;
}

async function trees({ loadGLB }) {
  const g = new THREE.Group();
  /* explicit, curated colours — material names in this kit are
     leafsGreen / leafsDark / woodBark / woodBarkDark / grass          */
  const SET = [
    ["tree_default",     0x35664a, 0x584434],
    ["tree_oak",         0x2d5a41, 0x5b4636],
    ["tree_fat",         0x3d6e4a, 0x4f3d2f],
    ["tree_detailed",    0x2f5f45, 0x59452f],
    ["tree_cone",        0x28513c, 0x4c3a2d],
    ["tree_pineDefaultA",0x24483a, 0x463629],
    ["tree_blocks",      0x436b45, 0x5b4636],
    ["plant_bushLarge",  0x35604a, 0x4c3a2d],
    ["plant_bush",       0x3a6a4e, 0x4c3a2d],
    ["grass_large",      0x4a7248, 0x4c3a2d],
  ];
  const cols = 5, gap = 1.5;
  for (let i = 0; i < SET.length; i++) {
    const [name, leaf, bark] = SET[i];
    let o;
    try { o = await loadGLB(`nature/${name}`); } catch (e) { continue; }
    tintByMaterial(o, { leafs: leaf, grass: leaf, wood: bark, bark: bark });
    const col = i % cols, row = Math.floor(i / cols);
    o.position.set((col - (cols - 1) / 2) * gap, 0, (row - 0.5) * gap);
    g.add(o);
  }
  return g;
}

/* a tree for the world: pick a species and give it slight colour drift
   so a street of them never looks copy-pasted                          */
const TREE_SPECIES = ["tree_default", "tree_oak", "tree_fat", "tree_detailed", "tree_cone", "tree_pineDefaultA"];
export async function makeTree(loadGLB, i = 0, autumn = false) {
  const name = TREE_SPECIES[i % TREE_SPECIES.length];
  const o = await loadGLB(`nature/${name}`);
  const greens = [0x35664a, 0x2d5a41, 0x3d6e4a, 0x2f5f45, 0x28513c, 0x24483a];
  const autumns = [0x8a6a35, 0x9a5f34, 0x7d5a2c];
  const leaf = autumn ? autumns[i % autumns.length] : greens[i % greens.length];
  tintByMaterial(o, { leafs: leaf, grass: leaf, wood: 0x53412f, bark: 0x53412f });
  return o;
}

export const RIGS = { towtruck, parts, clinic, houses, trees };

export async function buildRig(name, ctx) {
  const fn = RIGS[name];
  if (!fn) throw new Error(`unknown rig "${name}" — have: ${Object.keys(RIGS).join(", ")}`);
  return await fn(ctx);
}
