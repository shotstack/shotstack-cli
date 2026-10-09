# Motion: built-in options and html5

Shotstack has two kinds of motion, and they follow different rules:

- **Built-in motion** — clip `transition` and `effect`, `rich-text` `animation` presets, and clip keyframes. These are fixed options: use only the names and fields the schema defines, and take care when combining them on existing assets (see below).
- **`html5`** — anything goes: any property, easing, timing, physics or look. The defaults further down are a starting point for when nobody has given a direction. The user's brief, their brand or a reference video always comes first.

Whatever the mix, motion reads best when an edit reuses a small set of timings across its clips, so the clips feel like one piece.

> Durations here are in seconds, matching Shotstack's second-based timeline (most UI-motion guidance is frame-based).

## Built-in motion: fixed options

| Layer | Control | Options |
|---|---|---|
| clip `transition` / `effect` | whole-clip in/out | `fade`, `slide*`, `zoom` and the rest of the schema's list, each with `Slow`/`Fast` variants (`Slow` ≈ 0.8 s, default ≈ 0.6 s, `Fast` ≈ 0.33 s) |
| `rich-text` `animation` | `preset` + `duration` + `style` + `direction` | presets below |
| clip keyframes | Tween arrays on clip properties | `interpolation` and `easing` from fixed lists, below |

### rich-text animation

| Intent | `rich-text` animation |
|---|---|
| fade in | `{ "preset": "fadeIn", "duration": 0.6 }` |
| rise + fade | `{ "preset": "ascend", "duration": 0.6, "direction": "up" }` |
| slide in | `{ "preset": "slideIn", "duration": 0.6, "direction": "up" }` |
| word-by-word cascade | `{ "preset": "shift", "duration": 0.6, "style": "word", "direction": "up" }` |
| typewriter | `{ "preset": "typewriter", "duration": 0.8, "style": "character" }` |

Schema constraints (`@shotstack/schemas` → `RichTextAnimation`): `preset` ∈ `fadeIn · slideIn · typewriter · ascend · shift · movingLetters`; `duration` 0.1–30 s; **`style` (`word`/`character`) applies only to `typewriter` and `shift`** (ignored on the others); `direction` is **required** for `slideIn`, `ascend`, `shift`, `movingLetters`. Rich-text `animation` is **entrance-only** — exits use the clip `transition.out`. The presets' easing is fixed by the engine; for full easing control, use `html5`.

### Clip keyframes

`scale`, `opacity`, `offset.x`/`.y`, `transform.rotate.angle`, `transform.skew.x`/`.y`, an asset's `volume` and a video's `speed` take a Tween array instead of a number: `[{ "from": 1, "to": 1.1, "start": 0, "length": 2, "interpolation": "bezier", "easing": "easeOutQuart" }]`.

- `interpolation` is `linear` (default), `bezier` or `constant`. Pair `easing` with `bezier`.
- `easing` is one of `ease`, `easeIn`, `easeOut`, `easeInOut`, or `easeIn` / `easeOut` / `easeInOut` followed by `Quad`, `Cubic`, `Quart`, `Quint`, `Sine`, `Expo`, `Circ` or `Back` (for example `easeOutCubic`, `easeInOutBack`).
- Next to html5 GSAP, `easeOutQuad` ≈ `power1.out`, `easeOutCubic` ≈ `power2.out` and `easeOutQuart` ≈ `power3.out`.

### Combining built-in motion on existing assets

- Keyframes move the whole rendered clip; a `rich-text` preset animates the text inside it. A slide preset plus an `offset` keyframe moves the text twice, so animate each property one way per clip.
- Keyframe times are relative to the clip's `start`, and a tween past the clip's `length` is cut off.
- Footage, images and logos are scaled with `fit` first; keyframe `scale` multiplies that, so a large scale on a low-resolution source shows its pixels.

## html5: free motion, with defaults to start from

Nothing in this section is required. Use these values when the user hasn't given a direction, and change any of them when the brief, the brand or a reference calls for a different feel: fast, bouncy, linear or maximal are all valid when asked for.

### Durations (seconds)

| Name | Seconds | Typical use |
|---|---|---|
| `instant` | 0.2 | micro shifts, near-imperceptible feedback |
| `fast` | 0.33 | exits, small moves |
| `base` | 0.6 | most entrances |
| `slow` | 0.8 | large entrances, hero moves |
| `slower` | 1.0 | full-scene transitions |
| `hold` | 1.5 | a settled hold before a clip ends |

Exits a little faster than entrances tend to feel clean.

### Easing

| Where | Entrance / settle | Exit |
|---|---|---|
| **html5 GSAP** | `ease: 'power3.out'` | `ease: 'power2.in'` |
| **html5 CSS** | `cubic-bezier(0.16, 1, 0.3, 1)` | `cubic-bezier(0.3, 0, 0.8, 0.2)` |

`power3.out` / `cubic-bezier(0.16,1,0.3,1)` is a confident "fast then settle" with no bounce. `linear` / `'none'` suits continuous drift (grain, a marquee, a constant-speed ticker); on motion the eye follows it looks mechanical, which is right when that's the look. Overshoot (`back.out(1.4)` in GSAP) reads as a pop: in a calm edit it lands best on one hero element per scene, and an energetic brief can use more.

### Stagger and travel

- `0.13 s` (≈ 4 frames at 30 fps) between siblings is a comfortable cascade — words, list items, grouped reveals. In GSAP: `stagger: 0.13`. In CSS: `animation-delay` steps of `0.13s`.
- Translating 12–24 px and scaling from `0.92` gives a restrained look; blur reveals often run `10 px → 0`. Go bigger when the brief is energetic.
- A reveal that holds for a moment before the clip ends (a trailing `gsap.to({}, { duration: <hold> })` or enough clip `length`) reads better than one cut the instant it lands.

### Choreography recipes (GSAP)

Pure, seekable GSAP — obey [`html5.md`](html5.md) (no `setTimeout`/`rAF`/`Date.now`/`gsap.call()`; size the clip to the content). Each recipe uses the defaults above; swap in any values the brief calls for.

```js
// entryFadeRise: rise 12px + fade
gsap.from('.el', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out' });

// entryFade: presence only (overlays, avatars)
gsap.from('.el', { opacity: 0, duration: 0.6, ease: 'power3.out' });

// entryScale: calm scale-up
gsap.from('.el', { opacity: 0, scale: 0.92, duration: 0.6, ease: 'power3.out' });

// blurReveal: opacity + blur + rise off ONE tween (one progress, many channels)
gsap.from('.el', { opacity: 0, y: 16, filter: 'blur(10px)', duration: 0.6, ease: 'power3.out' });

// wordStagger: each word rises in sequence (wrap words in <span>)
gsap.from('.word', { opacity: 0, yPercent: 120, duration: 0.6, ease: 'power3.out', stagger: 0.13 });

// heroReveal: a pop for a hero element
gsap.from('.hero', { opacity: 0, y: 16, scale: 0.97, duration: 0.8, ease: 'back.out(1.4)' });

// exitFadeFall: fade + drop, faster, ease-in (an exit doesn't settle)
gsap.to('.el', { opacity: 0, y: 8, duration: 0.33, ease: 'power2.in' });
```

**Entrance → hold → exit, on one timeline:**

```js
const tl = gsap.timeline();
tl.from('.el', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out' })  // in
  .to({},        { duration: 1.5 })                                       // hold
  .to('.el',     { opacity: 0, y: 8, duration: 0.33, ease: 'power2.in' }); // out
```

### CSS equivalents (no JS)

```css
/* fast-then-settle entrance */
.el { animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

/* staggered siblings — 0.13s steps */
.w:nth-child(1){animation-delay:0s}.w:nth-child(2){animation-delay:.13s}.w:nth-child(3){animation-delay:.26s}
```

## Brand kit — set the palette once, re-skin everything

Declare the brand as top-level `merge[]` fields and reference them in every clip's `html`/`css`/`js`, instead of hardcoding hex and font per clip — one edit re-skins the whole video.

```json
"merge": [
  { "find": "ink",    "replace": "#141414" },
  { "find": "accent", "replace": "#D96B82" },
  { "find": "bg",     "replace": "#08080A" },
  { "find": "font",   "replace": "Clash Display, system-ui, sans-serif" }
]
```

```css
.title { color: {{ink}}; font-family: {{font}}; }
.cta   { background: {{accent}}; }
```

`merge` find/replace runs over the whole edit, including `html`/`css`/`js` strings, so `{{accent}}` resolves everywhere. Follow the brand's own rules for how much accent colour to use; without them, one accent on a headline word, a number or a CTA is a safe start.

## Before rendering

1. **Built-in options are valid:** preset, transition, effect, `interpolation` and `easing` names come from the schema; `direction` is set where a preset requires it.
2. **Built-in motion doesn't double up:** one animation per property per clip; a preset and a keyframe don't both move the same text.
3. **html5 motion is seekable:** GSAP, CSS or `__shotstackSeek`, with no timers.
4. **Each clip's `length` covers its entrance, any hold and its exit.**
5. **Timings are consistent across the edit**, whatever values the brief called for.
6. **Brand colours via `merge[]`.**

## See also

- [`html5-snippets.md`](html5-snippets.md) — ready-made clips built on the defaults above
- [`html5.md`](html5.md) — the html5 sandbox rules these obey (seekable-only, sizing, fonts)
- `shared/agent-core.md` → "Motion" — the compact summary (shared with the MCP server)
