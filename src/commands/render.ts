import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { createClient } from "../http/client.ts";
import { requireApiKey } from "../http/auth.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv } from "../recorder.ts";

interface RenderResponse {
  success: boolean;
  message: string;
  response: { id: string; message?: string };
}

export const renderCommand = new Command("render")
  .description("Submit a Shotstack Edit JSON to the render API")
  .argument("<file>", "Path to a Shotstack Edit JSON file")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { env?: string; output: string }) => {
    await withRecording("render", commandArgv("render"), async () => {
      const format = parseOutputFormat(options.output);
      const apiKey = requireApiKey();
      const env = resolveEnv(options.env);

      const path = resolve(process.cwd(), file);
      const raw = await readFile(path, "utf8");
      const template = JSON.parse(raw) as unknown;

      const client = createClient({ apiKey, env });
      const result = await client.post<RenderResponse>("/render", template);
      const id = result.response.id;

      emit(format, { id }, id);
      return { renderId: id, response: result.response };
    });
  });
