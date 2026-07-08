# SVG asset guide

The `svg` asset type embeds raw SVG markup into a clip. Use it for vector shapes, icons, and decorative elements. **Use `rich-text` for any text content** — SVG `<text>` is unsupported.

## Contents

- Required attributes
- Supported elements
- Unsupported elements (and what to use instead)
- Worked example

## Required attributes

Every SVG asset's `src` is raw markup (not a URL) and **must include all four** of:

- `xmlns="http://www.w3.org/2000/svg"`
- `viewBox` defining the coordinate space
- `width` (in pixels)
- `height` (in pixels)

```json
{
  "asset": {
    "type": "svg",
    "src": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1280 720\" width=\"1280\" height=\"720\"><circle cx=\"640\" cy=\"360\" r=\"80\" fill=\"#e74c3c\"/></svg>"
  }
}
```

Without these, the renderer can't size or position the SVG.

## Supported elements

The renderer understands these SVG primitives:

- `<path>` — arbitrary vector paths via `d` attribute
- `<rect>` — rectangles
- `<circle>` — circles
- `<ellipse>` — ellipses
- `<line>` — straight lines
- `<polygon>` — closed polygons
- `<polyline>` — open polygonal lines
- `<g>` — grouping (for transforms applied to multiple shapes)

Standard fill, stroke, and transform attributes work: `fill`, `fill-opacity`, `stroke`, `stroke-width`, `stroke-opacity`, `transform`.

## Unsupported elements

| Element | Use instead |
|---|---|
| `<text>` | `rich-text` asset |
| `<image>` | `image` asset |
| `<animate>`, `<animateTransform>` | Static SVG; use clip-level `transform` for motion |
| `<foreignObject>` | Not supported |
| `<filter>` (most filters) | Apply effects via clip-level properties or post-process |
| External `<use>` references | Inline the markup |

Animated SVGs are not rendered — only the static initial frame is used.

## Worked example: speech bubble for a testimonial

Speech bubbles are an example "rich-text can't do this" case — a rounded body with a tail pointing at the speaker requires a `<path>`. Pair the SVG bubble with a `rich-text` clip for the quote inside it.

```json
{
  "timeline": {
    "tracks": [
      {
        "clips": [
          {
            "asset": {
              "type": "rich-text",
              "text": "This changed our workflow completely.",
              "font": {
                "family": "JTUSjIg1_i6t8kCHKm45xW5rygbi49c",
                "size": 44,
                "color": "#0f172a",
                "weight": 600
              },
              "align": {
                "horizontal": "center",
                "vertical": "middle"
              }
            },
            "start": 0.5,
            "length": 4,
            "width": 540,
            "height": 160,
            "offset": {
              "x": 0.235,
              "y": 0.373
            }
          }
        ]
      },
      {
        "clips": [
          {
            "asset": {
              "type": "svg",
              "src": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 600 220\" width=\"600\" height=\"220\"><path d=\"M 40 0 H 560 Q 600 0 600 40 V 140 Q 600 180 560 180 H 200 L 160 220 L 170 180 H 40 Q 0 180 0 140 V 40 Q 0 0 40 0 Z\" fill=\"#ffffff\" stroke=\"#0f172a\" stroke-width=\"4\"/></svg>"
            },
            "start": 0.5,
            "length": 4,
            "width": 600,
            "height": 220,
            "offset": {
              "x": 0.235,
              "y": 0.356
            },
            "transition": {
              "in": "fade",
              "out": "fade"
            }
          }
        ]
      },
      {
        "clips": [
          {
            "asset": {
              "type": "image",
              "src": "https://shotstack-assets.s3.amazonaws.com/images/business-man.jpg"
            },
            "start": 0,
            "length": 5,
            "fit": "crop"
          }
        ]
      }
    ]
  },
  "output": {
    "format": "mp4",
    "resolution": "1080"
  }
}
```

Track order: rich-text quote on top, SVG bubble in the middle, talking-head video at the bottom. The `<path>` `d` attribute draws a rounded rectangle (40px corner radius via `Q` curves) with a triangular tail at the bottom pointing toward the speaker. `stroke` gives the bubble an outline; `fill="#ffffff"` makes the body opaque.

Position the bubble with `offset` so the tail points at the subject's head. Adjust the path's tail coordinates (`L 160 220 L 170 180`) to point left/right/up depending on where the speaker is in frame.

Other patterns SVG is right for:

- **Tutorial highlight rings** — `<circle>` with `fill="none"` and a thick `stroke`, positioned over a UI element.
- **Brand badges** — small geometric lockups using `<rect>`/`<polygon>` plus `transform`.
- **Decorative dividers** — wavy lines or geometric frames between scenes.

If you only need a coloured rectangle behind text, **don't reach for SVG** — `rich-text` already supports `background.color`/`opacity`/`borderRadius`. Reserve SVG for shapes rich-text can't produce.

## When to use SVG vs rich-text

| Need | Asset |
|---|---|
| Any words, letters, or characters | `rich-text` |
| Decorative shapes, lines, icons | `svg` |
| Animated text effects | `rich-text` (with the asset's animation properties) or `rich-caption` |
| Logo with shapes only | `svg` |
| Logo with text + shapes | `rich-text` for the text + `svg` for shapes, on adjacent tracks |
