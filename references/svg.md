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

## Worked example: lower-third bar

```json
{
  "timeline": {
    "tracks": [
      {
        "clips": [{
          "asset": {
            "type": "rich-text",
            "text": "Jane Smith — CEO",
            "font": { "family": "JTUSjIg1_i6t8kCHKm45xW5rygbi49c", "size": 48, "color": "#ffffff" }
          },
          "start": 0, "length": 5,
          "offset": { "x": -0.2, "y": -0.35 }
        }]
      },
      {
        "clips": [{
          "asset": {
            "type": "svg",
            "src": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1920 200\" width=\"1920\" height=\"200\"><rect x=\"0\" y=\"0\" width=\"1920\" height=\"200\" fill=\"#000000\" fill-opacity=\"0.7\"/></svg>"
          },
          "start": 0, "length": 5,
          "offset": { "x": 0, "y": -0.35 }
        }]
      },
      {
        "clips": [{
          "asset": { "type": "video", "src": "https://shotstack-assets.s3.amazonaws.com/footage/beach.mp4" },
          "start": 0, "length": 5
        }]
      }
    ]
  },
  "output": { "format": "mp4", "resolution": "1080" }
}
```

Track order: text on top, semi-transparent black bar in the middle, video on the bottom.

## When to use SVG vs rich-text

| Need | Asset |
|---|---|
| Any words, letters, or characters | `rich-text` |
| Decorative shapes, lines, icons | `svg` |
| Animated text effects | `rich-text` (with the asset's animation properties) or `rich-caption` |
| Logo with shapes only | `svg` |
| Logo with text + shapes | `rich-text` for the text + `svg` for shapes, on adjacent tracks |
