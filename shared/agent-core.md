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

Clips on the same track must not have overlapping `start`/`length` ranges. Overlapping clips flicker because the engine can't decide which to display. Put parallel content on separate tracks.

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
| `video` | Video file (mp4, mov, webm). |
| `image` | Static image (jpg, png). |
| `audio` | Audio clip placed at a specific time on the timeline. |
| `rich-text` | Styled text overlay with full typography control. **Use this instead of `text`/`html`/`title`.** |
| `svg` | Vector graphics from raw SVG markup. See `references/svg.md`. |
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
| `html` | `rich-text` |
| `shape` | `svg` with `<rect>`, `<circle>`, `<polygon>` etc. |
| `timeline.soundtrack` | `audio` asset on its own track with `length: "end"` |

### AI-generated assets

`image-to-video`, `text-to-speech`, and `text-to-image` are billed per generation **even when invoked through the sandbox stage endpoint** (which is otherwise free). They are async — the render submits the AI job and waits. Renders containing AI assets take longer.

## Fonts

Prefer **custom Google Fonts via `timeline.fonts[]`** over the built-in font list. The Studio SDK exposes ~400 Google Fonts. See `references/fonts.md` for the URL pattern and the built-in fallback list.

Per the [Shotstack docs](https://shotstack.io/docs/guide/architecting-an-application/rich-text/#custom-fonts), custom fonts give you the full Google Fonts catalogue with predictable rendering. System fonts like `Arial`, `Helvetica`, and `Times New Roman` are NOT installed and will fail with "Font not found".

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
            "font": { "family": "JTUSjIg1_i6t8kCHKm45xW5rygbi49c", "size": 60, "color": "#ffffff" }
          },
          "start": 0, "length": 3
        }]
      }
    ]
  }
}
```

The `font.family` value is the **font file basename** (without `.ttf`/`.otf`).

## Top 5 mistakes

1. **Reverse track order.** `tracks[0]` is the TOP layer, not the bottom. Captions go in early tracks; backgrounds go in late tracks.
2. **System fonts.** `Arial`, `Helvetica`, `Times New Roman`, etc. are not installed. Use Google Fonts via `timeline.fonts[]` (preferred) or one of the built-in fonts in `references/fonts.md`.
3. **Captions fill the whole frame.** A `rich-caption` clip without `width`, `height`, and `fit: "none"` covers the entire output. Use a named preset from `references/caption.md`.
4. **`<text>` inside an SVG asset.** Raw `<text>` is unsupported. Use a `rich-text` asset for any text content; reserve SVG for shapes only.
5. **Composing custom caption styles when presets exist.** The five named presets (Nico, Kai, Kapow, Lovely Little Lychee, Rizz) cover the common styles. Use one verbatim from `references/caption.md` unless the user asks for something specific.

## Per-topic deep dives

For details beyond this core guide (rich-caption presets, SVG constraints, full font URL list, troubleshooting), see the `references/` directory in the Shotstack CLI repo or fetch the topic-specific docs from `https://shotstack.io/docs/guide/llms-full.txt`.
