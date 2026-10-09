**Defaults when no style is given.** Use these when the user hasn't asked for a particular look; their brief, brand or references always come first.

- **Durations (seconds):** `instant 0.2 · fast 0.33 · base 0.6 · slow 0.8 · slower 1.0 · hold 1.5`. Entrances around `base`, exits a little faster.
- **Ease:** html5 GSAP `power3.out` (in) / `power2.in` (out); CSS `cubic-bezier(0.16, 1, 0.3, 1)`. `linear` suits continuous drift; `back.out(1.4)` reads as a pop.
- **Stagger and travel:** `0.13s` between siblings; translate 12–24 px and scale from 0.92 for a restrained look.
- **Consistency:** whatever the values, reuse a small set of timings across the edit so the clips feel like one piece.

## The design ladder — escalate from rich-text to html5

One overlay is a `rich-text` job. **Several videos "in different styles" is not** — making them all `rich-text` ships one look eight times. Match the asset to the ambition:

| Level | Asset | Use for |
|---|---|---|
| 1 — type & layout | `rich-text` | Titles, lower-thirds, kickers, captions, price/CTA pills. Fast and reliable; the right default for static styled text. |
| 2 — shapes | `svg` | Colour panels, rules, badges, frames, geometric accents behind or around type. |
| 3 — motion graphics | `html5` | Kinetic type, value reveals, shine sweeps, animated gradients, film grain, masked reveals, data-driven overlays — anything that should *move* beyond a `transition` or a Ken-Burns `effect`. gsap and its plugins, anime, d3 and lottie are preloaded. See the HTML5 guide, the effects palette in the HTML5 effects palette, and the copy-paste clips in the HTML5 snippets. |

**When the brief asks for a *range*, deliberately spread across the ladder.** A strong set: a couple of clean `rich-text` studio cuts, one or two `svg` colour-block promos, and several `html5` pieces carrying the real motion (kinetic headline, value reveal, shine-swept CTA, grain-graded teaser). Reserve the elaborate `html5` treatments for the hero / hype cuts where motion sells the product. If every clip in a "variety" brief is `rich-text`, you have not delivered variety.
