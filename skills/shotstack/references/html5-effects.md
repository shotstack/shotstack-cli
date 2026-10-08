# HTML5 effects palette

What you can build inside one `html5` clip, listed by the effect you'd reach for in a motion-graphics or editing tool. Every recipe renders the same in Studio's preview and the cloud render, on the CPU renderer, unless its note says otherwise. Timing and easing come from [`motion.md`](motion.md); the rules every recipe obeys are in [`html5.md`](html5.md). Snippets assume a GSAP timeline `tl = gsap.timeline()`.

**Match** means preview and render agree. **Caveat** names what differs. **Not available** gives the alternative.

## Text

| Effect | Recipe | Status |
|---|---|---|
| Per-character animation | `const s = SplitText.create("#t", { type: "chars" }); tl.from(s.chars, { y: 40, opacity: 0, rotation: -15, stagger: 0.04 })` | Match |
| Per word / per line | `type: "words"` or `type: "lines"`. For lines, embed the font and build the tween in `onSplit` with `autoSplit: true`, so lines are measured with the real font | Match |
| Tracking in / out | `tl.fromTo("#t", { letterSpacing: "0.6em" }, { letterSpacing: "0.12em", duration: 2 })` | Match |
| Typewriter | `tl.to("#t", { text: "Final copy", duration: 1.5, ease: "none" })` | Match |
| Text decoder | `tl.to("#t", { scrambleText: { text: "DECODED", chars: "01" }, duration: 1.2 })` | Caveat: random glyphs; only the final text matches |
| Text on a path | SVG `<text><textPath href="#curve" id="tp">…</textPath></text>`, then `tl.to("#tp", { attr: { startOffset: "30%" } })` | Match |
| Stroke, gradient fill, glow | `-webkit-text-stroke: 2px #fff` · `background: linear-gradient(…); -webkit-background-clip: text; color: transparent` · `text-shadow: 0 0 12px #0ff` | Match, glow edges soften slightly in preview |

## Shapes and paths

| Effect | Recipe | Status |
|---|---|---|
| Stroke write-on | `tl.fromTo("#path", { drawSVG: "0%" }, { drawSVG: "100%" })` | Match |
| Travelling stroke segment | `tl.fromTo("#path", { drawSVG: "0% 10%" }, { drawSVG: "90% 100%" })` | Match |
| Shape morph | `tl.to("#shapeA", { morphSVG: "#shapeB" })` | Match |
| Motion path, auto-orient | `tl.to("#dot", { motionPath: { path: "#track", align: "#track", autoRotate: true, alignOrigin: [0.5, 0.5] } })`, or CSS `offset-path: path("M…")` with `tl.to(el, { offsetDistance: "100%" })` | Match |
| Repeated copies of a shape | Generate N copies in JS, then `tl.from(copies, { rotation: (i) => i * 30, opacity: 0, stagger: 0.05 })` | Match |
| Boolean path operations, path offset | Not available. Draw the merged outline as one SVG path | — |

## Masks and mattes

| Effect | Recipe | Status |
|---|---|---|
| Animated mask (wipe, reveal) | `tl.fromTo(el, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)" })` or a `polygon(…)` with the same point count | Match |
| Mask feather | `mask-image: linear-gradient(90deg, #000 60%, transparent)` | Match |
| Alpha matte (fill through text) | SVG `<mask id="m"><text fill="#fff">MATTE</text></mask>` on a gradient or image; animate what's behind | Match |
| Luma matte | `<mask style="mask-type: luminance">` containing a gradient | Match |
| Inverted matte | In the SVG mask, a white rect with the shape drawn in black | Match |
| HTML content as a matte | Not available. The matte must be SVG content or an image | — |

## Blend modes and adjustment layers

| Effect | Recipe | Status |
|---|---|---|
| Multiply, screen, overlay, difference, colour dodge, add | `mix-blend-mode: multiply` (also `plus-lighter` for add) | Match |
| Linear burn, vivid or pin light, hard mix, subtract, divide, dissolve | Not available. Nearest: `color-burn`, `hard-light`, `difference` | — |
| Adjustment layer | An element over the layers it affects with `backdrop-filter: blur(10px) saturate(1.4)` | Match. Caveat: costly over large areas |
| Blending isolated to a group | `isolation: isolate` on the group | Match |

## Effects

| Effect | Recipe | Status |
|---|---|---|
| Gaussian blur | `filter: blur(8px)`; animate with `tl.to(el, { filter: "blur(0px)" })` | Match |
| Directional blur | SVG `<filter><feGaussianBlur stdDeviation="14 0"/></filter>` (x only) | Match |
| Glow | `filter: drop-shadow(0 0 12px #22d3ee) drop-shadow(0 0 28px #a855f7)` | Caveat: halo slightly softer in preview |
| Drop shadow | `filter: drop-shadow(0 12px 24px rgba(0,0,0,.5))` | Match |
| Noise displacement, wave warp | `<feTurbulence id="t" type="fractalNoise" baseFrequency="0.02" numOctaves="3"/>` → `<feDisplacementMap id="d" in="SourceGraphic" scale="30"/>`; animate `tl.to("#t", { attr: { baseFrequency: 0.05 } })` and `#d` `scale` | Match |
| Fractal noise | `<feTurbulence type="turbulence">` then `<feColorMatrix>` to tint | Match. Caveat: about 75 ms per full 1080p frame |
| Curves, levels, hue/saturation, tint | `<feComponentTransfer>` (`table`, `gamma`), `<feColorMatrix type="hueRotate">` (animate `attr: { values }`), or CSS `saturate() contrast() hue-rotate()` | Match |
| Bevel, light sweep | `<feSpecularLighting>` with `<fePointLight id="p">`; animate `tl.to("#p", { attr: { x: 1920 } })` | Match |
| Lens glow, anamorphic streak | Radial or linear gradients with `mix-blend-mode: screen` | Match |
| Vignette | Overlay `radial-gradient(ellipse, transparent 55%, rgba(0,0,0,.6))` | Match |
| Film grain | Snippet 6 in [`html5-snippets.md`](html5-snippets.md) | Match |
| Motion blur | Not available. Fake it on fast moves with a short directional blur | — |

## Motion and time

| Effect | Recipe | Status |
|---|---|---|
| Custom easing curve | `CustomEase.create("hop", "M0,0 C0.3,1 0.7,1 1,0")`, then `ease: "hop"` | Match |
| Bounce with squash | `CustomBounce.create("bnc", { strength: 0.6, squash: 2, squashID: "bnc-sq" })`; position uses `"bnc"`, scale uses `"bnc-sq"` | Match |
| Wiggle, random shake | `CustomWiggle.create("wig", { wiggles: 7, type: "easeOut" })`, then `ease: "wig"`. Never `type: "random"` | Match |
| Loop, ping-pong loop | `repeat: -1`, plus `yoyo: true` for ping-pong | Match |
| Nested scenes | Each scene is its own timeline on one master: `gsap.timeline().add(sceneA, 0).add(sceneB, 2.5)` | Match |
| Speed ramp, time remapping | `const scene = gsap.timeline({ paused: true }).to(…); gsap.globalTimeline.remove(scene); tl.to(scene, { progress: 1, duration: 3, ease: "power3.inOut" })`. The `remove` line is required | Match |
| Throw, fall, bounce | `tl.to(el, { physics2D: { velocity: 600, angle: -60, gravity: 900 }, duration: 2 })` | Match |
| Momentum glide to a stop | `tl.to(el, { inertia: { x: { velocity: 600, end: 300 } } })` | Match |
| Layout morph | `const st = Flip.getState(".item")`; change classes or order; `tl.add(Flip.from(st, { duration: 1 }))` | Match |
| Seeded randomness | `const rand = d3.randomLcg(42)`; never `Math.random()` | Match |

## 3D and camera

| Effect | Recipe | Status |
|---|---|---|
| 3D layers and camera move (2.5D) | `perspective: 1600px` on a stage, `transform-style: preserve-3d` on a world, each layer at `translateZ(z) scale((p − z) / p)`; move the world with `tl.to("#world", { z: 150, y: 20, rotationY: -3 })` | Match. Order layers back to front |
| Depth of field, rack focus | Tween a `focus` object and set each layer's `blur(|z − focus| / 120 px)` in its `onUpdate` | Match. Caveat: six blurred full-frame layers cost about 340 ms per 1080p frame |
| Card flip, tilt | `perspective` and `tl.to(el, { rotationY: 180 })` | Match |
| Cube, carousel, crossing planes | Correct in the cloud render; Studio's preview paints faces in DOM order. Avoid | Caveat |
| 3D models, lights, materials, WebGL | Not available. Fake depth with layered 2.5D, gradients and SVG lighting | — |

## Generative and data

| Use | Recipe | Status |
|---|---|---|
| Particles, generative art | Canvas 2D drawn from `window.__shotstackSeek = (ms) => { … }` with seeded positions; or DOM dots with `physics2D` | Match |
| Charts and data viz | D3 builds SVG, GSAP animates it ([`html5.md`](html5.md) bar-chart example) | Match |
| Lottie animation | `lottie.loadAnimation({ container, renderer: "svg", autoplay: false, loop: false, animationData })`. Shapes, stroke write-ons, masks, mattes and nested compositions work | Caveat: expressions don't run; convert them to keyframes first |

## Not available

- **WebGL, shaders, 3D models:** use CSS 2.5D and SVG filters.
- **Video or audio inside the clip:** put footage and sound on other timeline tracks; `html5` is the graphics layer.
- **Scroll, drag or pointer-driven animation:** capture is time-driven only.
- **Remote fonts, images, scripts:** inline them as `data:` URIs.

## Cost

Most recipes cost 20–40 ms per 1080p frame on the CPU renderer. The expensive ones are full-frame blur or `backdrop-filter` (about 90 ms), fractal noise (about 75 ms) and stacks of blurred depth layers (about 340 ms). Keep heavy filters on small elements, and blur only the layers that need it.
