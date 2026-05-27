import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { Command } from "commander";
import { createClient, type Client, ApiError } from "../http/client.ts";
import { requireApiKey } from "../http/auth.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, type OutputFormat, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv } from "../recorder.ts";

const POLL_INTERVAL_MS = 3000;
const SOURCE_TERMINAL_STATES = new Set(["ready", "failed", "deleted", "overwritten"]);

export type SourceStatus = "queued" | "importing" | "ready" | "failed" | "deleted" | "overwritten";

export interface SourceAttributes {
  id: string;
  status: SourceStatus;
  input?: string;
  source?: string;
  width?: number;
  height?: number;
  duration?: number;
  error?: string;
}

interface UploadResponse {
  data: { attributes: { id: string; url: string; expires?: string } };
}

interface QueuedSourceResponse {
  data: { type: string; id: string };
}

interface SourceResponse {
  data: { type: string; id: string; attributes: SourceAttributes };
}

interface SourceListResponse {
  data: Array<{ type: string; id: string; attributes: SourceAttributes }>;
}

type WatchOptions = { env?: string; watch?: boolean; output: string };
type ReadOptions = { env?: string; output: string };

export const ingestCommand = new Command("ingest").description(
  "Ingest source media via the Shotstack Ingest API: upload local files, fetch remote URLs, and manage stored sources",
);

ingestCommand
  .command("upload <file>")
  .description("Upload a local file and host it on Shotstack for use as an Edit asset src")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--watch", "Poll until the source is ready, then print its hosted URL")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: WatchOptions) => {
    await withRecording("ingest upload", commandArgv("upload"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env, "ingest");
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      const bytes = await readFile(resolve(process.cwd(), file));
      const upload = await client.post<UploadResponse>("/upload");
      const { id, url } = upload.data.attributes;
      await putToSignedUrl(url, bytes, guessContentType(file));

      return finishSource(client, id, format, options.watch === true);
    });
  });

ingestCommand
  .command("fetch <url>")
  .description("Ingest a remote URL into Shotstack-hosted storage")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--watch", "Poll until the source is ready, then print its hosted URL")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (url: string, options: WatchOptions) => {
    await withRecording("ingest fetch", commandArgv("fetch"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env, "ingest");
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      const queued = await client.post<QueuedSourceResponse>("/sources", { url });
      return finishSource(client, queued.data.id, format, options.watch === true);
    });
  });

ingestCommand
  .command("status <id>")
  .description("Poll the status of an ingested source")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--watch", "Poll continuously until the source reaches a terminal state")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (id: string, options: WatchOptions) => {
    await withRecording("ingest status", commandArgv("status"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env, "ingest");
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });
      const final = await pollSource(client, id, format, options.watch === true);
      return { renderId: final.id, response: sourceView(final), exitCode: final.status === "failed" ? 1 : 0 };
    });
  });

ingestCommand
  .command("list")
  .description("List ingested sources")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (options: ReadOptions) => {
    await withRecording("ingest list", commandArgv("list"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env, "ingest");
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      const res = await client.get<SourceListResponse>("/sources");
      const sources = res.data.map((d) => sourceView(d.attributes));
      const human = sources.length
        ? sources.map((s) => [s.id, s.status, s.source ?? ""].join("  ").trimEnd()).join("\n")
        : "No sources.";
      emit(format, sources, human);
      return { response: { count: sources.length } };
    });
  });

ingestCommand
  .command("delete <id>")
  .description("Delete an ingested source")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (id: string, options: ReadOptions) => {
    await withRecording("ingest delete", commandArgv("delete"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env, "ingest");
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      await client.del(`/sources/${encodeURIComponent(id)}`);
      emit(format, { id, deleted: true }, `deleted ${id}`);
      return { renderId: id, response: { id, deleted: true } };
    });
  });

async function finishSource(client: Client, id: string, format: OutputFormat, watch: boolean) {
  if (!watch) {
    emit(format, { id }, id);
    return { renderId: id, response: { id } };
  }
  const final = await pollSource(client, id, format, true);
  return { renderId: id, response: sourceView(final), exitCode: final.status === "failed" ? 1 : 0 };
}

export async function pollSource(
  client: Client,
  id: string,
  format: OutputFormat,
  watch: boolean,
  intervalMs: number = POLL_INTERVAL_MS,
): Promise<SourceAttributes> {
  while (true) {
    const result = await client.get<SourceResponse>(`/sources/${encodeURIComponent(id)}`);
    const attributes = result.data.attributes;
    emit(format, sourceView(attributes), formatHuman(attributes));

    if (!watch || SOURCE_TERMINAL_STATES.has(attributes.status)) return attributes;
    await sleep(intervalMs);
  }
}

/**
 * PUT raw file bytes to the pre-signed S3 URL returned by POST /upload.
 * This is a foreign-host request: it must NOT carry the api key, and the
 * signature lives in the URL's query string, so we send only the body
 * (plus an optional Content-Type, which S3 does not include in the signature).
 */
export async function putToSignedUrl(url: string, body: Uint8Array, contentType?: string): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: contentType ? { "content-type": contentType } : undefined,
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Deliberately keep the signed URL out of the message — it is logged.
    throw new ApiError(res.status, detail || undefined, `PUT upload → ${res.status} ${res.statusText}`);
  }
}

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".ogv": "video/ogg",
  ".wmv": "video/x-ms-wmv",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".svg": "image/svg+xml",
  ".srt": "application/x-subrip",
  ".vtt": "text/vtt",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function guessContentType(filename: string): string | undefined {
  return MIME_BY_EXT[extname(filename).toLowerCase()];
}

function sourceView(a: SourceAttributes): SourceAttributes {
  const view: SourceAttributes = { id: a.id, status: a.status };
  if (a.source) view.source = a.source;
  if (a.input) view.input = a.input;
  if (a.width) view.width = a.width;
  if (a.height) view.height = a.height;
  if (a.duration) view.duration = a.duration;
  if (a.error) view.error = a.error;
  return view;
}

function formatHuman(a: SourceAttributes): string {
  const parts: string[] = [a.status];
  if (a.source) parts.push(a.source);
  if (a.error) parts.push(`error: ${a.error}`);
  return parts.join("  ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
