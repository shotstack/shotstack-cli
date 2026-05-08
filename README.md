# Shotstack CLI

Command-line interface for the [Shotstack](https://shotstack.io) video rendering API. Built for humans and AI agents.

```sh
shotstack render template.json
shotstack status <render-id> --watch
```

## Install

```sh
# npm (global)
npm i -g @shotstack/cli

# one-shot via npx
npx @shotstack/cli render template.json

# one-shot via bun
bunx @shotstack/cli render template.json
```

All three install paths use the same `@shotstack/cli` package on npm.

## Authentication

Set your API key as an environment variable:

```sh
export SHOTSTACK_API_KEY=...
```

Get a key at <https://shotstack.io>.

## Environments

Pick the API environment with `--env` or `SHOTSTACK_ENV`. Defaults to `v1` (production).

| `--env` | Endpoint |
|---|---|
| `stage` | `https://api.shotstack.io/edit/stage` |
| `v1` (default) | `https://api.shotstack.io/edit/v1` |

```sh
shotstack render template.json --env stage
SHOTSTACK_ENV=stage shotstack render template.json
```

## Commands

### `shotstack render <file>`

Submits a Shotstack Edit JSON to the render API. Returns a render ID. With `--watch`, polls until the render reaches a terminal state and prints the output URL — equivalent to `render` followed by `status --watch` but in one command.

```sh
shotstack render my-template.json
shotstack render my-template.json --output json
shotstack render my-template.json --watch              # submit + poll until done
shotstack render my-template.json --watch --output json
```

### `shotstack status <id>`

Polls the render status. Use `--watch` to poll continuously until the render completes.

```sh
shotstack status 01ja7-x8m2k-...
shotstack status 01ja7-x8m2k-... --watch
shotstack status 01ja7-x8m2k-... --output json
```

### `shotstack studio <file>`

Opens a `shotstack.studio` URL that loads the Edit JSON in the browser-based editor. By default, posts the JSON to the share API and emits a short URL like `https://shotstack.studio/s/abc12345` — clean, shareable, expires in 30 days. Falls back to inline base64url encoding if the share API is unreachable.

No render API key required; no render credits charged. Use to hand a generated edit off to a human for review or quick tweaks before rendering.

```sh
shotstack studio my-template.json
# → opens browser silently with https://shotstack.studio/s/<slug>

shotstack studio my-template.json --copy        # also copies URL to clipboard
shotstack studio my-template.json --no-open     # print URL, don't open browser
shotstack studio my-template.json --no-shorten  # emit base64url inline (offline / debug)
shotstack studio my-template.json --output json # emit {"url":"...","shortened":true} on stdout
```

When a browser can be launched, the command is silent — the URL only opens in the browser. On a headless server (no `$DISPLAY`, no `xdg-open`), the URL is printed to stdout instead so you can copy it elsewhere.

### `shotstack feedback`

Opens a pre-filled GitHub issue with a sanitised dossier of your last 5 CLI invocations (render IDs, errors, exit codes). API keys and signed URLs are stripped at write time. You review and submit in your browser; nothing is transmitted automatically. Inspect the log at `~/.shotstack/log.jsonl`.

## Output

Default is human-readable. Pass `--output json` for machine-readable output. Exit codes:

- `0` success
- `1` permanent error (4xx, validation, missing API key)
- `2` transient/retryable error (5xx, network)

## For AI agents

This repo ships a [`SKILL.md`](./SKILL.md) at the root, following the [Agent Skills open standard](https://agentskills.io). Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, and 50+ other agents.

```sh
npx skills add shotstack/shotstack-cli
```

The skill loads at session start (~50-100 tokens metadata) and teaches the agent three things `--help` doesn't:

- Always pass `--output json` when piping
- Use `shotstack status --watch` instead of writing a polling loop
- Fetch the current timeline schema from <https://shotstack.io/docs/llms.txt> before submitting

## Telemetry

Every API request includes two headers so we can split CLI traffic in dashboards:

- `x-shotstack-origin: cli`
- `x-shotstack-environment: stage | v1`

No other data is sent. The CLI never phones home; it only talks to the Shotstack API.

## Licence

Apache 2.0.
