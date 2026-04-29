import { Command } from "commander";
import { createClient } from "../http/client.ts";
import { requireApiKey } from "../http/auth.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv } from "../recorder.ts";

interface StatusResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    status: "queued" | "fetching" | "rendering" | "saving" | "done" | "failed";
    url?: string;
    error?: string;
    duration?: number;
    renderTime?: number;
  };
}

const TERMINAL_STATES = new Set(["done", "failed"]);
const POLL_INTERVAL_MS = 3000;

export const statusCommand = new Command("status")
  .description("Poll the status of a Shotstack render")
  .argument("<id>", "Render ID returned by `shotstack render`")
  .option("--watch", "Poll continuously until the render reaches a terminal state")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (id: string, options: { watch?: boolean; env?: string; output: string }) => {
    await withRecording("status", commandArgv("status"), async () => {
      const format = parseOutputFormat(options.output);
      const apiKey = requireApiKey();
      const env = resolveEnv(options.env);
      const client = createClient({ apiKey, env });

      while (true) {
        const result = await client.get<StatusResponse>(`/render/${encodeURIComponent(id)}`);
        const r = result.response;
        emit(format, r, formatHuman(r));

        if (!options.watch || TERMINAL_STATES.has(r.status)) {
          const exitCode = r.status === "failed" ? 1 : 0;
          return { renderId: r.id, response: r, exitCode };
        }
        await sleep(POLL_INTERVAL_MS);
      }
    });
  });

function formatHuman(r: StatusResponse["response"]): string {
  const parts: string[] = [r.status];
  if (r.url) parts.push(r.url);
  if (r.error) parts.push(`error: ${r.error}`);
  return parts.join("  ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
