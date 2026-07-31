# Dream Create — the dreamworld ☁️

> One dream, endless creations. A WebGL cloud-flight through the things Dustin has built.

A personal showcase for **Dustin / Dream Create**, built as an immersive
3D experience: you drift down through a volumetric cloudscape in blues and
teals, passing glowing "waypoints" for each app.

## ✨ What it is

- A full-screen **Three.js** dreamworld — a gradient sky shader, hundreds of
  soft volumetric cloud sprites, a glowing sun, drifting light-motes, and a
  luminous orb for each app.
- **Scroll drives a flight** through the clouds; the camera banks along a
  gentle path and sways with the mouse (parallax).
- Content floats over the scene as **frosted-glass cards** — legible over any
  cloud thanks to soft scrims and backdrop blur.
- **Self-contained**: Three.js is vendored locally (`assets/vendor/`), so it
  works offline and deploys anywhere with **no build step**.
- **Graceful fallback**: no WebGL or `prefers-reduced-motion` → a static CSS
  cloud-sky, with all content fully readable and accessible.

## 🪐 The apps (the waypoints)

| App | What it is | Link |
|-----|-----------|------|
| **DreamCRM** | Front-office platform for dental clinics | dreamcreatestudio.com |
| **Dream Create Web** | Studio that builds & hosts custom sites | (contact) |
| **Dream Towing** | Dispatch/ops platform for towing companies | (contact) |
| **Dream Create Real Estate** | Courtney's real estate photo & video | `apps/real-estate/` |

## 📁 Structure

```
index.html               # the dreamworld
assets/css/app.css       # glass UI, scenes, fallback sky
assets/js/app.js         # Three.js scene + UI (ES module)
assets/vendor/
  three.module.js        # vendored Three.js r160 (MIT)
apps/
  real-estate/           # Courtney's site — a live "Create" extension
```

## 🛠️ Make it yours

1. **App copy / links** — edit the `<article class="card">` blocks in `index.html`.
2. **Contact** — search for `hello@dreamcreatestudio.com`.
3. **The dream, tuned** — in `assets/js/app.js`, the top of `initDream()` has
   the knobs: `CLOUD_COUNT`, fog density/colour, sun position, the sky-shader
   colours, and the `APP` waypoint positions/colours.
4. **Form delivery** — the form simulates sending; wire it to
   [Formspree](https://formspree.io) / [Netlify Forms](https://docs.netlify.com/forms/setup/)
   (see the note in `app.js`).

## 🚀 Run locally

ES modules need HTTP (not `file://`):

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## 🎨 Palette

Sky-deep `#0c2a55` · sky-mid `#1f5fa8` · teal `#2fa9c9` · bright teal `#7fe3f0` ·
cloud `#eaf6ff` · a soft dawn glow at the horizon.

Fonts: **Cormorant Garamond** (airy display) · **Inter** (UI).

---

Dreamed up & built by Dustin · made beautiful with Courtney.
