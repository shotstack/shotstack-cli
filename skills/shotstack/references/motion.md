# Motion language — the house vocabulary

A small, closed set of timing, easing and stagger values that **every** animated clip should share. Composing motion from these tokens — instead of inventing a new easing and duration per clip — is what makes a multi-clip edit feel like one production instead of eight unrelated effects. Reach for these before hardcoding a `duration`, an `ease`, or a delay.

> The values are video-paced for Shotstack's **second-based** timeline (most UI-motion guidance is frame-based). The GSAP/CSS easings below stand in for spring physics, which the render engine doesn't expose.

## The tokens

### Duration scale (seconds)

| Token | Seconds | Use for |
|---|---|---|
| `instant` | 0.2 | micro shifts, near-imperceptible feedback |
| `fast` | 0.33 | **exits**, small moves |
| `base` | 0.6 | **the default entrance** — ~80% of reveals |
| `slow` | 0.8 | large entrances, hero moves |
| `slower` | 1.0 | full-scene transitions |
| `hold` | 1.5 | minimum settled hold before a clip ends |

Most entrances are `base` (0.6 s). Exits are deliberately faster than entrances — get out of the way faster than you came in.

### Easing — one house curve, no overshoot by default

| Where | Entrance / settle | Exit |
|---|---|---|
| **html5 GSAP** | `ease: 'power3.out'` | `ease: 'power2.in'` |
| **html5 CSS** | `cubic-bezier(0.16, 1, 0.3, 1)` | `cubic-bezier(0.3, 0, 0.8, 0.2)` |

`power3.out` / `cubic-bezier(0.16,1,0.3,1)` is the **house ease** — a confident "fast then settle" that reads like a heavily-damped spring with **no bounce**. Use it for anything the eye tracks (position, scale, blur). Never use raw `linear` / `'none'` for motion the eye follows; `linear` is only correct for a continuous drift (grain, marquee, a constant-speed ticker).

**Overshoot is opt-in, not default.** A gentle `back.out(1.4)` (GSAP) is reserved for **one** "hero" element per scene where a pop is intended — a logo sting, a headline punch. Calm is the default; energetic is fine when it *earns* it. Never sprinkle bounce across every element.

### Stagger — one value

`0.13 s` (≈ 4 frames at 30 fps) between siblings in any cascade — words, list items, grouped reveals. One value everywhere; present but never frantic. In GSAP: `stagger: 0.13`. In CSS: `animation-delay` steps of `0.13s` (`0s, 0.13s, 0.26s, …`).

### Travel & restraint

- **Travel small:** translate **12–24 px**, not 80. The eye should feel the motion, not be dragged by it. Blur reveals: `10 px → 0`. Scale reveals: `0.92 → 1` (below ~0.85 is dramatic-zoom territory — avoid unless intended).
- **One focal element per moment.** If two things compete, stagger them. Don't animate everything at once.
- **Let it settle.** After a reveal lands, hold it (a trailing `gsap.to({}, { duration: <hold> })` or enough clip `length`) before the clip ends. Never cut a reveal the instant it arrives.

## The three motion layers

Shotstack exposes motion at three levels of control. Use the tokens at whichever level fits; reach down a level only when you need more control.

| Layer | Control | Where the tokens apply |
|---|---|---|
| 1 — **clip `transition` / `effect`** | coarse (whole-clip in/out; only `Slow`/`Fast` variants) | pick `fade`, `slide*`, `zoom`; `Slow` ≈ `slow`, default ≈ `base`, `Fast` ≈ `fast` |
| 2 — **`rich-text` `animation`** | medium (`preset` + `duration` + `style` + `direction`) | set `duration` from the scale; `style:"word"` gives the staggered cascade |
| 3 — **`html5` GSAP / CSS** | full (any property, any easing) | the full vocabulary below — durations, the house ease, `0.13` stagger |

### Layer 2 — rich-text animation, tokenised

`animation.preset` maps onto the choreography names; set `duration` from the scale:

| Intent | `rich-text` animation |
|---|---|
| fade in | `{ "preset": "fadeIn", "duration": 0.6 }` |
| rise + fade (the workhorse) | `{ "preset": "ascend", "duration": 0.6, "direction": "up" }` |
| slide in | `{ "preset": "slideIn", "duration": 0.6, "direction": "up" }` |
| word-by-word cascade | `{ "preset": "shift", "duration": 0.6, "style": "word", "direction": "up" }` |
| typewriter | `{ "preset": "typewriter", "duration": 0.8, "style": "character" }` |

Schema constraints (`@shotstack/schemas` → `RichTextAnimation`): `preset` ∈ `fadeIn · slideIn · typewriter · ascend · shift · movingLetters`; `duration` 0.1–30 s; **`style` (`word`/`character`) applies only to `typewriter` and `shift`** (ignored on the others); `direction` is **required** for `slideIn`, `ascend`, `shift`, `movingLetters`. Rich-text `animation` is **entrance-only** — exits use the clip `transition.out` (Layer 1). Easing on the presets is engine-fixed; for full easing control, drop to html5 (Layer 3).

## Choreography recipes (html5 / GSAP)

Pure, seekable GSAP — obey [`html5.md`](html5.md) (no `setTimeout`/`rAF`/`Date.now`/`gsap.call()`; size the clip to the content). Each recipe is a named choreography helper you compose rather than reinventing.

```js
// entryFadeRise — THE workhorse: rise 12px + fade, house ease, base duration
gsap.from('.el', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out' });

// entryFade — presence only (overlays, avatars)
gsap.from('.el', { opacity: 0, duration: 0.6, ease: 'power3.out' });

// entryScale — calm scale-up
gsap.from('.el', { opacity: 0, scale: 0.92, duration: 0.6, ease: 'power3.out' });

// blurReveal — opacity + blur + rise off ONE tween (one progress, many channels)
gsap.from('.el', { opacity: 0, y: 16, filter: 'blur(10px)', duration: 0.6, ease: 'power3.out' });

// wordStagger — each word rises in sequence (wrap words in <span>)
gsap.from('.word', { opacity: 0, yPercent: 120, duration: 0.6, ease: 'power3.out', stagger: 0.13 });

// heroReveal — the ONE place a pop is allowed (≤1 per scene)
gsap.from('.hero', { opacity: 0, y: 16, scale: 0.97, duration: 0.8, ease: 'back.out(1.4)' });

// exitFadeFall — fade + drop, faster, ease-in (an exit doesn't settle)
gsap.to('.el', { opacity: 0, y: 8, duration: 0.33, ease: 'power2.in' });
```

**Entrance → hold → exit, on one timeline:**

```js
const tl = gsap.timeline();
tl.from('.el', { opacity: 0, y: 12, duration: 0.6, ease: 'power3.out' })  // in (base)
  .to({},        { duration: 1.5 })                                       // hold
  .to('.el',     { opacity: 0, y: 8, duration: 0.33, ease: 'power2.in' }); // out (fast)
```

### CSS equivalents (no JS)

```css
/* house ease entrance */
.el { animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

/* staggered siblings — 0.13s steps */
.w:nth-child(1){animation-delay:0s}.w:nth-child(2){animation-delay:.13s}.w:nth-child(3){animation-delay:.26s}
```

## Brand kit — set the palette once, re-skin everything

Don't hardcode hex and font per snippet. Declare the brand as top-level `merge[]` fields and reference the tokens in every clip's `html`/`css`/`js` — one edit re-skins the whole video — brand tokens applied once, via Shotstack merge:

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

`merge` find/replace runs over the whole edit, including `html`/`css`/`js` strings, so `{{accent}}` resolves everywhere. Keep one accent and use it sparingly — a headline word, a number, a CTA, one glow — everything else neutral. **Colour is earned, never sprinkled.**

## Motion checklist

Before rendering anything animated:

1. **Durations from the scale?** (`0.6` in, `0.33` out — not `0.45`, `0.7`, `1.2`.)
2. **House ease, not linear?** `power3.out` / `cubic-bezier(0.16,1,0.3,1)` for tracked motion.
3. **Overshoot only on one hero element**, if at all.
4. **Stagger is `0.13`**, applied via `stagger` / `animation-delay`.
5. **Travel 12–24 px; scale ≥ 0.92.** Restraint over flash.
6. **One focal element per moment;** competing elements staggered.
7. **It holds before it cuts** (settled `hold`, not an instant exit).
8. **Brand colours via `merge[]`**, accent used sparingly.

## See also

- [`html5-snippets.md`](html5-snippets.md) — ready-made clips that already follow these tokens
- [`html5.md`](html5.md) — the html5 sandbox rules these obey (seekable-only, sizing, fonts)
- `shared/agent-core.md` → "Motion language" — the compact token summary (shared with the MCP server)
