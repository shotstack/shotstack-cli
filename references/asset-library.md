# Placeholder asset library

Use these URLs when the user hasn't provided their own assets — for examples, tests, and demos. **This is not a curated stock library**; it's a small placeholder set hosted by Shotstack.

All URLs are public HTTPS and stable.

## Videos

```
https://shotstack-assets.s3.amazonaws.com/footage/beach.mp4
https://shotstack-assets.s3.amazonaws.com/footage/sunset.mp4
https://shotstack-assets.s3.amazonaws.com/footage/mountains.mp4
https://shotstack-assets.s3.amazonaws.com/footage/skateboarder.mp4
https://shotstack-assets.s3.amazonaws.com/footage/city-timelapse.mp4
https://shotstack-assets.s3.amazonaws.com/footage/drone.mp4
https://shotstack-assets.s3.amazonaws.com/footage/trees.mp4
```

## Images

```
https://shotstack-assets.s3.amazonaws.com/images/wave-barrel.jpg
https://shotstack-assets.s3.amazonaws.com/images/earth.jpg
https://shotstack-assets.s3.amazonaws.com/images/business-man.jpg
https://shotstack-assets.s3.amazonaws.com/images/financial-background.jpg
https://shotstack-assets.s3.amazonaws.com/images/happy1.jpg
https://shotstack-assets.s3.amazonaws.com/images/dog1.jpg
https://shotstack-assets.s3.amazonaws.com/images/waterfall.jpeg
```

## Music

Royalty-free tracks from the Unminus library, hosted on Shotstack's CDN. Use as `audio` assets on a dedicated track. (`timeline.soundtrack` is deprecated — use `audio` with `length: "end"` instead.)

```
https://shotstack-assets.s3.amazonaws.com/music/unminus/white.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/waveform.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/reggae.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/palmtrees.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/neuron.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/lit.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/kring.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/happy.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/berlin.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/autumn.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/ambition.mp3
https://shotstack-assets.s3.amazonaws.com/music/unminus/ambisax.mp3
```

## Picking an asset

Match the placeholder to the user's intent when one isn't provided:

| Intent | Pick |
|---|---|
| Beach / vacation | `beach.mp4`, `sunset.mp4`, `palmtrees.mp3` |
| Cityscape / business | `city-timelapse.mp4`, `business-man.jpg`, `ambition.mp3` |
| Nature / outdoors | `mountains.mp4`, `drone.mp4`, `trees.mp4`, `waterfall.jpeg` |
| Sport / energy | `skateboarder.mp4`, `lit.mp3` |
| Earth / global | `earth.jpg`, `neuron.mp3` |
| Cheerful / upbeat | `happy1.jpg`, `dog1.jpg`, `happy.mp3`, `kring.mp3` |
| Editorial / corporate | `financial-background.jpg`, `berlin.mp3`, `white.mp3` |

When the user provides their own URLs, ignore this list entirely.
