# Shotstack Agent Core

Universal Edit JSON authoring conventions. Read this **before composing any Edit JSON**. The conventions agents most often get wrong are listed here once. The same file ships with both the Shotstack CLI skill and the Shotstack MCP server.

## Before composing JSON: check the schema

Don't invent property names or enum values. The Shotstack schema is published — fetch one of these before composing JSON from scratch:

- <https://shotstack.io/docs/api/api.edit.json> — single-file OpenAPI Schema. Machine-validatable; load it once and validate locally instead of round-tripping the API.
- <https://shotstack.io/docs/api/> — interactive HTML reference. Fastest for human scanning.
- <https://shotstack.io/docs/guide/llms-full.txt> — single-file LLM-friendly version of the full guide + reference.
- <https://github.com/shotstack/oas-api-definition/tree/main/schemas> — raw OpenAPI YAML, source of truth.

CSS naming conventions (`alignment`, `vertical: "center"`) **do not** apply. The spec uses precise names that often differ from web/CSS instincts:

| You'd guess (wrong) | API uses (right) |
|---|---|
| `alignment` | `align` |
| `align: "center"` (string on rich-text asset) | `align: { "horizontal": "center", "vertical": "middle" }` (object) |
| `align.vertical: "center"` | `align.vertical: "middle"` |
| `font.name` | `font.family` |
| `duration` | `length` |
| `transitions: [...]` (array) | `transition: { in, out }` (object) |
| `fit: "cover"` (CSS instinct: scale+crop maintaining aspect) | `fit: "crop"` — Shotstack's `cover` STRETCHES without maintaining aspect ratio |

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

The `alias://` protocol is also used in `rich-caption` `src` to auto-transcribe a referenced audio/video clip — see `references/caption.md`.

## Public HTTPS URLs only

All asset `src` URLs must be publicly accessible HTTPS. **No local file paths, no `data:` URIs, no signed URLs that expire mid-render.** The render workers fetch assets from the public internet.

For test renders without your own assets, use the placeholder library at <https://shotstack-assets.s3.amazonaws.com/> — see `references/asset-library.md`.

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

**Validate before you render:** `shotstack validate <file>` catches same-track overlaps — plus unloaded fonts, non-public `src` URLs, and wrong property names/enums — offline, no API key, no credits.

## Clip motion & rich-text fields (cheatsheet)

Compose from this rather than round-tripping the full schema — these are the values renders actually use. (`api.edit.json` stays authoritative; `shotstack validate` checks against it.)

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

For motion beyond this (kinetic type, value reveals, shine sweeps, grain, pulsing CTAs) reach for `html5` — see [`references/html5-snippets.md`](../references/html5-snippets.md).

## Motion language (house tokens)

Compose motion from a **closed set of tokens** so a multi-clip edit feels like one production, not eight unrelated effects. **Don't invent a new easing or duration per clip.** Full recipes (GSAP/CSS, choreography, brand kit) in [`references/motion.md`](../references/motion.md).

- **Durations (seconds):** `instant 0.2 · fast 0.33 · base 0.6 · slow 0.8 · slower 1.0 · hold 1.5`. Entrances default to **`base` (0.6)**; **exits are faster** (`fast`).
- **One house ease, no overshoot:** html5 GSAP `power3.out` (in) / `power2.in` (out); CSS `cubic-bezier(0.16, 1, 0.3, 1)`. Never raw `linear` for tracked motion. A gentle `back.out(1.4)` is reserved for **one** hero element per scene — calm is the default.
- **One stagger:** `0.13s` between siblings (GSAP `stagger: 0.13`; CSS `animation-delay` steps).
- **Restraint:** translate 12–24 px (not 80), scale ≥ 0.92, one focal element per moment, let a reveal settle (`hold`) before it cuts.
- **rich-text `animation`** (entrance-only — exits use the clip `transition.out`): set `duration` from the scale (e.g. `0.6`); `preset:"ascend"` + `direction:"up"` is the rise-and-fade workhorse; for a word cascade use `preset:"shift"` + `style:"word"` + `direction:"up"` (`style` works only on `typewriter`/`shift`; `direction` is required for `slideIn`/`ascend`/`shift`/`movingLetters`).
- **Brand once:** put palette/font in top-level `merge[]` (`{{ink}}`, `{{accent}}`, `{{font}}`) and reference them in every clip — one edit re-skins the whole video. Accent used sparingly.

## Positioning & coordinates

`position` picks one of nine anchor points (`center` default; `top` `bottom` `left` `right` `topLeft` `topRight` `bottomLeft` `bottomRight`); `offset` nudges from there. **`offset` is a fraction of the output frame, not a centred −1..+1 grid:** `offset.x` positive → right (× frame width), `offset.y` positive → **up** (× frame height). Range is ±10; anything past ±1 pushes the clip off-frame.

Clip-level `width`/`height` (pixels) define a bounding box. For `image`/`video`, `fit` fills it — `crop` (keep aspect, crop overflow) · `contain` (letterbox) · `cover` (**stretch, distorts**) · `none`. For `rich-text`, that same clip box sets the text-wrap width and the area `align` positions within — **size text on the clip, not the asset.** Without `width`/`height` a clip fills the frame, so unsized text centres across the whole output. `scale` then multiplies the result (uniform on both axes).

Order of operations: fit → position → offset → rotate → scale. Full reference: [`references/positioning.md`](../references/positioning.md).

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

## Merge fields

Top-level `merge[]` (sibling of `timeline`/`output`, NOT a clip property) is a simple find-and-replace that runs over the entire Edit JSON **before** any asset is processed. Each entry is `{ "find": "<TOKEN>", "replace": "<value>" }` — the `find` value is the token name **without** braces; every `{{TOKEN}}` occurrence in any string throughout the Edit is swapped for the value.

```json
{
  "merge": [
    { "find": "TITLE",   "replace": "Q4 Results" },
    { "find": "REVENUE", "replace": "$1,247,890" },
    { "find": "ACCENT",  "replace": "#22D3EE" }
  ],
  "timeline": {
    "tracks": [{
      "clips": [{
        "asset": { "type": "rich-text", "text": "{{TITLE}}", "font": { "family": "Roboto", "size": 60, "color": "{{ACCENT}}" } },
        "start": 0, "length": 3
      }]
    }]
  },
  "output": { "format": "mp4", "resolution": "1080" }
}
```

**Rules:**
- Whitespace inside braces is ignored: `{{ TITLE }}` and `{{TITLE}}` are the same token.
- Token names are **case sensitive**. Use `UPPER_SNAKE_CASE` (the Shotstack convention).
- The `{{` delimiter cannot be changed.
- One `merge[]` entry can replace multiple `{{TOKEN}}` occurrences across the entire Edit.
- The replacement is a dumb string swap — no conditionals, no loops, no escaping.

**Where merge fields resolve:** every string value in the Edit JSON — `rich-text` `text` and `font.color`; `html5` `html`, `css`, and `js`; `svg` markup; `asset.src` URLs; `clip.transition` names; any string anywhere. This is an Edit-wide capability, not an html5 feature.

**When to use merge vs baking at generation time:**

| Scenario | Use |
|---|---|
| Reusable template rendered many times with different data (reports, personalised videos, per-user wraps) | `merge[]` — keep one Edit JSON, swap the `merge[]` per render |
| Brand re-skinning (palette, font, accent across every clip) | `merge[]` — change one `merge[]` entry to re-skin the whole video |
| One-off render or data unique to a single video | Bake values directly into the asset at generation time — simpler, no merge indirection |
| Generating multiple edits programmatically (e.g. one per user from a CSV) | Either — merge keeps the template reusable, baking is more direct. If the template won't be reused, bake. |

**Checking merge results:** pass `?data=true&merged=true` on the status request to see the merged Edit JSON in the response — useful for debugging unresolved placeholders.

**Validate caveat:** `shotstack validate` checks `html5` JS syntax **before** merge resolution. A `{{TOKEN}}` inside a JS string literal (e.g. `color: "{{ACCENT}}"`) is valid JS and passes. A `{{TOKEN}}` in JS *code* position (not inside a string) may fail validation pre-merge but work at render time post-merge — keep merge fields inside string literals to avoid false positives.

## Asset types

Use only the **current** asset types; the deprecated ones still parse but should not be used in new templates.

### Current

| Type | Purpose |
|---|---|
| `video` | Video file (mp4, mov, webm). |
| `image` | Static image — `jpg`, `png`, `webp`, `gif`, `bmp`, `tiff`. |
| `audio` | Audio clip placed at a specific time on the timeline. |
| `rich-text` | Styled text overlay with full typography control. **Use this instead of `text`/`html`/`title`.** |
| `svg` | Vector graphics from raw SVG markup. See `references/svg.md`. |
| `html5` | Self-contained HTML/CSS/JS page rendered in an iframe (motion graphics, charts, animated overlays). Preloads gsap/d3/anime/lottie. See `references/html5.md`. **Never use the deprecated `html` asset.** |
| `rich-caption` | Word-level animated captions sourced from audio, video, or subtitle files. See `references/caption.md`. |
| `luma` | Luma matte for masking effects. |
| `image-to-video` | **AI**: animate a still image into a short video clip. Billed per generation. |
| `text-to-image` | **AI**: generate an image from a text prompt. Billed per generation. |
| `text-to-speech` | **AI**: generate speech from a text prompt. Billed per generation. |

`timeline.fonts[]` is a separate field for custom font URLs (not an asset type).

For background music, **use an `audio` asset on its own track** with `length: "end"`. Do NOT use `timeline.soundtrack` — it is deprecated. The audio asset path supports keyframes, custom timing, fades, and effects; soundtrack does not.

### Deprecated — do not use

`text`, `title`, `caption`, `html`, `shape`. They still parse but produce inferior output. Replace with:

| If you'd use… | Use instead |
|---|---|
| `text` or `title` | `rich-text` |
| `caption` | `rich-caption` |
| `html` | `html5` (for motion graphics or animated overlays) or `rich-text` (for static styled text) |
| `shape` | `svg` with `<rect>`, `<circle>`, `<polygon>` etc. |
| `timeline.soundtrack` | `audio` asset on its own track with `length: "end"` |

### AI-generated assets

`image-to-video`, `text-to-speech`, and `text-to-image` are billed per generation **even when invoked through the sandbox stage endpoint** (which is otherwise free). They are async — the render submits the AI job and waits. Renders containing AI assets take longer.

## The design ladder — escalate from rich-text to html5

One overlay is a `rich-text` job. **Several videos "in different styles" is not** — making them all `rich-text` ships one look eight times. Match the asset to the ambition:

| Level | Asset | Use for |
|---|---|---|
| 1 — type & layout | `rich-text` | Titles, lower-thirds, kickers, captions, price/CTA pills. Fast and reliable; the right default for static styled text. |
| 2 — shapes | `svg` | Colour panels, rules, badges, frames, geometric accents behind or around type. |
| 3 — motion graphics | `html5` | Kinetic type, value reveals, shine sweeps, animated gradients, film grain, masked reveals, data-driven overlays — anything that should *move* beyond a `transition` or a Ken-Burns `effect`. gsap / anime / d3 / lottie are preloaded. See [`references/html5.md`](../references/html5.md) and the copy-paste clips in [`references/html5-snippets.md`](../references/html5-snippets.md). |

**When the brief asks for a *range*, deliberately spread across the ladder.** A strong set: a couple of clean `rich-text` studio cuts, one or two `svg` colour-block promos, and several `html5` pieces carrying the real motion (kinetic headline, value reveal, shine-swept CTA, grain-graded teaser). Reserve the elaborate `html5` treatments for the hero / hype cuts where motion sells the product. If every clip in a "variety" brief is `rich-text`, you have not delivered variety.

## Fonts

Use **custom Google Fonts via `timeline.fonts[]`**. System fonts (`Arial`, `Helvetica`, `Times New Roman`) are NOT installed and will fail with "Font not found".

**CRITICAL: Do NOT construct or fabricate Google Fonts URLs from memory.** Google rotates them (`v26 → v31 → ...`) and the hash filenames change with each version. Any URL you reconstruct from training data is almost certainly a 404. **Use ONLY the verified entries below, copied verbatim.**

See `references/fonts.md` for how to source fonts from the Studio SDK catalogue and the built-in fallback fonts.

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

The `font.family` value MUST match the `family` column in the table above (it's the filename basename without `.ttf`). If `family` and the URL's basename don't match, the font will not load.

## Top 5 mistakes

1. **Reverse track order.** `tracks[0]` is the TOP layer, not the bottom. Captions go in early tracks; backgrounds go in late tracks.
2. **System fonts.** `Arial`, `Helvetica`, `Times New Roman`, etc. are not installed. Use Google Fonts via `timeline.fonts[]` (preferred) or one of the built-in fonts in `references/fonts.md`.
3. **Captions fill the whole frame.** A `rich-caption` clip without `width`, `height`, and `fit: "none"` covers the entire output. Use a named preset from `references/caption.md`.
4. **`<text>` inside an SVG asset.** Raw `<text>` is unsupported. Use a `rich-text` asset for any text content; reserve SVG for shapes only.
5. **Composing custom caption styles when presets exist.** The five named presets (Nico, Kai, Kapow, Lovely Little Lychee, Rizz) cover the common styles. Use one verbatim from `references/caption.md` unless the user asks for something specific.

## Per-topic deep dives

For details beyond this core guide (rich-caption presets, SVG constraints, full font URL list, troubleshooting), see the `references/` directory in the Shotstack CLI repo or fetch the topic-specific docs from `https://shotstack.io/docs/guide/llms-full.txt`.
