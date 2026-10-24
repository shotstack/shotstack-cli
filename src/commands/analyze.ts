import { Command } from "commander";
import { requireApiKey } from "../http/auth.ts";
import { createClient, type Client } from "../http/client.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, type OutputFormat, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv, type CommandResult } from "../recorder.ts";

export interface MusicMap {
  bpm?: number;
  meter?: number;
  bar?: number;
  origin?: number;
  steady?: boolean;
  bars?: { count?: number };
  beats?: unknown[];
  downbeats?: number[];
  drops?: unknown[];
  sections?: unknown[];
}

export interface Analysis {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  url?: string;
  error?: string;
}

const TERMINAL_STATES = new Set(["done", "failed"]);
const POLL_INTERVAL_MS = 3000;

export const analyzeCommand = new Command("analyze")
  .alias("analyse")
  .description("Find a music track's tempo, beats, bars, drops and sections")
  .argument("<src>", "Public URL of an audio or video file; host a local file with `shotstack ingest upload` first")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (src: string, options: { env?: string; output: string }) => {
    await withRecording("analyze", commandArgv("analyze"), async () => {
      const format = parseOutputFormat(options.output);
      // Analysis costs no credits, but /generate requires a key to identify the account.
      const env = resolveEnv(options.env);
      const client = createClient({ apiKey: requireApiKey(env.name), env });
      return runAnalyze(client, src, format);
    });
  });

// Waits for the result: analysis takes seconds and costs nothing, so there's no job worth leaving behind.
export async function runAnalyze(
  client: Client,
  src: string,
  format: OutputFormat,
  intervalMs: number = POLL_INTERVAL_MS,
): Promise<CommandResult> {
  let job = await client.post<Analysis>("/generate", {
    asset: { type: "audio", model: "shotstack-music-analysis", src },
  });
  while (!TERMINAL_STATES.has(job.status)) {
    if (format !== "json") console.error(`${job.status}  ${job.id}`);
    await sleep(intervalMs);
    job = await client.get<Analysis>(`/generate/${encodeURIComponent(job.id)}`);
  }
  if (job.status === "failed") {
    emit(format, job, `failed  error: ${job.error ?? "unknown error"}`);
    return { response: job, exitCode: 1 };
  }
  // The map is public JSON on the CDN: fetch it without the API key.
  if (!job.url) return fail(job, "analysis finished without a map URL");
  const res = await fetch(job.url);
  if (!res.ok) return fail(job, `could not fetch the analysis map (${res.status}) from ${job.url}`);
  const map = (await res.json()) as MusicMap;
  emit(format, map, `done  ${formatSummary(map)}`);
  if (format !== "json") console.error("Print the full map with --output json.");
  return { response: job, exitCode: 0 };
}

function fail(job: Analysis, message: string): CommandResult {
  console.error(message);
  return { response: job, exitCode: 1 };
}

export function formatSummary(m: MusicMap): string {
  const counts = `${m.drops?.length ?? 0} drops, ${m.sections?.length ?? 0} sections`;
  if (!m.steady) {
    return `tempo varies (about ${m.bpm} BPM): ${m.beats?.length ?? 0} beats, ${m.downbeats?.length ?? 0} downbeats, ${counts}`;
  }
  return `${m.bpm} BPM, ${m.meter}/4, bar ${m.bar?.toFixed(2)} s from ${m.origin?.toFixed(2)} s, ${m.bars?.count ?? 0} bars, ${counts}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
