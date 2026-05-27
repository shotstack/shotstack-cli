import { Command } from "commander";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { resolveEnvName, ENV_NAMES } from "../http/env.ts";
import { storeKey, removeKey, clearKeys, credentialsPath } from "../http/credentials.ts";
import { emit, parseOutputFormat } from "../output.ts";

export const loginCommand = new Command("login")
  .description("Save your Shotstack API key so you don't have to set SHOTSTACK_API_KEY every session")
  .option(`--env <name>`, `Environment the key belongs to: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (options: { env?: string; output: string }) => {
    const format = parseOutputFormat(options.output);
    const env = resolveEnvName(options.env);

    const apiKey = await readApiKey();
    if (!apiKey) {
      console.error("No API key provided.");
      process.exit(1);
    }

    await storeKey(env, apiKey);
    const path = credentialsPath();
    emit(format, { env, stored: true, path }, `Saved API key for ${env} → ${path} (chmod 600).`);
  });

export const logoutCommand = new Command("logout")
  .description("Remove a saved Shotstack API key")
  .option(`--env <name>`, `Environment to forget: ${ENV_NAMES.join(" | ")}`)
  .option("--all", "Remove saved keys for every environment")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (options: { env?: string; all?: boolean; output: string }) => {
    const format = parseOutputFormat(options.output);

    if (options.all) {
      await clearKeys();
      emit(format, { cleared: true }, "Removed all saved API keys.");
      return;
    }

    const env = resolveEnvName(options.env);
    const removed = await removeKey(env);
    emit(format, { env, removed }, removed ? `Removed saved API key for ${env}.` : `No saved API key for ${env}.`);
  });

/**
 * Read the key from a non-TTY stdin (piped: `echo $KEY | shotstack login`) or,
 * on a terminal, prompt with echo suppressed so the key never hits the screen
 * or shell history. No `--key` flag by design — that would leak into argv/history.
 */
async function readApiKey(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  return promptHidden("Shotstack API key: ");
}

function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    let muted = false;
    const output = new Writable({
      write(chunk, _encoding, callback) {
        if (!muted) process.stdout.write(chunk);
        callback();
      },
    });
    const rl = createInterface({ input: process.stdin, output, terminal: true });
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = true; // prompt is already written; suppress the echo of typed characters
  });
}
