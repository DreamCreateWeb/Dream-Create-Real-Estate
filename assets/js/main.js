/* =========================================================
   Dream Create Real Estate Media — interactions
   Vanilla JS, no dependencies. Respects reduced-motion.
   ========================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  /* ---------------------------------------------------------
     1. Day / Night theme toggle (with memory + system pref)
     --------------------------------------------------------- */
  const root = document.documentElement;
  const themeToggle = $("#themeToggle");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (themeToggle) themeToggle.setAttribute("aria-pressed", theme === "night");
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "night" ? "#171a2e" : "#fbf3ea");
  }

  let stored = null;
  try { stored = localStorage.getItem("dcre-theme"); } catch (e) {}
  if (stored) {
    applyTheme(stored);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyTheme("night");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "night" ? "day" : "night";
      applyTheme(next);
      try { localStorage.setItem("dcre-theme", next); } catch (e) {}
      burstSparkles(themeToggle, next === "night" ? ["⭐", "🌙", "✨"] : ["☀️", "✨", "🌤️"]);
    });
  }

  /* ---------------------------------------------------------
     2. Sticky nav shadow + back-to-top + build progress
     --------------------------------------------------------- */
  const nav = $("#nav");
  const toTop = $("#toTop");
  const progFill = $(".build-progress__fill");
  const progHouse = $(".build-progress__house");

  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 24);
    if (toTop) toTop.classList.toggle("is-visible", y > 600);

    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH > 0 ? Math.min(1, y / docH) : 0;
    if (progFill) progFill.style.width = (pct * 100) + "%";
    if (progHouse) progHouse.style.left = (pct * 100) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" }));

  /* ---------------------------------------------------------
     3. Mobile menu
     --------------------------------------------------------- */
  const burger = $("#navBurger");
  const navLinks = $(".nav__links");
  if (burger && navLinks) {
    burger.addEventListener("click", () => {
      const open = navLinks.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open);
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$(".nav__links a").forEach((a) =>
      a.addEventListener("click", () => {
        navLinks.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------------------------------------------------------
     4. Scroll-reveal via IntersectionObserver
     --------------------------------------------------------- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !prefersReduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------------------------------------------------------
     5. Animated stat counters
     --------------------------------------------------------- */
  const counters = $$("[data-count]");
  if (counters.length) {
    const cObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10) || 0;
        if (prefersReduced) { el.textContent = target; cObs.unobserve(el); return; }
        const dur = 1400;
        const start = performance.now();
        (function tick(now) {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased);
          if (p < 1) requestAnimationFrame(tick);
        })(start);
        cObs.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach((c) => cObs.observe(c));
  }

  /* ---------------------------------------------------------
     6. Hero parallax (mouse + scroll)
     --------------------------------------------------------- */
  const parallaxEls = $$("[data-parallax]");
  const houseScene = $(".house-scene");
  if (!prefersReduced) {
    let mx = 0, my = 0, tx = 0, ty = 0, raf = null;
    const hero = $("#hero");
    if (hero) {
      hero.addEventListener("mousemove", (e) => {
        const r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5;
        my = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      hero.addEventListener("mouseleave", () => { mx = 0; my = 0; if (!raf) raf = requestAnimationFrame(loop); });
    }
    function loop() {
      tx += (mx - tx) * 0.08;
      ty += (my - ty) * 0.08;
      parallaxEls.forEach((el) => {
        const depth = parseFloat(el.dataset.parallax) || 0;
        el.style.transform = `translate(${tx * depth * 40}px, ${ty * depth * 40}px)`;
      });
      if (Math.abs(mx - tx) > 0.001 || Math.abs(my - ty) > 0.001) raf = requestAnimationFrame(loop);
      else raf = null;
    }

    // subtle scroll parallax for the house
    window.addEventListener("scroll", () => {
      if (!houseScene) return;
      const y = window.scrollY;
      if (y < window.innerHeight) houseScene.style.marginBottom = (y * 0.06) + "px";
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     7. Fireflies (generated) + click on house to toggle theme
     --------------------------------------------------------- */
  const ff = $(".fireflies");
  if (ff && !prefersReduced) {
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("span");
      s.style.left = (5 + Math.random() * 90) + "%";
      s.style.top = (40 + Math.random() * 55) + "%";
      s.style.animationDelay = (Math.random() * 8) + "s, " + (Math.random() * 2) + "s";
      s.style.animationDuration = (6 + Math.random() * 6) + "s, " + (1.4 + Math.random()) + "s";
      ff.appendChild(s);
    }
  }
  // clicking the little house lights it up (toggles theme) — a delightful easter egg
  const theHouse = $(".house-scene");
  if (theHouse && themeToggle) {
    theHouse.style.cursor = "pointer";
    theHouse.setAttribute("title", "psst… click to flip day & night");
    theHouse.addEventListener("click", () => themeToggle.click());
  }

  /* ---------------------------------------------------------
     8. Portfolio filtering
     --------------------------------------------------------- */
  const chips = $$(".chip");
  const frames = $$(".frame");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => { c.classList.remove("is-active"); c.setAttribute("aria-selected", "false"); });
      chip.classList.add("is-active");
      chip.setAttribute("aria-selected", "true");
      const f = chip.dataset.filter;
      frames.forEach((frame) => {
        const show = f === "all" || frame.dataset.cat === f;
        frame.classList.toggle("is-hidden", !show);
      });
    });
  });

  // Lightbox for frames (uses the tile's own gradient + title)
  frames.forEach((frame) => {
    frame.setAttribute("tabindex", "0");
    frame.setAttribute("role", "button");
    const t = $(".frame__title", frame);
    if (t) frame.setAttribute("aria-label", "View " + t.textContent);
    const open = () => openLightbox(frame);
    frame.addEventListener("click", open);
    frame.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });

  let lb = null;
  function openLightbox(frame) {
    const title = $(".frame__title", frame)?.textContent || "Featured home";
    const tag = $(".frame__tag", frame)?.textContent || "";
    const style = frame.getAttribute("style") || "";
    if (!lb) {
      lb = document.createElement("div");
      lb.className = "lightbox";
      lb.innerHTML =
        '<div class="lightbox__backdrop"></div>' +
        '<div class="lightbox__inner" role="dialog" aria-modal="true" aria-label="Portfolio preview">' +
          '<button class="lightbox__close" aria-label="Close">&times;</button>' +
          '<div class="lightbox__photo"></div>' +
          '<div class="lightbox__meta"><span class="lightbox__tag"></span><h3 class="lightbox__title"></h3>' +
          '<p class="lightbox__hint">✨ This is a styled placeholder — swap in a real photo to make it shine.</p></div>' +
        "</div>";
      document.body.appendChild(lb);
      injectLightboxCSS();
      lb.addEventListener("click", (e) => {
        if (e.target.classList.contains("lightbox__backdrop") || e.target.classList.contains("lightbox__close")) closeLightbox();
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
    }
    $(".lightbox__photo", lb).setAttribute("style", style);
    $(".lightbox__tag", lb).textContent = tag;
    $(".lightbox__title", lb).textContent = title;
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    $(".lightbox__close", lb).focus();
  }
  function closeLightbox() {
    if (lb) lb.classList.remove("is-open");
    document.body.style.overflow = "";
  }
  function injectLightboxCSS() {
    if ($("#lightbox-css")) return;
    const css = document.createElement("style");
    css.id = "lightbox-css";
    css.textContent =
      ".lightbox{position:fixed;inset:0;z-index:300;display:grid;place-items:center;opacity:0;pointer-events:none;transition:opacity .3s}" +
      ".lightbox.is-open{opacity:1;pointer-events:auto}" +
      ".lightbox__backdrop{position:absolute;inset:0;background:rgba(30,20,26,.6);backdrop-filter:blur(6px)}" +
      ".lightbox__inner{position:relative;width:min(720px,92vw);background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-lg);transform:scale(.92);transition:transform .35s cubic-bezier(.34,1.56,.64,1)}" +
      ".lightbox.is-open .lightbox__inner{transform:scale(1)}" +
      ".lightbox__photo{aspect-ratio:16/10;background:linear-gradient(160deg,var(--g1),var(--g2) 55%,var(--g3))}" +
      ".lightbox__meta{padding:20px 24px 24px}" +
      ".lightbox__tag{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--accent-2)}" +
      ".lightbox__title{font-family:var(--display);font-style:italic;font-size:26px;margin:4px 0 8px}" +
      ".lightbox__hint{color:var(--text-soft);font-size:14px;margin:0}" +
      ".lightbox__close{position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.9);color:#3a3231;font-size:26px;line-height:1;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.2);z-index:2}";
    document.head.appendChild(css);
  }

  /* ---------------------------------------------------------
     9. Before / After staging slider (drag + keyboard)
     --------------------------------------------------------- */
  const ba = $("#ba");
  const baBefore = $("#baBefore");
  const baHandle = $("#baHandle");
  if (ba && baBefore && baHandle) {
    let dragging = false;
    const setPos = (clientX) => {
      const r = ba.getBoundingClientRect();
      let pct = ((clientX - r.left) / r.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      baBefore.style.width = pct + "%";
      baHandle.style.left = pct + "%";
      baHandle.setAttribute("aria-valuenow", Math.round(pct));
    };
    const startDrag = (e) => { dragging = true; ba.classList.add("is-dragging"); moveDrag(e); };
    const moveDrag = (e) => {
      if (!dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      setPos(x);
      if (e.cancelable) e.preventDefault();
    };
    const endDrag = () => { dragging = false; ba.classList.remove("is-dragging"); };

    baHandle.addEventListener("mousedown", startDrag);
    ba.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", moveDrag);
    window.addEventListener("mouseup", endDrag);
    baHandle.addEventListener("touchstart", startDrag, { passive: false });
    window.addEventListener("touchmove", moveDrag, { passive: false });
    window.addEventListener("touchend", endDrag);

    baHandle.addEventListener("keydown", (e) => {
      const cur = parseFloat(baHandle.getAttribute("aria-valuenow")) || 50;
      if (e.key === "ArrowLeft") { setByPct(cur - 4); e.preventDefault(); }
      if (e.key === "ArrowRight") { setByPct(cur + 4); e.preventDefault(); }
    });
    function setByPct(pct) {
      pct = Math.max(0, Math.min(100, pct));
      baBefore.style.width = pct + "%";
      baHandle.style.left = pct + "%";
      baHandle.setAttribute("aria-valuenow", Math.round(pct));
    }
  }

  /* ---------------------------------------------------------
     10. Contact form: validate → mailbox animation → success
     --------------------------------------------------------- */
  const form = $("#contactForm");
  const mailbox = $("#mailbox");
  const flyLetter = $("#flyLetter");
  const success = $("#formSuccess");
  const sendBtn = $("#sendBtn");

  function validateField(field) {
    const input = $("input, textarea", field);
    if (!input || !input.hasAttribute("required")) return true;
    let ok = input.value.trim().length > 0;
    if (input.type === "email" && ok) ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    field.classList.toggle("is-invalid", !ok);
    return ok;
  }

  if (form) {
    // clear error as the user types
    $$(".field input, .field textarea", form).forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.closest(".field");
        if (field && field.classList.contains("is-invalid")) validateField(field);
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const required = $$(".field", form).filter((f) => $("[required]", f));
      let valid = true;
      required.forEach((f) => { if (!validateField(f)) valid = false; });

      if (!valid) {
        const firstBad = $(".field.is-invalid", form);
        if (firstBad) {
          firstBad.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
          $("input, textarea", firstBad)?.focus();
        }
        return;
      }

      // animate the letter into the mailbox
      if (mailbox && flyLetter && !prefersReduced) {
        mailbox.scrollIntoView({ behavior: "smooth", block: "center" });
        flyLetter.classList.remove("is-flying");
        void flyLetter.offsetWidth; // reflow
        flyLetter.classList.add("is-flying");
        setTimeout(() => mailbox.classList.add("is-delivered"), 700);
      }

      if (sendBtn) { sendBtn.disabled = true; $(".btn__label", sendBtn).textContent = "Sending…"; }

      setTimeout(() => {
        if (success) { success.hidden = false; }
        launchConfetti();
        // (Wire up to a real backend / Formspree / Netlify Forms here.)
      }, prefersReduced ? 200 : 950);
    });
  }

  /* ---------------------------------------------------------
     11. Confetti + sparkle helpers
     --------------------------------------------------------- */
  const CONFETTI_COLORS = ["#d98c6a", "#eab8b1", "#e0b978", "#a9bfa0", "#5b3a4b", "#f6c87b"];
  function launchConfetti() {
    if (prefersReduced) return;
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("div");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      p.style.animationDuration = 2.4 + Math.random() * 1.8 + "s";
      p.style.animationDelay = Math.random() * 0.4 + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      if (Math.random() > 0.6) p.style.borderRadius = "50%";
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4600);
    }
  }

  const sparkLayer = $(".sparkle-layer");
  function burstSparkles(anchor, glyphs) {
    if (prefersReduced || !sparkLayer) return;
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("span");
      s.className = "sparkle";
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = cx + (Math.random() - 0.5) * 60 + "px";
      s.style.top = cy + (Math.random() - 0.5) * 30 + "px";
      s.style.animationDelay = Math.random() * 0.2 + "s";
      sparkLayer.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }
  }

  /* ---------------------------------------------------------
     12. Cursor sparkle trail (desktop, subtle)
     --------------------------------------------------------- */
  if (!prefersReduced && window.matchMedia("(pointer: fine)").matches && sparkLayer) {
    let last = 0;
    const trail = ["✦", "✧", "·", "✨"];
    window.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (now - last < 90) return;
      last = now;
      if (Math.random() > 0.5) return; // thin it out
      const s = document.createElement("span");
      s.className = "sparkle";
      s.textContent = trail[Math.floor(Math.random() * trail.length)];
      s.style.left = e.clientX + "px";
      s.style.top = e.clientY + "px";
      s.style.fontSize = 8 + Math.random() * 8 + "px";
      s.style.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      s.style.opacity = ".8";
      sparkLayer.appendChild(s);
      setTimeout(() => s.remove(), 900);
    });
  }

  /* ---------------------------------------------------------
     13. Footer year
     --------------------------------------------------------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
