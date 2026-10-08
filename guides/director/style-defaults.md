## Motion language (house tokens)

Compose motion from a **closed set of tokens** so a multi-clip edit feels like one production, not eight unrelated effects. **Don't invent a new easing or duration per clip.** Full recipes (GSAP/CSS, choreography, brand kit) in the motion guide.

- **Durations (seconds):** `instant 0.2 · fast 0.33 · base 0.6 · slow 0.8 · slower 1.0 · hold 1.5`. Entrances default to **`base` (0.6)**; **exits are faster** (`fast`).
- **One house ease, no overshoot:** html5 GSAP `power3.out` (in) / `power2.in` (out); CSS `cubic-bezier(0.16, 1, 0.3, 1)`. Never raw `linear` for tracked motion. A gentle `back.out(1.4)` is reserved for **one** hero element per scene — calm is the default.
- **One stagger:** `0.13s` between siblings (GSAP `stagger: 0.13`; CSS `animation-delay` steps).
- **Restraint:** translate 12–24 px (not 80), scale ≥ 0.92, one focal element per moment, let a reveal settle (`hold`) before it cuts.
- **rich-text `animation`** (entrance-only — exits use the clip `transition.out`): set `duration` from the scale (e.g. `0.6`); `preset:"ascend"` + `direction:"up"` is the rise-and-fade workhorse; for a word cascade use `preset:"shift"` + `style:"word"` + `direction:"up"` (`style` works only on `typewriter`/`shift`; `direction` is required for `slideIn`/`ascend`/`shift`/`movingLetters`).
- **Brand once:** put palette/font in top-level `merge[]` (`{{ink}}`, `{{accent}}`, `{{font}}`) and reference them in every clip — one edit re-skins the whole video. Accent used sparingly.
## The design ladder — escalate from rich-text to html5

One overlay is a `rich-text` job. **Several videos "in different styles" is not** — making them all `rich-text` ships one look eight times. Match the asset to the ambition:

| Level | Asset | Use for |
|---|---|---|
| 1 — type & layout | `rich-text` | Titles, lower-thirds, kickers, captions, price/CTA pills. Fast and reliable; the right default for static styled text. |
| 2 — shapes | `svg` | Colour panels, rules, badges, frames, geometric accents behind or around type. |
| 3 — motion graphics | `html5` | Kinetic type, value reveals, shine sweeps, animated gradients, film grain, masked reveals, data-driven overlays — anything that should *move* beyond a `transition` or a Ken-Burns `effect`. gsap and its plugins, anime, d3 and lottie are preloaded. See the HTML5 guide, the effects palette in the HTML5 effects palette, and the copy-paste clips in the HTML5 snippets. |

**When the brief asks for a *range*, deliberately spread across the ladder.** A strong set: a couple of clean `rich-text` studio cuts, one or two `svg` colour-block promos, and several `html5` pieces carrying the real motion (kinetic headline, value reveal, shine-swept CTA, grain-graded teaser). Reserve the elaborate `html5` treatments for the hero / hype cuts where motion sells the product. If every clip in a "variety" brief is `rich-text`, you have not delivered variety.
