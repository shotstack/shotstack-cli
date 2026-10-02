import { Command, InvalidArgumentError } from "commander";
import type { components } from "@shotstack/schemas";
import { createClient, type Client } from "../http/client.ts";
import { requireApiKey } from "../http/auth.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, type OutputFormat, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv, type CommandResult } from "../recorder.ts";
import { fetchModel, formatAvailability, type GenerationModel } from "./models.ts";

export type Generation = components["schemas"]["GenerationResponse"];

export interface GenerateInput {
  model: string;
  prompt: string;
  options?: Record<string, unknown>;
  length?: number;
}

const TERMINAL_STATES = new Set(["done", "failed"]);
const POLL_INTERVAL_MS = 3000;

export const generateCommand = new Command("generate")
  .description("Generate one image, video or audio asset from a prompt")
  .argument("<model>", "Model id from `shotstack models`")
  .argument("<prompt>", "Text prompt; for a speech model, the words to speak")
  .option("--options <json>", "Model options as a JSON object (see `shotstack models <model>`)", parseOptionsJson)
  .option("--length <seconds>", "Length of the clip the asset fills; models that generate to a duration use it", parseSeconds)
  .option("--watch", "Poll until the asset is ready, then print its URL")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(
    async (
      model: string,
      prompt: string,
      options: { options?: Record<string, unknown>; length?: number; watch?: boolean; env?: string; output: string },
    ) => {
      await withRecording("generate", commandArgv("generate"), async () => {
        const format = parseOutputFormat(options.output);
        const env = resolveEnv(options.env);
        const apiKey = requireApiKey(env.name);
        const client = createClient({ apiKey, env });
        const input = { model, prompt, options: options.options, length: options.length };
        return runGenerate(client, input, format, options.watch === true);
      });
    },
  );

export async function runGenerate(
  client: Client,
  input: GenerateInput,
  format: OutputFormat,
  watch: boolean,
  intervalMs: number = POLL_INTERVAL_MS,
): Promise<CommandResult> {
  // The model's type is needed for the asset, and an unavailable model is refused before anything is billed.
  const model = await fetchModel(client, input.model);
  if (model.available === false) {
    const refusal = { model: model.model, available: false, unavailableReason: model.unavailableReason };
    if (format === "json") console.log(JSON.stringify(refusal));
    else console.error(`✗ ${model.model} is ${formatAvailability(model)}`);
    return { response: refusal, exitCode: 1 };
  }

  // No Idempotency-Key: without one, identical requests share a job and its cached result.
  const submitted = await client.post<Generation>("/generate", buildRequest(model, input));
  emit(format, submitted, formatHuman(submitted));

  let final = submitted;
  if (!TERMINAL_STATES.has(submitted.status)) {
    if (watch) final = await pollGeneration(client, submitted.id, format, intervalMs);
    else if (format !== "json") {
      console.error("Still generating. Run the same command with --watch to wait; the same request returns this job instead of starting another.");
    }
  }
  return { renderId: final.id, response: final, exitCode: final.status === "failed" ? 1 : 0 };
}

export function buildRequest(model: GenerationModel, input: GenerateInput) {
  return {
    asset: {
      type: model.type,
      prompt: input.prompt,
      model: model.model,
      ...(input.options && { options: input.options }),
    },
    ...(input.length !== undefined && { length: input.length }),
  };
}

export async function pollGeneration(
  client: Client,
  id: string,
  format: OutputFormat,
  intervalMs: number = POLL_INTERVAL_MS,
): Promise<Generation> {
  while (true) {
    await sleep(intervalMs);
    const generation = await client.get<Generation>(`/generate/${encodeURIComponent(id)}`);
    emit(format, generation, formatHuman(generation));
    if (TERMINAL_STATES.has(generation.status)) return generation;
  }
}

export function parseOptionsJson(value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidArgumentError("Not valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidArgumentError("Expected a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

// Checked here because NaN serialises to null, which the API reads as no length and bills the model's default.
export function parseSeconds(value: string): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new InvalidArgumentError("Expected a positive number of seconds.");
  return seconds;
}

function formatHuman(g: Generation): string {
  if (g.status === "done") return `done  ${g.url ?? ""}`.trimEnd();
  if (g.status === "failed") return `failed  error: ${g.error ?? "unknown error"}`;
  return `${g.status}  ${g.id}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
