# Fonts guide

The Shotstack render engine ships a small built-in font set; everything else must be loaded as a custom font via `timeline.fonts[]`. Per the [Shotstack docs](https://shotstack.io/docs/guide/architecting-an-application/rich-text.md), **prefer custom Google Fonts** for predictable rendering and full typographic range.

## CRITICAL: never fabricate font URLs

**Do NOT construct or reconstruct Google Fonts URLs from memory.** Google rotates the version segment (`v26 → v31 → …`) and the hashed filename changes with each version, so any URL you assemble from training data is almost certainly a 404 — and a missing font fails the render. **Copy a URL verbatim** from the verified catalogue below, or from the live Studio SDK catalogue (linked further down). If the exact font you want isn't available verbatim, pick the closest verified match rather than inventing one.

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
            "font": { "family": "JTUSjIg1_i6t8kCHKm45xW5rygbi49c", "size": 60, "weight": "700", "color": "#ffffff" }
          },
          "start": 0, "length": 3
        }]
      }
    ]
  }
}
```

The `font.family` value is the URL's filename without extension, and it **must** match the URL's basename exactly. For URL `https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm45xW5rygbi49c.ttf`, family = `JTUSjIg1_i6t8kCHKm45xW5rygbi49c`. If `family` and the URL basename diverge, the font silently fails to load.

## Verified font catalogue (12 fonts)

Copied verbatim from the Studio SDK catalogue. Paste the **url** into `timeline.fonts[].src`, paste the **family** into `asset.font.family`.

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

Variable fonts (most of the above) cover the full weight range (100–900) from a single URL — set `font.weight` in the clip. For the non-variable fonts (Poppins, Bebas Neue, Anton) the registered URL is weight 400; the SDK falls back gracefully when you request a bolder weight.

### Sourcing more fonts

The Studio SDK ships a curated catalogue of ~400 Google Fonts at <https://github.com/shotstack/shotstack-studio-sdk/blob/main/src/core/fonts/google-fonts.ts>. Copy the `url` and `family` for an entry **verbatim** — do not hand-edit the version or hash. For a font not in that catalogue, open it on <https://fonts.google.com>, view the CSS, and copy the exact `.ttf` URL from the `@font-face` `src` (again, verbatim).

### Multiple weights / styles

Each weight or style is a **separate URL** — load every one you reference. Look each up in the SDK catalogue rather than guessing the hash:

```json
{
  "timeline": {
    "fonts": [
      { "src": "https://fonts.gstatic.com/s/roboto/v50/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf" }
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
