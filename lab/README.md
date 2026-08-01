# Asset lab

Tools for the **asset quality** phase — get every model, material and
texture looking right *in isolation*, before any world building.

## Asset studio — `lab/asset.html`

Inspect one asset on a turntable under clean studio lighting, with a HUD
reporting size / meshes / triangles / materials.

```
lab/asset.html?m=vehicles/sedan          # a single GLB from assets/models
lab/asset.html?rig=towtruck              # a built rig from rigs.js
        &env=dusk                        # dusk lighting instead of studio
        &a=40                            # freeze the turntable at 40° (stable screenshots)
        &grid=0                          # hide the ground grid
```

## Contact sheets — `lab/sheet.js`

Renders an asset from 8 angles (front / both sides / back / 3-4 / close /
rear 3-4 / top) and composites one labelled sheet. This is the difference
between *guessing* and *seeing* — clipping, floating parts and material
errors are obvious on a sheet and invisible in a single hero shot.

```bash
node lab/sheet.js "rig=towtruck" towtruck            # → .preview/towtruck-sheet.png
node lab/sheet.js "rig=towtruck" tt-wire "wire=1"    # wireframe overlay
node lab/sheet.js "m=vehicles/sedan" sedan
```

Studio flags that make this work: `&a=` azimuth, `&el=` elevation,
`&zoom=`, `&wire=1` wireframe, `&xray=1` transparent, `&hud=0`, `&grid=0`.

## Repainting kit atlases

Kenney kits share one **palette atlas of vertical gradient strips** (64px
wide) — *not* flat colour patches. Tinting `material.color` therefore
repaints windows, tyres and lights along with the body.

`paint(obj, kit, bands)` repaints whole strips instead, scaling each texel
by its own luminance so the shading survives. To discover which strip is
which, flood them all with `?bands=1` and look:

    0 = window glass   1 = lights   3 = lower cladding
    5 = wheel hubs     6 = main body paint

## Rigs — `lab/rigs.js`

Bespoke assets built by kitbashing CC0 base models with custom geometry
and proper materials (steel / chrome / rubber / glass / glow).

- `towtruck` — **Dream Towing wrecker**: Kenney flatbed base tinted amber,
  plus a modelled wrecker assembly (tower, lattice boom, hydraulic ram,
  winch drum, cable, hook block, stabilisers, light bar, exhaust stack,
  mirrors, head/tail lights).

## Scene lab — `lab/env.html`

Full environment tests (`?s=hood|clinic|truck`). Superseded for asset work
by the studio above; kept for scene composition later.

## Asset sources — all CC0 (public domain)

| Source | Used for |
|--------|----------|
| [Kenney](https://kenney.nl/assets) | City Kit Suburban / Commercial / Industrial / Roads, Car Kit, Nature Kit, Modular Buildings, Building Kit |
| [ambientCG](https://ambientcg.com) | PBR textures (grass, asphalt, concrete, paving) |
| [Poly Haven](https://polyhaven.com) | HDRI environment lighting |

Commercial use, no attribution required. Provenance files live beside the
assets (`assets/models/LICENSE-ASSETS.txt`, `assets/textures/LICENSE-TEXTURES.txt`).
