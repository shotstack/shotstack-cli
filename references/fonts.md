# Fonts guide

The Shotstack render engine ships a small built-in font set; everything else must be loaded as a custom font via `timeline.fonts[]`. Per the [Shotstack docs](https://shotstack.io/docs/guide/architecting-an-application/rich-text/#custom-fonts), **prefer custom Google Fonts** for predictable rendering and full typographic range.

## Contents

- The custom-font workflow (preferred)
- Built-in fonts (fallback)
- Why system fonts (Arial, Helvetica) fail

## Custom-font workflow (preferred)

Load a font from a public URL via `timeline.fonts[]`, then reference its **file basename** in the `font.family` property of any `rich-text` or `rich-caption` asset.

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

The `font.family` value is the URL's filename without extension.

For URL `https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm45xW5rygbi49c.ttf`, family = `JTUSjIg1_i6t8kCHKm45xW5rygbi49c`.

### Where to find Google Fonts URLs

The Shotstack Studio SDK ships a curated catalogue of ~400 Google Fonts at <https://github.com/shotstack/shotstack-studio-sdk/blob/main/src/core/fonts/google-fonts.ts>. Each entry has a fastest-served Google Fonts CDN URL.

Common picks:

| Font | URL |
|---|---|
| Montserrat 700 | `https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm45xW5rygbi49c.ttf` |
| Roboto 400 | `https://fonts.gstatic.com/s/roboto/v48/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.ttf` |
| Inter 700 | `https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTfvlaQc78lA2.ttf` |
| Bangers | `https://fonts.gstatic.com/s/bangers/v25/FeVQS0BTqb0h60ACL5la2bxii28.ttf` |
| Luckiest Guy | `https://fonts.gstatic.com/s/luckiestguy/v25/_gP_1RrxsjcxVyin9l9n_j2RStR3qDpraA.ttf` |
| Open Sans 400 | `https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVc.ttf` |
| Poppins 700 | `https://fonts.gstatic.com/s/poppins/v22/pxiByp8kv8JHgFVrLCz7Z1xlFQ.ttf` |

For other fonts, find the family on <https://fonts.google.com>, view the CSS, and copy the `.ttf` URL from the `@font-face` `src`.

### Multiple weights / styles

Each weight or style is a separate URL — load each one you need:

```json
{
  "timeline": {
    "fonts": [
      { "src": "https://fonts.gstatic.com/s/roboto/v48/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.ttf" },
      { "src": "https://fonts.gstatic.com/s/roboto/v48/KFOlCnqEu92Fr1MmEU9fBBc4.ttf" }
    ]
  }
}
```

## Built-in fonts (fallback)

These twelve fonts are pre-installed in the render engine and don't need a `timeline.fonts[]` entry. Use them only when you can't load a custom font.

| Family | Weight | Italic? |
|---|---|---|
| `Arapey` | 400 | yes |
| `Clear Sans` | 400 | no |
| `Didact Gothic` | 400 | no |
| `Montserrat` | 400 | yes (also as custom font) |
| `MovLette` | 400 | no |
| `NotoEmoji` | 400 | no — emoji glyphs |
| `Open Sans` | 400 | yes |
| `Permanent Marker` | 400 | no |
| `Roboto` | 400 | yes (incl. 700 italic, 800–900 italic) |
| `Sue Ellen Francisco` | 400 | no |
| `Uni Neue` | **700 only** | no |
| `Work Sans` | 400 | yes |

The renderer accepts both spaced (`Open Sans`) and concatenated (`OpenSans`) family names for these.

## Why system fonts fail

System fonts like `Arial`, `Helvetica`, `Times New Roman`, `Courier New`, etc. are **not installed** on the render engine. Using them produces a "Font not found" error at render time.

**Wrong:**

```json
{ "font": { "family": "Arial", "size": 48, "color": "#000000" } }
```

**Right (custom):**

```json
{
  "timeline": {
    "fonts": [
      { "src": "https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTfvlaQc78lA2.ttf" }
    ]
  },
  "asset": {
    "font": { "family": "UcCo3FwrK3iLTfvlaQc78lA2", "size": 48, "color": "#000000" }
  }
}
```

**Right (built-in):**

```json
{ "font": { "family": "Roboto", "size": 48, "color": "#000000" } }
```
