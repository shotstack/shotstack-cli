import { Command } from "commander";
import type { components } from "@shotstack/schemas";
import { createClient, type Client } from "../http/client.ts";
import { requireApiKey } from "../http/auth.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv } from "../recorder.ts";

// The published schema has no `pricing`; API deployments that predate generation quotes still send it.
type GenerationModelPricing = {
  credits: number | Record<string, number>;
  tieredBy?: { option: string; default: string };
  quantity?: { measure: string; per: number };
};
export type GenerationModel = components["schemas"]["GenerationModel"] & { pricing?: GenerationModelPricing };
type GenerationModelList = components["schemas"]["GenerationModelListResponse"];

const UNIT_NOUNS: Record<string, string> = { clipSeconds: "second", promptCharacters: "character" };

export async function listModels(client: Client): Promise<GenerationModel[]> {
  const result = await client.get<GenerationModelList>("/models");
  return result.models;
}

/** One model, including the JSON Schema for its `options`. */
export async function fetchModel(client: Client, id: string): Promise<GenerationModel> {
  return client.get<GenerationModel>(`/models/${encodeURIComponent(id)}`);
}

export const modelsCommand = new Command("models")
  .description("List generation models with availability and price, or show one model's options")
  .argument("[id]", "Model id; prints the JSON Schema for its options")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (id: string | undefined, options: { env?: string; output: string }) => {
    await withRecording("models", commandArgv("models"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env);
      const apiKey = requireApiKey(env.name);
      const client = createClient({ apiKey, env });

      if (id) {
        const model = await fetchModel(client, id);
        emit(format, model, formatModelDetail(model));
        return { response: { model: model.model, available: model.available } };
      }

      const models = await listModels(client);
      emit(format, models, models.length ? formatModelTable(models) : "No models.");
      return { response: { count: models.length } };
    });
  });

// `available` is omitted when the account could not be read; that is not a yes.
export function formatAvailability(model: GenerationModel): string {
  if (model.available === true) return "available";
  if (model.available === false) return `unavailable: ${model.unavailableReason ?? "no reason given"}`;
  return "availability unknown";
}

export function formatPrice(pricing: GenerationModelPricing): string {
  const unit = formatUnit(pricing.quantity);
  if (typeof pricing.credits === "number") return `${pricing.credits} ${pricing.credits === 1 ? "credit" : "credits"} ${unit}`;
  const fallback = pricing.tieredBy?.default;
  const tiers = Object.entries(pricing.credits)
    .map(([tier, credits]) => `${tier} ${credits}${tier === fallback ? " (default)" : ""}`)
    .join(", ");
  return `credits ${unit} by ${pricing.tieredBy?.option ?? "option"}: ${tiers}`;
}

function formatUnit(quantity: GenerationModelPricing["quantity"]): string {
  if (!quantity) return "per generation";
  const noun = UNIT_NOUNS[quantity.measure] ?? quantity.measure;
  return quantity.per === 1 ? `per ${noun}` : `per ${quantity.per} ${noun}s`;
}

function formatModelTable(models: GenerationModel[]): string {
  const rows = models.map((m) => [m.model, m.type, formatAvailability(m), m.pricing ? formatPrice(m.pricing) : ""]);
  const widths = rows[0]!.map((_, col) => Math.max(...rows.map((row) => row[col]!.length)));
  return rows.map((row) => row.map((cell, col) => cell.padEnd(widths[col]!)).join("  ").trimEnd()).join("\n");
}

function formatModelDetail(model: GenerationModel): string {
  const lines = [`${model.model}  ${model.type}  ${formatAvailability(model)}`];
  if (model.name) lines.push(model.description ? `${model.name}: ${model.description}` : model.name);
  if (model.pricing) lines.push(`Price: ${formatPrice(model.pricing)}`);
  if (model.options) lines.push("Options:", JSON.stringify(model.options, null, 2));
  return lines.join("\n");
}
