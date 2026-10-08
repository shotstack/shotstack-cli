# HTML5 asset guide

The `html5` asset type renders a self-contained HTML/CSS/JS page inside a video clip. Use it for animated overlays, data visualisations, motion graphics, and anything you'd build as a tiny single-page web app.

For what you can make with it, effect by effect, see the effects palette below.

This is the **modern replacement for the deprecated `html` asset.** `html5` runs in a real browser iframe with a JS runtime, library preloads, and deterministic frame capture — the old `html` asset should never be used.

## Contents

- Required and optional fields
- Preloaded libraries
- The browser harness (deterministic auto-seek)
- Sandbox restrictions: no network, inline everything (incl. fonts)
- Sizing
- 3D: what renders in preview and render
- Worked example: animated lower-third (GSAP)
- Worked example: animated bar chart (D3 + GSAP)
- Worked example: 10-second countdown (pure CSS)
- Common mistakes
- When to use `html5` vs `rich-text`/`svg`

## Required and optional fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | Yes | `"html5"` | Discriminator. |
| `html` | Yes | string | Body markup. Supports merge fields (`{{title}}`). |
| `css` | No | string | Stylesheet. Inlined into the iframe `<head>`. Supports merge fields. |
| `js` | No | string | Script. Runs after libraries are preloaded. Supports merge fields. |

Clip-level `width` and `height` set the iframe's pixel dimensions. They default to the edit's natural size.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"card\"><h1>{{title}}</h1></div>",
    "css": ".card { font-family: 'Inter'; padding: 32px; color: #fff; }",
    "js": "gsap.to('.card', { x: 200, duration: 1 });"
  },
  "start": 0,
  "length": 4,
  "width": 1920,
  "height": 1080
}
```

## Preloaded libraries

Four libraries and GSAP's plugins are always available — no `<script src=>` tags and no `gsap.registerPlugin()` call needed:

- **GSAP** (`window.gsap`) — primary animation library. Use timelines (`gsap.timeline()`) over loose tweens; the harness seeks timelines correctly.
- **anime.js** (`window.anime`) — alternative animation library.
- **D3** (`window.d3`) — for data binding, scales, and SVG/DOM construction. Pair with GSAP for the actual animation; D3's transitions work too but GSAP is more reliable under seek. `d3.randomLcg(seed)` is the seeded random source.
- **Lottie** (`window.lottie`) — Bodymovin JSON player (SVG-renderer build; `renderer: "canvas"` is unavailable). Expressions in the file (`wiggle`, `loopOut`) don't run: a layer that carries one doesn't render. Bake expressions into keyframes before export (After Effects: *Animation → Keyframe Assistant → Convert Expression to Keyframes*).

GSAP 3.15 plugins, already registered:

| Plugin | Use it for |
|---|---|
| `SplitText` | Per-character, word or line animation. `SplitText.create("#title", { type: "chars" })` |
| `TextPlugin` | Typewriter text: `gsap.to(el, { text: "Hello", duration: 1 })` |
| `ScrambleTextPlugin` | Decoding text. Picks random glyphs, so only its final text matches between preview and render |
| `DrawSVGPlugin` | Stroke write-ons and travelling stroke segments: `{ drawSVG: "0%" } → { drawSVG: "100%" }` |
| `MorphSVGPlugin` | Morph one SVG path into another |
| `MotionPathPlugin` | Move along an SVG path, with `autoRotate` |
| `Flip` | Animate between two layouts: `Flip.getState`, change the layout, `Flip.from(state)` |
| `CustomEase`, `CustomBounce`, `CustomWiggle`, `EasePack` | Graph-editor curves, bounce, wiggle and slow-mo eases. Avoid `CustomWiggle` `type: "random"` and `RoughEase`: they're random |
| `Physics2DPlugin`, `PhysicsPropsPlugin`, `InertiaPlugin` | Velocity, gravity and friction motion |

ScrollTrigger, ScrollSmoother, Observer and Draggable aren't bundled: capture never scrolls or takes input.

**You can't load other libraries via `<script src=>`** — the iframe's CSP blocks all external scripts and network access (see *Sandbox restrictions* below).

## The browser harness (deterministic auto-seek)

Frames are captured by **seeking** the animation to each timestamp, not by playing in real time — so your animation must be **seekable**. GSAP (timelines or tweens), anime.js, Lottie, and CSS (`@keyframes`, transitions, `Element.animate()`) are all driven automatically. Anything time-driven that isn't seekable gives a frozen or wrong frame: never use `setTimeout`, `setInterval`, `requestAnimationFrame` loops, `Date.now()` / `performance.now()`, or `gsap.call()`. For "different content at different times" (countdowns, tickers, scene swaps) use the staggered-CSS pattern (see the countdown example) or bake values into the HTML and animate their visibility (see the value-reveal snippet).

**Callbacks.** `onUpdate` runs on every seek for tweens and timelines the harness drives, so it can set what GSAP can't tween directly (a blur computed from depth, a counter's text), provided it depends only on the tween's own progress. It does **not** run for timelines created with `paused: true`, and `gsap.call()` fires when the playhead passes it but isn't undone when the renderer seeks back. Avoid both. Prefer animating CSS properties (opacity, transform, filter) and baking values into the HTML.

**Scenes as nested timelines.** Build each scene as its own timeline and place it on one master: `gsap.timeline().add(sceneA, 0).add(sceneB, 2.5)`. Nested timelines and `delay` play at their offsets, the way nested compositions sit on an editing timeline.

**Randomness must be seeded.** Preview and render must draw the same values, so never use `Math.random()`. Use `const rand = d3.randomLcg(42)` and generate positions, colours and velocities from it at load.

**Initial state in CSS or `from()`.** Put each element's starting state in its CSS or in a `from()` / `fromTo()`. A `gsap.set()` made before the timeline can miss the first frame of the cloud render.

**Custom drawing.** For anything the libraries don't drive (canvas 2D, SVG built in code), define `window.__shotstackSeek = function (ms) { … }` and redraw the whole frame for `ms` from scratch. The harness calls it on every frame, after GSAP.

**Duration comes from the clip's `length`** — there's no animation-duration auto-detection. Size your animation to run within (or fill) the clip's `length`.

## Sandbox restrictions: no network, inline everything

The iframe renders under a strict Content-Security-Policy (`default-src 'none'`), in both Studio preview and cloud render. Nothing is fetched from the network at render time:

- **No external `<script src=>`.** Only the bundled GSAP/anime.js/D3/Lottie run (they're inlined for you). Another library would have to be inlined into your `js` — and must be seekable.
- **No `fetch` / `XMLHttpRequest`** (`connect-src 'none'`). Bundle any data inline — e.g. the JS array in the bar-chart example.
- **No remote images** (`img-src 'self' data: blob:`). Embed images as `data:` URIs. A `data:image/svg+xml` background is fine.
- **No remote fonts** (`font-src 'self' data:`) — see below.

### Fonts in HTML5

`timeline.fonts[]` does **not** apply to `html5` assets (it loads fonts for `rich-text` / `rich-caption` only), and a remote `@font-face` URL (Google Fonts, etc.) is CSP-blocked. Two ways to get a custom font into an `html5` clip:

1. **Inline it as a `data:` `@font-face`** — base64-encode the `.woff2` / `.ttf`:
   ```css
   @font-face { font-family: 'Brand'; src: url('data:font/woff2;base64,<…>') format('woff2'); }
   .title { font-family: 'Brand', sans-serif; }
   ```
2. **Use a system family** (`system-ui`, `Arial`, `Georgia`, …) — resolves with no load, but each machine picks its own font, so text in Studio's preview won't match the cloud render exactly. Embed a font whenever the text must match.

An unresolved family silently falls back to the browser default — the render won't fail, but the text won't be your font. For a single styled line, a `rich-text` asset (which *does* use `timeline.fonts[]`; verified catalogue in the agent guide) is simpler than a `data:` font embed.

## Sizing

The single most important rule: **size the clip to the content, not to the canvas.** Then position with `offset`.

The clip's `width` / `height` are the iframe's natural pixel dimensions — match them to the content's real size; every coordinate inside the iframe is in that pixel space. Sizing the clip to the whole canvas when the content is a small corner overlay wastes space and makes it harder to place — size to the content and move it with `offset`.

**Right pattern:**

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"bar\">…</div>",
    "css": "html,body{margin:0;padding:0;width:560px;height:120px;background:transparent;overflow:hidden}.bar{width:560px;height:120px;…}"
  },
  "width": 560,
  "height": 120,
  "offset": { "x": -0.29, "y": -0.33 }
}
```

- Clip `width` / `height` matches the content's natural size (560 × 120 for a typical lower-third bar)
- CSS `html, body` matches the clip dimensions exactly
- The `.bar` (or whatever the root visual is) fills the body — no `position: absolute; left: …` inside the iframe
- `offset` positions the clip on the canvas (`{x: 0, y: 0}` is centred; `x` ±0.5 is the canvas edges; `y` positive is up, negative is down)

**Reserved for the canvas-spanning case:** sizing the clip to the full output (`width: 1920, height: 1080`) is correct only when the content really fills the frame — animated charts, scene transitions, full-screen titles. For overlays (lower-thirds, badges, watermarks, callouts), always size to the content.

**General rules either way:**

- Use **fixed pixel values throughout** (`px`, not `vw` / `vh` / `%` on root). The capture happens at the iframe's natural size, not a viewport.
- The harness already applies a reset — `margin:0; padding:0; box-sizing:border-box; overflow:hidden`, and `body { background: transparent }` — so you mainly need to pin the explicit `width`/`height` on `html, body`. The body is transparent by default; it composites over the track below.
- The iframe doesn't know about the clip — every internal coordinate is in iframe-pixel space.

## 3D: what renders in preview and render

| Look | How | Preview and render |
|---|---|---|
| 2.5D camera move (layers at depth, dolly, rack focus) | `perspective` on a stage, `transform-style: preserve-3d` on a world, each layer at `translateZ(…)`. GSAP moves the world (`z`, `y`, `rotationY`) as the camera. Depth of field: `onUpdate` sets each layer's `blur()` from its distance to a tweened focus value | Match |
| Card flip, tilted plane | `perspective` + `rotationY` / `rotationX` | Match |
| Cubes, carousels, planes that cross | `preserve-3d` with several faces | Correct in the cloud render; Studio's preview paints faces in DOM order, so hidden faces show. Avoid |
| WebGL (three.js `WebGLRenderer`, shaders) | `<canvas>` with a WebGL context | Blank in the cloud render: no WebGL there |

For 2.5D, order layers back to front in the DOM and scale each far layer up so it still fills the frame (`scale = (perspective − z) / perspective`).

**Watch the cost.** Blur and `backdrop-filter` on full-frame layers are the expensive part on the CPU renderer: six blurred depth layers cost about 340 ms per 1080p frame. Keep blurred layers small, or blur only the layers that need it.

## Worked example: animated lower-third (GSAP)

Slide-in name + role bar with subtle accent. **Clip sized to the bar (560×120), positioned via `offset`.** 5 seconds.

```json
{
  "timeline": {
    "tracks": [
      {
        "clips": [
          {
            "asset": {
              "type": "html5",
              "html": "<div class=\"bar\"><div class=\"accent\"></div><div class=\"text\"><div class=\"name\" id=\"name\">{{name}}</div><div class=\"role\" id=\"role\">{{role}}</div></div></div>",
              "css": "html,body{margin:0;padding:0;width:560px;height:120px;overflow:hidden;font-family:system-ui,sans-serif;background:transparent}.bar{display:flex;align-items:center;width:560px;height:120px;padding:0 32px;box-sizing:border-box;background:rgba(15,23,42,0.92);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.45);opacity:0}.accent{width:6px;height:72px;background:linear-gradient(180deg,#22d3ee,#a78bfa);border-radius:3px;margin-right:24px;transform:scaleY(0);transform-origin:top}.text{display:flex;flex-direction:column;color:#fff}.name{font-size:44px;font-weight:700;letter-spacing:-0.5px;opacity:0;transform:translateX(-12px)}.role{font-size:22px;font-weight:500;color:#94a3b8;margin-top:4px;opacity:0;transform:translateX(-12px)}",
              "js": "const tl=gsap.timeline();tl.to('.bar',{opacity:1,duration:0.5,ease:'power2.out'},0).to('.accent',{scaleY:1,duration:0.5,ease:'power3.out'},0.2).to('#name',{opacity:1,x:0,duration:0.5,ease:'power2.out'},0.35).to('#role',{opacity:1,x:0,duration:0.5,ease:'power2.out'},0.5).to({},{duration:3.5}).to('.bar',{opacity:0,duration:0.5,ease:'power2.in'});"
            },
            "start": 0,
            "length": 5,
            "width": 560,
            "height": 120,
            "offset": { "x": -0.29, "y": -0.39 }
          }
        ]
      }
    ]
  },
  "merge": [
    { "find": "name", "replace": "Sarah Chen" },
    { "find": "role", "replace": "Head of Product" }
  ],
  "output": { "format": "mp4", "resolution": "1080" }
}
```

**Patterns to copy:**

- **Clip is the size of the bar, not the canvas** — placement is one `offset` change.
- **`html, body, .bar` all 560×120.** No absolute positioning inside the iframe — the bar IS the iframe content.
- One GSAP timeline drives every animation.
- Merge fields (`{{name}}`, `{{role}}`) in the HTML, populated by **top-level** `merge[]` (sibling of `timeline`/`output`, NOT a clip property). Keeps the asset reusable. Merge fields also resolve in `css` and `js` — use `{{accent}}` in CSS for brand colours, or `{{targetValue}}` inside a JS string literal for data-driven animation targets.
- A trailing `.to({}, { duration: 3.5 })` holds the final state before the clip ends.

## Worked example: animated bar chart (D3 + GSAP)

D3 builds the SVG; GSAP animates the bars growing in. 6 seconds, 1080p.

```json
{
  "timeline": {
    "tracks": [
      {
        "clips": [
          {
            "asset": {
              "type": "html5",
              "html": "<div class=\"stage\"><h1>Sessions by country</h1><div class=\"sub\">Last 30 days</div><svg id=\"chart\" width=\"1600\" height=\"640\" viewBox=\"0 0 1600 640\"><defs><linearGradient id=\"g\" x1=\"0\" x2=\"0\" y1=\"0\" y2=\"1\"><stop offset=\"0%\" stop-color=\"#22d3ee\"/><stop offset=\"100%\" stop-color=\"#0891b2\"/></linearGradient></defs></svg></div>",
              "css": "html,body{margin:0;padding:0;width:1920px;height:1080px;overflow:hidden;font-family:system-ui,sans-serif;background:radial-gradient(ellipse at 20% 0%,#0f172a 0%,#03020b 100%);color:#e2e8f0}.stage{position:relative;width:1920px;height:1080px;padding:96px 160px;box-sizing:border-box}h1{margin:0;font-size:64px;font-weight:800;letter-spacing:-2px;color:#fff;opacity:0}.sub{margin-top:12px;font-size:24px;color:#94a3b8;opacity:0}#chart{position:absolute;top:280px;left:160px;opacity:0}.bar{fill:url(#g)}.label{font-size:22px;font-weight:700;fill:#fff;font-variant-numeric:tabular-nums}.cat{font-size:18px;fill:#94a3b8;text-transform:uppercase;letter-spacing:1px}",
              "js": "const data=[{c:'US',v:48230},{c:'IN',v:32140},{c:'GB',v:21670},{c:'DE',v:18450},{c:'BR',v:15890},{c:'JP',v:14210},{c:'AU',v:11630}];const W=1600,H=640,M={t:20,r:120,b:60,l:120};const iw=W-M.l-M.r,ih=H-M.t-M.b;const x=d3.scaleBand().domain(data.map(d=>d.c)).range([0,iw]).padding(0.28);const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.v)*1.05]).range([ih,0]);const g=d3.select('#chart').append('g').attr('transform',`translate(${M.l},${M.t})`);const bars=g.selectAll('rect').data(data).enter().append('rect').attr('class','bar').attr('x',d=>x(d.c)).attr('y',ih).attr('width',x.bandwidth()).attr('height',0).attr('rx',8);const labels=g.selectAll('text.label').data(data).enter().append('text').attr('class','label').attr('x',d=>x(d.c)+x.bandwidth()/2).attr('y',ih).attr('text-anchor','middle').text(d=>d.v.toLocaleString()).style('opacity',0);const cats=g.selectAll('text.cat').data(data).enter().append('text').attr('class','cat').attr('x',d=>x(d.c)+x.bandwidth()/2).attr('y',ih+34).attr('text-anchor','middle').text(d=>d.c);const tl=gsap.timeline();tl.to('h1',{opacity:1,duration:0.6,ease:'power3.out'},0.1).to('.sub',{opacity:1,duration:0.5,ease:'power2.out'},0.5).to('#chart',{opacity:1,duration:0.4,ease:'power2.out'},0.7);bars.each(function(d,i){tl.to(this,{attr:{y:y(d.v),height:ih-y(d.v)},duration:0.7,ease:'power2.out'},1.0+i*0.08)});labels.each(function(d,i){tl.to(this,{attr:{y:y(d.v)-14},opacity:1,duration:0.4,ease:'power2.out'},1.4+i*0.08)});"
            },
            "start": 0,
            "length": 6,
            "width": 1920,
            "height": 1080
          }
        ]
      }
    ]
  },
  "output": { "format": "mp4", "resolution": "1080" }
}
```

**Patterns to copy:**

- D3 builds DOM; **GSAP animates it**. D3's `.transition()` works but GSAP is the more reliable seek target.
- Bars start at `y = ih, height = 0` (collapsed at the baseline); GSAP grows them up via `attr: { y, height }`.
- Stagger via `1.0 + i * 0.08` per bar — each bar starts 80ms after the previous.

## Worked example: 10-second countdown (pure CSS)

A countdown is "show different content at different times" — the classic case where authors reach for `setTimeout` or `gsap.call()`. **Both are wrong** because the capture harness seeks by absolute time, not by playing through real time. The right pattern: render every state up-front, hide them with `opacity:0`, and use one CSS animation per state with staggered `animation-delay`.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"stage\"><div id=\"n10\" class=\"num\">10</div><div id=\"n9\" class=\"num\">9</div><div id=\"n8\" class=\"num\">8</div><div id=\"n7\" class=\"num\">7</div><div id=\"n6\" class=\"num\">6</div><div id=\"n5\" class=\"num\">5</div><div id=\"n4\" class=\"num\">4</div><div id=\"n3\" class=\"num\">3</div><div id=\"n2\" class=\"num\">2</div><div id=\"n1\" class=\"num\">1</div></div>",
    "css": "html,body{margin:0;width:1920px;height:1080px;background:#000;font-family:system-ui,sans-serif;overflow:hidden}.stage{position:relative;width:1920px;height:1080px}.num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:280px;font-weight:900;color:#fff;opacity:0}@keyframes pop{0%,100%{opacity:0;transform:scale(1.3)}10%,90%{opacity:1;transform:scale(1)}}#n10{animation:pop 1s linear 0s 1 both}#n9{animation:pop 1s linear 1s 1 both}#n8{animation:pop 1s linear 2s 1 both}#n7{animation:pop 1s linear 3s 1 both}#n6{animation:pop 1s linear 4s 1 both}#n5{animation:pop 1s linear 5s 1 both}#n4{animation:pop 1s linear 6s 1 both}#n3{animation:pop 1s linear 7s 1 both}#n2{animation:pop 1s linear 8s 1 both}#n1{animation:pop 1s linear 9s 1 both}"
  },
  "start": 0,
  "length": 10,
  "width": 1920,
  "height": 1080
}
```

No JS at all — each number is a CSS animation in its own time slot, so every captured frame shows whichever number is mid-pop.

**Patterns to copy:**

- **One element per state.** `<div id="n10">10</div>`, `<div id="n9">9</div>`, ... — never mutate `textContent` from JS.
- **Stagger via `animation-delay`.** `0s, 1s, 2s, ...` lines each animation up to a unique slot.
- **`animation-fill-mode: both`.** During the delay phase the element shows the `0%` keyframe (`opacity:0`); after the animation it shows the `100%` keyframe (`opacity:0`). Together with `position:absolute;inset:0`, only the currently-animating element is visible.

The same pattern scales to scene transitions (each scene is a `<section>` with its own animation slot), tickers (each price is a `<div>` with a slot), animated lists, etc.

## Common mistakes

1. **`<canvas>` drawn in a loop.** Canvas 2D drawing renders in preview and render, but only when it's drawn from `window.__shotstackSeek(ms)`: a `requestAnimationFrame` loop never advances under seek. A WebGL canvas is blank in the cloud render. For charts and shapes, SVG is still lighter:

   | Want | Use |
   |---|---|
   | Particles / generative graphics | Canvas 2D from `__shotstackSeek` with seeded positions, or SVG `<circle>`s |
   | Charts (line / bar / area) | D3 → `<svg>` (see the bar-chart worked example) |
   | Pixel-level effects | CSS filters (`filter: blur(...) hue-rotate(...)`), `<feFilter>` in SVG |
   | Free-form drawings | SVG `<path>` |
2. **Mismatched dimensions.** If `clip.width = 1920` and your CSS sets `body { width: 1280px }`, content gets cropped or stretched. Pin the iframe's `html, body` dimensions to the clip dimensions.
3. **JS syntax or runtime errors produce a blank clip with no render error.** If `asset.js` throws (syntax error or uncaught runtime error), the entire clip renders as a blank frame. The render still reports `status: "done"` with no error — there is no feedback loop. Runtime errors (e.g. referencing a DOM element that doesn't exist) are silent: wrap suspect code in `try/catch` to surface the error.

## When to use `html5` vs `rich-text`/`svg`

| Need | Use |
|---|---|
| Single line of styled text with a font, colour, and position | `rich-text` (faster, no iframe overhead) |
| A few static shapes (rectangles, circles, paths) | `svg` (lighter than HTML5) |
| Animated motion graphics (timeline of fades/slides/scales) | `html5` with GSAP |
| Data visualisation (charts, dashboards, mock UIs) | `html5` with D3 + GSAP |
| Lottie animation | `html5` with `lottie.loadAnimation(...)` |
| Animated text effects beyond what `rich-text` offers | `html5` with GSAP |
| Logo lockup with text + shapes (no animation) | `rich-text` + `svg` on adjacent tracks |

Reach for `html5` when the alternative would be an unwieldy stack of separate tracks or when the design genuinely needs DOM-style layout (flexbox, grid, layered backgrounds with shadows). For static or single-property animation, the lighter assets render faster.

# HTML5 effects palette

What you can build inside one `html5` clip, listed by the effect you'd reach for in a motion-graphics or editing tool. Every recipe renders the same in Studio's preview and the cloud render, on the CPU renderer, unless its note says otherwise. Timing and easing come from the motion guide; the rules every recipe obeys are in the HTML5 guide above. Snippets assume a GSAP timeline `tl = gsap.timeline()`.

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
| Film grain | Snippet 6 in the snippets below | Match |
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
| Charts and data viz | D3 builds SVG, GSAP animates it (see the bar-chart example in the HTML5 guide above) | Match |
| Lottie animation | `lottie.loadAnimation({ container, renderer: "svg", autoplay: false, loop: false, animationData })`. Shapes, stroke write-ons, masks, mattes and nested compositions work | Caveat: expressions don't run; convert them to keyframes first |

## Not available

- **WebGL, shaders, 3D models:** use CSS 2.5D and SVG filters.
- **Video or audio inside the clip:** put footage and sound on other timeline tracks; `html5` is the graphics layer.
- **Scroll, drag or pointer-driven animation:** capture is time-driven only.
- **Remote fonts, images, scripts:** inline them as `data:` URIs.

## Cost

Most recipes cost 20–40 ms per 1080p frame on the CPU renderer. The expensive ones are full-frame blur or `backdrop-filter` (about 90 ms), fractal noise (about 75 ms) and stacks of blurred depth layers (about 340 ms). Keep heavy filters on small elements, and blur only the layers that need it.

# HTML5 snippet pack — drop-in motion graphics

Copy-paste `html5` clips that "pop" — kinetic type, value reveals, shine sweeps,
pulsing CTAs, grain. Each is a **single clip**: paste it into a track's
`clips[]`, set `start`/`length`, and position with `offset`.

Every snippet here is composed from the house **the motion guide** tokens —
one duration scale (`base` 0.6 s in, `fast` 0.33 s out), one house ease
(`power3.out` / `cubic-bezier(0.16,1,0.3,1)`), one stagger (`0.13 s`), and a single
shared palette (ink `#141414`, accent `#D96B82`). That shared vocabulary is what
makes a set of these clips feel like one production. **When you adapt a snippet,
keep the tokens** — change the words, the colours and the canvas size, not the
easings and durations. Read the motion guide for the why and the full recipe set.

Read the HTML5 guide above for the rules these obey. The non-negotiables:

- **Seekable animation only.** GSAP timelines, GSAP tweens, anime.js, Lottie, or CSS `@keyframes`. **Never** `setTimeout`/`setInterval`/`requestAnimationFrame`/`Date.now()`/`gsap.call()` — the renderer seeks by absolute time, it doesn't play.
- **Animate CSS properties; keep callbacks pure.** `onUpdate` runs on every seek, so it may only set values derived from the tween's progress. Never use `paused: true` timelines or `gsap.call()`: neither follows the renderer's seeks. Bake final values into the HTML at generation time and reveal them with opacity/transform tweens.
- **Size the clip to the content, not the canvas.** `html, body` pinned to the clip's `width`/`height`; place with `offset` (`{x:0,y:0}` is centred, `y` positive is up). Use **px**, never `vw`/`vh`/`%`.
- **The body is transparent by default** — the clip composites over the layers below (only set an opaque background if you want one).
- **Canvas only from the seek hook.** Draw canvas 2D inside `window.__shotstackSeek(ms)`, never in a `requestAnimationFrame` loop. WebGL is blank in the cloud render. SVG or positioned DOM is usually lighter.
- **No network.** gsap (with its plugins), anime, d3 and lottie are preloaded; external `<script src>`, `fetch`, remote `<img>`, and remote fonts are all CSP-blocked — inline everything as `data:` URIs.
- **Fonts:** `timeline.fonts[]` does **not** reach `html5` and remote `@font-face` is blocked. These snippets name a display font first but render in the `system-ui` fallback unless you inline the font as a `data:` `@font-face`.
- **Use unique element IDs for GSAP targets, not `:nth-child` or compound CSS selectors.** Studio preview doesn't resolve `.parent:nth-child(n) .child` patterns; `#id` works everywhere. When animating repeated elements (list rows, bars, cards), generate a unique ID per item (`id="row0"`, `id="bar0"`) rather than relying on structural selectors.

Coordinates below assume a **1080×1920 vertical** canvas; adjust `offset` for other sizes.

> **Continuous-motion exception.** Looping or drifting effects (the pulse, the sweep, the grain) are *ambient*, not entrances — they correctly use `ease-in-out` / `linear` and their own loop durations rather than the entrance tokens. Everything that *reveals* uses the house entrance tokens.

---

## 1. Blur reveal — calm text entrance

**Category** entrances · **Use when** the default text reveal; the calm house entrance for a title or line — reach for a punchier one (snippet 2) only with intent · **Canvas** 900×300 · **Tags** text, reveal, entrance, blur

The reference entrance: opacity, blur and a 16 px rise settle **together** off one tween (one progress, many channels) on the house ease — no overshoot. Quietly cinematic.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"t\">{{title}}</div>",
    "css": "html,body{margin:0;width:900px;height:300px;overflow:hidden;background:transparent;font-family:'Clash Display',system-ui,sans-serif}.t{display:flex;align-items:center;justify-content:center;width:900px;height:300px;font-size:150px;font-weight:600;letter-spacing:-3px;color:#141414;text-align:center}",
    "js": "gsap.from('.t',{opacity:0,y:16,filter:'blur(10px)',duration:0.6,ease:'power3.out'});gsap.to({},{duration:1.5});"
  },
  "start": 0,
  "length": 3,
  "width": 900,
  "height": 300,
  "offset": { "x": 0, "y": 0 }
}
```

`base` (0.6 s) entrance on `power3.out`, then a `hold` (1.5 s) settle. Swap `{{title}}` via top-level `merge[]`. `Clash Display` falls back to `system-ui` unless you inline it as a `data:` `@font-face` (see Fonts above).

---

## 2. Kinetic headline (word-by-word rise)

**Category** entrances · **Use when** a headline needs energy — a hype/hero title where each word punches up in sequence · **Canvas** 980×420 · **Tags** text, reveal, entrance, stagger, hero

Each word springs up in sequence. GSAP timeline, fully seekable, on the house stagger.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"h\"><span>JUST</span> <span>DROPPED</span></div>",
    "css": "html,body{margin:0;width:980px;height:420px;overflow:hidden;background:transparent;font-family:'Anton',system-ui,sans-serif}.h{display:flex;flex-wrap:wrap;gap:0 18px;align-items:center;justify-content:center;width:980px;height:420px;text-transform:uppercase;line-height:0.9}.h span{display:inline-block;font-size:150px;font-weight:800;color:#141414;transform:translateY(120%);opacity:0}",
    "js": "const tl=gsap.timeline();gsap.utils.toArray('.h span').forEach((el,i)=>{tl.to(el,{y:0,opacity:1,duration:0.6,ease:'power3.out'},i*0.13)});tl.to({},{duration:1.5});"
  },
  "start": 0,
  "length": 3,
  "width": 980,
  "height": 420,
  "offset": { "x": 0, "y": 0.02 }
}
```

Each word starts `translateY(120%)`, opacity 0; `0.6 s` rise on `power3.out`, words `0.13 s` apart (the house stagger); a trailing empty tween holds the title still. **Punchy variant:** this is the one "hero" spot where a pop is allowed — swap `ease:'power3.out'` for `ease:'back.out(1.4)'` for a gentle overshoot. Keep it to one headline per scene. `Anton` falls back to `system-ui` unless inlined.

---

## 3. Value reveal — bake and fade-in

**Category** data · **Use when** revealing a value, price, stat or metric · **Canvas** 620×220 · **Tags** number, price, stat, data · **Merge-friendly** target value

Bake the final value into the HTML and reveal it with opacity + blur + rise. The value is always present in the DOM — the animation controls only its visibility — so every captured frame shows the correct number. **Never use `onUpdate` to mutate `textContent`**: the seek harness doesn't fire `onUpdate` callbacks, so the value stays at its initial state (`$0`) in every frame.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"wrap\"><span class=\"cur\">$</span><span class=\"n\">395</span></div>",
    "css": "html,body{margin:0;width:620px;height:220px;overflow:hidden;background:transparent;font-family:system-ui,sans-serif}.wrap{display:flex;align-items:baseline;justify-content:center;width:620px;height:220px;color:#141414;font-weight:800;font-variant-numeric:tabular-nums;opacity:0;transform:translateY(16px);filter:blur(10px)}.cur{font-size:70px;margin-right:6px}.n{font-size:150px;letter-spacing:-2px}",
    "js": "gsap.to('.wrap',{opacity:1,y:0,filter:'blur(0px)',duration:0.8,ease:'power3.out'});gsap.to({},{duration:1.5});"
  },
  "start": 0,
  "length": 3,
  "width": 620,
  "height": 220,
  "offset": { "x": 0, "y": -0.1 }
}
```

`slow` (0.8 s) reveal on `power3.out` (a decelerating settle reads right for a value), then a `hold`. Swap `395` for any value at generation time; for thousands separators format the string before baking it (`$63,642` not `63642`). Pair with a static label on an adjacent `rich-text` track ("FROM", "AUD").

---

## 4. Shine / gloss sweep

**Category** graphics (emphasis) · **Use when** adding premium gloss to a product name, logo or card · **Canvas** 860×280 · **Tags** shine, gloss, emphasis, specular

A specular highlight slides across text — premium product gloss. *Continuous* motion (the sweep itself), so it uses `ease-in-out` over `slower` (1.0 s), not an entrance token. Pure CSS keyframe (WAAPI-seekable). Put this clip **above** the thing it shines on, or wrap the content in the same clip.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"plate\"><div class=\"label\">UTOPIA</div><div class=\"shine\"></div></div>",
    "css": "html,body{margin:0;width:860px;height:280px;overflow:hidden;background:transparent;font-family:'Anton',system-ui,sans-serif}.plate{position:relative;width:860px;height:280px;display:flex;align-items:center;justify-content:center;overflow:hidden}.label{font-size:200px;font-weight:800;letter-spacing:6px;color:#141414;text-transform:uppercase}.shine{position:absolute;top:0;left:0;width:240px;height:280px;background:linear-gradient(100deg,transparent,rgba(255,255,255,0.85),transparent);mix-blend-mode:overlay;transform:translateX(-300px) skewX(-12deg);animation:sweep 1s ease-in-out 0.4s 1 both}@keyframes sweep{to{transform:translateX(1100px) skewX(-12deg)}}",
    "js": ""
  },
  "start": 0,
  "length": 3,
  "width": 860,
  "height": 280,
  "offset": { "x": 0, "y": 0 }
}
```

`mix-blend-mode: overlay` makes the sweep read as a real highlight rather than a white bar. No JS needed. The `0.4 s` start delay lets the thing it shines on settle first.

---

## 5. Pulsing CTA button

**Category** graphics (emphasis) · **Use when** drawing the eye to a CTA on an end card · **Canvas** 620×170 · **Tags** cta, button, pulse, loop · **Accent** `#D96B82`

A "SHOP NOW" pill with a soft breathing glow. *Ambient loop* — `ease-in-out`, its own 1.6 s cycle (exempt from the entrance tokens). CSS keyframes seek cleanly.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"cta\">SHOP NOW</div>",
    "css": "html,body{margin:0;width:620px;height:170px;overflow:hidden;background:transparent;font-family:system-ui,sans-serif}.cta{width:560px;height:128px;margin:21px auto;display:flex;align-items:center;justify-content:center;border-radius:16px;background:#D96B82;color:#fff;font-size:46px;font-weight:700;letter-spacing:4px;text-transform:uppercase;box-shadow:0 0 0 0 rgba(217,107,130,0.5);animation:pulse 1.6s ease-in-out 0s infinite both}@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(217,107,130,0.45)}50%{transform:scale(1.04);box-shadow:0 0 36px 8px rgba(217,107,130,0.35)}}",
    "js": ""
  },
  "start": 0,
  "length": 4,
  "width": 620,
  "height": 170,
  "offset": { "x": 0, "y": -0.4 }
}
```

The accent (`#D96B82`) is used here as the single earned colour. The clip is wider/taller than the pill so the glow has room. For a non-looping single pop, replace `infinite` with `1`.

---

## 6. Film-grain / texture overlay

**Category** atmosphere · **Use when** adding a moody analogue texture over a dark scene · **Canvas** 1080×1920 (full frame) · **Tags** grain, texture, overlay, atmosphere

A subtle moving grain over the whole frame. *Continuous drift* — `steps()`/`linear` is correct here (not an entrance). SVG `feTurbulence`, animated by shifting a slightly-oversized layer so it never reveals an edge. Size this one **to the canvas** and put it on a top track at low opacity.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"grain\"></div>",
    "css": "html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:transparent}.grain{position:absolute;top:-5%;left:-5%;width:110%;height:110%;opacity:0.12;background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\");background-size:240px 240px;animation:drift 0.6s steps(4) 0s infinite both}@keyframes drift{0%{transform:translate(0,0)}25%{transform:translate(-12px,8px)}50%{transform:translate(10px,-10px)}75%{transform:translate(-8px,-6px)}100%{transform:translate(0,0)}}",
    "js": ""
  },
  "start": 0,
  "length": 10,
  "width": 1080,
  "height": 1920,
  "offset": { "x": 0, "y": 0 }
}
```

A `data:` URI is fine **inside an html5 asset's CSS** (it's iframe content, not an `asset.src` the render workers fetch). Tune `opacity` (0.06–0.18) and `baseFrequency` (higher = finer grain). `steps(4)` gives a filmic stutter rather than smooth slide.

---

## Brand kit — re-skin every snippet at once

The snippets share one palette (ink `#141414`, accent `#D96B82`) so a set already looks coherent. To re-skin a whole edit to a brand in one place, lift the colours/font into top-level `merge[]` and reference the tokens in each clip's `html`, `css`, and `js` — `merge` find/replace runs over all three strings:

```json
"merge": [
  { "find": "ink",    "replace": "#1A1A2E" },
  { "find": "accent", "replace": "#E8552D" },
  { "find": "font",   "replace": "Anton, system-ui, sans-serif" }
]
```

Then in any snippet's CSS, swap the literal hex for the token: `color:{{ink}}`, `background:{{accent}}`, `font-family:{{font}}`. One edit re-skins every clip. Keep the accent **earned** — a headline word, a number, a CTA, one glow; everything else neutral. (If you ship a snippet *without* a matching `merge[]` entry, leave the literal hex in — an undefined `{{token}}` renders as invalid CSS.)

## Composing these

- Each snippet is one clip on its own track. Layer order is top-track-first (see the agent guide) — grain and shine go in **early** tracks, backgrounds in **late** ones.
- Reuse text via top-level `merge[]` (`{{title}}` in the HTML) — see the lower-third example in the HTML5 guide above.
- Mix calm and punchy deliberately: a `blur-reveal` title, a `kinetic-headline` hero line, a `value-reveal` stat, a `shine` on the product, a pulsing CTA — all on the same tokens, so the set reads as one piece.
