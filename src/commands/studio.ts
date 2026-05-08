import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, execSync } from "node:child_process";
import { Command } from "commander";
import { emit, parseOutputFormat } from "../output.ts";
import { validateEdit, formatIssues } from "../lib/validate.ts";

const STUDIO_URL = "https://shotstack.studio";
const SHARE_API_URL = `${STUDIO_URL}/api/share`;
const SHARE_TIMEOUT_MS = 3000;
const URL_WARN_THRESHOLD = 6000;

export const studioCommand = new Command("studio")
  .description(
    "Open the Edit JSON in the shotstack.studio web editor. By default, posts the JSON to the share API and returns a short URL."
  )
  .argument("<file>", "Path to a Shotstack Edit JSON file")
  .option("--copy", "Copy the URL to the clipboard")
  .option("--no-open", "Do not try to open the URL in a browser")
  .option("--no-shorten", "Skip the share API; emit a base64url URL inline")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { copy?: boolean; open: boolean; shorten: boolean; output: string }) => {
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

    const { url, shortened } = await buildStudioUrl(template, { shorten: options.shorten });

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
  options: { shorten?: boolean } = {}
): Promise<StudioUrl> {
  const shouldShorten = options.shorten !== false;
  if (shouldShorten) {
    const shortUrl = await tryShortenViaStudio(template);
    if (shortUrl) return { url: shortUrl, shortened: true };
    console.error("warning: could not reach the shotstack.studio share API; falling back to inline URL.");
  }
  return { url: buildInlineUrl(template), shortened: false };
}

export function buildInlineUrl(template: unknown): string {
  const encoded = Buffer.from(JSON.stringify(template), "utf8").toString("base64url");
  return `${STUDIO_URL}/#json=${encoded}`;
}

async function tryShortenViaStudio(template: unknown): Promise<string | null> {
  try {
    const res = await fetch(SHARE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
      signal: AbortSignal.timeout(SHARE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string };
    return json.url ?? null;
  } catch {
    return null;
  }
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
