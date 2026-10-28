# Motion on Shotstack

What can move in an edit, on which layer, and how much control each layer gives you. Timing, easing, travel and rhythm are design choices for the piece; this file covers which layer to use and how each one behaves.

There are two kinds of motion. **Built-in motion** (clip transitions, effects and keyframes, and `rich-text` and `rich-caption` animation) takes fixed options from the schema. **`html5`** takes any seekable animation.

## Choosing

| Need | Use |
|---|---|
| Cut between shots | No transition. Cross-fade (below) only when the piece is slow. |
| Life in a still | One `effect` (`zoomInSlow`, `slideLeftSlow`, …) or one slow `scale` tween, moving toward the subject |
| A title or label arriving | `rich-text` `animation` |
| Captions | `rich-caption` `animation` |
| A fade, volume duck or speed ramp at a set time | Clip keyframes |
| Kinetic type, staggered reveals, exits, motion timed to music, custom easing, loops | `html5` |

- Decide the easing family, travel distance and stagger once per video, and reuse them.
- Entrances decelerate (`.out`); exits accelerate (`.in`) and run shorter.
- One source of motion per property per clip.
- Leave text on screen long enough to read: at least 0.8 s, and no more than about 20 characters a second.
- Stagger by at least one frame (0.04 s at 25 fps).

## Time

- **The timeline is in seconds.** Clip `start`/`length`, keyframe `start`/`length` and GSAP `duration` are all seconds. Convert frame-based specs with the output frame rate (`output.fps`, 25 by default): at 25 fps one frame is 0.04 s.
- **An `html5` clip captures its animation for the clip's `length`** at the output frame rate, measured from the clip's start. Animation that runs past the end is cut; animation that finishes early holds its last state (a CSS animation only with `animation-fill-mode: forwards` or `both`).

## What each layer can move

| Layer | What moves | Control |
|---|---|---|
| Clip `transition` | the whole clip, in and out | `fade` `reveal` `wipe*` `slide*` `carousel*` `shuffle*` `zoom`; all but `zoom` take `Slow`/`Fast`. Timing and easing are fixed (below). |
| Clip `effect` | the whole clip, drifting linearly from its start to its end (Ken Burns) | `zoomIn` `zoomOut` `slideLeft` `slideRight` `slideUp` `slideDown`, each with `Slow`/`Fast` |
| Clip keyframes | `scale`, `opacity`, `offset.x`/`.y`, `transform.rotate.angle`, `transform.skew.x`/`.y`, an asset's `volume`, a video's `speed` | Tween arrays with your own `start` and `length`; `interpolation` and `easing` from fixed lists (below) |
| `rich-text` `animation` | the text's entrance | `preset` + `duration` + `style` + `direction`; easing is fixed |
| `rich-caption` `animation` | each word as it is spoken | `style`: `karaoke` `highlight` `pop` `fade` `slide` `bounce` `typewriter` `none`, plus `direction` for `slide`; timed to the transcript |
| `html5` | anything inside the clip | any seekable GSAP, anime.js, Lottie or CSS animation, any easing, per-element timing. Rules in [`html5.md`](html5.md). |

`svg` and `shape` assets have no animation of their own: move them with clip keyframes, effects and transitions. Every `direction`, and every direction in a transition or effect name, is the way the content travels: `slideLeft` and `"direction": "left"` move left.

### Transitions

A transition runs inside its clip: a 1 s `fade` in takes the clip's first second, and a `transition.out` takes its last. To cross-fade, start the incoming clip on the track above `d` seconds before the outgoing clip ends and give it a `transition.in` lasting `d`; leave the outgoing clip at full opacity.

| Transition | Seconds (`Slow` / `Fast`) | Motion |
|---|---|---|
| `fade` | 1 (2 / 0.5) | opacity |
| `reveal` `wipe*` | 1 (2 / 0.5) | a wipe across the frame |
| `slide*` | 0.5 (1 / 0.25) | 2.5% of the frame, with a fade |
| `carousel*` | 0.5 (1 / 0.25) | a full frame, no fade |
| `shuffle*` | 1 (2 / 0.5) | rotates and scales in, no fade |
| `zoom` | 0.4 | scales in from 10×, or out to it, with a fade and blur |

### Effects

`zoomIn`/`zoomOut` change scale by 0.3 over the clip (`Slow` 0.1, `Fast` 0.7). `slide*` pans 8% of the frame (`Slow` 3%, `Fast` 12%) and enlarges the clip to cover the travel; footage that already overflows the frame pans its whole overflow instead.

### rich-text animation

| Preset | Example |
|---|---|
| fade in | `{ "preset": "fadeIn", "duration": 0.6 }` |
| rise + fade | `{ "preset": "ascend", "duration": 0.6, "direction": "up" }` |
| slide in | `{ "preset": "slideIn", "duration": 0.6, "direction": "up" }` |
| word-by-word cascade | `{ "preset": "shift", "duration": 0.6, "style": "word", "direction": "up" }` |
| typewriter | `{ "preset": "typewriter", "duration": 0.8, "style": "character" }` |

- **`direction`** is optional: `slideIn` and `shift` default to `left`, `ascend` and `movingLetters` to `up`. `ascend` takes only `up` or `down`.
- **`style`** (`word`/`character`) staggers `fadeIn`, `slideIn`, `typewriter` and `shift`; `shift` staggers by character unless told otherwise, and `ascend` always goes word by word.
- **`duration`** (0.1–30 s) covers the whole text. A staggered word or character animates for 0.3 s, with starts spread over the first 70% of `duration`, so a longer duration spreads the units out without slowing each one. When omitted, the text animates at about 30 characters per second, taking 0.3 s at least and 90% of the clip at most.
- **Every preset is an entrance that starts with the clip**, except `movingLetters`, which fades in over 0.5 s and then ripples for the whole clip, ignoring `duration` and `style`. Exits use the clip's `transition.out`. For easing, per-character timing or exits, use `html5`.

### Clip keyframes

- `interpolation` is `linear` (the default), `bezier` or `constant`. `easing` takes effect with `bezier`, which defaults to `ease`. `constant` holds `from` until the tween ends, then jumps to `to`.
- `easing` is `ease`, `easeIn`, `easeOut`, `easeInOut`, or `easeIn` / `easeOut` / `easeInOut` followed by `Quad`, `Cubic`, `Quart`, `Quint`, `Sine`, `Expo`, `Circ` or `Back` (for example `easeOutCubic`, `easeInOutBack`).
- To match an `html5` clip's GSAP ease: `easeOutQuad` ≈ `power1.out`, `easeOutCubic` ≈ `power2.out`, `easeOutQuart` ≈ `power3.out`.
- Give every tween a `start` and `length`. Before the first tween the value holds its `from`, and after the last it holds its `to`. A gap between tweens animates from one `to` to the next `from`, so set them equal to hold still.

### Combining built-in motion on one clip

- Keyframes move the whole rendered clip; a `rich-text` preset animates the text inside it. A `slideIn` plus an `offset` keyframe moves the text twice.
- Effects and transitions write their own `scale`, `offset` and `opacity` values over keyframes on the same property: a `fade` takes opacity to 0 at the clip's edge, and `zoomIn` ramps scale up from your keyframed value. Animate each property one way per clip.
- Keyframe times are relative to the clip's `start`, and a tween that runs past the clip's `length` is cut off.
- Footage, images and logos are scaled by `fit` first, and keyframe `scale` multiplies that, so a large scale on a low-resolution source shows its pixels.

## Easing available in html5

- **GSAP:** `none`, `steps(n)`, and `power1`–`power4`, `sine`, `circ`, `expo`, `back(overshoot)`, `elastic(amplitude, period)` and `bounce`, each as `.in`, `.out` or `.inOut`.
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

// character cascade: wrap each character in a <span class="c">; inline spans ignore transforms, so give .c display: inline-block
tl.from('#word .c', { opacity: 0, yPercent: 110, rotation: 12, duration: 0.5, ease: 'power4.out', stagger: 0.03 }, 1.6);

// elastic settle
tl.from('#price', { scale: 0, duration: 1.1, ease: 'elastic.out(1, 0.45)' }, 2.0);

// exit, overlapping the next beat
tl.to('#title, #sub', { opacity: 0, y: -12, duration: 0.33, ease: 'power2.in' }, '-=0.1');

// ambient loop: repeat: -1 makes the timeline endless, so add it last, at an absolute time
tl.to('#glow', { opacity: 0.4, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true }, 0);
```

### CSS equivalents (no JS)

```css
.el { animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }

/* staggered siblings */
.w:nth-child(1){animation-delay:0s}.w:nth-child(2){animation-delay:.08s}.w:nth-child(3){animation-delay:.16s}
```

## See also

- [`html5.md`](html5.md) — the html5 sandbox: seekable animation only, sizing, fonts, preloaded libraries
- [`html5-snippets.md`](html5-snippets.md) — ready-made clips to remix
- `shared/agent-core.md` → "Motion" — the compact summary (shared with the MCP server)
