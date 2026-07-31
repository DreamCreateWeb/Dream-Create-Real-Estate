# Apps, by Dream Create ☯

> One dream, endless creations.

The ecosystem hub for **Dream Create** — a husband-&-wife studio where
**Dream** (Dustin) engineers the systems and **Create** (Courtney) gives
them soul. A sister universe to [Dream Create Studio](https://dreamcreatestudio.com).

Built as a fast, dependency-free static site — deploys anywhere (Vercel,
Netlify, GitHub Pages, Cloudflare Pages) with zero build step.

## ✨ The concept — a living yin-yang

The whole page *is* the duality. It flows between two halves:

- **☾ Dream** — a cosmic night side (deep indigo, starlight, moon-silver) — Dustin's engineering, systems & platforms.
- **☀ Create** — a luminous day side (cream, blush, clay, gold) — Courtney's design, photography & warmth.
- **☯ The seam** — a twilight gradient where the two meet. **Dream Create Web** — which *builds and designs* — lives right here.

Interactive touches:
- A slowly-rotating **yin-yang emblem** with orbiting app-dots and a cursor-parallax.
- The nav **adapts** (light/dark) as you scroll over each half.
- A **balance toggle** (top-right orb) that shifts the yin-yang lead and remembers it.
- Generated **starfields** on the Dream sections, warm **motes** on the Create sections.
- A **cursor trail** — stars over dark areas, sparkles over light.
- App cards with **3D tilt**, a validated contact form with a **stardust burst** on send.
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

**Dream:** indigo `#5b57c8` · violet `#8f7fe0` · starlight `#f4d98a` · deep `#0c0b22`
**Create:** cream `#fbf3ea` · clay `#d98c6a` · gold `#e6b877` · plum `#3a2b4a`
**Seam (twilight):** violet → magenta `#c56b8a` → coral → gold

Fonts: **Space Grotesk** (display), **Inter** (body), **Fraunces** (italic accents).

---

Built by Dustin, made beautiful by Courtney. ☾ ☀
