import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, execSync } from "node:child_process";
import { Command } from "commander";
import { emit, parseOutputFormat } from "../output.ts";
import { validateEdit, formatIssues } from "../lib/validate.ts";
import { requireApiKey, MissingApiKeyError } from "../http/auth.ts";
import { ApiError } from "../http/client.ts";
import { resolveEnvName, ENV_NAMES } from "../http/env.ts";

const STUDIO_URL = "https://shotstack.studio";
const SHARE_API_URL = `${STUDIO_URL}/api/share`;
const SHARE_TIMEOUT_MS = 5000;
const URL_WARN_THRESHOLD = 6000;

export const studioCommand = new Command("studio")
  .description(
    "Open the Edit JSON in the shotstack.studio web editor. By default, posts the JSON to the share API and returns a short URL."
  )
  .argument("<file>", "Path to a Shotstack Edit JSON file")
  .option("--copy", "Copy the URL to the clipboard")
  .option("--no-open", "Do not try to open the URL in a browser")
  .option("--no-shorten", "Skip the share API; emit a base64url URL inline")
  .option(`--env <name>`, `Environment whose API key makes the short link permanent: ${ENV_NAMES.join(" | ")}`)
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { copy?: boolean; open: boolean; shorten: boolean; env?: string; output: string }) => {
    const format = parseOutputFormat(options.output);

    const path = resolve(process.cwd(), file);
    const raw = await readFile(path, "utf8");
    const template = JSON.parse(raw) as unknown;

    const validation = validateEdit(template);
    if (!validation.ok) {
      if (format === "json") console.log(JSON.stringify({ ok: false, issues: validation.issues }));
      else console.error(formatIssues(validation.issues));
      process.exit(1);
    }

    const apiKey = options.shorten ? shareApiKey(options.env) : undefined;
    const { url, shortened } = await buildStudioUrl(template, { shorten: options.shorten, apiKey });

    if (!shortened && url.length > URL_WARN_THRESHOLD) {
      console.error(
        `warning: encoded URL is ${url.length} characters; large templates may exceed browser URL limits.`
      );
    }

    if (options.copy) await copyToClipboard(url);

    const opened = options.open && browserAvailable() && openInBrowser(url);

    if (format === "json" || !opened) {
      emit(format, { url, shortened }, url);
    }
  });

interface StudioUrl {
  url: string;
  shortened: boolean;
}

export async function buildStudioUrl(
  template: unknown,
  options: { shorten?: boolean; apiKey?: string } = {}
): Promise<StudioUrl> {
  const shouldShorten = options.shorten !== false;
  if (shouldShorten) {
    const shared = await shareViaStudio(template, options.apiKey);
    if ("url" in shared) {
      if (!options.apiKey) {
        console.error(
          "note: this link lasts 30 days. Run `shotstack login` or set SHOTSTACK_API_KEY to make your links permanent."
        );
      }
      return { url: shared.url, shortened: true };
    }
    console.error(`warning: the shotstack.studio share API failed (${shared.failed}); falling back to inline URL.`);
  }
  return { url: buildInlineUrl(template), shortened: false };
}

// Studio validates keys against the production and sandbox Edit API only, so a dev key would be refused.
export function shareApiKey(cliEnv: string | undefined): string | undefined {
  const env = resolveEnvName(cliEnv);
  if (env === "dev") return undefined;
  try {
    return requireApiKey(env);
  } catch (err) {
    if (err instanceof MissingApiKeyError) return undefined;
    throw err;
  }
}

export function buildInlineUrl(template: unknown): string {
  const encoded = Buffer.from(JSON.stringify(template), "utf8").toString("base64url");
  return `${STUDIO_URL}/#json=${encoded}`;
}

type ShareOutcome = { url: string } | { failed: string; retry: boolean };

async function shareViaStudio(template: unknown, apiKey: string | undefined): Promise<ShareOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const first = await postShare(template, headers);
  return "retry" in first && first.retry ? postShare(template, headers) : first;
}

// A 4xx throws: the edit or the key was refused, and an inline URL would hide that.
async function postShare(template: unknown, headers: Record<string, string>): Promise<ShareOutcome> {
  let res: Response;
  try {
    res = await fetch(SHARE_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(template),
      signal: AbortSignal.timeout(SHARE_TIMEOUT_MS),
    });
  } catch (err) {
    return { failed: (err as Error).message, retry: true };
  }
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (res.ok && body.url) return { url: body.url };
  if (res.status === 429 || res.status >= 500) return { failed: `HTTP ${res.status}`, retry: true };
  if (res.status >= 400) {
    const reason = `${body.error ?? "no reason given"} (HTTP ${res.status})`;
    throw new ApiError(res.status, body, `The shotstack.studio share API refused the request: ${reason}`);
  }
  return { failed: `HTTP ${res.status} without a url`, retry: false };
}

async function copyToClipboard(text: string): Promise<void> {
  const { cmd, args } = clipboardCommand();
  await new Promise<void>((res, rej) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
    proc.on("error", rej);
    proc.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
    proc.stdin.end(text);
  });
}

function clipboardCommand(): { cmd: string; args: string[] } {
  if (process.platform === "darwin") return { cmd: "pbcopy", args: [] };
  if (process.platform === "win32") return { cmd: "clip", args: [] };
  return { cmd: "xclip", args: ["-selection", "clipboard"] };
}

function openInBrowser(url: string): boolean {
  const { cmd, args } = browserCommand(url);
  try {
    const proc = spawn(cmd, args, { detached: true, stdio: "ignore" });
    proc.on("error", () => {});
    proc.unref();
    return true;
  } catch {
    return false;
  }
}

function browserCommand(url: string): { cmd: string; args: string[] } {
  if (process.platform === "win32") return { cmd: "cmd", args: ["/c", "start", "", url] };
  if (process.platform === "darwin") return { cmd: "open", args: [url] };
  return { cmd: "xdg-open", args: [url] };
}

function browserAvailable(): boolean {
  if (process.platform === "darwin" || process.platform === "win32") return true;
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return false;
  try {
    execSync("command -v xdg-open", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
