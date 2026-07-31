/* =========================================================
   Dream Create — the dreamworld (upgraded)
   A scroll-driven flight from bright day down into a starlit
   dream: volumetric clouds, a sea of cloud below, glowing app
   waypoints, bloom, a break-through-the-clouds intro & more.
   ========================================================= */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/* ===================== UI ===================== */
function initUI() {
  const nav = $("#nav"), bar = $("#progressBar");
  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 20);
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (docH > 0 ? (y / docH) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#navBurger"), links = $(".nav__links");
  if (burger && links) {
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open);
    });
    $$(".nav__links a").forEach((a) => a.addEventListener("click", () => {
      links.classList.remove("is-open"); burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    }));
  }

  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add("is-in"));

  // contact form
  const form = $("#contactForm"), success = $("#formSuccess"), sendBtn = $("#sendBtn");
  const validate = (f) => {
    const i = $("input, textarea", f);
    if (!i || !i.hasAttribute("required")) return true;
    let ok = i.value.trim().length > 0;
    if (i.type === "email" && ok) ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value.trim());
    f.classList.toggle("is-invalid", !ok); return ok;
  };
  if (form) {
    $$(".field input, .field textarea", form).forEach((i) => i.addEventListener("input", () => {
      const f = i.closest(".field"); if (f && f.classList.contains("is-invalid")) validate(f);
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      $$(".field", form).filter((f) => $("[required]", f)).forEach((f) => { if (!validate(f)) ok = false; });
      if (!ok) { const b = $(".field.is-invalid", form); if (b) { b.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); $("input,textarea", b)?.focus(); } return; }
      if (sendBtn) { sendBtn.disabled = true; const l = $(".btn__label", sendBtn); if (l) l.textContent = "Sending…"; }
      setTimeout(() => { if (success) success.hidden = false; }, reduced ? 120 : 620);
    });
  }
  const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();

  initCursor();
  initSound();
}

/* ---- Glowing cursor ---- */
function initCursor() {
  const dot = $("#cursor");
  if (!dot || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, on = false;
  window.addEventListener("mousemove", (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!on) { on = true; document.body.classList.add("has-cursor"); }
  });
  const hoverSel = "a, button, .card, input, textarea, .sound";
  document.addEventListener("mouseover", (e) => { if (e.target.closest(hoverSel)) dot.classList.add("is-hover"); });
  document.addEventListener("mouseout", (e) => { if (e.target.closest(hoverSel)) dot.classList.remove("is-hover"); });
  (function tick() { x = lerp(x, tx, 0.2); y = lerp(y, ty, 0.2); dot.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`; requestAnimationFrame(tick); })();
}

/* ---- Ambient sound (opt-in) ---- */
function initSound() {
  const btn = $("#soundToggle");
  if (!btn) return;
  let audio = null, on = false;
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    // wind — brown noise through a lowpass, slowly breathing
    const N = 2 * ctx.sampleRate, buf = ctx.createBuffer(1, N, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const wlp = ctx.createBiquadFilter(); wlp.type = "lowpass"; wlp.frequency.value = 520; wlp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.15;
    wind.connect(wlp).connect(wg).connect(master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lg = ctx.createGain(); lg.gain.value = 0.08; lfo.connect(lg).connect(wg.gain);
    // pad — soft A-major chord
    const plp = ctx.createBiquadFilter(); plp.type = "lowpass"; plp.frequency.value = 900;
    const pg = ctx.createGain(); pg.gain.value = 0.05; plp.connect(pg).connect(master);
    [220, 277.18, 329.63].forEach((f, i) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.detune.value = (i - 1) * 4; const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g).connect(plp); o.start(); });
    const trem = ctx.createOscillator(); trem.frequency.value = 0.12; const tg = ctx.createGain(); tg.gain.value = 0.025; trem.connect(tg).connect(pg.gain); trem.start();
    wind.start(); lfo.start();
    return { ctx, master };
  }
  btn.addEventListener("click", () => {
    if (!audio) audio = build();
    if (!audio) return;
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    on = !on;
    audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
    audio.master.gain.linearRampToValueAtTime(on ? 0.16 : 0.0001, audio.ctx.currentTime + 0.9);
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on);
  });
}

/* ===================== Textures ===================== */
function makeCloudTexture() {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s; const x = c.getContext("2d");
  for (let i = 0; i < 20; i++) {
    const r = s * (0.12 + Math.random() * 0.2), px = s * (0.2 + Math.random() * 0.6), py = s * (0.28 + Math.random() * 0.5);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(255,255,255,0.2)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  const fade = x.createRadialGradient(s/2, s/2, s*0.16, s/2, s/2, s*0.5);
  fade.addColorStop(0, "rgba(255,255,255,1)"); fade.addColorStop(1, "rgba(255,255,255,0)");
  x.globalCompositeOperation = "destination-in"; x.fillStyle = fade; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeGlowTexture() {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s; const x = c.getContext("2d");
  const g = x.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.2, "rgba(255,255,255,0.7)");
  g.addColorStop(0.5, "rgba(255,255,255,0.16)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ===================== Dreamworld ===================== */
function initDream() {
  const canvas = $("#dream");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
  catch (e) { return false; }
  if (!renderer || !renderer.getContext()) return false;

  const DPR = Math.min(window.devicePixelRatio, 1.6);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const fogDay = new THREE.Color(0x2a6b9c), fogNight = new THREE.Color(0x070b22);
  scene.fog = new THREE.FogExp2(fogDay.clone(), 0.0024);

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
  const START_Z = 44, END_Z = -320;
  const zAt = (t) => lerp(START_Z, END_Z, t);
  camera.position.set(0, 0, START_Z);

  const cloudTex = makeCloudTexture(), glowTex = makeGlowTexture();

  /* ---- Sky dome (day → night) ---- */
  const skyUni = {
    dayTop: { value: new THREE.Color(0x0b2c60) }, dayMid: { value: new THREE.Color(0x2f8fc0) }, dayBot: { value: new THREE.Color(0xc2e6ee) }, daySun: { value: new THREE.Color(0xffe6cf) },
    nightTop:{ value: new THREE.Color(0x030410) }, nightMid:{ value: new THREE.Color(0x0a1430) }, nightBot:{ value: new THREE.Color(0x16305a) }, nightSun:{ value: new THREE.Color(0xbcd0ff) },
    mixv: { value: 0 }, sunDir: { value: new THREE.Vector3(0.3, 0.52, -1).normalize() },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyUni,
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 dayTop,dayMid,dayBot,daySun,nightTop,nightMid,nightBot,nightSun,sunDir; uniform float mixv;
      void main(){
        vec3 d = normalize(vPos); float h = d.y;
        vec3 top = mix(dayTop,nightTop,mixv), mid = mix(dayMid,nightMid,mixv), bot = mix(dayBot,nightBot,mixv), sun = mix(daySun,nightSun,mixv);
        vec3 col = mix(bot, mid, smoothstep(-0.3, 0.22, h));
        col = mix(col, top, smoothstep(0.12, 0.85, h));
        float s = 1.0 - distance(d, normalize(sunDir));
        col += sun * pow(clamp(s,0.0,1.0), 3.0) * mix(0.9, 0.5, mixv);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  scene.add(sky);

  /* ---- Far group (stars + moon) follows camera, fades in at night ---- */
  const farGroup = new THREE.Group(); scene.add(farGroup);
  const SN = 900, sg = new THREE.BufferGeometry(), sp = new Float32Array(SN * 3), scol = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(400 + Math.random() * 120);
    sp[i*3]=v.x; sp[i*3+1]=v.y; sp[i*3+2]=v.z;
    const c = new THREE.Color().setHSL(0.55 + Math.random()*0.1, 0.4, 0.7 + Math.random()*0.3);
    scol[i*3]=c.r; scol[i*3+1]=c.g; scol[i*3+2]=c.b;
  }
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  sg.setAttribute("color", new THREE.BufferAttribute(scol, 3));
  const starMat = new THREE.PointsMaterial({ size: 1.6, map: glowTex, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  farGroup.add(new THREE.Points(sg, starMat));
  // moon
  const moon = new THREE.Group();
  const moonCore = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 24), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false, transparent: true, opacity: 0 }));
  moon.add(moonCore);
  [ [64, 0.45], [120, 0.22] ].forEach(([sc, op]) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcdd8ff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.scale.set(sc, sc, 1); moon.add(m); });
  moon.position.set(-260, 150, -420); farGroup.add(moon);
  const moonMats = moon.children.map((c) => c.material);

  /* ---- Sun ---- */
  const sunGroup = new THREE.Group();
  const sunPos = new THREE.Vector3(60, 40, -260);
  [ [90, 0.55], [170, 0.3], [280, 0.16] ].forEach(([sc, op]) => { const m = new THREE.SpriteMaterial({ map: glowTex, color: 0xffe6c6, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); const s = new THREE.Sprite(m); s.scale.set(sc, sc, 1); sunGroup.add(s); });
  sunGroup.add(new THREE.Mesh(new THREE.SphereGeometry(9, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff4e6, fog: false, transparent: true, opacity: 1 })));
  sunGroup.position.copy(sunPos); scene.add(sunGroup);
  const sunMats = sunGroup.children.map((c) => c.material);

  /* ---- Clouds (drifting field) ---- */
  const clouds = [];
  const tint = [0xdfeefb, 0xc4e2f4, 0xa9d4ee, 0xe6dcf2].map((c) => new THREE.Color(c));
  for (let i = 0; i < 200; i++) {
    let t = -0.1 + Math.random() * 1.2;
    if (t > -0.05 && t < 0.07) t += 0.14; // keep the opening (hero) view clear & blue
    const z = zAt(t) + (Math.random() - 0.5) * 14;
    const bright = Math.random() < 0.12;
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: bright ? new THREE.Color(0xdcefff) : tint[(Math.random()*tint.length)|0], transparent: true, opacity: bright ? 0.26 : 0.12 + Math.random()*0.24, depthWrite: false, blending: bright ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
    const s2 = new THREE.Sprite(mat);
    const radius = 17 + Math.random() * 42, ang = Math.random() * Math.PI * 2;
    s2.position.set(Math.cos(ang)*radius, Math.sin(ang)*radius*0.5 + (Math.random()-0.5)*12, z);
    const sc = 16 + Math.random() * 34; s2.scale.set(sc, sc*(0.6+Math.random()*0.25), 1);
    s2.material.rotation = Math.random() * Math.PI; scene.add(s2);
    clouds.push({ sp: s2, baseY: s2.position.y, phase: Math.random()*Math.PI*2, spin: (Math.random()-0.5)*0.02, base: mat.color.clone(), baseOp: mat.opacity });
  }
  /* ---- Sea of clouds below ---- */
  const seaClouds = [];
  for (let i = 0; i < 120; i++) {
    const t = -0.1 + Math.random() * 1.2;
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color(0xcfe0ee), transparent: true, opacity: 0.09 + Math.random()*0.13, depthWrite: false, fog: true });
    const s2 = new THREE.Sprite(mat);
    s2.position.set((Math.random()-0.5)*220, -22 - Math.random()*16, zAt(t) + (Math.random()-0.5)*20);
    const sc = 40 + Math.random() * 66; s2.scale.set(sc, sc*0.5, 1);
    s2.material.rotation = Math.random() * Math.PI; scene.add(s2);
    const o = { sp: s2, baseY: s2.position.y, phase: Math.random()*Math.PI*2, spin: (Math.random()-0.5)*0.008, baseOp: mat.opacity, base: mat.color.clone() };
    clouds.push(o); seaClouds.push(o);
  }

  /* ---- Light motes ---- */
  const P = 600, pg = new THREE.BufferGeometry(), pp = new Float32Array(P*3);
  for (let i = 0; i < P; i++) { pp[i*3]=(Math.random()-0.5)*90; pp[i*3+1]=(Math.random()-0.5)*60; pp[i*3+2]=zAt(Math.random()); }
  pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  const points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.5, map: glowTex, color: 0xdff4ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(points);

  /* ---- App waypoints ---- */
  const APP = [
    { t: 2.5/8, x: -15, y:  5, color: 0x4fd0e6 },
    { t: 3.5/8, x:  16, y: -3, color: 0x57e0c8 },
    { t: 4.5/8, x: -15, y:  5, color: 0x8ab4ff },
    { t: 5.5/8, x:  16, y: -4, color: 0xffc9b0 },
  ];
  const orbs = APP.map((a) => {
    const g = new THREE.Group(); const col = new THREE.Color(a.color);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, fog: false }));
    g.add(core);
    const halos = [ [11, 0.6], [22, 0.28] ].map(([sc, op]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.scale.set(sc, sc, 1); g.add(s); return { s, op }; });
    const rMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.05, 8, 90), rMat); ring.rotation.x = 1.2; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.03, 8, 90), rMat.clone()); ring2.rotation.y = 1.1; g.add(ring2);
    g.position.set(a.x, a.y, zAt(a.t)); scene.add(g);
    return { g, core, ring, ring2, halos, phase: Math.random()*Math.PI*2, baseY: a.y, x: a.x, center: a.t };
  });

  /* ---- Postprocessing (bloom) ---- */
  let composer = null;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.4, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight);
  } catch (e) { composer = null; }

  /* ---- Interaction ---- */
  let targetProg = 0, prog = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  function readScroll() { const d = document.documentElement.scrollHeight - innerHeight; targetProg = d > 0 ? clamp(window.scrollY / d, 0, 1) : 0; }
  window.addEventListener("scroll", readScroll, { passive: true }); readScroll();
  window.addEventListener("mousemove", (e) => { tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5; });
  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  const nightBlue = new THREE.Color(0x0c1732);
  let intro = 0; // 0 → 1 over the intro dolly
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), et = clock.elapsedTime;
    intro = clamp(intro + dt / 2.8, 0, 1);
    const introEase = 1 - Math.pow(1 - intro, 4);
    prog = lerp(prog, targetProg, 0.055);
    mx = lerp(mx, tmx, 0.05); my = lerp(my, tmy, 0.05);

    // day → night
    const night = smooth(0.36, 0.9, prog);
    skyUni.mixv.value = night;
    scene.fog.color.copy(fogDay).lerp(fogNight, night);
    starMat.opacity = smooth(0.5, 0.88, prog) * 0.95;
    const moonOp = smooth(0.5, 0.9, prog);
    moonMats.forEach((m, i) => { m.opacity = moonOp * (i === 0 ? 1 : (i === 1 ? 0.5 : 0.25)); });
    const sunFade = clamp(1 - night * 1.15, 0, 1);
    sunMats.forEach((m, i) => { m.opacity = sunFade * [0.55, 0.3, 0.16, 1][i]; });

    // arrival focus
    let focusX = 0, focusY = 0;
    for (const o of orbs) {
      const f = 1 - smooth(0, 0.085, Math.abs(prog - o.center));
      o.g.position.y = o.baseY + Math.sin(et * 0.7 + o.phase) * 0.8;
      o.core.scale.setScalar(1 + f * 0.9 + Math.sin(et * 1.4 + o.phase) * 0.05);
      o.ring.rotation.z += dt * (0.4 + f * 1.2);
      o.ring2.rotation.x += dt * (0.3 + f * 1.0);
      o.halos.forEach((h) => { h.s.material.opacity = h.op * (1 + f * 0.9); });
      focusX += o.x * f * 0.4; focusY += o.baseY * f * 0.3;
    }

    // camera flight
    const baseX = Math.sin(prog * 6.0) * 4.0;
    const baseY = Math.sin(prog * 5.0) * 2.2 + Math.sin(et * 0.4) * 0.5;
    camera.position.x = baseX + mx * 8 + focusX;
    camera.position.y = baseY - my * 5 + focusY;
    camera.position.z = zAt(prog) + (1 - introEase) * 30;
    camera.rotation.y = -mx * 0.14;
    camera.rotation.x = my * 0.08;

    for (const c of clouds) {
      c.sp.position.y = c.baseY + Math.sin(et * 0.4 + c.phase) * 0.7;
      c.sp.material.rotation += c.spin * dt;
      c.sp.material.color.copy(c.base).lerp(nightBlue, night * 0.9);
      c.sp.material.opacity = c.baseOp * (1 - night * 0.5);
    }
    points.rotation.y = et * 0.01;
    sky.position.copy(camera.position);
    farGroup.position.copy(camera.position);

    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  let running = true;
  function loop() { if (running) frame(); requestAnimationFrame(loop); }
  loop();
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) clock.getDelta(); });
  return true;
}

/* ===================== Boot ===================== */
function boot() {
  initUI();
  const hasWebGL = (() => { try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } })();
  let ok = false;
  if (hasWebGL && !reduced) { try { ok = initDream(); } catch (e) { console.warn("dream failed", e); ok = false; } }
  if (!ok) document.body.classList.add("no-webgl");
  requestAnimationFrame(() => requestAnimationFrame(() => { document.body.classList.remove("is-loading"); document.body.classList.add("ready"); }));
}
boot();
