# Troubleshooting

Common errors and the fix for each. **Catch most of them before rendering:** `shotstack validate <file>` checks an Edit against the schema and flags same-track overlaps, unloaded fonts and non-public URLs offline — no API key, no credits. If your error isn't here, run `shotstack feedback` to file a pre-filled GitHub issue with the render UUID attached — engineers can find server-side state in seconds.

## Contents

- "Unknown property: alignment" / wrong property names
- "Invalid option: expected one of top|middle|bottom"
- Video looks stretched / squishing after rendering
- "Font not found"
- Captions cover the whole frame
- Clips flicker / "clips overlap" on one track
- Timeline renders but layers are wrong
- "Invalid asset URL"
- html5 clip is blank but render succeeded
- "Render failed" with no other detail
- Render takes much longer than expected
- Credits exhausted on stage environment

## "Unknown property: alignment" (and similar)

You used a property name from CSS or HTML instinct — `alignment`, `font.name`, `duration` — instead of the Shotstack name.

**Fix:** the spec uses these exact names:

| You'd guess (wrong) | API uses (right) |
|---|---|
| `alignment` | `align` |
| `font.name` | `font.family` |
| `duration` | `length` |
| `transitions: [...]` (array) | `transition: { in, out }` (object) |

Always check <https://shotstack.io/docs/api/api.edit.json> (OpenAPI Schema) or <https://shotstack.io/docs/guide/llms-full.txt> before composing Edit JSON. Don't guess from CSS conventions.

## "Invalid option: expected one of top|middle|bottom"

You set `align.vertical` to `"center"` (CSS instinct). Shotstack's vertical enum is `top | middle | bottom`. Horizontal is `left | center | right` (the word "center" works there, just not for vertical).

**Fix:** use `"middle"` for vertical centering.

## Video looks stretched / squished after rendering

You used `fit: "cover"` from CSS instinct expecting it to scale-and-crop maintaining aspect ratio. Shotstack's `cover` does the opposite — it STRETCHES the asset to fill the viewport without maintaining aspect ratio.

The Shotstack `fit` enum is **inverted from CSS**:

| Shotstack value | Behaviour |
|---|---|
| `crop` (default) | Scale to fill, **maintaining aspect ratio**, crop excess. This is what CSS calls `object-fit: cover`. |
| `cover` | Stretch to fill, ignoring aspect ratio. This is what CSS calls `object-fit: fill`. |
| `contain` | Fit entirely within viewport, maintaining aspect ratio (letterbox). |
| `none` | No scaling. |

**Fix:** use `fit: "crop"` (or omit `fit` — `crop` is the default) for the typical "scale and crop" behaviour you'd expect from CSS `object-fit: cover`.

## "Font not found"

You used a font name that isn't in the built-in list and didn't load it via `timeline.fonts[]`.

**Fix:** add the font URL to `timeline.fonts[]` and use the file basename as `family`. See `references/fonts.md`. If you really need a system font, use `Roboto` (built-in) as a substitute.

## Captions cover the whole frame

A `rich-caption` clip without `width`, `height`, and `fit: "none"` defaults to filling the entire output.

**Fix:** use one of the five named presets in `references/caption.md` (Nico, Kai, Kapow, Lovely Little Lychee, Rizz) which include the right dimensions, or set `width`/`height`/`fit: "none"` explicitly on your clip.

## Clips flicker / "clips overlap" on one track

Two clips on the **same track** have overlapping `start`/`length` ranges, so the engine can't decide which to show — they flicker. This is the most common structural mistake when several elements appear at once (e.g. a title, a price and a button on an end card all at `start: 8`).

**Fix:** put anything visible at the same time on its **own track**. Sequential clips (one ends, the next begins — chain them with `"start": "auto"`) can share a track. `shotstack validate <file>` pinpoints the offending track and clip indices offline. See `shared/agent-core.md` → "Don't overlap clips on the same track" for a before/after.

## Timeline renders but layers are wrong

You assumed `tracks[0]` was the bottom layer.

**Fix:** reverse the track array. `tracks[0]` is the TOP layer; the last track is the BOTTOM. Captions and overlays go in early tracks; backgrounds go in late tracks. See `references/timeline.md`.

## "Invalid asset URL"

The `src` is not a public HTTPS URL, or it's a `data:` URI, or it's a local path, or the URL needs auth that isn't included.

**Fix:** host the asset at a public HTTPS URL or use a presigned URL with credentials in the URL itself. For tests, pull from `references/asset-library.md`.

## html5 clip is blank but render succeeded

An `html5` clip renders as a completely blank frame, but the render reports `status: "done"` with no error. This is a **silent failure** — there is no feedback loop.

Two causes:

1. **JS syntax error in `asset.js`.** A missing semicolon, unbalanced brace, or any other parse error crashes the entire script before any animation runs. `shotstack validate <file>` catches this offline — it runs each `asset.js` string through a syntax check and reports the error with the clip path. **Always validate before rendering.**

2. **JS runtime error.** Referencing a DOM element that doesn't exist (`document.getElementById("missing")`), calling a method on `null`, or any other uncaught exception — the script stops mid-execution and the clip stays in its initial state (typically invisible if elements start at `opacity:0`). These are not caught by `validate` (they require the runtime DOM). To debug, wrap suspect code in `try/catch` and log to a visible element, or simplify the JS to isolate the failing line.

A third variant: values stuck at `$0` or their initial state. This happens when `onUpdate` callbacks are used to mutate `textContent` — the seek harness doesn't fire `onUpdate`, so the DOM never updates. Bake final values into the HTML and animate opacity/transform instead. See `references/html5.md` → "The browser harness".

## "Render failed" with no other detail

`shotstack status <id> --output json` returns the full response including the error message. The `--watch` text view truncates.

```sh
shotstack status <id> --output json | jq .response.error
```

Then run `shotstack feedback` — the dossier captures the response body and the engineer can correlate against server-side logs in <30 seconds.

## Render takes much longer than expected

Renders containing AI-generation assets (`text-to-image`, `image-to-video`) take longer because the engine waits for the AI job to complete before rendering. Renders with very long source videos or many tracks also take longer.

**Fix:** if you're iterating quickly, render with `output.resolution: "preview"` first (512×288 @ 15fps) to validate the timeline shape before spending credits on full-resolution output.

## Credits exhausted on stage environment

The `stage` environment uses no credits, but you do require a positive credit balance to make use of the sandbox.

**Fix:** add more credits to your account. Check current credit balance at <https://app.shotstack.io>.

## Filing a useful bug report

`shotstack feedback` opens a pre-filled GitHub issue with:

- CLI version + OS
- Last 5 invocations (sanitised — no API key, no signed URL params)
- Render UUIDs and status responses

This dossier lets engineers find the server-side render state in seconds. **Always include the render UUID** when filing — without it, debugging is "user said it didn't work" with no way to reproduce.
