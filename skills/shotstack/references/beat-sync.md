# Beat sync

Cut and animate to a track by measuring it, not by trusting the tempo you asked for. A generated track keeps a stated BPM but puts its drops and sections where it likes, and a tempo found by ear or by a general-purpose library is often half a beat off the kick. A cut that lands a quarter-beat late reads as a mistake.

## 1. Get the track before you compose

Analysis needs a file. A `prompt` on the timeline's `audio` asset only generates at render time, so there is nothing to measure while you write the edit.

- **The user's track:** use its hosted URL.
- **A library track:** use its URL as is.
- **A generated track:** generate it on its own first, then use the URL it returns as a plain `audio` `src`. Still state the BPM in the prompt; measure the result anyway.

<!-- surface:cli -->
Host a local file with `shotstack ingest upload <file> --watch`. Generate a track with `shotstack generate <music-model> "<prompt>" --length <seconds> --watch`, after quoting it with `--quote`.
<!-- /surface -->

## 2. Analyse it

Analysis is free, takes 15–30 s and reads the first 10 minutes of the track.

The `src` must be a direct, public link to an audio or video file: share pages and redirects are refused.
<!-- surface:cli -->
It needs an API key (`shotstack login`).

```sh
shotstack analyze https://shotstack-assets.s3.amazonaws.com/music/unminus/lit.mp3 --output json > map.json
```
<!-- /surface -->

## 3. Read the map

| Field | Meaning |
|---|---|
| `steady` | `true`: the tempo holds, and `bpm`, `beat`, `bar`, `meter` and `origin` describe a grid. `false`: use `beats[]` and `downbeats[]` instead. |
| `bpm`, `beat`, `bar` | Tempo, and the beat and bar lengths in seconds. |
| `meter` | Beats per bar. |
| `origin` | Time of the first downbeat. Bar `n` starts at `origin + n × bar`. |
| `bars.count`, `bars.energy[]` | Number of bars, and loudness per bar from 0 to 1. |
| `drops[]` | `{ bar, time }` where the low end comes in hard. |
| `sections[]` | `{ bar, time, change }`, where `change` is `rise` or `fall`. |
| `downbeat.confidence` | How sure the bar phase is, 0 to 1. |
| `precision` | How far to trust each part: `grid` is `frame` or `beat`, `sections` is `bar`, `downbeat` is `estimate`. |
| `beats[]`, `downbeats[]` | Beat and bar times, only when `steady` is `false`. |

## 4. Write every cue in bars

- **Cuts on bar lines.** A shot holds a whole number of bars. Compute each `start` and `length` from the map and keep three decimals; never round to whole seconds.
- **Let energy set the pace.** Hold two or four bars where `bars.energy` is low and cut every bar where it is high.
- **Spend the big moment on a drop.** Put the reveal, the logo or the hardest cut at a `drops[].time`.
- **Change scene at sections.** A `rise` opens a new idea; a `fall` is where to breathe.
- **Accents on beats.** A pulse, flash or kick-on-the-beat sits at `origin + k × beat`.
- **No grid?** When `steady` is `false`, cut on `downbeats[]` and accent on `beats[]`.
- **Downbeat off by one?** The bar phase is an estimate. If `downbeat.confidence` is low, look at the first drop: if it lands mid-bar, shift `origin` by a beat.

## 5. Drive `html5` motion from the map

An `html5` clip's time is local to the clip. Put the map's numbers and the clip's own `start` in the page and place every tween from them, on a timeline the harness seeks (not `paused`):

```js
const ORIGIN = 0.062, BAR = 1.9998, BEAT = BAR / 4, CLIP_START = 8.062; // from the map and this clip
const at = (bar, beat = 0) => ORIGIN + bar * BAR + beat * BEAT - CLIP_START;
const tl = gsap.timeline();
tl.from(".title", { yPercent: 110, duration: BEAT, ease: "power3.out" }, at(4))
  .to(".title", { scale: 1.06, duration: BEAT / 2, yoyo: true, repeat: 1 }, at(5))
  .to(".title", { opacity: 0, duration: BEAT }, at(7, 3));
```

Built-in motion works the same way: a clip whose `start` is a bar line makes its `transition` land on the beat.

## 6. Keep the music a plain audio clip

Put the track on its own track as an `audio` asset at `start: 0` with `length: "end"`; a fade (`effect: "fadeOut"`) is fine. Anything that moves the audio moves the grid with it. If you trim the track or start it later, add that offset to every time: timeline time = map time − `trim` + the audio clip's `start`.

## 7. Check frames at bar lines

Before calling it done, look at a few cuts and the first drop at their bar times: the new shot should be on screen at the bar line, not a frame or two after it.

<!-- surface:cli -->
Preview with `shotstack studio`, or render on stage and pull a frame at a bar time with `ffmpeg -ss <time> -i out.mp4 -frames:v 1 bar.png`.
<!-- /surface -->
