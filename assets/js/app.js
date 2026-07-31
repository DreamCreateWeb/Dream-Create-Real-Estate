/* =========================================================
   Apps, by Dream Create — interactions
   Vanilla JS. Respects prefers-reduced-motion.
   ========================================================= */
(function () {
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---- 1. Generate starfields ---- */
  $$("[data-stars]").forEach((field) => {
    const n = parseInt(field.dataset.stars, 10) || 40;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      const size = Math.random() * 2 + 1;
      s.style.width = s.style.height = size + "px";
      s.style.animationDelay = (Math.random() * 4) + "s";
      s.style.animationDuration = (3 + Math.random() * 3) + "s";
      if (Math.random() > 0.8) s.style.background = "#f4d98a";
      frag.appendChild(s);
    }
    field.appendChild(frag);
  });

  /* ---- 2. Generate warm motes ---- */
  $$("[data-motes]").forEach((field) => {
    const n = parseInt(field.dataset.motes, 10) || 12;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      s.style.animationDuration = (7 + Math.random() * 8) + "s";
      s.style.animationDelay = (Math.random() * 8) + "s";
      const sc = 0.6 + Math.random() * 1.4;
      s.style.transform = `scale(${sc})`;
      frag.appendChild(s);
    }
    field.appendChild(frag);
  });

  /* ---- 3. Nav: scroll state + adapt to section behind it ---- */
  const nav = $("#nav");
  const toTop = $("#toTop");
  const scrollFill = $(".scrollbar span");
  const modeSections = $$(".mode-dream, .mode-create, .mode-twilight");

  function currentModeAt(y) {
    // which section sits under the nav (top ~70px)?
    let mode = "dark";
    for (const sec of modeSections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= 72 && r.bottom > 72) {
        mode = sec.classList.contains("mode-create") ? "light" : "dark";
      }
    }
    return mode;
  }

  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 24);
    if (toTop) toTop.classList.toggle("is-visible", y > 700);
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollFill) scrollFill.style.width = (docH > 0 ? (y / docH) * 100 : 0) + "%";

    const mode = currentModeAt(y);
    nav.classList.toggle("nav--on-light", mode === "light");
    nav.classList.toggle("nav--on-dark", mode !== "light");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }));

  /* ---- 4. Balance toggle (shift the yin-yang lead) ---- */
  const root = document.documentElement;
  const balanceToggle = $("#balanceToggle");
  let lead = "balanced";
  try { lead = localStorage.getItem("dc-lead") || "balanced"; } catch (e) {}
  root.setAttribute("data-lead", lead);
  if (balanceToggle) {
    balanceToggle.addEventListener("click", () => {
      lead = lead === "create" ? "dream" : "create";
      root.setAttribute("data-lead", lead);
      try { localStorage.setItem("dc-lead", lead); } catch (e) {}
      burstSparks(balanceToggle, lead === "create" ? ["☀","✦","✨"] : ["☾","✦","⭐"]);
    });
  }

  /* ---- 5. Mobile menu ---- */
  const burger = $("#navBurger");
  const links = $(".nav__links");
  if (burger && links) {
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open);
    });
    $$(".nav__links a").forEach((a) => a.addEventListener("click", () => {
      links.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    }));
  }

  /* ---- 6. Scroll reveal ---- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  /* ---- 7. Hero parallax (emblem follows cursor) ---- */
  if (!reduced) {
    const hero = $("#hero");
    const pEls = $$("[data-parallax]");
    let mx = 0, my = 0, tx = 0, ty = 0, raf = null;
    if (hero && pEls.length) {
      hero.addEventListener("mousemove", (e) => {
        const r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5;
        my = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      hero.addEventListener("mouseleave", () => { mx = 0; my = 0; if (!raf) raf = requestAnimationFrame(loop); });
    }
    function loop() {
      tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08;
      pEls.forEach((el) => {
        const d = parseFloat(el.dataset.parallax) || 0;
        el.style.transform = `translate(${tx * d * 34}px, ${ty * d * 34}px)`;
      });
      if (Math.abs(mx - tx) > 0.001 || Math.abs(my - ty) > 0.001) raf = requestAnimationFrame(loop);
      else raf = null;
    }
  }

  /* ---- 8. App card 3D tilt ---- */
  if (!reduced && window.matchMedia("(pointer: fine)").matches) {
    $$(".app-card").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `translateY(-8px) rotateX(${-py * 6}deg) rotateY(${px * 6}deg)`;
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
  }

  /* ---- 9. Contact form ---- */
  const form = $("#contactForm");
  const success = $("#formSuccess");
  const sendBtn = $("#sendBtn");
  function validate(field) {
    const input = $("input, textarea", field);
    if (!input || !input.hasAttribute("required")) return true;
    let ok = input.value.trim().length > 0;
    if (input.type === "email" && ok) ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    field.classList.toggle("is-invalid", !ok);
    return ok;
  }
  if (form) {
    $$(".field input, .field textarea", form).forEach((input) => {
      input.addEventListener("input", () => {
        const f = input.closest(".field");
        if (f && f.classList.contains("is-invalid")) validate(f);
      });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const required = $$(".field", form).filter((f) => $("[required]", f));
      let valid = true;
      required.forEach((f) => { if (!validate(f)) valid = false; });
      if (!valid) {
        const bad = $(".field.is-invalid", form);
        if (bad) { bad.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); $("input,textarea", bad)?.focus(); }
        return;
      }
      if (sendBtn) { sendBtn.disabled = true; const l = $(".btn__label", sendBtn); if (l) l.textContent = "Sending…"; }
      setTimeout(() => { if (success) success.hidden = false; launchStardust(); }, reduced ? 150 : 800);
      // Wire to a real backend (Formspree / Netlify Forms) here.
    });
  }

  /* ---- 10. Stardust burst (success) ---- */
  const COLORS = ["#8f7fe0", "#e6b877", "#d98c6a", "#c56b8a", "#f4d98a", "#d7d2ff"];
  function launchStardust() {
    if (reduced) return;
    for (let i = 0; i < 60; i++) {
      const p = document.createElement("div");
      p.className = "mote";
      const size = 5 + Math.random() * 7;
      p.style.width = p.style.height = size + "px";
      p.style.left = (40 + Math.random() * 20) + "vw";
      p.style.top = (40 + Math.random() * 20) + "vh";
      p.style.background = COLORS[i % COLORS.length];
      p.style.boxShadow = "0 0 8px " + COLORS[i % COLORS.length];
      const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
      p.animate(
        [{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
         { transform: `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px) scale(0)`, opacity: 0 }],
        { duration: 1100 + Math.random() * 700, easing: "cubic-bezier(.22,.9,.3,1)" }
      );
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1900);
    }
  }

  /* ---- 11. Sparkle helper ---- */
  const motesLayer = $(".motes");
  function burstSparks(anchor, glyphs) {
    if (reduced || !motesLayer) return;
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = cx + (Math.random() - 0.5) * 50 + "px";
      s.style.top = cy + (Math.random() - 0.5) * 24 + "px";
      s.style.animationDelay = Math.random() * 0.2 + "s";
      motesLayer.appendChild(s);
      setTimeout(() => s.remove(), 1050);
    }
  }

  /* ---- 12. Cursor trail — stars on dark, sparkles on light ---- */
  if (!reduced && window.matchMedia("(pointer: fine)").matches && motesLayer) {
    let last = 0;
    window.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (now - last < 80) return;
      last = now;
      if (Math.random() > 0.55) return;
      const onLight = nav.classList.contains("nav--on-light");
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = onLight ? "✦" : (Math.random() > 0.5 ? "·" : "✧");
      s.style.left = e.clientX + "px";
      s.style.top = e.clientY + "px";
      s.style.fontSize = (7 + Math.random() * 7) + "px";
      s.style.color = onLight ? COLORS[1 + Math.floor(Math.random()*3)] : COLORS[Math.floor(Math.random()*COLORS.length)];
      s.style.opacity = ".85";
      motesLayer.appendChild(s);
      setTimeout(() => s.remove(), 950);
    });
  }

  /* ---- 13. Year ---- */
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
})();
