# Timeline conventions

Detailed guide to track layering, the soundtrack vs audio distinction, and `timeline.fonts[]`. Read this when building any non-trivial timeline JSON.

## Contents

- Track layering (with worked example)
- Soundtrack vs audio asset
- `timeline.fonts[]` for custom fonts
- Background colour
- Cache control
- Common track-layout patterns

## Track layering

The single most counter-intuitive Shotstack convention.

`timeline.tracks` is an array. **The first element is the TOP layer (foreground); the last is the BOTTOM (background).** The order of the JSON array IS the visual stacking order, top-to-bottom.

Per the [official docs](https://shotstack.io/docs/guide/architecting-an-application/guidelines/):

> Tracks are layered on top of each other in the same order they are added to the array with the top most track layered over the top of those below it.

### Worked example: caption on a video

To overlay captions on a video:

```json
{
  "timeline": {
    "tracks": [
      {
        "clips": [{
          "asset": { "type": "rich-caption", "src": "alias://voice", "...": "..." },
          "start": 0, "length": "end",
          "width": 678, "height": 143,
          "fit": "none"
        }]
      },
      {
        "clips": [{
          "asset": { "type": "audio", "src": "https://.../voice.mp3" },
          "start": 0, "length": "auto",
          "alias": "voice"
        }]
      },
      {
        "clips": [{
          "asset": { "type": "video", "src": "https://.../background.mp4" },
          "start": 0, "length": "end"
        }]
      }
    ]
  },
  "output": { "format": "mp4", "resolution": "hd" }
}
```

Order of tracks:
1. **Top:** `rich-caption` (the visible captions)
2. **Middle:** `audio` (provides the words for transcription via `alias`)
3. **Bottom:** `video` (the background imagery)

If you put the video first and the captions last, the video covers the captions and you see nothing.

### When to use multiple tracks

| Goal | Layout |
|---|---|
| Background + foreground overlay | Two tracks |
| Multiple parallel audio sources (voiceover + music) | Soundtrack for music, separate audio track for voiceover |
| Title card on video | Title clip in early track, video in later track |
| Picture-in-picture | PiP video in early track, main video in later track |

## Soundtrack vs audio asset

There are two ways to add audio. Pick the right one.

| Use `timeline.soundtrack` when | Use `audio` asset when |
|---|---|
| One background music track for the entire timeline | Sound effects at specific times |
| Loop or fade the music | Voiceover synced to specific clips |
| You don't need to control timing | Multiple audio sources at different times |

```json
{
  "timeline": {
    "soundtrack": {
      "src": "https://shotstack-assets.s3.amazonaws.com/music/unminus/palmtrees.mp3",
      "effect": "fadeOut"
    },
    "tracks": [/* ... */]
  }
}
```

Soundtrack supported `effect` values: `fadeIn`, `fadeOut`, `fadeInFadeOut`.

## `timeline.fonts[]` for custom fonts

Custom fonts loaded from a URL, available to all `rich-text` and `rich-caption` clips in the timeline.

```json
{
  "timeline": {
    "fonts": [
      { "src": "https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm45xW5rygbi49c.ttf" },
      { "src": "https://fonts.gstatic.com/s/bangers/v25/FeVQS0BTqb0h60ACL5la2bxii28.ttf" }
    ]
  }
}
```

The `font.family` you reference in an asset must be the **basename of the file** (without `.ttf`/`.otf`/`.woff`).

For the Montserrat URL above, `font.family` is `JTUSjIg1_i6t8kCHKm45xW5rygbi49c`.

See `references/fonts.md` for the full pattern.

## Background colour

`timeline.background` is a hex string. Defaults to `#000000`.

```json
{ "timeline": { "background": "#ffffff", "tracks": [/* ... */] } }
```

## Cache control

`timeline.cache: false` disables caching of fetched source assets for this render. Default is `true`. Disable cache when you're iterating on the same source URL with changed content.

## Common track-layout patterns

**Slideshow:** images in one track, soundtrack for music. One image per clip; use `start: "auto"` to chain them.

**Voiceover with captions:** captions in track[0], audio in track[1] (with `alias` for the captions to reference), video/image in track[2].

**Lower third title:** title `rich-text` clip in track[0] with positioned `offset`, main video in track[1].

**Picture-in-picture:** small video with `scale: 0.3` in track[0] with `offset`, main video at full size in track[1].
