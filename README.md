# Apps, by Dream Create ☯

> One dream, endless creations.

The ecosystem hub for **Dream Create** — a husband-&-wife studio where
**Dream** (Dustin) engineers the systems and **Create** (Courtney) gives
them soul. A sister universe to [Dream Create Studio](https://dreamcreatestudio.com).

Built as a fast, dependency-free static site — deploys anywhere (Vercel,
Netlify, GitHub Pages, Cloudflare Pages) with zero build step.

## ✨ The concept — a living yin-yang

The whole page *is* the duality. It flows between two halves:

- **Dream** — a cosmic night side (near-black, muted indigo, starlight, brass) — Dustin's engineering, systems & platforms.
- **Create** — a luminous day side (warm parchment, ink, brass) — Courtney's design, photography & warmth.
- **The seam** — a filmic twilight gradient where the two meet. **Dream Create Web** — which *builds and designs* — lives right here.

The execution is deliberately **editorial / filmic** — restrained, textural,
grown-up. No emoji, no candy gradients, no bouncy motion.

Design touches:
- A refined, slowly-rotating **celestial yin-yang** — a day/night terminator with a tiny sun & crescent moon, rendered with grain and a luminous seam.
- A global **film-grain** overlay, drifting **haze**, and a filmic **vignette** for depth.
- **Fraunces** high-contrast serif display, **Inter** body, **IBM Plex Mono** for numbered section labels — with custom hairline SVG icons throughout.
- The nav **adapts** (light/dark) as you scroll over each half.
- A **balance toggle** that shifts the yin-yang lead and remembers it.
- Sparse **starfields** on the Dream sections; slow, expensive easing everywhere.
- Underline-only form fields, a validated contact form with an elegant success state.
- Fully responsive & accessible (keyboard, focus states, `prefers-reduced-motion`, semantic HTML).

## 🪐 The ecosystem

| App | Half | Status | Notes |
|-----|------|--------|-------|
| **DreamCRM** | ☾ Dream | Live | Front-office platform for dental clinics → dreamcreatestudio.com |
| **Dream Create Web** | ☯ Both | Live | Web studio that builds & hosts custom sites |
| **Dream Towing** | ☾ Dream | Live | Dispatch/ops platform for towing companies |
| **Dream Create \| Real Estate** | ☀ Create | New | Courtney's real estate photo & video → `apps/real-estate/` |

## 📁 Structure

```
index.html              # Apps by Dream Create — the hub
assets/css/app.css      # duality design system + animations
assets/js/app.js        # all interactivity (vanilla JS)
apps/
  real-estate/          # ── the first "Create" extension ──
    index.html          # Dream Create | Real Estate (full site)
    assets/…            # its own styles & scripts
    README.md
```

The real estate site is a **self-contained extension**, linked from the
apps grid. New apps can join the ecosystem the same way — a folder under
`apps/` plus a card in `index.html`.

## 🛠️ Make it yours — quick checklist

1. **App details / links** — edit the `.app-card` blocks in `index.html`
   (names, descriptions, `href`s, Live/New badges).
2. **Contact** — search for `hello@dreamcreatestudio.com`.
3. **Portraits** — the Duality section uses text-only cards; drop in real
   photos of Dustin & Courtney if you'd like (swap the `.half__inner`).
4. **Form delivery** — the form simulates sending. Wire it to
   [Formspree](https://formspree.io) / [Netlify Forms](https://docs.netlify.com/forms/setup/)
   (see the note in `app.js`, section 9).

## 🚀 Run locally

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## 🎨 Palette & type

**Dream (night):** near-black `#0a0a0f` · muted indigo haze · bone `#e9e6df` · brass `#c6a15b`
**Create (day):** parchment `#e7e0d3` · ink `#1a1620` · brass-deep `#9a6a34`
**Seam (twilight):** filmic dusk — deep aubergine → mauve → warm sand

Fonts: **Fraunces** (high-contrast serif display), **Inter** (body), **IBM Plex Mono** (labels).

---

Built by Dustin, made beautiful by Courtney. ☾ ☀
