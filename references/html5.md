# HTML5 asset guide

The `html5` asset type renders a self-contained HTML/CSS/JS page inside a video clip. Use it for animated overlays, data visualisations, motion graphics, and anything you'd build as a tiny single-page web app.

This is the **modern replacement for the deprecated `html` asset.** `html5` runs in a real browser iframe with a JS runtime, library preloads, and deterministic frame capture — the old `html` asset only rendered static markup.

## Contents

- Required and optional fields
- Preloaded libraries
- The browser harness (deterministic auto-seek)
- Sandbox restrictions: no network, inline everything (incl. fonts)
- Sizing
- Worked example: animated lower-third (GSAP)
- Worked example: animated bar chart (D3 + GSAP)
- Author overrides for custom animation engines
- Common mistakes
- When to use `html5` vs `rich-text`/`svg`

## Required and optional fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | Yes | `"html5"` | Discriminator. |
| `html` | Yes | string | Body markup. Supports merge fields (`{{title}}`). |
| `css` | No | string | Stylesheet. Inlined into the iframe `<head>`. |
| `js` | No | string | Script. Runs after libraries are preloaded. |

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

Four libraries are always available — no `<script src=>` tags needed:

- **GSAP** (`window.gsap`) — primary animation library. Use timelines (`gsap.timeline()`) over loose tweens; the harness seeks timelines correctly.
- **anime.js** (`window.anime`) — alternative animation library. Every instance is auto-tracked via `__shotstackAnimeInstances` (catches `autoplay: false` instances that `anime.running` misses).
- **D3** (`window.d3`) — for data binding, scales, and SVG/DOM construction. Pair with GSAP for the actual animation; D3's transitions work too but GSAP is more reliable under seek.
- **Lottie** (`window.lottie`) — Bodymovin JSON player (SVG-renderer build; `renderer: "canvas"` is unavailable).

These cover ~95% of motion-graphics use cases. **You can't load other libraries via `<script src=>`** — the iframe's CSP blocks all external scripts and network access (see *Sandbox restrictions* below). GSAP, anime.js and Lottie are the animation engines the seek harness drives; D3 just builds the DOM/data (animate it with GSAP). Capture is a static seek at the edit's frame rate (`output.fps`, default 30).

## The browser harness (deterministic auto-seek)

When a clip plays, the SDK captures frames by seeking the iframe's animation state to specific timestamps and rasterising each frame. This is **deterministic**: the same input always produces the same output, regardless of how long real-time playback would take.

The harness is injected automatically. It installs one `window` function you do **not** write yourself:

- `__shotstackSeek(timeMs)` — seeks every detected animation source to `timeMs`.

**Duration comes from the clip's `length`** — there's no animation-duration auto-detection. Size your animation to run within (or fill) the clip's `length`.

**What gets seeked automatically:**

| Source | How it's driven |
|---|---|
| GSAP timelines (`gsap.timeline()`) | `tl.pause()` + `tl.seek(seconds)` on every descendant timeline. |
| GSAP loose tweens | `gsap.globalTimeline.seek(seconds)`. |
| anime.js instances | `instance.pause()` + `instance.seek(timeMs)` on every tracked instance. |
| Lottie animations | `anim.goToAndStop(timeMs, false)` on every registered animation. |
| CSS `@keyframes`, transitions, `Element.animate(...)` | `document.getAnimations()` → set `currentTime` on each. |

**Practical consequence:** write your animation as you would for a normal web page. Use GSAP timelines, anime.js, Lottie, or CSS — the harness drives time. Don't rely on `setTimeout`, `requestAnimationFrame` loops, or `Date.now()` for animation timing — none of those are seekable.

## Sandbox restrictions: no network, inline everything

The iframe renders under a strict Content-Security-Policy (`default-src 'none'`), in both Studio preview and cloud render. Nothing is fetched from the network at render time:

- **No external `<script src=>`.** Only the bundled GSAP/anime.js/D3/Lottie run (they're inlined for you). Another library would have to be inlined into your `js` — and must be seekable (see *Author overrides*).
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
2. **Use a system family** (`system-ui`, `Arial`, `Georgia`, …) — resolves in the render browser with no load.

An unresolved family silently falls back to the browser default — the render won't fail, but the text won't be your font. For a single styled line, a `rich-text` asset (which *does* use `timeline.fonts[]`; verified catalogue in `references/fonts.md`) is simpler than a `data:` font embed.

## Sizing

The single most important rule: **size the clip to the content, not to the canvas.** Then position with `offset`.

The clip's `width` / `height` becomes the iframe's natural pixel dimensions AND the editor's selection box. When the user drags the clip's corners to resize, the iframe gets CSS-scaled — the bar stays the same shape but every internal pixel scales proportionally. This is true regardless of CSS / GSAP / anime / Lottie.

If the clip is sized to the canvas (1920×1080) but the visual content is a small lower-third in the corner, the selection box appears huge over empty space — confusing for the user, and resizing scales the lower-third with the empty space.

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

- **Clip is the size of the bar, not the canvas.** Selection box wraps the bar; resizing changes the bar's size; placement is one `offset` change.
- **`html, body, .bar` all 560×120.** No absolute positioning inside the iframe — the bar IS the iframe content.
- Single GSAP timeline driving every animation. The harness seeks the timeline; child tweens follow automatically.
- Merge fields (`{{name}}`, `{{role}}`) in the HTML, populated by **top-level** `merge[]` (sibling of `timeline`/`output`, NOT a clip property). Keeps the asset reusable.
- Background `rgba(...,0.92)` so the bar sits over a video underneath without being fully opaque.
- Final `.to({}, { duration: 3.5 })` is a hold — no animation, just consumes timeline time so the bar stays visible before fading out.

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
- Single `<linearGradient>` in `<defs>`, all bars reference it via `fill="url(#g)"`. SVG-native, no per-bar styling.

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

No JS at all. The harness's WAAPI driver pauses each animation, sets `currentTime` to the capture timestamp, and commits the seeked values — so each frame correctly shows whichever number is mid-pop.

**Patterns to copy:**

- **One element per state.** `<div id="n10">10</div>`, `<div id="n9">9</div>`, ... — never mutate `textContent` from JS.
- **Stagger via `animation-delay`.** `0s, 1s, 2s, ...` lines each animation up to a unique slot.
- **`animation-fill-mode: both`.** During the delay phase the element shows the `0%` keyframe (`opacity:0`); after the animation it shows the `100%` keyframe (`opacity:0`). Together with `position:absolute;inset:0`, only the currently-animating element is visible.
- **Linear easing.** The harness can seek at any timestamp; non-linear easings still work, but `linear` keeps the math obvious when iterating on timing.

The same pattern scales to scene transitions (each scene is a `<section>` with its own animation slot), tickers (each price is a `<div>` with a slot), animated lists, etc.

## What to avoid for time-driven content

- **`setTimeout` / `setInterval` / `requestAnimationFrame` loops** — none advance during capture. The harness drives time deterministically.
- **`new Date()` / `Date.now()` / `performance.now()` reads** — return the host's wall-clock, not the capture's seeked time.
- **`gsap.call(fn, args, time)`** — callbacks aren't seekable. Use `gsap.fromTo()` / `gsap.to()` tweens, or pure CSS animations.
- **Any state mutation triggered by an event other than the harness seek.**

## Author overrides for exotic animation engines

You almost never need these. They exist for engines outside the supported libraries (Three.js, P5, custom WebGL loops) — and since external scripts are blocked (see *Sandbox restrictions*), such an engine has to be inlined in your `js`. If you're using GSAP, anime.js, Lottie, or CSS animations, **do not install these** — the auto-detected path is the only one tested for parity between Studio playback and cloud render.

```js
// Custom timeline — the harness calls seek() alongside the auto-detected sources.
// seek() receives SECONDS.
window.__shotstackTimeline = {
  seek(seconds) { /* set every part of your scene to time `seconds` */ }
};

// Or install a bare seek hook. NOTE: this one receives MILLISECONDS.
window.__shotstackSeek = (timeMs) => { /* set state for time timeMs */ };
```

Install before any animation starts — the harness loads at the end of the document and captures whatever hook you've defined. The clip's `length` sets the duration; there is no duration hook.

## Common mistakes

1. **Time-based logic in JS that isn't seekable.** `setTimeout`, `setInterval`, `requestAnimationFrame` loops, `new Date()` / `Date.now()` reads, and **`gsap.call()`** callbacks all fail because they don't run during the deterministic capture. Use GSAP timelines (`tl.to/fromTo`), anime.js instances, Lottie, or pure CSS keyframes — the four sources the harness auto-seeks.

2. **`<canvas>` elements.** The Studio frame capture serialises the iframe's DOM via `XMLSerializer`. A `<canvas>` element's bitmap lives in the 2D-context backing store, NOT in the DOM — so the cloned canvas comes through empty and **the captured frames show nothing where the canvas was**. The cloud render (puppeteer) handles canvas correctly, but Studio playback won't, so the parity is broken. Use SVG or positioned HTML elements instead:

   | Want | Replace `<canvas>` with |
   |---|---|
   | Particles / generative graphics | Positioned `<div>` elements animated with CSS transforms, or `<circle>` in SVG |
   | Charts (line / bar / area) | D3 → `<svg>` (see the bar-chart worked example) |
   | Pixel-level effects | CSS filters (`filter: blur(...) hue-rotate(...)`), `<feFilter>` in SVG |
   | Free-form drawings | SVG `<path>` |

   If you're building something that genuinely cannot be expressed without canvas, render it as a `<video>` or `<image>` asset instead of an `html5` clip.
2. **Mismatched dimensions.** If `clip.width = 1920` and your CSS sets `body { width: 1280px }`, content gets cropped or stretched. Pin the iframe's `html, body` dimensions to the clip dimensions.
3. **Expecting network access.** External `<script src=>`, `fetch`/XHR, remote `<img src="https://…">`, and remote `@font-face` URLs are all blocked by the iframe's Content-Security-Policy. Only the bundled libraries run, and there is no network — inline all data, images, and fonts as `data:` URIs (see *Sandbox restrictions*).
4. **Forgetting `overflow: hidden`.** Without it, animations can scroll the iframe and capture extra content beyond the intended viewport.
5. **Using the deprecated `html` asset type.** It still parses but is static-only and ignores the harness. Always use `html5`.
6. **Painting an opaque background by accident.** The body is **transparent by default**, so a clip above a video already composites over it. Set `body { background: … }` only when you genuinely want a solid backdrop — it will hide the layers below.

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
