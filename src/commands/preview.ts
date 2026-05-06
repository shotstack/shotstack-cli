import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, execSync } from "node:child_process";
import { Command } from "commander";
import { emit, parseOutputFormat } from "../output.ts";

const STUDIO_URL = "https://shotstack.studio";
const URL_WARN_THRESHOLD = 6000;

export const previewCommand = new Command("preview")
  .description("Open a shotstack.studio URL that loads the Edit JSON in the browser editor")
  .argument("<file>", "Path to a Shotstack Edit JSON file")
  .option("--copy", "Copy the URL to the clipboard")
  .option("--no-open", "Do not try to open the URL in a browser")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { copy?: boolean; open: boolean; output: string }) => {
    const format = parseOutputFormat(options.output);

    const path = resolve(process.cwd(), file);
    const raw = await readFile(path, "utf8");
    const template = JSON.parse(raw) as unknown;
    assertTemplateShape(template);

    const url = buildPreviewUrl(template);

    if (url.length > URL_WARN_THRESHOLD) {
      console.error(`warning: encoded URL is ${url.length} characters; large templates may exceed browser URL limits.`);
    }

    if (options.copy) await copyToClipboard(url);

    const opened = options.open && browserAvailable() && openInBrowser(url);

    if (format === "json" || !opened) {
      emit(format, { url }, url);
    }
  });

export function buildPreviewUrl(template: unknown): string {
  const encoded = Buffer.from(JSON.stringify(template), "utf8").toString("base64url");
  return `${STUDIO_URL}/#json=${encoded}`;
}

function assertTemplateShape(t: unknown): asserts t is { timeline: unknown; output: unknown } {
  if (!t || typeof t !== "object") throw new Error("Template must be a JSON object.");
  if (!("timeline" in t)) throw new Error("Template missing required field: timeline.");
  if (!("output" in t)) throw new Error("Template missing required field: output.");
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
