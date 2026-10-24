import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { Command, InvalidArgumentError } from "commander";
import { captureSheets, type CaptureInput, type CaptureResult } from "../lib/capture.ts";
import { formatIssues, validateEdit } from "../lib/validate.ts";
import { type OutputFormat, parseOutputFormat } from "../output.ts";
import { withRecording, commandArgv, type CommandResult } from "../recorder.ts";

const PAGE_URL = "https://shotstack.studio/capture.html";
const TIMEOUT_MS = 60_000;

export const inspectCommand = new Command("inspect")
  .description("Draw an edit's frames at given times into a contact sheet, in headless Chrome, without rendering")
  .argument("<edit>", "Path to a Shotstack Edit JSON file")
  .requiredOption("--at <seconds>", "Times to capture, separated by commas, e.g. 0.5,8.05", parseTimes)
  .option("--out <path>", "Where to write the sheet; past six times, sheets are numbered inspect-1.jpg, inspect-2.jpg, …", "inspect.jpg")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { at: number[]; out: string; output: string }) => {
    await withRecording("inspect", commandArgv("inspect"), async () => {
      const format = parseOutputFormat(options.output);
      const edit = JSON.parse(await readFile(resolve(process.cwd(), file), "utf8")) as unknown;
      return runInspect({ edit, times: options.at }, { out: options.out, format, capture });
    });
  });

function capture(input: CaptureInput): Promise<CaptureResult> {
  return captureSheets(input, {
    pageUrl: process.env.SHOTSTACK_CAPTURE_URL?.trim() || PAGE_URL,
    timeoutMs: TIMEOUT_MS,
    profileDir: join(homedir(), ".shotstack", "chrome"),
  });
}

export function parseTimes(value: string): number[] {
  const parts = value.split(",").map((part) => part.trim());
  const times = parts.map(Number);
  if (parts.some((part) => part === "") || times.some((time) => !Number.isFinite(time))) {
    throw new InvalidArgumentError("--at takes seconds separated by commas, e.g. 0.5,8.05");
  }
  return times;
}

export function sheetPaths(out: string, count: number): string[] {
  if (count === 1) return [out];
  const { dir, name, ext } = parse(out);
  return Array.from({ length: count }, (_, i) => join(dir, `${name}-${i + 1}${ext}`));
}

export async function runInspect(
  input: CaptureInput,
  { out, format, capture }: { out: string; format: OutputFormat; capture: (input: CaptureInput) => Promise<CaptureResult> },
): Promise<CommandResult> {
  if ("edit" in input) {
    const { ok, issues } = validateEdit(input.edit);
    // The page loads assets from their URLs, so a local path fails there just as it does in a render.
    const blocking = issues.filter((issue) => (issue.level ?? "error") === "error" || issue.code === "src_not_public");
    if (!ok || blocking.length > 0) {
      if (format === "json") console.log(JSON.stringify({ ok: false, issues: blocking }));
      else console.error(formatIssues(blocking));
      return { exitCode: 1 };
    }
  }

  const { sheets, skipped } = await capture(input);
  const paths = sheetPaths(out, sheets.length);
  for (const [i, sheet] of sheets.entries()) {
    await mkdir(dirname(paths[i]!), { recursive: true });
    await writeFile(paths[i]!, Buffer.from(sheet.image.slice(sheet.image.indexOf(",") + 1), "base64"));
  }

  const written = sheets.map((sheet, i) => ({ path: paths[i]!, times: sheet.times }));
  if (format === "json") {
    console.log(JSON.stringify({ sheets: written, skipped }));
  } else {
    for (const time of skipped) console.error(`skipped ${time.toFixed(2)}s: past the edit's end`);
    for (const { path, times } of written) console.log(`${path}  ${times.map((time) => `${time.toFixed(2)}s`).join(" ")}`);
  }
  return { exitCode: sheets.length > 0 ? 0 : 1, response: { sheets: written, skipped } };
}
