# Caption guide

Word-level animated captions. The most failure-prone asset type — read this fully before composing one.

The asset type to use is **`rich-caption`** (Shotstack's name for word-level captions). The deprecated `caption` type still parses but produces inferior output — always use `rich-caption`.

## Contents

- The five named presets (use these verbatim when possible)
- Sizing per output resolution
- The `alias://` source pattern
- Required clip-level dimensions
- Custom styling (when no preset fits)

## The five named presets

These are the canonical Shotstack rich-caption styles, lifted from the dashboard-v2 Captions panel. Use one verbatim unless the user asks for something specific.

All presets assume:
- Output resolution `1080` (1920×1080) or `hd` (1280×720)
- The captions track is **above** the audio/video source track
- The source clip has `alias: "audio"` (or whatever you wire `src: "alias://<name>"` to)

If output is portrait (1080×1920) or another aspect, scale `width`, `height`, `font.size`, and `padding` proportionally to the output dimensions.

### Nico — bold uppercase, slide-down animation

White Montserrat, uppercase, with subtle drop shadow. Slides each word down on activation.

```json
{
  "asset": {
    "type": "rich-caption",
    "src": "alias://audio",
    "font": { "family": "JTUSjIg1_i6t8kCHKm45xW5rygbi49c", "size": 88, "color": "#ffffff", "opacity": 1, "weight": 700 },
    "animation": { "style": "slide", "direction": "down" },
    "border": { "width": 0, "color": "#000000", "opacity": 1, "radius": 18 },
    "style": { "textTransform": "uppercase" },
    "padding": { "top": 25, "right": 0, "bottom": 0, "left": 0 },
    "shadow": { "offsetX": 5, "offsetY": 5, "blur": 4, "color": "#000000", "opacity": 0.59 },
    "active": {
      "shadow": { "offsetX": 5, "offsetY": 5, "blur": 4, "color": "#000000", "opacity": 0.59 }
    }
  },
  "start": 0, "length": "end",
  "width": 800, "height": 200,
  "offset": { "x": 0, "y": -0.35 }
}
```

Required `timeline.fonts[]` entry: `https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm45xW5rygbi49c.ttf`

### Kai — black-on-white pill, fade animation

Inter, black text on white pill background. Active word greys out. Clean editorial look.

```json
{
  "asset": {
    "type": "rich-caption",
    "src": "alias://audio",
    "font": { "family": "UcCo3FwrK3iLTfvlaQc78lA2", "size": 52, "color": "#000000", "opacity": 1, "weight": 700 },
    "animation": { "style": "fade" },
    "border": { "width": 0, "color": "#000000", "opacity": 1, "radius": 18 },
    "style": { "textTransform": "none" },
    "padding": { "top": 25, "right": 0, "bottom": 15, "left": 0 },
    "active": { "font": { "color": "#7d7e80" } },
    "background": { "color": "#ffffff", "opacity": 1, "borderRadius": 10 }
  },
  "start": 0, "length": "end",
  "width": 678, "height": 143,
  "offset": { "x": 0, "y": -0.3 }
}
```

Required font: `https://fonts.gstatic.com/s/inter/v20/UcCo3FwrK3iLTfvlaQc78lA2.ttf`

### Kapow — comic-book stroke with purple highlight

Luckiest Guy, white with thick black stroke, rotated -7.5°, active word gets a purple background. Use for energetic / playful content.

```json
{
  "asset": {
    "type": "rich-caption",
    "src": "alias://audio",
    "font": { "family": "_gP_1RrxsjcxVyin9l9n_j2RStR3qDpraA", "size": 52, "color": "#ffffff", "opacity": 1, "weight": 700 },
    "animation": { "style": "highlight" },
    "border": { "width": 0, "color": "#000000", "opacity": 1, "radius": 18 },
    "style": { "textTransform": "uppercase" },
    "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
    "stroke": { "width": 3, "color": "#000000", "opacity": 1 },
    "active": {
      "stroke": { "width": 3, "color": "#000000", "opacity": 1 },
      "font": { "background": "#690be9" }
    }
  },
  "start": 0, "length": "end",
  "width": 434, "height": 143,
  "offset": { "x": 0, "y": 0 },
  "transform": { "rotate": { "angle": -7.5 } }
}
```

Required font: `https://fonts.gstatic.com/s/luckiestguy/v25/_gP_1RrxsjcxVyin9l9n_j2RStR3qDpraA.ttf`

### Lovely Little Lychee — soft pink highlight

Montserrat, white with thin stroke and shadow, active word in soft pink. Romantic / lifestyle content.

```json
{
  "asset": {
    "type": "rich-caption",
    "src": "alias://audio",
    "font": { "family": "JTUSjIg1_i6t8kCHKm45xW5rygbi49c", "size": 36, "color": "#ffffff", "opacity": 1, "weight": 700 },
    "animation": { "style": "highlight" },
    "border": { "width": 0, "color": "#000000", "opacity": 1, "radius": 18 },
    "style": { "textTransform": "none" },
    "padding": { "top": 15, "right": 0, "bottom": 0, "left": 0 },
    "stroke": { "width": 1, "color": "#000000", "opacity": 1 },
    "active": {
      "font": { "color": "#ffcdd0" },
      "stroke": { "width": 1, "color": "#000000", "opacity": 1 },
      "shadow": { "offsetX": 5, "offsetY": 5, "blur": 4, "color": "#000000", "opacity": 0.8 }
    },
    "shadow": { "offsetX": 5, "offsetY": 5, "blur": 4, "color": "#000000", "opacity": 0.8 }
  },
  "start": 0, "length": "end",
  "width": 609, "height": 65,
  "offset": { "x": 0, "y": -0.4 }
}
```

Required font: same as Nico (Montserrat).

### Rizz — bold display with thick stroke and pop animation

Bangers, white with very thick black stroke, active word turns blue. High-energy social-media style.

```json
{
  "asset": {
    "type": "rich-caption",
    "src": "alias://audio",
    "font": { "family": "FeVQS0BTqb0h60ACL5la2bxii28", "size": 84, "color": "#ffffff", "opacity": 1, "weight": 700 },
    "animation": { "style": "pop" },
    "border": { "width": 0, "color": "#000000", "opacity": 1, "radius": 18 },
    "style": { "textTransform": "none" },
    "padding": { "top": 35, "right": 0, "bottom": 0, "left": 0 },
    "stroke": { "width": 10, "color": "#000000", "opacity": 1 },
    "active": {
      "font": { "color": "#6375ff" },
      "stroke": { "width": 10, "color": "#000000", "opacity": 1 }
    }
  },
  "start": 0, "length": "end",
  "width": 609, "height": 167,
  "offset": { "x": 0, "y": -0.35 }
}
```

Required font: `https://fonts.gstatic.com/s/bangers/v25/FeVQS0BTqb0h60ACL5la2bxii28.ttf`

## Sizing per output resolution

The preset values above target full HD (1920×1080). For other output resolutions, scale `width`, `height`, `font.size`, and `padding` linearly:

| Output | Scale factor (vs 1080p) |
|---|---|
| `preview` 512×288 | 0.27 |
| `mobile` 640×360 | 0.33 |
| `sd` 1024×576 | 0.53 |
| `hd` 1280×720 | 0.67 |
| `1080` 1920×1080 | 1.00 (preset values as-is) |
| Portrait 1080×1920 | Use `width: 900` and similar 1080-equivalents; the offset `y` may need adjustment for vertical framing |

Always render at least once at the target resolution and verify the captions are positioned correctly.

## The `alias://` source pattern

Rich-caption transcribes audio to produce word-level timing. Three ways to source it:

| `src` value | Behaviour |
|---|---|
| `alias://<name>` | Auto-transcribe a referenced audio/video/text-to-speech clip. Set `alias: "<name>"` on the source clip. **Preferred for sync.** |
| Subtitle file URL | Use existing `.srt` or `.vtt` file. No auto-transcription. |
| Audio/video file URL | Auto-transcribe a standalone media file. Use when there's no source clip on the timeline. |

The `alias://` form keeps the captions in sync with the source clip even when you change its `start` or `length`.

## Required clip-level dimensions

A `rich-caption` clip without `width`, `height`, and `fit: "none"` defaults to filling the entire output frame, which obscures everything below. The five presets all set these explicitly. If you author your own:

```json
{
  "asset": { "type": "rich-caption", "...": "..." },
  "start": 0, "length": "end",
  "width": 678, "height": 143,
  "fit": "none",
  "offset": { "x": 0, "y": -0.3 }
}
```

`offset.y: -0.3` puts the captions in the lower-third area. Negative `y` is below centre; positive is above.

## Custom styling

If none of the five presets fits, copy the closest preset and modify. The properties are:

| Group | Properties |
|---|---|
| `font` | `family`, `size`, `color`, `opacity`, `weight` |
| `animation` | `style`: `fade`, `slide`, `highlight`, `pop`. `direction` for slide: `up`, `down`, `left`, `right`. |
| `border` | `width`, `color`, `opacity`, `radius` |
| `padding` | `top`, `right`, `bottom`, `left` (numbers) |
| `stroke` | `width`, `color`, `opacity` (text outline) |
| `shadow` | `offsetX`, `offsetY`, `blur`, `color`, `opacity` |
| `background` | `color`, `opacity`, `borderRadius` (the rounded pill behind text) |
| `active` | Same property groups, applied only to the currently-spoken word |
| `style.textTransform` | `none`, `uppercase`, `lowercase`, `capitalize` |

For the canonical schema, see <https://shotstack.io/docs/api/#tocs_richcaptionasset>.
