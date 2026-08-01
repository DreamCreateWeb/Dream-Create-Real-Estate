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

/* recolor only body-ish meshes of a kit model */
export function tintBody(obj, color) {
  obj.traverse((o) => {
    if (!o.isMesh || !/body|cabin|chassis/i.test(o.name)) return;
    o.material = o.material.clone();
    o.material.color = new THREE.Color(color);
    o.material.roughness = 0.4;
    o.material.metalness = 0.22;
  });
  return obj;
}

/* =========================================================
   RIG: Dream Towing wrecker
   Kenney flatbed truck as the base, with a properly modelled
   wrecker assembly: boom, hydraulic ram, winch drum, cable,
   hook block, stabilisers, light bar, stack & mirrors.
   ========================================================= */
async function towtruck({ loadGLB }) {
  const AMBER = 0xff9c3d;
  const g = new THREE.Group();

  const base = await loadGLB("vehicles/truck-flat");
  tintBody(base, AMBER);
  g.add(base);

  // measure the base so every added part is proportional & seated
  const bb = new THREE.Box3().setFromObject(base);
  const sz = new THREE.Vector3(); bb.getSize(sz);
  const noseZ = bb.max.z, tailZ = bb.min.z;      // model nose is +Z
  const bedY = bb.min.y + sz.y * 0.46;            // top of the flat bed
  const halfW = sz.x / 2;

  const steel = M.steel(), dark = M.darkSteel(), chrome = M.chrome();

  /* --- deck plate over the flatbed --- */
  const deck = rbox(sz.x * 0.92, 0.05, sz.z * 0.46, steel);
  at(deck, 0, bedY + 0.03, tailZ + sz.z * 0.27);
  g.add(deck);
  // deck ribs
  for (let i = -3; i <= 3; i++) {
    const rib = rbox(sz.x * 0.88, 0.02, 0.03, dark);
    at(rib, 0, bedY + 0.062, tailZ + sz.z * 0.27 + i * (sz.z * 0.055));
    g.add(rib);
  }

  /* --- tower the boom pivots from --- */
  const towerH = sz.y * 0.62;
  const towerZ = tailZ + sz.z * 0.44;
  [-1, 1].forEach((s) => {
    const leg = rbox(0.06, towerH, 0.09, dark);
    at(leg, s * halfW * 0.42, bedY + towerH / 2, towerZ);
    g.add(leg);
  });
  const towerTop = rbox(halfW * 0.95, 0.07, 0.12, dark);
  at(towerTop, 0, bedY + towerH, towerZ);
  g.add(towerTop);
  // winch drum between the legs
  const drum = cyl(0.09, 0.09, halfW * 0.7, chrome, 14);
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
  const drop = tip.y - (bb.min.y + sz.y * 0.30);
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
  [-1, 1].forEach((s) => {
    const arm = rbox(0.07, 0.07, 0.22, dark);
    at(arm, s * halfW * 0.78, bb.min.y + sz.y * 0.24, tailZ + 0.1);
    g.add(arm);
    const pad = cyl(0.07, 0.09, 0.05, steel, 10);
    at(pad, s * halfW * 0.78, bb.min.y + sz.y * 0.10, tailZ + 0.1);
    g.add(pad);
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

export const RIGS = { towtruck };

export async function buildRig(name, ctx) {
  const fn = RIGS[name];
  if (!fn) throw new Error(`unknown rig "${name}" — have: ${Object.keys(RIGS).join(", ")}`);
  return await fn(ctx);
}
