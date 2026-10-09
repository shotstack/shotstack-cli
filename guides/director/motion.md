# Motion on Shotstack

What can move in an edit, on which layer, and how much control each layer gives you. Timing, easing, travel and rhythm are design choices for the piece; this file covers the mechanics.

There are two kinds of motion. **Built-in motion** (clip transitions, effects and keyframes, and `rich-text` animation) takes fixed options from the schema and needs care when combined on an existing asset. **`html5`** takes any seekable animation.

## Time

- **The timeline is in seconds.** Clip `start`/`length`, keyframe `start`/`length` and GSAP `duration` are all seconds. Convert frame-based specs with the output frame rate (`output.fps`): at 25 fps one frame is 0.04 s.
- **An `html5` clip captures its animation for the clip's `length`,** measured from the clip's start. Animation that runs past the end is cut; animation that finishes early holds its last state.

## What each layer can move

| Layer | What moves | Control |
|---|---|---|
| Clip `transition` | the whole clip, in and out | `fade` `reveal` `wipe*` `slide*` `carousel*` `shuffle*` `zoom`, each with `Slow`/`Fast` variants. Timing and easing are engine-fixed. |
| Clip `effect` | a Ken Burns drift on an image or video | `zoomIn` `zoomOut` `slideLeft` `slideRight` `slideUp` `slideDown`, each with `Slow`/`Fast` |
| Clip keyframes | `scale`, `opacity`, `offset.x`/`.y`, `transform.rotate.angle`, `transform.skew.x`/`.y`, an asset's `volume`, a video's `speed` | Tween arrays with your own `start` and `length`; `interpolation` and `easing` from fixed lists (below) |
| `rich-text` `animation` | the text's entrance | `preset` + `duration` + `style` + `direction`; easing is engine-fixed |
| `html5` | anything inside the clip | any seekable GSAP, anime.js, Lottie or CSS animation, any easing, per-element timing. Rules in the HTML5 guide. |

### rich-text animation

| Preset | Example |
|---|---|
| fade in | `{ "preset": "fadeIn", "duration": 0.6 }` |
| rise + fade | `{ "preset": "ascend", "duration": 0.6, "direction": "up" }` |
| slide in | `{ "preset": "slideIn", "duration": 0.6, "direction": "up" }` |
| word-by-word cascade | `{ "preset": "shift", "duration": 0.6, "style": "word", "direction": "up" }` |
| typewriter | `{ "preset": "typewriter", "duration": 0.8, "style": "character" }` |

Schema constraints (`@shotstack/schemas` → `RichTextAnimation`): `preset` ∈ `fadeIn · slideIn · typewriter · ascend · shift · movingLetters`; `duration` 0.1–30 s; **`style` (`word`/`character`) applies only to `typewriter` and `shift`** (ignored on the others); `direction` is **required** for `slideIn`, `ascend`, `shift`, `movingLetters`. Rich-text `animation` is **entrance-only**: exits use the clip `transition.out`. For control over easing, per-character timing or exits, use `html5`.

### Clip keyframes

- `interpolation` is `linear` (the default), `bezier` or `constant`. `easing` takes effect with `bezier`.
- `easing` is `ease`, `easeIn`, `easeOut`, `easeInOut`, or `easeIn` / `easeOut` / `easeInOut` followed by `Quad`, `Cubic`, `Quart`, `Quint`, `Sine`, `Expo`, `Circ` or `Back` (for example `easeOutCubic`, `easeInOutBack`).
- To match an `html5` clip's GSAP ease: `easeOutQuad` ≈ `power1.out`, `easeOutCubic` ≈ `power2.out`, `easeOutQuart` ≈ `power3.out`.

### Combining built-in motion on an existing asset

- Keyframes move the whole rendered clip; a `rich-text` preset animates the text inside it. A slide preset plus an `offset` keyframe moves the text twice, so animate each property one way per clip.
- Keyframe times are relative to the clip's `start`, and a tween that runs past the clip's `length` is cut off.
- Footage, images and logos are scaled by `fit` first, and keyframe `scale` multiplies that, so a large scale on a low-resolution source shows its pixels.

## Easing available in html5

- **GSAP:** `none`, `power1`–`power4`, `sine`, `circ`, `expo`, `back(overshoot)`, `elastic(amplitude, period)`, `bounce` and `steps(n)`, each as `.in`, `.out` or `.inOut`.
- **CSS:** any `cubic-bezier()`, `steps()` or `linear(…)` point list, on `@keyframes`, transitions and `Element.animate()`.

## Recipes

Syntax starting points, deliberately different in feel. Build each scene on one top-level timeline and place tweens with GSAP's position parameter (`0`, `'<'`, `'-=0.2'`, labels) rather than `delay`.

```js
const tl = gsap.timeline();

// settle: rise and fade into place
tl.from('#title', { opacity: 0, y: 24, duration: 0.6, ease: 'power3.out' }, 0);

// blur reveal: opacity, blur and rise off one tween
tl.from('#sub', { opacity: 0, y: 16, filter: 'blur(10px)', duration: 0.6, ease: 'power3.out' }, 0.3);

// pop: overshoot on arrival
tl.from('#badge', { opacity: 0, scale: 0.6, duration: 0.5, ease: 'back.out(2.2)' }, 0.8);

// slam: big travel, hard snap
tl.from('#hit', { opacity: 0, x: -600, skewX: -18, duration: 0.45, ease: 'expo.out' }, 1.2);

// character cascade: wrap each character in a <span class="c">
tl.from('#word .c', { opacity: 0, yPercent: 110, rotation: 12, duration: 0.5, ease: 'power4.out', stagger: 0.03 }, 1.6);

// elastic settle
tl.from('#price', { scale: 0, duration: 1.1, ease: 'elastic.out(1, 0.45)' }, 2.0);

// exit, overlapping the next beat
tl.to('#title, #sub', { opacity: 0, y: -12, duration: 0.33, ease: 'power2.in' }, '-=0.1');

// ambient loop: a drift that runs for the rest of the clip
tl.to('#glow', { opacity: 0.4, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true }, 0);
```

### CSS equivalents (no JS)

```css
.el { animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }

/* staggered siblings */
.w:nth-child(1){animation-delay:0s}.w:nth-child(2){animation-delay:.08s}.w:nth-child(3){animation-delay:.16s}
```

## Brand kit through merge fields

`merge` find/replace runs over every string in the edit, including `html5` `html`, `css` and `js`. Declare the brand once as top-level fields and reference them in every clip, and one edit re-skins the whole video:

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

## See also

- the HTML5 guide — the html5 sandbox: seekable animation only, sizing, fonts, preloaded libraries
- the HTML5 snippets — ready-made clips to remix
- the agent guide → "Motion" — the compact summary (shared with the MCP server)
