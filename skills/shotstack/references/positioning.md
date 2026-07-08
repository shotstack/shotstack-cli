# Positioning & coordinates

How `position`, `offset`, `width`/`height`, `scale`, and the transform fields place a clip in the frame. `shared/agent-core.md` carries the one-paragraph summary; this is the full reference.

## The coordinate model

`position` picks one of nine **anchor points** in the frame; `offset` then nudges the clip from that anchor. **`offset` is a fraction of the output frame — not pixels, and not a centred −1..+1 grid:**

- `offset.x` positive → **right** (a fraction of frame width); `offset.y` positive → **up** (a fraction of frame height). Note `y` is *up*-positive, the opposite of typical screen coordinates.
- `position:"center"` with `offset:{ "x":0, "y":0 }` sits dead centre. `offset:{ "x":0.5 }` moves half a frame-width right; `offset:{ "x":-1 }` moves a full frame-width left — off-screen.
- The field accepts ±10; anything past ±1 already moves the clip partly or fully out of frame (no error).

## Anchor points

`position` pins the clip's centre to the named point; `offset` shifts from there.

| | left edge | centre | right edge |
|---|---|---|---|
| **top edge** | `topLeft` | `top` | `topRight` |
| **middle** | `left` | `center` *(default)* | `right` |
| **bottom edge** | `bottomLeft` | `bottom` | `bottomRight` |

Example: `position:"topLeft"`, `offset:{ "x":0.05, "y":-0.05 }` → a 5% margin in from the top-left corner.

## Offset in numbers

On a 1920×1080 frame: `offset.x:0.1` → 192 px right; `offset.y:0.1` → 108 px up; `offset.x:-0.5` → 960 px left (half the frame). Because the shift scales with the frame, the same `offset` looks the same at any resolution.

## Sizing & fit (image / video)

Give a clip a `width`/`height` (pixels) to define a box; `fit` decides how the media fills it:

| `fit` | behaviour |
|---|---|
| `crop` *(default)* | fill the box, keep aspect ratio, crop the overflow |
| `contain` | fit entirely inside the box, keep aspect ratio, letterbox the gaps |
| `cover` | stretch to the box exactly — **distorts** if the aspect ratio differs |
| `none` | no scaling; crop to the box |

`scale` then multiplies the result (`1` = the fit result, `0.5` = half). `scale` is uniform on both axes — for a deliberate non-uniform stretch, use `fit:"cover"` with a `width`/`height`.

## Sizing text

Give a `rich-text` clip a `width`/`height` to set its text box: text wraps to that width, and `align` (`horizontal`: `left`/`center`/`right`; `vertical`: `top`/`middle`/`bottom`) positions the text inside it. **Without a `width`/`height`, the box defaults to the whole frame** — so `align` centres the text across the entire output and `position`/`offset` then move that full-frame block, which is rarely what you intend. Set `width`/`height` on any text you want placed precisely.

## Transforms

- `scale` — uniform multiplier (above).
- `transform.rotate.angle` — degrees clockwise; rotates around the clip's own centre, so it spins in place wherever you positioned it.
- `transform.skew.x` / `.y` — shear.
- `transform.flip.horizontal` / `.vertical` — mirror.
- `opacity` — `0`–`1`.

## Order of operations

`fit` (scale media into the box) → `position` (anchor) → `offset` (nudge) → `rotate` / `skew` → `scale`. Worth remembering when a result surprises you: scaling is applied last, around the positioned anchor.

## Common mistakes

1. **`offset.y` sign.** Positive `offset.y` moves **up**; use a negative value to move down.
2. **Expecting a centred −1..+1 grid.** There isn't one — `offset` is a fraction of the frame measured from the `position` anchor. `offset.x:-1` is a whole frame-width left, not "the left edge".
3. **`fit:"cover"` distorts.** It stretches to the box. Use `fit:"crop"` to fill while keeping aspect ratio.
4. **Unsized text.** A `rich-text` with no `width`/`height` fills the frame; set them to place text precisely.
5. **Offsets off-screen.** Past ±1 the clip leaves the frame silently — no error.
