---
name: shotstack
description: |
  Render video, poll render status, and upload local source files via the
  Shotstack API. Use when generating clips, building automated video pipelines,
  uploading footage/audio/images to use in an Edit, or orchestrating cloud video
  renders from a script, agent, or CI workflow.
  NOT for: real-time streaming, or live broadcasting.
license: Apache-2.0
---

# Shotstack CLI

This skill loads in **terminal-based AI agents** (Claude Code, Cursor, Codex CLI, Gemini CLI, etc.). All operations here are shell commands. There is no embedded UI, no iframe, no inline canvas, no MCP tool surface — only `shotstack` invocations from a terminal. To hand off to a human, run `shotstack studio <file>`; this opens the user's default browser to a `shotstack.studio` URL. Tell the user to click Render *in the browser tab*, not in any UI inside the terminal.

**Open-ended first render? Ask before composing.** If the ask doesn't state what the video is (subject, format or destination) — e.g. "render my first video", "make me a video", "set up Shotstack" — read [`references/onboarding.md`](references/onboarding.md) and ask its discovery questions, then WAIT for answers. Do not write an Edit first. An open-ended ask is not a specification, and a stray JSON file in the project doesn't make the user experienced. Compose without asking only when the user has stated what the video is, or explicitly says to just show anything.

Commands for the Shotstack video rendering API. `render` submits an Edit JSON and returns a render ID; `status` polls a render until done. `ingest` uploads your own local files (or fetches remote URLs) and hosts them so they can be referenced from an Edit. `validate` lints an Edit — run it before every render. `studio` opens an edit in the browser editor for a human to preview, tweak, and render. `template list|get|create|update|delete` reads and writes templates saved to the account: `list` shows saved templates (id + name); `get <id>` fetches a saved template's Edit JSON (e.g. one the user designed in Studio) so you can render or remix it; `create <file> --name <name>` saves an edit as a new template; `update <id> <file>` overwrites one; `delete <id>` removes one.

**Default loop — no API key required:** compose → `validate` (offline lint) → `studio` (browser preview). Only the API-backed commands (`render`, `status`, `ingest`) need a key. Reach for `render` when you specifically need a final MP4 exported in the cloud; reach for `studio` for everything else — it is the cheapest way to see an edit and the right default for any creative a human will review.

## Authentication

Save your API key once with `shotstack login` — it's stored in `~/.shotstack/credentials.json` (chmod 600), per environment, so you don't re-enter it every session:

```sh
shotstack login                  # prompts (hidden input); saves the v1 (production) key
shotstack login --env stage      # save the stage key (Shotstack keys are env-specific)
echo "$KEY" | shotstack login    # non-interactive (CI / agents): read the key from stdin
shotstack logout --env stage     # forget one env;  shotstack logout --all  forgets all
```

Or set an environment variable (overrides the saved key — best for CI):

```sh
export SHOTSTACK_API_KEY=...
```

Resolution precedence: **`SHOTSTACK_API_KEY` env var → saved key for the target `--env` → error.** Get a key at <https://app.shotstack.io>. **`validate` and `studio` need no key** — only the API-backed commands (`render`, `status`, `ingest`) require one; without a key *those* exit 1, while compose → validate → studio keeps working.

## Environments

```
--env stage    → https://api.shotstack.io/edit/stage   (test credits, free)
--env v1       → https://api.shotstack.io/edit/v1      (production, default)
```

**The cheapest iteration path is `studio` — not `stage`.** `studio` previews client-side in the browser with no key and no credits (see the Studio section below); iterate there. `--env stage` gives a free cloud render (With watermark) for when you need a rendered video for review; v1 charges real credits. Override the target with the `SHOTSTACK_ENV` env var for the session. `ingest` commands hit the parallel `…/ingest/{env}` base automatically using the same key.

## Quickstart

```sh
# 1 — Validate offline. Schema + same-track overlaps + fonts + URLs. No key, no credits.
shotstack validate template.json

# 2 — Preview in the browser. The DEFAULT next step: no key, no credits; a human hits Render.
shotstack studio template.json
# → opens https://shotstack.studio/s/<slug> and prints the short URL

# 3 — Export to MP4. Needs an API key and charges credits. Submit + poll in one command.
shotstack render template.json --watch
# → done  https://shotstack-api-v1-output.s3.amazonaws.com/.../01ja7-x8m2k-39rzv-cmvxve.mp4

# Poll an existing render to a terminal state.
shotstack status 01ja7-x8m2k-39rzv-cmvxve --watch
# → done  https://shotstack-api-v1-output.s3.amazonaws.com/.../01ja7-x8m2k-39rzv-cmvxve.mp4
```

## Uploading local files to use in an Edit

An Edit can only reference media by **URL** — a local path in an `asset.src` will not render. To use a local file, host it first with `shotstack ingest upload`, then put the returned URL in your Edit.

```sh
# Upload a local file and poll until it's hosted. --watch prints the URL.
shotstack ingest upload ./clip.mp4 --watch --output json
# → {"id":"zzytey4v-...","status":"importing"}
# → {"id":"zzytey4v-...","status":"ready","source":"https://shotstack-ingest-api-v1-sources.s3...amazonaws.com/.../source.mp4",...}

# Capture the hosted URL straight into a variable:
SRC=$(shotstack ingest upload ./clip.mp4 --watch --output json | tail -n1 | jq -r .source)
# …then reference "$SRC" as an asset.src in your Edit JSON and run `shotstack render`.
```

The bare command (no `--watch`) returns only an `id`; the hosted `source` URL does not exist until ingestion is `ready`. Always `--watch` (or follow up with `shotstack ingest status <id> --watch`) when you need the URL.

Other ingest subcommands: `ingest fetch <url>` (host a copy of a remote URL), `ingest status <id>`, `ingest list`, `ingest delete <id>`. **Read [`references/ingest.md`](references/ingest.md) for the full upload→render workflow, status values, and supported file types.**

## Default workflow: preview in Studio (no key, no credits)

**`shotstack studio <file>` is the default way to look at an edit** — prefer it over `render` unless you specifically need a cloud-exported MP4. It posts the JSON to https://shotstack.studio and opens `https://shotstack.studio/s/<slug>` in the browser — a short, shareable URL. No API key, no render credits charged; it previews client-side, so it works with no key. The human plays, edits, and decides whether to spend credits on a render.

```sh
shotstack studio template.json              # opens browser + prints short URL
shotstack studio template.json --no-open    # headless: just print the URL
shotstack studio template.json --no-shorten # emit base64url URL inline (offline / debug)
shotstack studio template.json --output json # piping: {"url":"...","shortened":true}, no browser
```

On headless systems (no `xdg-open`, no `$DISPLAY`) the browser launch silently no-ops; the URL is still printed. Safe to run anywhere.

If the share API is unreachable, the command falls back to the inline base64url form automatically and prints a stderr warning. Shares expire after 30 days.

**Default to `studio` for anything non-trivial** — multi-scene, multi-track, or any creative an interested human will review. It previews client-side, costs nothing, and lets the human hit Render when it's right. Use `render` directly only for single-shot/simple edits, automated pipelines, or when told "just render it".

## Four CLI rules

1. **Pipe → `--output json`.** Default output is human-readable. When parsing programmatically or piping to another command, always pass `--output json`.

2. **Use `--watch`, not a polling loop.** `shotstack render <file> --watch` submits and polls in one shot; `shotstack status <id> --watch` polls an existing render. Both exit when terminal: `done` (exit 0) or `failed` (exit 1). Don't write `while true; do ...; sleep 3; done`.

3. **Compose from `shared/agent-core.md`, then `shotstack validate`.** Its cheatsheet carries the property names, enums (transition/effect/position/fit) and rich-text fields you need — no schema download required. `shotstack validate <file>` then checks the JSON against the live schema offline and flags same-track overlaps, unloaded fonts and non-public URLs before you spend a credit. (For edge cases the full schema is at <https://shotstack.io/docs/api/api.edit.json> and the guide at <https://shotstack.io/docs/guide/llms-full.txt>.)

4. **Hand off to a human via `shotstack studio <file>` when uncertain.** Don't burn render credits iterating. Generate JSON → `shotstack studio file.json` (opens browser) → human reviews/tweaks → render only when right.

## REQUIRED: Read `shared/agent-core.md` before composing any Edit JSON

The Shotstack schema does **not** match CSS or web conventions. Composing Edit JSON from training-data instinct will produce silently invalid renders. **Read [`shared/agent-core.md`](shared/agent-core.md) first**, every time. The most-failed conversions:

| You'd write (wrong) | API requires (right) |
|---|---|
| `alignment` | `align` |
| `align.vertical: "center"` | `align.vertical: "middle"` |
| `font.name` | `font.family` |
| `duration` | `length` |
| `transitions: [...]` (array) | `transition: { in, out }` (object) |
| `fit: "cover"` (CSS instinct) | `fit: "crop"` |
| `tracks[0]` is the bottom (z-index instinct) | `tracks[0]` is the **TOP** layer |

The full ruleset (asset types, fonts, smart-string clip values, top-5 mistakes) lives in `shared/agent-core.md`. The same file is also returned by the Shotstack MCP server's `get_shotstack_guide` tool, so the conventions are identical across surfaces.

**For anything that animates, compose motion from the house tokens** — one duration scale (`base` 0.6 s in / `fast` 0.33 s out), one house ease (`power3.out` / `cubic-bezier(0.16,1,0.3,1)`, no overshoot by default), one stagger (`0.13 s`). The *Motion language* section of `agent-core.md` is the summary; [`references/motion.md`](references/motion.md) has the full GSAP/CSS recipes and the brand kit. **Don't invent a new easing or duration per clip** — shared tokens are what make a multi-clip edit feel like one production.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Permanent error — validation, missing key, 4xx, render `failed` |
| `2` | Transient error — 5xx, network, timeout. Safe to retry. |

## References

Authoritative sources, in order of preference:

- `shotstack --help` and `shotstack <command> --help` — current CLI flag listing
- [`shared/agent-core.md`](shared/agent-core.md) — Edit JSON authoring conventions (shared with MCP server)
- <https://shotstack.io/docs/api/api.edit.json> — OpenAPI Schema for the render API (machine-validatable)
- <https://shotstack.io/docs/guide/llms-full.txt> — full API docs in LLM-friendly single file
- <https://github.com/shotstack/oas-api-definition/tree/main/schemas> — raw OpenAPI YAML, source of truth for property names and enums
- <https://shotstack.io/docs/guide/> — interactive HTML docs and guides
- <https://shotstack.io/docs/api/> — interactive HTML API reference
- <https://github.com/shotstack/shotstack-cli> — CLI source

This skill ships sub-references for the gnarly bits:

- [`references/onboarding.md`](references/onboarding.md) — first-render discovery interview for new users: what to ask, and how answers map to a first Edit
- [`references/ingest.md`](references/ingest.md) — uploading local files (and fetching URLs) so they can be used in an Edit: the upload→render workflow, `--watch`, status values, supported types
- [`references/timeline.md`](references/timeline.md) — track layering, transitions, background music via audio assets
- [`references/positioning.md`](references/positioning.md) — coordinate model, `position`/`offset` (fraction of frame, +y up), clip bounding box & `fit`, text sizing, transform order
- [`references/caption.md`](references/caption.md) — sizing per resolution, default style, the 5 named presets, alias pattern (asset type: `rich-caption`)
- [`references/svg.md`](references/svg.md) — required attrs, supported elements
- [`references/motion.md`](references/motion.md) — **the house motion language**: one duration scale, one ease, one stagger; choreography recipes (GSAP/CSS), the rich-text/transition mappings, and the brand kit. Read before composing any animation.
- [`references/html5.md`](references/html5.md) — HTML5 asset: fields, preloaded libs (gsap/d3/anime/lottie), browser harness, sizing, worked examples
- [`references/html5-snippets.md`](references/html5-snippets.md) — copy-paste motion-graphic clips: kinetic headline, value reveal, shine sweep, pulsing CTA, film grain
- [`references/fonts.md`](references/fonts.md) — built-in fonts, Google Fonts URL pattern, custom-font workflow
- [`references/asset-library.md`](references/asset-library.md) — placeholder videos, images, music
- [`references/troubleshooting.md`](references/troubleshooting.md) — common errors and fixes

If this skill and `--help` ever disagree, trust `--help`. If this skill and `llms-full.txt` ever disagree, trust `llms-full.txt`.
