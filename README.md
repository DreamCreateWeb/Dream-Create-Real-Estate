# Dream Create Real Estate Media 🏡📸

A fancy-but-cute marketing website for a real estate **photography & videography**
studio — a sister brand to [Dream Create Studio](https://dreamcreatestudio.com).

Built as a fast, dependency-free static site so it deploys anywhere (Vercel,
Netlify, GitHub Pages, Cloudflare Pages) with zero build step.

## ✨ Highlights

- **Day / Night mode** — a sun/moon toggle in the nav (or click the little house!)
  that lights up the windows, reveals stars & fireflies, and remembers your choice.
- **Animated hero scene** — a charming house with glowing windows & chimney smoke,
  drifting clouds, a floating aerial drone, a house-shaped hot-air balloon, a
  swaying "Just Listed" sign, and a peeking puppy 🐶.
- **House-themed interactivity everywhere:**
  - Scroll progress rendered as a little house travelling across a build bar
  - Portfolio filtering + click-to-open lightbox
  - Draggable **before/after** virtual-staging slider
  - A **mailbox contact form** — your letter literally flies into the mailbox,
    the flag flips up, and confetti rains down on success
  - Scroll-reveal animations, animated stat counters, cursor sparkle trail
- **Fully responsive** and **accessible** — keyboard support, focus states,
  `prefers-reduced-motion` respected, semantic HTML.

## 📁 Structure

```
index.html            # all markup / sections
assets/css/styles.css # design system + all styling & animations
assets/js/main.js     # all interactivity (vanilla JS, no dependencies)
assets/img/           # drop real photos & headshots here
```

## 🛠️ Make it hers — quick checklist

Everything below is intentionally easy to find & swap:

1. **Owner name & story** — search `index.html` for `[Her Name]` and the About
   section copy.
2. **Contact details** — search for `hello@dreamcreatestudio.com`,
   `(555) 000-0000`, and `@dreamcreate.realestate`.
3. **Real photos** — the portfolio uses styled gradient placeholders. Replace each
   `<figure class="frame">` background with a real image, e.g.:
   ```html
   <figure class="frame" data-cat="interior">
     <img src="assets/img/kitchen.jpg" alt="Chef's dream kitchen" />
     <figcaption>…</figcaption>
   </figure>
   ```
   (Add `.frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}`.)
4. **Headshot** — replace the SVG in `.portrait-frame__photo` with
   `<img src="assets/img/owner.jpg" alt="…">`.
5. **Prices & services** — edit the `.svc-card` blocks.
6. **Form delivery** — the form currently simulates sending. Wire it to a real
   backend by adding an `action`/`method` or using
   [Formspree](https://formspree.io) / [Netlify Forms](https://docs.netlify.com/forms/setup/).
   Look for the note in `main.js` (section 10).

## 🚀 Run locally

Just open `index.html`, or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## 🎨 Brand palette

| Token     | Hex       | Use                     |
|-----------|-----------|-------------------------|
| Cream     | `#fbf3ea` | Background              |
| Blush     | `#eab8b1` | Soft accent             |
| Clay      | `#d98c6a` | Primary accent          |
| Sage      | `#8da982` | Secondary accent        |
| Gold      | `#e0b978` | Warm highlight          |
| Plum      | `#5b3a4b` | Headings / deep detail  |

Fonts: **Fraunces** (fancy serif display), **Nunito** (rounded body),
**Caveat** (handwritten accents).

---

Made with ♥ (and a little help from a puppy).
