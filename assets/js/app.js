/* =========================================================
   Dream Create — the dreamworld
   A scroll-driven flight through volumetric clouds (Three.js),
   with glowing "waypoints" for each app. Vanilla, self-contained.
   ========================================================= */
import * as THREE from "../vendor/three.module.js";

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ===================== UI (always runs) ===================== */
function initUI() {
  const nav = $("#nav");
  const bar = $("#progressBar");
  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 20);
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (docH > 0 ? (y / docH) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#navBurger");
  const links = $(".nav__links");
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
}

/* ===================== Textures ===================== */
function makeCloudTexture() {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d");
  for (let i = 0; i < 18; i++) {
    const r = s * (0.12 + Math.random() * 0.2);
    const px = s * (0.2 + Math.random() * 0.6), py = s * (0.28 + Math.random() * 0.5);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(255,255,255,0.20)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  // fade the outer edge so the sprite is a soft puff, not a square
  const fade = x.createRadialGradient(s/2, s/2, s*0.18, s/2, s/2, s*0.5);
  fade.addColorStop(0, "rgba(255,255,255,1)"); fade.addColorStop(1, "rgba(255,255,255,0)");
  x.globalCompositeOperation = "destination-in";
  x.fillStyle = fade; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeGlowTexture() {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.7)");
  g.addColorStop(0.5, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ===================== Dreamworld ===================== */
function initDream() {
  const canvas = $("#dream");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) { return false; }
  if (!renderer || !renderer.getContext()) return false;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(0x235f92), 0.0026);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  const START_Z = 44, END_Z = -300;
  const zAt = (t) => lerp(START_Z, END_Z, t);
  camera.position.set(0, 0, START_Z);

  /* ---- Sky dome ---- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x0a2a5c) },
      mid: { value: new THREE.Color(0x2f8fc0) },
      bot: { value: new THREE.Color(0xd9f4f7) },
      sun: { value: new THREE.Color(0xffe6cf) },
      sunDir: { value: new THREE.Vector3(0.28, 0.5, -1).normalize() },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform vec3 top,mid,bot,sun,sunDir;
      void main(){
        vec3 d = normalize(vPos);
        float h = d.y;
        vec3 col = mix(bot, mid, smoothstep(-0.28, 0.22, h));
        col = mix(col, top, smoothstep(0.14, 0.82, h));
        float s = 1.0 - distance(d, normalize(sunDir));
        col += sun * pow(clamp(s,0.0,1.0), 3.2) * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 24), skyMat);
  scene.add(sky);

  const cloudTex = makeCloudTexture();
  const glowTex = makeGlowTexture();

  /* ---- Sun (distant glow) ---- */
  const sunGroup = new THREE.Group();
  const sunPos = new THREE.Vector3(46, 34, -230);
  [ [70, 0.5], [130, 0.28], [220, 0.16] ].forEach(([sc, op]) => {
    const m = new THREE.SpriteMaterial({ map: glowTex, color: 0xffe4c4, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const sp = new THREE.Sprite(m); sp.scale.set(sc, sc, 1); sunGroup.add(sp);
  });
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff2e0, fog: false }));
  sunGroup.add(sunCore);
  sunGroup.position.copy(sunPos);
  scene.add(sunGroup);

  /* ---- Clouds ---- */
  const clouds = [];
  const CLOUD_COUNT = 210;
  const tint = [ new THREE.Color(0xdfeefb), new THREE.Color(0xc4e2f4), new THREE.Color(0xa9d4ee), new THREE.Color(0xe6dcf2) ];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const t = -0.08 + Math.random() * 1.16;
    const z = zAt(t) + (Math.random() - 0.5) * 14;
    const bright = Math.random() < 0.12;
    const col = bright ? new THREE.Color(0xdcefff) : tint[(Math.random() * tint.length) | 0];
    const mat = new THREE.SpriteMaterial({
      map: cloudTex, color: col, transparent: true,
      opacity: bright ? 0.26 : 0.12 + Math.random() * 0.24,
      depthWrite: false, blending: bright ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true,
    });
    const sp = new THREE.Sprite(mat);
    // keep clouds off the central flight axis so the view stays open & blue
    const radius = 17 + Math.random() * 42;
    const ang = Math.random() * Math.PI * 2;
    sp.position.set(Math.cos(ang) * radius, Math.sin(ang) * radius * 0.5 + (Math.random() - 0.5) * 12, z);
    const s = 16 + Math.random() * 34;
    sp.scale.set(s, s * (0.6 + Math.random() * 0.25), 1);
    sp.material.rotation = Math.random() * Math.PI;
    scene.add(sp);
    clouds.push({ sp, baseY: sp.position.y, phase: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.02, drift: 0.2 + Math.random() * 0.5 });
  }

  /* ---- Particles (light motes) ---- */
  const P = 700;
  const pgeo = new THREE.BufferGeometry();
  const pos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 90;
    pos[i*3+1] = (Math.random() - 0.5) * 60;
    pos[i*3+2] = zAt(Math.random()) ;
  }
  pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pmat = new THREE.PointsMaterial({ size: 0.5, map: glowTex, color: 0xdff4ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(pgeo, pmat);
  scene.add(points);

  /* ---- App waypoints ---- */
  const APP = [
    { t: 2.5/8, x: -15, y:  5, color: 0x4fd0e6 },
    { t: 3.5/8, x:  15, y: -3, color: 0x57e0c8 },
    { t: 4.5/8, x: -15, y:  5, color: 0x8ab4ff },
    { t: 5.5/8, x:  15, y: -4, color: 0xffc9b0 },
  ];
  const orbs = APP.map((a) => {
    const g = new THREE.Group();
    const col = new THREE.Color(a.color);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, fog: false }));
    g.add(core);
    [ [10, 0.6], [20, 0.28] ].forEach(([sc, op]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sp.scale.set(sc, sc, 1); g.add(sp);
    });
    const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.05, 8, 80), ringMat);
    ring.rotation.x = 1.2; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.03, 8, 80), ringMat.clone());
    ring2.rotation.y = 1.1; g.add(ring2);
    g.position.set(a.x, a.y, zAt(a.t));
    scene.add(g);
    return { g, core, ring, ring2, phase: Math.random() * Math.PI * 2, baseY: a.y };
  });

  /* ---- Interaction ---- */
  let targetProg = 0, prog = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  function readScroll() {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    targetProg = docH > 0 ? clamp(window.scrollY / docH, 0, 1) : 0;
  }
  window.addEventListener("scroll", readScroll, { passive: true });
  readScroll();
  window.addEventListener("mousemove", (e) => {
    tmx = (e.clientX / window.innerWidth - 0.5);
    tmy = (e.clientY / window.innerHeight - 0.5);
  });

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const et = clock.elapsedTime;
    prog = lerp(prog, targetProg, 0.06);
    mx = lerp(mx, tmx, 0.05); my = lerp(my, tmy, 0.05);

    // camera flight path
    const baseX = Math.sin(prog * 6.0) * 4.0;
    const baseY = Math.sin(prog * 5.0) * 2.2 + Math.sin(et * 0.4) * 0.5;
    camera.position.x = baseX + mx * 8;
    camera.position.y = baseY - my * 5;
    camera.position.z = zAt(prog);
    camera.rotation.y = -mx * 0.14;
    camera.rotation.x = my * 0.08;

    // clouds bob & spin gently
    for (const c of clouds) {
      c.sp.position.y = c.baseY + Math.sin(et * 0.4 + c.phase) * 0.7;
      c.sp.material.rotation += c.spin * dt;
    }
    // orbs
    for (const o of orbs) {
      o.g.position.y = o.baseY + Math.sin(et * 0.7 + o.phase) * 0.8;
      o.ring.rotation.z += dt * 0.4;
      o.ring2.rotation.x += dt * 0.3;
      const s = 1 + Math.sin(et * 1.4 + o.phase) * 0.05;
      o.core.scale.setScalar(s);
    }
    points.rotation.y = et * 0.01;
    sky.position.copy(camera.position);

    renderer.render(scene, camera);
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
  if (hasWebGL && !reduced) {
    try { ok = initDream(); } catch (e) { console.warn("dream init failed", e); ok = false; }
  }
  if (!ok) document.body.classList.add("no-webgl");

  // reveal loader out
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.remove("is-loading");
    document.body.classList.add("ready");
  }));
}
boot();
