# Ingesting local files (Ingest API)

The `shotstack ingest` commands host your own media on Shotstack so it can be
referenced from an Edit. This is the **Ingest API** — a separate service from
the Edit (render) API, living at `https://api.shotstack.io/ingest/{env}`. The
CLI targets it automatically; the same `SHOTSTACK_API_KEY` works for both.

Use it when your footage, audio, images, fonts, or subtitle files live on your
machine (or behind a URL) rather than already being on a public CDN. Sources
are stored until you delete them.

## The one rule that matters

**An Edit can only reference media by URL.** A local path in an `asset.src`
will not render. So the flow is always:

```
local file ──▶ shotstack ingest upload ──▶ hosted "source" URL ──▶ Edit asset.src ──▶ shotstack render
```

`shotstack ingest upload <file>` performs the two-step Ingest dance for you in
one command: it asks the API for a pre-signed URL, then streams your file's
bytes straight to storage.

## Get the hosted URL: use `--watch`

The bare command returns only a source **id** — the hosted URL does not exist
until ingestion finishes. Pass `--watch` to poll until the source is `ready`
and print its URL:

```sh
shotstack ingest upload ./intro.mp4 --watch --output json
# → {"id":"zzytey4v-...","status":"importing"}
# → {"id":"zzytey4v-...","status":"ready","source":"https://shotstack-ingest-api-v1-sources.s3.ap-southeast-2.amazonaws.com/.../source.mp4","width":1920,"height":1080,"duration":12.4}
```

The `source` field is the URL to drop into your Edit. In text mode the final
line is just `ready  <url>`, easy to capture in a shell variable:

```sh
SRC=$(shotstack ingest upload ./intro.mp4 --watch --output json | tail -n1 | jq -r .source)
```

Without `--watch`, capture the id and poll it later:

```sh
ID=$(shotstack ingest upload ./intro.mp4 --output json | jq -r .id)
shotstack ingest status "$ID" --watch --output json
```

## Worked example: upload then render

```sh
# 1. Upload a local clip and a local logo, capturing the hosted URLs.
VIDEO=$(shotstack ingest upload ./clip.mp4 --watch --output json | tail -n1 | jq -r .source)
LOGO=$(shotstack ingest upload ./logo.png  --watch --output json | tail -n1 | jq -r .source)

# 2. Reference them in an Edit (asset.src), then render.
cat > edit.json <<JSON
{
  "timeline": {
    "tracks": [
      { "clips": [ { "asset": { "type": "image", "src": "$LOGO" },  "start": 0, "length": 5 } ] },
      { "clips": [ { "asset": { "type": "video", "src": "$VIDEO" }, "start": 0, "length": 5 } ] }
    ]
  },
  "output": { "format": "mp4", "size": { "width": 1920, "height": 1080 } }
}
JSON

shotstack render edit.json --watch

or

shotstack studio edit.json
```

Remember `tracks[0]` is the **top** layer (see `shared/agent-core.md`), so the
logo track sits above the video.

## Fetch a remote URL instead of uploading

If the media is already at a URL but you want Shotstack to host its own copy
(stable, no hot-linking), use `fetch`:

```sh
shotstack ingest fetch https://example.com/big-video.mp4 --watch --output json
```

This only works for fully validated urls. YouTube and similar video hosting  
platforms are not supported.

## Manage stored sources

```sh
shotstack ingest list --output json          # every source you've ingested
shotstack ingest status <id> --output json   # one source's status + hosted URL
shotstack ingest delete <id>                  # remove a source from storage
```

## Status values

`queued` → `importing` → `ready` (terminal). A failed import ends in `failed`
(exit code 1 under `--watch`). `deleted` and `overwritten` are also terminal.

## Supported files

Video, image, audio, font, and subtitle (`.srt`/`.vtt`) files. The CLI infers
a `Content-Type` from the file extension; uncommon extensions still upload
(the API sniffs the content) but naming files with a correct extension is
safest.

## Environments

Sources are ingested into the environment you target (`--env stage` or `--env
v1`, default `v1`), mirroring `render`. Override the base URL for local testing
with `SHOTSTACK_INGEST_BASE_URL`.

```sh
shotstack ingest upload ./clip.mp4 --watch --env stage
```
