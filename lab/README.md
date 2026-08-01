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
