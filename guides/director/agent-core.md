# Shotstack Agent Core

Universal Edit JSON authoring conventions. Read this **before composing any Edit JSON**. The conventions agents most often get wrong are listed here once. The same file ships with both the Shotstack CLI skill and the Shotstack MCP server.

## Before composing JSON: check the schema

Don't invent property names or enum values. The Shotstack schema is published — fetch one of these before composing JSON from scratch:

- <https://shotstack.io/docs/api/api.edit.json> — single-file OpenAPI Schema. Machine-validatable; load it once and validate locally instead of round-tripping the API.
- <https://shotstack.io/docs/api/> — interactive HTML reference. Fastest for human scanning.
- <https://shotstack.io/docs/guide/llms-full.txt> — single-file LLM-friendly version of the full guide + reference.
- <https://github.com/shotstack/oas-api-definition/tree/main/schemas> — raw OpenAPI YAML, source of truth.

The `rich-text` asset's styling fields look like CSS but aren't: CSS naming conventions (`alignment`, `vertical: "center"`) **do not** apply to them, or to clip properties. The spec uses precise names that often differ from web/CSS instincts. (An `html5` asset's `css` is ordinary CSS.)

| You'd guess (wrong) | API uses (right) | On |
|---|---|---|
| `alignment` | `align` | `rich-text` |
| `align: "center"` (a string) | `align: { "horizontal": "center", "vertical": "middle" }` (object) | `rich-text` |
| `align.vertical: "center"` | `align.vertical: "middle"` | `rich-text` |
| `font.name` | `font.family` | `rich-text` |
| `duration` | `length` | clip |
| `transitions: [...]` (array) | `transition: { in, out }` (object) | clip |
| `fit: "cover"` (CSS instinct: scale+crop maintaining aspect) | `fit: "crop"` — Shotstack's `cover` STRETCHES without maintaining aspect ratio | clip |

When the API rejects a property, the error message names the field — fix and retry. Don't guess twice.

## Track ordering is REVERSED

`timeline.tracks` is an array. **The first element (`tracks[0]`) is the TOP layer; the last element is the BOTTOM layer.** This is opposite to most z-index conventions.

> "Tracks are layered on top of each other in the same order they are added to the array with the top most track layered over the top of those below it." — [Shotstack docs](https://shotstack.io/docs/guide/architecting-an-application/guidelines/)

Practical rule: **put captions, overlays, and titles in early tracks; put video/image backgrounds in later tracks.**

```json
{
  "timeline": {
    "tracks": [
      { "clips": [/* TOP — captions */] },
      { "clips": [/* MIDDLE — title overlay */] },
      { "clips": [/* BOTTOM — background video */] }
    ]
  }
}
```

## Smart clip strings

These string values are accepted in addition to numbers:

| Where | Value | Meaning |
|---|---|---|
| `clip.start` | `"auto"` | Start when the previous clip on the same track finishes |
| `clip.start` | `"alias://<name>"` | Inherit start from another clip with `alias: "<name>"` |
| `clip.length` | `"auto"` | Asset's natural duration. Use for foreground (video, voiceover, scene). |
| `clip.length` | `"end"` | Until timeline ends, capped at asset duration. Use for background (music, captions, watermark). |
| `clip.length` | `"alias://<name>"` | Inherit length from another clip |

`"end"` does NOT loop short audio — use a numeric `length` if you need precise control.

The `alias://` protocol is also used in `rich-caption` `src` to auto-transcribe a referenced audio/video clip — see the captions guide.

## Public HTTPS URLs only

All asset `src` URLs must be publicly accessible HTTPS. **No local file paths, no `data:` URIs, no signed URLs that expire mid-render.** The render workers fetch assets from the public internet.

For test renders without your own assets, use the placeholder library at <https://shotstack-assets.s3.amazonaws.com/> — see the placeholder asset library.

## Don't overlap clips on the same track

Clips on the same track must not have overlapping `start`/`length` ranges — overlapping clips flicker because the engine can't decide which to display. **Anything visible at the same time goes on a separate track.** This is the most common structural mistake.

```jsonc
// WRONG — three simultaneous end-card lines on ONE track (all overlap 8.0–11.0)
{ "clips": [
  { "asset": { "type": "rich-text", "text": "TITLE" },    "start": 8.0, "length": 3 },
  { "asset": { "type": "rich-text", "text": "$395" },     "start": 8.0, "length": 3 },
  { "asset": { "type": "rich-text", "text": "SHOP NOW" }, "start": 8.0, "length": 3 }
] }

// RIGHT — one track each
"tracks": [
  { "clips": [ { "asset": { "type": "rich-text", "text": "TITLE" },    "start": 8.0, "length": 3 } ] },
  { "clips": [ { "asset": { "type": "rich-text", "text": "$395" },     "start": 8.0, "length": 3 } ] },
  { "clips": [ { "asset": { "type": "rich-text", "text": "SHOP NOW" }, "start": 8.0, "length": 3 } ] }
]
```

Sequential clips (one finishes, the next starts) **can** share a track — `"start": "auto"` chains them. A cross-fade needs two tracks with a small time overlap and a `transition` on each.

## Clip motion & rich-text fields (cheatsheet)

Compose from this rather than round-tripping the full schema — these are the values renders actually use.

**Clip-level (wraps any asset):**

| Field | Values |
|---|---|
| `fit` | `crop` (fill + crop, default — CSS `object-fit: cover`) · `contain` (letterbox) · `cover` (stretch, ignores aspect) · `none` |
| `position` | `center` `top` `bottom` `left` `right` `topLeft` `topRight` `bottomLeft` `bottomRight` |
| `offset` | `{ "x": <−1..1>, "y": <−1..1> }` — fraction of the canvas; **`y` positive = up** |
| `scale` / `opacity` | number (`1` = the fit result) / `0..1` |
| `effect` | Ken-Burns drift: `zoomIn` `zoomOut` `slideLeft` `slideRight` `slideUp` `slideDown` — each also `…Slow` / `…Fast` |
| `filter` | `blur` `boost` `contrast` `darken` `greyscale` `lighten` `muted` `negative` |
| `transition` | `{ "in": …, "out": … }` ↓ |

**`transition.in` / `.out`** — each also takes a `Slow`/`Fast` suffix (e.g. `fadeSlow`, `slideUpFast`):
`none` `fade` `reveal` `wipeLeft` `wipeRight` `slideLeft` `slideRight` `slideUp` `slideDown` `carouselLeft` `carouselRight` `carouselUp` `carouselDown` `shuffle*` (eight corners, e.g. `shuffleTopRight`) `zoom`.

**Keyframes** — `scale`, `opacity`, `offset.x`/`.y`, `transform.rotate.angle`, `transform.skew.x`/`.y`, an asset's `volume` and a video's `speed` take a Tween array in place of a number: `[{ "from": 1, "to": 3, "start": 0, "length": 1, "interpolation": "bezier", "easing": "easeInOut" }]`. `start` is seconds into the clip; `interpolation` defaults to `linear`. A `speed` array ramps playback without changing the clip's `length`: the source starts at `trim`, the first `from` holds before the first tween and the last `to` after the last, `0` freezes and a negative speed reverses.

**`rich-text` asset** — the styled-text workhorse (use instead of `text`/`title`):

```json
{
  "type": "rich-text",
  "text": "UTOPIA",
  "font": { "family": "<loaded-family>", "size": 160, "weight": "700", "color": "#141414", "opacity": 1 },
  "style": { "letterSpacing": 6, "lineHeight": 0.95, "textTransform": "uppercase", "textDecoration": "none" },
  "stroke": { "width": 3, "color": "#000000" },
  "shadow": { "offsetX": 0, "offsetY": 6, "blur": 18, "color": "#000000", "opacity": 0.4 },
  "background": { "color": "#ffffff", "opacity": 1, "borderRadius": 16 },
  "align": { "horizontal": "center", "vertical": "middle" },
  "animation": { "preset": "fadeIn", "duration": 0.6, "style": "word", "direction": "up" }
}
```

`align.horizontal` = `left|center|right`; `align.vertical` = `top|middle|bottom` (**not** `center`). `animation.preset` = `fadeIn` `slideIn` `typewriter` `ascend` `shift` `movingLetters`; `animation.style` = `character|word`; `animation.direction` = `left|right|up|down`. Give the clip a `width`/`height` box so text wraps and aligns where you expect.

For motion beyond this (kinetic type, value reveals, shine sweeps, grain, pulsing CTAs) reach for `html5` — see the HTML5 snippets.

## Motion

Timing, easing and rhythm are yours to design. Built-in motion takes fixed options from the schema; `html5` takes any seekable animation. Detail and recipes in the motion guide.

- **Seconds, not frames:** convert frame-based specs with `output.fps`.
- **Clip level, fixed options:** `transition` in/out (engine-fixed timing, `Slow`/`Fast` variants), `effect` (Ken Burns drift) and keyframe tweens on `scale`, `opacity`, `offset`, `rotate`, `skew`, `volume` and `speed` (see Keyframes above). Keyframe `interpolation` is `linear`, `bezier` or `constant`, and `easing` comes from a fixed list (`easeOutCubic`, `easeInOutBack`, …).
- **Combining on an existing asset:** keyframes move the whole clip while a `rich-text` preset animates the text inside it, so animate each property one way per clip. Keyframe `scale` multiplies `fit`, so a large scale on a low-resolution source shows its pixels.
- **rich-text `animation`** is entrance-only (exits use the clip `transition.out`) with engine-fixed easing. `style` works only on `typewriter`/`shift`; `direction` is required for `slideIn`/`ascend`/`shift`/`movingLetters`.
- **`html5`** gives full control: any seekable GSAP, anime.js, Lottie or CSS animation, any easing, per-element timing.
- **Brand once:** palette and font as top-level `merge[]` fields (`{{ink}}`, `{{accent}}`, `{{font}}`) resolve inside `html5` `html`/`css`/`js` too, so one edit re-skins the whole video.

## Positioning & coordinates

`position` picks one of nine anchor points (`center` default; `top` `bottom` `left` `right` `topLeft` `topRight` `bottomLeft` `bottomRight`); `offset` nudges from there. **`offset` is a fraction of the output frame, not a centred −1..+1 grid:** `offset.x` positive → right (× frame width), `offset.y` positive → **up** (× frame height). Range is ±10; anything past ±1 pushes the clip off-frame.

Clip-level `width`/`height` (pixels) define a bounding box. For `image`/`video`, `fit` fills it — `crop` (keep aspect, crop overflow) · `contain` (letterbox) · `cover` (**stretch, distorts**) · `none`. For `rich-text`, that same clip box sets the text-wrap width and the area `align` positions within — **size text on the clip, not the asset.** Without `width`/`height` a clip fills the frame, so unsized text centres across the whole output. `scale` then multiplies the result (uniform on both axes).

Order of operations: fit → position → offset → rotate → scale. Full reference: the positioning guide.

## Output resolution

Pick `output.resolution` (preset) OR `output.size.width`+`output.size.height` (custom):

| Preset | Pixels @ fps |
|---|---|
| `preview` | 512×288 @ 15 |
| `mobile` | 640×360 @ 25 |
| `sd` | 1024×576 @ 25 |
| `hd` | 1280×720 @ 25 (default) |
| `1080` | 1920×1080 @ 25 |

Custom sizes must be divisible by 2.

## Asset types

Use only the **current** asset types; the deprecated ones still parse but should not be used in new templates.

### Current

| Type | Purpose |
|---|---|
| `video` | Video file (mp4, mov, webm), or AI-generated from a `prompt`. |
| `image` | Static image — `jpg`, `png`, `webp`, `gif`, `bmp`, `tiff` — or AI-generated from a `prompt`. |
| `audio` | Audio clip placed at a specific time on the timeline, or AI-generated speech or music from a `prompt`. |
| `rich-text` | Styled text overlay with full typography control. **Use this instead of `text`/`html`/`title`.** |
| `svg` | Vector graphics from raw SVG markup: `src` starts with `<svg`, never a URL or `data:` URI (the render fails). See **`svg` assets** below. |
| `html5` | Self-contained HTML/CSS/JS page rendered in an iframe (motion graphics, charts, animated overlays). Preloads gsap with its plugins (SplitText, DrawSVG, MorphSVG, MotionPath, Flip and more), d3, anime and lottie. See the HTML5 guide. **Never use the deprecated `html` asset.** |
| `rich-caption` | Word-level animated captions sourced from audio, video, or subtitle files. See the captions guide. |
| `luma` | Luma matte for masking effects. |

`timeline.fonts[]` is a separate field for custom font URLs (not an asset type).

For background music, **use an `audio` asset on its own track** with `length: "end"`. Do NOT use `timeline.soundtrack` — it is deprecated. The audio asset path supports keyframes, custom timing, fades, and effects; soundtrack does not.

### Deprecated — do not use

`text`, `title`, `caption`, `html`, `shape`. They still parse but produce inferior output. `text-to-image`, `image-to-video` and `text-to-speech` still work, rewritten internally to the generated assets below. Replace with:

| If you'd use… | Use instead |
|---|---|
| `text` or `title` | `rich-text` |
| `caption` | `rich-caption` |
| `html` | `html5` (for motion graphics or animated overlays) or `rich-text` (for static styled text) |
| `shape` | `svg` with `<rect>`, `<circle>`, `<polygon>` etc. |
| `timeline.soundtrack` | `audio` asset on its own track with `length: "end"` |
| `text-to-image`, `image-to-video`, `text-to-speech` | `image`, `video` or `audio` with `prompt` and `model` (below) |

### `svg` assets

`src` **is the SVG markup itself**, starting with `<svg`. Never a URL and never a data URI (`data:image/svg+xml;…`, base64 or URL-encoded): those fail to parse, so Studio shows an empty placeholder and the rendered video leaves the shape out. Write colours as plain `#hex`, not `%23`. `data:` URIs belong inside `html5` assets only.

Every `src` must include `xmlns="http://www.w3.org/2000/svg"`, a `viewBox`, and `width` and `height` in pixels. Without them the renderer can't size or place the shape.

```json
{
  "asset": {
    "type": "svg",
    "src": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\"><circle cx=\"100\" cy=\"100\" r=\"90\" fill=\"#142033\" stroke=\"#F2C14E\" stroke-width=\"6\"/></svg>"
  },
  "start": 0,
  "length": 3,
  "width": 200,
  "height": 200
}
```

- **Supported:** `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polygon>`, `<polyline>`, `<g>`, with `fill`, `fill-opacity`, `stroke`, `stroke-width`, `stroke-opacity` and `transform`.
- **Unsupported:** `<text>` (use `rich-text`), `<image>` (use `image`), `<animate>`/`<animateTransform>` (animate the clip instead; only the first frame renders), `<foreignObject>`, most `<filter>`s, and external `<use>` references.
- A plain coloured box behind text doesn't need SVG: `rich-text` has `background.color`, `opacity` and `borderRadius`. Use SVG for shapes rich-text can't draw, such as badges, rings, dividers and speech bubbles.

### AI-generated assets

Set `prompt` and `model` on an `image`, `video` or `audio` asset and it is generated at render time. `options` configures the model, and a `src` you set is only a preview placeholder that the generated file replaces. For speech, the prompt is the words to speak.

```json
{ "asset": { "type": "video", "prompt": "Slow dolly across a rain-soaked neon street at night", "model": "seedance-2.0-text-to-video", "options": { "resolution": "720p" } }, "start": 0, "length": 5 }
```

Options outside that schema are rejected. To animate a still, use an image-to-video model and put the image URL in `options.startSrc` (`inputSrc` on the original image-to-video models).

Generation is billed per asset **even on the stage endpoint**, which is otherwise free. Renders containing AI assets take longer, because the render waits for each generation.

## The design ladder — escalate from rich-text to html5

One overlay is a `rich-text` job. **Several videos "in different styles" is not** — making them all `rich-text` ships one look eight times. Match the asset to the ambition:

| Level | Asset | Use for |
|---|---|---|
| 1 — type & layout | `rich-text` | Titles, lower-thirds, kickers, captions, price/CTA pills. Fast and reliable; the right default for static styled text. |
| 2 — shapes | `svg` | Colour panels, rules, badges, frames, geometric accents behind or around type. |
| 3 — motion graphics | `html5` | Kinetic type, value reveals, shine sweeps, animated gradients, film grain, masked reveals, data-driven overlays — anything that should *move* beyond a `transition` or a Ken-Burns `effect`. gsap and its plugins, anime, d3 and lottie are preloaded. See the HTML5 guide, the effects palette in the HTML5 effects palette, and the copy-paste clips in the HTML5 snippets. |

**When the brief asks for a *range*, deliberately spread across the ladder.** A strong set: a couple of clean `rich-text` studio cuts, one or two `svg` colour-block promos, and several `html5` pieces carrying the real motion (kinetic headline, value reveal, shine-swept CTA, grain-graded teaser). If every clip in a "variety" brief is `rich-text`, you have not delivered variety.

## Fonts

Use **custom Google Fonts via `timeline.fonts[]`**. System fonts (`Arial`, `Helvetica`, `Times New Roman`) are NOT installed; text set in them renders in Roboto, with no render error.

**CRITICAL: Do NOT construct or fabricate Google Fonts URLs from memory.** Google rotates them (`v26 → v31 → ...`) and the hash filenames change with each version. Any URL you reconstruct from training data is almost certainly a 404. **Use ONLY the verified entries below, copied verbatim.**

### Verified font catalogue (12 fonts)

Paste the **url** into `timeline.fonts[].src`, paste the **family** into `asset.font.family`.

| Font (style) | family (use in `font.family`) | url (use in `timeline.fonts[].src`) |
|---|---|---|
| Inter (sans, variable) | `UcCo3FwrK3iLTfvlaQc78lA2` | `https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTfvlaQc78lA2.ttf` |
| Roboto (sans, variable) | `KFOmCnqEu92Fr1Me5WZLCzYlKw` | `https://fonts.gstatic.com/s/roboto/v50/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf` |
| Open Sans (sans, variable) | `mem8YaGs126MiZpBA-U1UpcaXcl0Aw` | `https://fonts.gstatic.com/s/opensans/v44/mem8YaGs126MiZpBA-U1UpcaXcl0Aw.ttf` |
| Montserrat (sans, variable) | `JTUSjIg1_i6t8kCHKm45xW5rygbi49c` | `https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm45xW5rygbi49c.ttf` |
| Poppins (sans) | `pxiEyp8kv8JHgFVrFJDUc1NECPY` | `https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJDUc1NECPY.ttf` |
| DM Sans (sans, variable) | `rP2Hp2ywxg089UriOZSCHBeHFl0` | `https://fonts.gstatic.com/s/dmsans/v17/rP2Hp2ywxg089UriOZSCHBeHFl0.ttf` |
| Nunito (sans, variable) | `XRXV3I6Li01BKof4MuyAbsrVcA` | `https://fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKof4MuyAbsrVcA.ttf` |
| Raleway (sans, variable) | `1Ptug8zYS_SKggPN-CoCTqluHfE` | `https://fonts.gstatic.com/s/raleway/v37/1Ptug8zYS_SKggPN-CoCTqluHfE.ttf` |
| Oswald (display, variable) | `TK3iWkUHHAIjg75GHjUHte5fKg` | `https://fonts.gstatic.com/s/oswald/v57/TK3iWkUHHAIjg75GHjUHte5fKg.ttf` |
| Bebas Neue (display) | `JTUSjIg69CK48gW7PXooxW5rygbi49c` | `https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW5rygbi49c.ttf` |
| Anton (display) | `1Ptgg87LROyAm0K08i4gS7lu` | `https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm0K08i4gS7lu.ttf` |
| Playfair Display (serif, variable) | `nuFiD-vYSZviVYUb_rj3ij__anPXPTvSgWE_-xU` | `https://fonts.gstatic.com/s/playfairdisplay/v40/nuFiD-vYSZviVYUb_rj3ij__anPXPTvSgWE_-xU.ttf` |

Variable fonts cover the full weight range (100–900) from a single URL — set `font.weight` on the clip. Poppins, Bebas Neue and Anton aren't variable: the listed URL is the 400 weight.

Never invent or hand-edit a font URL. If a font isn't listed and you can't copy its exact entry, use the closest listed font.

### Usage example

```json
{
  "timeline": {
    "fonts": [
      { "src": "https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm45xW5rygbi49c.ttf" }
    ],
    "tracks": [
      {
        "clips": [{
          "asset": {
            "type": "rich-text",
            "text": "Hello",
            "font": { "family": "JTUSjIg1_i6t8kCHKm45xW5rygbi49c", "size": 60, "weight": "700", "color": "#ffffff" }
          },
          "start": 0, "length": 3
        }]
      }
    ]
  }
}
```

Use the `family` column from the table above: the URL's filename without `.ttf`, matched ignoring case. The family name stored inside the font file also matches, but it isn't always the name on Google Fonts (Space Grotesk's file calls itself `Space Grotesk Light`), so the filename is the safe choice. A `font.family` that matches nothing renders in Roboto with no error. The exception is a lone entry in `timeline.fonts[]`, which is used whatever `font.family` says, so a wrong name only shows once a second font is added.

## Top 5 mistakes

1. **Reverse track order.** `tracks[0]` is the TOP layer, not the bottom. Captions go in early tracks; backgrounds go in late tracks.
2. **System fonts.** `Arial`, `Helvetica`, `Times New Roman`, etc. are not installed. Use Google Fonts via `timeline.fonts[]`, copied verbatim from the verified catalogue in the Fonts section.
3. **Captions fill the whole frame.** A `rich-caption` clip without `width`, `height`, and `fit: "none"` covers the entire output. Use a named preset from the captions guide.
4. **`<text>` inside an SVG asset.** Raw `<text>` is unsupported. Use a `rich-text` asset for any text content; reserve SVG for shapes only.
5. **Composing custom caption styles when presets exist.** The five named presets (Nico, Kai, Kapow, Lovely Little Lychee, Rizz) cover the common styles. Use one verbatim from the captions guide unless the user asks for something specific.

## Per-topic deep dives

For details beyond this core guide (rich-caption presets, SVG constraints, full font URL list, troubleshooting), fetch the topic-specific docs from `https://shotstack.io/docs/guide/llms-full.txt`.
