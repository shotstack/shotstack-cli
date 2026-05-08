---
name: shotstack
description: |
  Render video and poll render status via the Shotstack API.
  Use when generating clips, building automated video pipelines, or orchestrating
  cloud video renders from a script, agent, or CI workflow.
  NOT for: real-time streaming, or live broadcasting.
license: Apache-2.0
---

# Shotstack CLI

Two commands for the Shotstack video rendering API. `render` submits an Edit JSON and returns a render ID; `status` polls a render until done.

## Authentication

```sh
export SHOTSTACK_API_KEY=...
```

Get a key at <https://app.shotstack.io>. Without a key, every command exits with code 1.

## Environments

```
--env stage    → https://api.shotstack.io/edit/stage   (test credits, free)
--env v1       → https://api.shotstack.io/edit/v1      (production, default)
```

Use `--env stage` for experimentation. Stage is free; v1 charges real credits. Override with `SHOTSTACK_ENV` env var for the session.

## Quickstart

```sh
# Submit + poll in one command (most agent flows want this).
shotstack render template.json --watch
# → done  https://shotstack-api-v1-output.s3.amazonaws.com/.../01ja7-x8m2k-39rzv-cmvxve.mp4

# Submit only (returns ID).
shotstack render template.json --output json
# → {"id":"01ja7-x8m2k-39rzv-cmvxve"}

# Poll an existing render to terminal state.
shotstack status 01ja7-x8m2k-39rzv-cmvxve --watch
# → done  https://shotstack-api-v1-output.s3.amazonaws.com/.../01ja7-x8m2k-39rzv-cmvxve.mp4
```

## Hand-off to a human before rendering

When a human is in the loop and may want to tweak the result, prefer **`shotstack studio <file>`** over `shotstack render`. By default it posts the JSON to the share API and opens `https://shotstack.studio/s/<slug>` in the browser — a short, shareable URL. No API key, no render credits charged. The human can play, edit, and decide whether to render.

```sh
shotstack studio template.json              # opens browser + prints short URL
shotstack studio template.json --no-open    # headless: just print the URL
shotstack studio template.json --no-shorten # emit base64url URL inline (offline / debug)
shotstack studio template.json --output json # piping: {"url":"...","shortened":true}, no browser
```

On headless systems (no `xdg-open`, no `$DISPLAY`) the browser launch silently no-ops; the URL is still printed. Safe to run anywhere.

If the share API is unreachable, the command falls back to the inline base64url form automatically and prints a stderr warning. Shares expire after 30 days.

Use `render` only when you're confident the JSON is final, or there's no human to review.

## Four CLI rules

1. **Pipe → `--output json`.** Default output is human-readable. When parsing programmatically or piping to another command, always pass `--output json`.

2. **Use `--watch`, not a polling loop.** `shotstack render <file> --watch` submits and polls in one shot; `shotstack status <id> --watch` polls an existing render. Both exit when terminal: `done` (exit 0) or `failed` (exit 1). Don't write `while true; do ...; sleep 3; done`.

3. **Fetch the current schema and docs before generating Edit JSON.** The Shotstack API evolves; LLM training data is often stale. Pull <https://shotstack.io/docs/api/api.edit.json> and <https://shotstack.io/docs/guide/llms-full.txt> for the current schema and guides before composing an Edit from scratch.

4. **Hand off to a human via `studio` when uncertain.** Don't burn render credits iterating. Generate JSON → `shotstack studio` → human reviews/tweaks → render only when right.

## Authoring Edit JSON

The conventions agents most often get wrong (track order is reversed, asset type names, font allowlist, smart strings) live in the shared agent-core guide:

**See [`shared/agent-core.md`](shared/agent-core.md)** before composing any Edit JSON.

This file is also delivered to chat-based clients (Claude.ai, ChatGPT) via the Shotstack MCP server, so the conventions stay identical across surfaces.

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

- [`references/timeline.md`](references/timeline.md) — track layering, transitions, background music via audio assets
- [`references/caption.md`](references/caption.md) — sizing per resolution, default style, the 5 named presets, alias pattern (asset type: `rich-caption`)
- [`references/svg.md`](references/svg.md) — required attrs, supported elements
- [`references/fonts.md`](references/fonts.md) — built-in fonts, Google Fonts URL pattern, custom-font workflow
- [`references/asset-library.md`](references/asset-library.md) — placeholder videos, images, music
- [`references/troubleshooting.md`](references/troubleshooting.md) — common errors and fixes

If this skill and `--help` ever disagree, trust `--help`. If this skill and `llms-full.txt` ever disagree, trust `llms-full.txt`.
