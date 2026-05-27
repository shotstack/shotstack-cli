# HTML5 snippet pack — drop-in motion graphics

Copy-paste `html5` clips that "pop" — kinetic type, count-ups, shine sweeps,
pulsing CTAs, grain. Each is a **single clip**: paste it into a track's
`clips[]`, set `start`/`length`, and position with `offset`.

Read [`html5.md`](html5.md) first for the rules these obey. The non-negotiables:

- **Seekable animation only.** GSAP timelines, GSAP tweens (incl. `onUpdate`), anime.js, Lottie, or CSS `@keyframes`. **Never** `setTimeout`/`setInterval`/`requestAnimationFrame`/`Date.now()`/`gsap.call()` — the renderer seeks by absolute time, it doesn't play.
- **Size the clip to the content, not the canvas.** `html, body` pinned to the clip's `width`/`height`; place with `offset` (`{x:0,y:0}` is centred, `y` positive is up). Use **px**, never `vw`/`vh`/`%`.
- **The body is transparent by default** — the clip composites over the layers below (only set an opaque background if you want one).
- **No `<canvas>`** — Studio capture serialises the DOM; canvas bitmaps come through empty. Use SVG or positioned DOM.
- **No network.** gsap/anime/d3/lottie are preloaded; external `<script src>`, `fetch`, remote `<img>`, and remote fonts are all CSP-blocked — inline everything as `data:` URIs.
- **Fonts:** `timeline.fonts[]` does **not** reach `html5` and remote `@font-face` is blocked. These snippets name a display font first but render in the `system-ui` fallback unless you inline the font as a `data:` `@font-face`.

Coordinates below assume a **1080×1920 vertical** canvas; adjust `offset` for other sizes. Colours use a neutral ink/accent — swap for your palette.

---

## 1. Kinetic headline (word-by-word rise)

Big title where each word springs up in sequence. GSAP timeline, fully seekable.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"h\"><span>JUST</span> <span>DROPPED</span></div>",
    "css": "html,body{margin:0;width:980px;height:420px;overflow:hidden;background:transparent;font-family:'Anton',system-ui,sans-serif}.h{display:flex;flex-wrap:wrap;gap:0 18px;align-items:center;justify-content:center;width:980px;height:420px;text-transform:uppercase;line-height:0.9}.h span{display:inline-block;font-size:150px;font-weight:800;color:#141414;transform:translateY(120%);opacity:0}",
    "js": "const tl=gsap.timeline();gsap.utils.toArray('.h span').forEach((el,i)=>{tl.to(el,{y:0,opacity:1,duration:0.6,ease:'back.out(1.7)'},i*0.18)});tl.to({},{duration:1.2});"
  },
  "start": 0,
  "length": 3,
  "width": 980,
  "height": 420,
  "offset": { "x": 0, "y": 0.02 }
}
```

Each word is a `<span>` starting `translateY(120%)`. The trailing empty tween is a hold so the title sits still before the clip ends. The CSS names `Anton`, but custom fonts must be inlined — `timeline.fonts[]` doesn't apply inside `html5` and remote `@font-face` is CSP-blocked — so without an inline `data:` `@font-face` it renders in the `system-ui` fallback. To get `Anton`: `@font-face{font-family:'Anton';src:url('data:font/woff2;base64,…') format('woff2')}`.

---

## 2. Count-up number / price odometer

Animate a value from 0 to its target. Seek-safe because the count lives in a **tweened object with `onUpdate`** (fires on seek), never a timer.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"wrap\"><span class=\"cur\">$</span><span id=\"n\">0</span></div>",
    "css": "html,body{margin:0;width:620px;height:220px;overflow:hidden;background:transparent;font-family:system-ui,sans-serif}.wrap{display:flex;align-items:baseline;justify-content:center;width:620px;height:220px;color:#141414;font-weight:800;font-variant-numeric:tabular-nums}.cur{font-size:70px;margin-right:6px}#n{font-size:150px;letter-spacing:-2px}",
    "js": "const o={v:0};const out=document.getElementById('n');const tl=gsap.timeline();tl.to(o,{v:395,duration:1.4,ease:'power2.out',onUpdate:()=>{out.textContent=Math.round(o.v)}});tl.to({},{duration:1.0});"
  },
  "start": 0,
  "length": 3,
  "width": 620,
  "height": 220,
  "offset": { "x": 0, "y": -0.1 }
}
```

Swap `v:395` for any target. For thousands separators use `Math.round(o.v).toLocaleString()`. Pair with a static label on an adjacent `rich-text` track ("FROM", "AUD").

---

## 3. Shine / gloss sweep

A specular highlight that slides across text or a card — premium product gloss. Pure CSS keyframe (WAAPI-seekable). Put this clip **above** the thing it shines on, or wrap the content in the same clip.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"plate\"><div class=\"label\">UTOPIA</div><div class=\"shine\"></div></div>",
    "css": "html,body{margin:0;width:860px;height:280px;overflow:hidden;background:transparent;font-family:'Anton',system-ui,sans-serif}.plate{position:relative;width:860px;height:280px;display:flex;align-items:center;justify-content:center;overflow:hidden}.label{font-size:200px;font-weight:800;letter-spacing:6px;color:#141414;text-transform:uppercase}.shine{position:absolute;top:0;left:0;width:240px;height:280px;background:linear-gradient(100deg,transparent,rgba(255,255,255,0.85),transparent);mix-blend-mode:overlay;transform:translateX(-300px) skewX(-12deg);animation:sweep 2.4s ease-in-out 0.4s 1 both}@keyframes sweep{to{transform:translateX(1100px) skewX(-12deg)}}",
    "js": ""
  },
  "start": 0,
  "length": 3,
  "width": 860,
  "height": 280,
  "offset": { "x": 0, "y": 0 }
}
```

`mix-blend-mode: overlay` makes the sweep read as a real highlight rather than a white bar. No JS needed.

---

## 4. Pulsing CTA button

A "SHOP NOW" pill with a soft breathing glow — draws the eye on an end card. CSS keyframes loop and seek cleanly.

```json
{
  "asset": {
    "type": "html5",
    "html": "<div class=\"cta\">SHOP NOW</div>",
    "css": "html,body{margin:0;width:620px;height:170px;overflow:hidden;background:transparent;font-family:system-ui,sans-serif}.cta{width:560px;height:128px;margin:21px auto;display:flex;align-items:center;justify-content:center;border-radius:16px;background:#5c3a21;color:#fff;font-size:46px;font-weight:700;letter-spacing:4px;text-transform:uppercase;box-shadow:0 0 0 0 rgba(92,58,33,0.5);animation:pulse 1.6s ease-in-out 0s infinite both}@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(92,58,33,0.45)}50%{transform:scale(1.04);box-shadow:0 0 36px 8px rgba(92,58,33,0.35)}}",
    "js": ""
  },
  "start": 0,
  "length": 4,
  "width": 620,
  "height": 170,
  "offset": { "x": 0, "y": -0.4 }
}
```

The clip is wider/taller than the pill so the glow has room (`overflow:hidden` would otherwise clip it). For a non-looping single pop, replace `infinite` with `1`.

---

## 5. Film-grain / texture overlay

A subtle moving grain over the whole frame — adds a moody, analogue feel (great over dark scenes). SVG `feTurbulence`, animated by shifting a slightly-oversized layer so it never reveals an edge. Size this one **to the canvas** and put it on a top track at low opacity.

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

## Composing these

- Each snippet is one clip on its own track. Layer order is top-track-first (see `agent-core.md`) — grain and shine go in **early** tracks, backgrounds in **late** ones.
- They don't overlap on a single track, so `shotstack validate <file>` stays clean. Run it before rendering.
- Reuse text via top-level `merge[]` (`{{title}}` in the HTML) — see the lower-third example in `html5.md`.
- Heavier motion = longer render. Preview in `shotstack studio <file>` before spending credits.
