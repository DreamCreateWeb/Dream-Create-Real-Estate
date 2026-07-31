/* =========================================================
   Dream Create — interactions
   Vanilla JS. Restrained & slow. Respects reduced-motion.
   ========================================================= */
(function () {
  "use strict";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---- 1. Starfields (sparse, fine) ---- */
  $$("[data-stars]").forEach((field) => {
    const n = parseInt(field.dataset.stars, 10) || 24;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      const size = Math.random() < 0.85 ? 1 : 1.6;
      s.style.width = s.style.height = size + "px";
      s.style.animationDelay = (Math.random() * 6) + "s";
      s.style.animationDuration = (5 + Math.random() * 4) + "s";
      if (Math.random() > 0.88) s.style.background = "#c6a15b";
      frag.appendChild(s);
    }
    field.appendChild(frag);
  });

  /* ---- 2. Nav: scroll state, progress, mode adaption ---- */
  const nav = $("#nav");
  const toTop = $("#toTop");
  const progress = $(".progress span");
  const modeSections = $$(".mode-dream, .mode-create, .mode-twilight");

  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 20);
    if (toTop) toTop.classList.toggle("is-visible", y > 700);
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (docH > 0 ? (y / docH) * 100 : 0) + "%";

    let light = false;
    for (const sec of modeSections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= 68 && r.bottom > 68) light = sec.classList.contains("mode-create");
    }
    nav.classList.toggle("nav--on-light", light);
    nav.classList.toggle("nav--on-dark", !light);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }));

  /* ---- 3. Balance toggle ---- */
  const root = document.documentElement;
  const toggle = $("#balanceToggle");
  let lead = "balanced";
  try { lead = localStorage.getItem("dc-lead") || "balanced"; } catch (e) {}
  root.setAttribute("data-lead", lead);
  if (toggle) {
    toggle.addEventListener("click", () => {
      lead = lead === "create" ? "dream" : "create";
      root.setAttribute("data-lead", lead);
      try { localStorage.setItem("dc-lead", lead); } catch (e) {}
    });
  }

  /* ---- 4. Mobile menu ---- */
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

  /* ---- 5. Scroll reveal ---- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  /* ---- 6. Hero emblem parallax (subtle) ---- */
  if (!reduced && window.matchMedia("(pointer: fine)").matches) {
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
      tx += (mx - tx) * 0.06; ty += (my - ty) * 0.06;
      pEls.forEach((el) => {
        const d = parseFloat(el.dataset.parallax) || 0;
        el.style.transform = `translate(${tx * d * 26}px, ${ty * d * 26}px)`;
      });
      if (Math.abs(mx - tx) > 0.001 || Math.abs(my - ty) > 0.001) raf = requestAnimationFrame(loop);
      else raf = null;
    }
  }

  /* ---- 7. Contact form ---- */
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
      let valid = true;
      $$(".field", form).filter((f) => $("[required]", f)).forEach((f) => { if (!validate(f)) valid = false; });
      if (!valid) {
        const bad = $(".field.is-invalid", form);
        if (bad) { bad.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); $("input,textarea", bad)?.focus(); }
        return;
      }
      if (sendBtn) { sendBtn.disabled = true; const l = $(".btn__label", sendBtn); if (l) l.textContent = "Sending…"; }
      setTimeout(() => { if (success) success.hidden = false; }, reduced ? 120 : 640);
      // Wire to a real backend (Formspree / Netlify Forms) here.
    });
  }

  /* ---- 8. Year ---- */
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
})();
