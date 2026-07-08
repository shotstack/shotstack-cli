# HTML5 snippet pack — drop-in motion graphics

Copy-paste `html5` clips that "pop" — kinetic type, value reveals, shine sweeps,
pulsing CTAs, grain. Each is a **single clip**: paste it into a track's
`clips[]`, set `start`/`length`, and position with `offset`.

Every snippet here is composed from the house **[`motion.md`](motion.md)** tokens —
one duration scale (`base` 0.6 s in, `fast` 0.33 s out), one house ease
(`power3.out` / `cubic-bezier(0.16,1,0.3,1)`), one stagger (`0.13 s`), and a single
shared palette (ink `#141414`, accent `#D96B82`). That shared vocabulary is what
makes a set of these clips feel like one production. **When you adapt a snippet,
keep the tokens** — change the words, the colours and the canvas size, not the
easings and durations. Read [`motion.md`](motion.md) for the why and the full recipe set.

Read [`html5.md`](html5.md) for the rules these obey. The non-negotiables:

- **Seekable animation only.** GSAP timelines, GSAP tweens, anime.js, Lottie, or CSS `@keyframes`. **Never** `setTimeout`/`setInterval`/`requestAnimationFrame`/`Date.now()`/`gsap.call()` — the renderer seeks by absolute time, it doesn't play.
- **`onUpdate` does not fire under seek.** GSAP `onUpdate` callbacks are **not** invoked when the harness seeks to a frame, so any DOM mutations made inside them (`textContent`, `innerHTML`, class swaps) won't appear in the rendered video. Animate **CSS properties only** (opacity, transform, filter, scale). Bake final values into the HTML at generation time and reveal them with opacity/transform tweens.
- **Size the clip to the content, not the canvas.** `html, body` pinned to the clip's `width`/`height`; place with `offset` (`{x:0,y:0}` is centred, `y` positive is up). Use **px**, never `vw`/`vh`/`%`.
- **The body is transparent by default** — the clip composites over the layers below (only set an opaque background if you want one).
- **No `<canvas>`** — Studio capture serialises the DOM; canvas bitmaps come through empty. Use SVG or positioned DOM.
- **No network.** gsap/anime/d3/lottie are preloaded; external `<script src>`, `fetch`, remote `<img>`, and remote fonts are all CSP-blocked — inline everything as `data:` URIs.
- **Fonts:** `timeline.fonts[]` does **not** reach `html5` and remote `@font-face` is blocked. These snippets name a display font first but render in the `system-ui` fallback unless you inline the font as a `data:` `@font-face`.

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

- Each snippet is one clip on its own track. Layer order is top-track-first (see `agent-core.md`) — grain and shine go in **early** tracks, backgrounds in **late** ones.
- They don't overlap on a single track, so `shotstack validate <file>` stays clean. Run it before rendering.
- Reuse text via top-level `merge[]` (`{{title}}` in the HTML) — see the lower-third example in `html5.md`.
- Mix calm and punchy deliberately: a `blur-reveal` title, a `kinetic-headline` hero line, a `value-reveal` stat, a `shine` on the product, a pulsing CTA — all on the same tokens, so the set reads as one piece.
- Heavier motion = longer render. Preview in `shotstack studio <file>` before spending credits.
