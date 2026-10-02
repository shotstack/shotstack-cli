# Generating assets

`shotstack models <id>` shows what a model *accepts*. This is what produces a good result.

Set an asset's `prompt` and `model` and the asset is generated at render time; `options` configures the generator. Everything below is per-model craft, then a section on what the surrounding timeline can contribute.

## Video — Seedance

**Verbs carry the generation.** The model animates motion, so spend the words there and describe consequences rather than states: "leaves scatter on each impact", not "leaves on the ground".

**Dialogue in double quotes gets lip-synced**, and picture and sound are generated in one pass rather than layered afterwards. Name the vocal tone you want.

**Silence is a parameter, not a phrase.** Set `generateAudio: false`. Writing "no music" in the prompt is not the mechanism.

**Cuts must be asked for**, with "cut to". Consistency holds across cuts inside a single generation — roughly three per take — and a multi-cut single generation is more consistent than the same shots generated separately.

**Duration is a beat budget.** Fit the described action to the time available. Overpacking a short clip produces rushing and incoherence; it does not compress gracefully. A prompt written for fifteen seconds will not survive being asked for five.

There is no prompt-length limit on the model itself. The API caps `prompt` at 4,000 characters.

**Choosing a generation.** 2.5 for duration: up to 30 seconds in one take, against 2.0's 15. ByteDance also claims better prompt adherence for 2.5, which its own pages don't corroborate. **2.0 for cost**: it is cheaper per second at every resolution, and both top out at 1080p. `shotstack models` has the current rates.

## Images — Nano Banana

Write plain descriptive sentences, not comma-separated tags with quality boosters. Photographic and cinematographic vocabulary works and appears in the vendor's own examples: shot type, camera angle and proximity, lighting setup, lens and focal length.

**There is no negative prompt.** No such field exists. Phrase exclusions as positive instructions — "an empty desk" rather than "no clutter".

**Quote text that must appear**, and describe the font in plain words rather than by name:

```
the text "Grand Opening" in a clean, bold, sans-serif
```

Iterative refinement is not available on this route. Each generation is single-shot.

**Which tier.** The standard tier is the right default: on general image quality, character work and stylisation it matches or beats the Pro tier at roughly half the price, and it offers a 0.5K option Pro does not. Reach for Pro for hard, multi-instruction, information-dense compositions at high resolution, where its much larger output budget tells. Not for "better images" generally.

1024–1536 px on the long edge suffices for screen use.

### Text inside an image, or over it

Short, decorative, one line — generate it and check the result. Copy that must be spelled correctly, must run to several lines, or must survive a merge-field substitution — generate a plain background and composite a `rich-text` asset over it. A real font is spell-correct by construction, resolution-independent, and can be reworded without regenerating the image.

## Speech

Three providers: **ElevenLabs**, **MiniMax** and **Amazon Polly**. Run `shotstack models` for the current ids.

The script is the instrument. Most bad output is a writing problem, not a settings problem.

**Numbers and currency are the most common defect.** Spell out anything you care about. Dates in numeric form are read as digit runs.

**ElevenLabs** is the default. Audio tags like `[laughs]` belong to a newer generation of its models and do nothing on the endpoints offered here. Stage directions written inline are read aloud rather than interpreted.

**Voice choice has no evidence behind it** beyond the vendors' own descriptors, and preset lists rotate. Pick by listening, not by name.

**Polly** takes a free-string voice and is the odd one out: its remedies are all SSML, which is unreachable because input is sent as plain text and escaped. Newscaster style works on four voices only — Matthew, Joanna, Lupe and Amy — and requesting it on any other fails the render.

**MiniMax** publishes a far larger voice catalogue than the seventeen names listed here, and several controls it supports — speed, volume, pitch, emotion — are not exposed. Treat the listed voices as the supported set.

Speech length is not knowable in advance. Set the clip's `length` to `"auto"` and let it take the produced file's duration, rather than guessing a slot and overrunning it.

## Music

**Eleven Music.** A prompt answers genre, mood, instrumentation, tempo and production era whether or not you intend it to. Whatever you leave out, the model chooses.

**Production vocabulary does real work** — "dusty", "vinyl crackle", "sparse", "ethereal". Give a BPM when timing matters; the model holds a stated tempo precisely. Naming a key helps, less reliably.

**Naming a musician or band is refused**, as is quoting copyrighted lyrics. The error includes a suggested alternative prompt. Describe the era and production style instead: "1990s trip-hop with detuned Rhodes and a heavy swung break".

Add "instrumental only" to the prompt, or set `forceInstrumental` for a guarantee. That flag cannot be combined with a composition plan.

**Composition plans** describe a track section by section — reach for one when you need section structure, lyric placement or a multi-vocalist arrangement, not at any particular length. Section durations are exact and sum to the track length. Keep style entries as short tags, pair every positive list with a negative one, and put what should never change in the global styles. To keep a planned section instrumental, leave its `lines` empty and add "vocals" to its negative styles.

## Working inside a timeline

An Edit knows things a bare prompt does not. This is the part no standalone generator can do for you.

**Match the generation's aspect ratio to your output.** A 9:16 generation inside a 16:9 edit gets cropped, and you paid for the pixels thrown away. The exception is deliberate: generate oversized when a later pan, zoom or reframe needs somewhere to move.

**Generate stills larger than the video that consumes them.** A 1K still feeding a 720p clip asks the video model to invent about half again as much detail as the source held. Use 2K when the target is 720p or above.

**Anchor stills become frame one, so everything static is inherited.** Composition, lighting and style all come from the still; the prompt should describe only motion. There is no fixing a badly-composed anchor in the video prompt. Artefacts get worse in motion rather than better, so a still with malformed hands or heavy compression is not usable.

**Chain at most two or three generated clips.** Feeding each clip's last frame into the next accumulates drift, and it degrades well before any advertised limit.

**Continuity across a cut is usually not what you want.** Most cuts are meant to break continuity — a new angle, a new location, a time jump. Carry a frame forward when you specifically want the shots to feel continuous, not by default.

**Keep a repeated style clause** across separately generated assets when they need to look like a set. There is no project-level style; the shared sentence is the mechanism.

## What does not work

- **A fixed seed does not carry a look across different prompts.** Seeds give reproducibility for an identical prompt and nothing more.
- **Film stock names, "colour grade" and "LUT"** are not part of the documented vocabulary. Use shot type, lighting, angle and focal length instead.
- **Repeating the aspect ratio or resolution in the prompt** does nothing. Set the option.
- **Negative prompts** do not exist on the image models. Phrase it positively.

## flux-schnell

No craft guidance. Its vendor no longer documents the endpoint anywhere, so nothing about it can be stated with confidence.
