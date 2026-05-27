import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { createClient } from "../http/client.ts";
import { requireApiKey } from "../http/auth.ts";
import { resolveEnv, ENV_NAMES } from "../http/env.ts";
import { emit, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv } from "../recorder.ts";
import { pollStatus } from "./status.ts";
import { validateEdit, formatIssues } from "../lib/validate.ts";

interface RenderResponse {
  success: boolean;
  message: string;
  response: { id: string; message?: string };
}

export const renderCommand = new Command("render")
  .description("Submit a Shotstack Edit JSON to the render API")
  .argument("<file>", "Path to a Shotstack Edit JSON file")
  .option(`--env <name>`, `Environment: ${ENV_NAMES.join(" | ")}`)
  .option("--watch", "After submitting, poll until the render reaches a terminal state")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { env?: string; watch?: boolean; output: string }) => {
    await withRecording("render", commandArgv("render"), async () => {
      const format = parseOutputFormat(options.output);
      const env = resolveEnv(options.env);
      const apiKey = requireApiKey(env.name);

      const path = resolve(process.cwd(), file);
      const raw = await readFile(path, "utf8");
      const template = JSON.parse(raw) as unknown;

      const validation = validateEdit(template);
      if (!validation.ok) {
        if (format === "json") console.log(JSON.stringify({ ok: false, issues: validation.issues }));
        else console.error(formatIssues(validation.issues));
        return { exitCode: 1, validation };
      }
      // Valid, but surface any warnings (unloaded fonts, non-public URLs, …).
      if (validation.issues.length > 0 && format !== "json") {
        console.error(formatIssues(validation.issues));
      }

      const client = createClient({ apiKey, env });

      // Watched renders retry once if the render job fails with a transient
      // message (e.g. "Service temporarily unavailable"); otherwise submit once.
      const maxAttempts = options.watch ? 2 : 1;
      let lastId = "";
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = await client.post<RenderResponse>("/render", template);
        const id = result.response.id;
        lastId = id;

        if (!options.watch) {
          emit(format, { id }, id);
          return { renderId: id, response: result.response };
        }

        const final = await pollStatus(client, id, format, true);
        if (final.status !== "failed") {
          return { renderId: id, response: final, exitCode: 0 };
        }

        const transient = isTransientFailure(final.error);
        if (transient && attempt < maxAttempts) {
          if (format !== "json") {
            console.error(`⚠ render failed (${final.error ?? "unknown"}) — looks transient, resubmitting ${attempt + 1}/${maxAttempts}…`);
          }
          await sleep(2000);
          continue;
        }

        if (format !== "json") {
          console.error(
            transient
              ? `✗ render still failing after ${maxAttempts} attempts. For a complex multi-scene edit, preview it client-side first: shotstack studio ${file}`
              : `✗ render failed: ${final.error ?? "unknown error"}`,
          );
        }
        return { renderId: id, response: final, exitCode: 1 };
      }
      return { renderId: lastId, exitCode: 1 };
    });
  });

const TRANSIENT_FAILURE = /temporar|try again|time ?d? ?out|timeout|too many requests|service unavailable|unavailable|throttl/i;

function isTransientFailure(error: string | undefined): boolean {
  return typeof error === "string" && TRANSIENT_FAILURE.test(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
