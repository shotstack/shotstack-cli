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

Save your API key once with `shotstack login`. It's stored in `~/.shotstack/credentials.json`, keyed per environment:

```sh
shotstack login                  # prompts for the key (hidden), saves the v1 key
shotstack login --env stage      # save the stage key
echo "$KEY" | shotstack login    # non-interactive: read the key from stdin (CI/agents)
shotstack logout [--env <name>]  # remove a saved key (--all removes every env)
```

Alternatively, set an environment variable, which **overrides** any saved key:

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

The `ingest` commands target the parallel `https://api.shotstack.io/ingest/{env}` base with the same API key.

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

### `shotstack ingest <subcommand>`

Uploads your own local files (or fetches remote URLs) via the [Ingest API](https://shotstack.io/docs/guide/ingesting-footage/ingest-api/) and hosts them on Shotstack so they can be referenced from an Edit. An Edit can only reference media by URL, so this is how you get a local clip, image, audio file, or font into a render.

```sh
# Upload a local file; --watch polls until ready and prints the hosted URL.
shotstack ingest upload ./clip.mp4 --watch
# → ready  https://shotstack-ingest-api-v1-sources.s3.ap-southeast-2.amazonaws.com/.../source.mp4

shotstack ingest upload ./clip.mp4 --output json   # returns {"id":"..."} immediately (no URL yet)
shotstack ingest fetch https://example.com/v.mp4 --watch   # host a copy of a remote URL
shotstack ingest status <source-id> --watch        # poll an existing source
shotstack ingest list --output json                # list ingested sources
shotstack ingest delete <source-id>                # remove a source from storage
```

Sources are stored until you delete them. The bare `upload`/`fetch` commands return only an id — use `--watch` (or `ingest status`) to get the hosted URL once ingestion is `ready`.

### `shotstack login` / `shotstack logout`

Saves (or removes) your API key so it persists across shell sessions. Keys are stored per environment in `~/.shotstack/credentials.json`.

```sh
shotstack login                  # prompt, save the v1 (production) key
shotstack login --env stage      # save the stage key
echo "$KEY" | shotstack login --env v1   # non-interactive (CI / agents)
shotstack logout --env stage     # remove the stage key
shotstack logout --all           # remove every saved key
```

The `SHOTSTACK_API_KEY` env var always takes precedence over a saved key, so CI and automation are unaffected.

### `shotstack feedback`

Opens a pre-filled GitHub issue with a sanitised dossier of your last 5 CLI invocations (render IDs, errors, exit codes). API keys and signed URLs are stripped at write time. You review and submit in your browser; nothing is transmitted automatically. Inspect the log at `~/.shotstack/log.jsonl`.

## Output

Default is human-readable. Pass `--output json` for machine-readable output. Exit codes:

- `0` success
- `1` permanent error (4xx, validation, missing API key)
- `2` transient/retryable error (5xx, network)

## For AI agents

This repo ships an Agent Skill in [`skills/shotstack/`](./skills/shotstack/), a self-contained skill folder following the [Agent Skills open standard](https://agentskills.io). Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, and 50+ other agents.

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
