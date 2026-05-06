---
name: shotstack
description: |
  Render video and poll render status via the Shotstack API.
  Use when generating clips, building automated video pipelines, or orchestrating
  cloud video renders from a script, agent, or CI workflow.
  NOT for: real-time streaming, or live broadcasting.
license: Apache-2.0
---

# Shotstack CLI

Two commands for the Shotstack video rendering API. `render` submits an Edit JSON and returns a render ID; `status` polls a render until done.

## Authentication

```sh
export SHOTSTACK_API_KEY=...
```

Get a key at <https://app.shotstack.io>. Without a key, every command exits with code 1.

## Environments

```
--env stage    → https://api.shotstack.io/edit/stage   (test credits, free)
--env v1       → https://api.shotstack.io/edit/v1      (production, default)
```

Use `--env stage` for experimentation. Stage is free; v1 charges real credits. Override with `SHOTSTACK_ENV` env var for the session.

## Quickstart

```sh
# Submit + poll in one command (most agent flows want this).
shotstack render template.json --watch
# → done  https://shotstack-api-v1-output.s3.amazonaws.com/.../01ja7-x8m2k-39rzv-cmvxve.mp4

# Submit only (returns ID).
shotstack render template.json --output json
# → {"id":"01ja7-x8m2k-39rzv-cmvxve"}

# Poll an existing render to terminal state.
shotstack status 01ja7-x8m2k-39rzv-cmvxve --watch
# → done  https://shotstack-api-v1-output.s3.amazonaws.com/.../01ja7-x8m2k-39rzv-cmvxve.mp4
```

## Hand-off to a human before rendering

When a human is in the loop and may want to tweak the result, prefer **`shotstack preview <file>`** over `shotstack render`. By default it opens the browser to `https://shotstack.studio/#json=<base64url>` and prints the URL — the timeline loads directly into the browser-based editor. No API call, no key, no charge. The human can play, edit, and decide whether to render — saving credits when the AI's first attempt isn't quite right.

```sh
shotstack preview template.json              # opens browser + prints URL
shotstack preview template.json --no-open    # headless: just print the URL
shotstack preview template.json --output json # piping: {"url":"..."}, no browser
```

On headless systems (no `xdg-open`, no `$DISPLAY`) the browser launch silently no-ops; the URL is still printed. Safe to run anywhere.

Use `render` only when you're confident the JSON is final, or there's no human to review.

## Four CLI rules

1. **Pipe → `--output json`.** Default output is human-readable. When parsing programmatically or piping to another command, always pass `--output json`.

2. **Use `--watch`, not a polling loop.** `shotstack render <file> --watch` submits and polls in one shot; `shotstack status <id> --watch` polls an existing render. Both exit when terminal: `done` (exit 0) or `failed` (exit 1). Don't write `while true; do ...; sleep 3; done`.

3. **Fetch the current schema and docs before generating Edit JSON.** The Shotstack API evolves; LLM training data is often stale. Pull <https://shotstack.io/docs/api/api.edit.json> and <https://shotstack.io/docs/guide/llms-full.txt> for the current schema and guides before composing an Edit from scratch.

4. **Hand off to a human via `preview` when uncertain.** Don't burn render credits iterating. Generate JSON → `shotstack preview` → human reviews/tweaks → render only when right.

## Authoring Edit JSON

These are the conventions agents most often get wrong. Read this section before generating any Edit JSON.

### Before composing JSON: check the schema

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

### Track ordering is REVERSED

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

### Smart clip strings

These string values are accepted in addition to numbers:

| Where | Value | Meaning |
|---|---|---|
| `clip.start` | `"auto"` | Start when the previous clip on the same track finishes |
| `clip.start` | `"alias://<name>"` | Inherit start from another clip with `alias: "<name>"` |
| `clip.length` | `"auto"` | Play for the full duration of the asset |
| `clip.length` | `"end"` | Play until the end of the timeline |
| `clip.length` | `"alias://<name>"` | Inherit length from another clip |

The `alias://` protocol is also used in `rich-caption` `src` to auto-transcribe a referenced audio/video clip — see `references/rich-caption.md`.

### Public HTTPS URLs only

All asset `src` URLs must be publicly accessible HTTPS. **No local file paths, no `data:` URIs, no signed URLs that expire mid-render.** The render workers fetch assets from the public internet.

For test renders without your own assets, use the placeholder library at <https://shotstack-assets.s3.amazonaws.com/> — see `references/asset-library.md`.

### Don't overlap clips on the same track

Clips on the same track must not have overlapping `start`/`length` ranges. Overlapping clips flicker because the engine can't decide which to display. Put parallel content on separate tracks.

### Output resolution

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

The render API supports many asset types. Use only the **current** ones; the deprecated ones still parse but should not be used in new templates.

### Current

| Type | Purpose |
|---|---|
| `video` | Video file (mp4, mov, webm). |
| `image` | Static image (jpg, png). |
| `audio` | Audio clip placed at a specific time on the timeline. |
| `rich-text` | Styled text overlay with full typography control. **Use this instead of `text`/`html`/`title`.** |
| `svg` | Vector graphics from raw SVG markup. See `references/svg.md`. |
| `rich-caption` | Word-level animated captions sourced from audio, video, or subtitle files. See `references/rich-caption.md`. |
| `luma` | Luma matte for masking effects. |
| `image-to-video` | **AI**: animate a still image into a short video clip. Billed per generation. |
| `text-to-image` | **AI**: generate an image from a text prompt. Billed per generation. |

`timeline.soundtrack` is a separate top-level field (not an asset type) for a single background music track. `timeline.fonts[]` is a separate field for custom font URLs.

### Deprecated — do not use

`text`, `title`, `caption`, `html`, `shape`. They still parse but produce inferior output. Replace with:

| If you'd use… | Use instead |
|---|---|
| `text` or `title` | `rich-text` |
| `caption` | `rich-caption` |
| `html` | `rich-text` |
| `shape` | `svg` with `<rect>`, `<circle>`, `<polygon>` etc. |

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
3. **Captions fill the whole frame.** A `rich-caption` clip without `width`, `height`, and `fit: "none"` covers the entire output. Use a named preset from `references/rich-caption.md`.
4. **`<text>` inside an SVG asset.** Raw `<text>` is unsupported. Use a `rich-text` asset for any text content; reserve SVG for shapes only.
5. **Composing custom caption styles when presets exist.** The five named presets (Nico, Kai, Kapow, Lovely Little Lychee, Rizz) cover the common styles. Use one verbatim from `references/rich-caption.md` unless the user asks for something specific.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Permanent error — validation, missing key, 4xx, render `failed` |
| `2` | Transient error — 5xx, network, timeout. Safe to retry. |

## References

Authoritative sources, in order of preference:

- `shotstack --help` and `shotstack <command> --help` — current CLI flag listing
- <https://shotstack.io/docs/api/api.edit.json> — OpenAPI Schema for the render API (machine-validatable)
- <https://shotstack.io/docs/guide/llms-full.txt> — full API docs in LLM-friendly single file
- <https://github.com/shotstack/oas-api-definition/tree/main/schemas> — raw OpenAPI YAML, source of truth for property names and enums
- <https://shotstack.io/docs/guide/> — interactive HTML docs and guides
- <https://shotstack.io/docs/api/> — interactive HTML API reference
- <https://github.com/shotstack/shotstack-cli> — CLI source

This skill ships sub-references for the gnarly bits:

- [`references/timeline.md`](references/timeline.md) — track layering, transitions, soundtrack vs audio
- [`references/rich-caption.md`](references/rich-caption.md) — sizing per resolution, default style, the 5 named presets, alias pattern
- [`references/svg.md`](references/svg.md) — required attrs, supported elements
- [`references/fonts.md`](references/fonts.md) — built-in fonts, Google Fonts URL pattern, custom-font workflow
- [`references/asset-library.md`](references/asset-library.md) — placeholder videos, images, music
- [`references/troubleshooting.md`](references/troubleshooting.md) — common errors and fixes

If this skill and `--help` ever disagree, trust `--help`. If this skill and `llms-full.txt` ever disagree, trust `llms-full.txt`.
