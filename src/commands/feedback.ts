import { Command } from "commander";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { logPath, type LogEntry } from "../recorder.ts";
import { version } from "../version.ts";

const ISSUE_BASE_URL = "https://github.com/shotstack/shotstack-cli/issues/new?template=bug.yml";
const MAX_URL_BYTES = 6_000;
const RECORDS_TO_INCLUDE = 5;

export const feedbackCommand = new Command("feedback")
  .description("Open a pre-filled GitHub issue with a flight-recorder dossier from your last 5 invocations")
  .action(async () => {
    const records = await readLastRecords(RECORDS_TO_INCLUDE);
    const dossier = renderDossier(records);
    const title = buildTitle(records);
    const titleParam = `&title=${encodeURIComponent(title)}`;
    const url = `${ISSUE_BASE_URL}${titleParam}&body=${encodeURIComponent(dossier)}`;

    if (url.length <= MAX_URL_BYTES) {
      openInBrowser(url);
      console.log("Opened browser with pre-filled issue. Review before submitting.");
      return;
    }

    const dir = await mkdtemp(join(tmpdir(), "shotstack-feedback-"));
    const tmpFile = join(dir, "dossier.md");
    await writeFile(tmpFile, dossier);
    openInBrowser(`${ISSUE_BASE_URL}${titleParam}`);
    console.log(`Dossier too large to inline. Saved to: ${tmpFile}`);
    console.log("Drag the file into the issue body, or paste its contents.");
  });

async function readLastRecords(n: number): Promise<LogEntry[]> {
  const path = logPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const tail = lines.slice(-n).reverse();
  const records: LogEntry[] = [];
  for (const line of tail) {
    try {
      records.push(JSON.parse(line) as LogEntry);
    } catch {
      // skip malformed line
    }
  }
  return records;
}

function renderDossier(records: LogEntry[]): string {
  const lines: string[] = [];
  lines.push("## Environment");
  lines.push(`- Shotstack CLI: ${version}`);
  lines.push(`- OS: ${process.platform}-${process.arch}`);
  lines.push("");
  lines.push(`## Last ${RECORDS_TO_INCLUDE} invocations (most recent first)`);
  lines.push("");
  if (records.length === 0) {
    lines.push("_No recorded invocations._");
  } else {
    for (const r of records) {
      const argsStr = (r.args ?? []).join(" ");
      const heading = `### ${r.ts} — shotstack ${r.cmd}${argsStr ? " " + argsStr : ""}`;
      lines.push(heading);
      lines.push(`- Exit: ${r.exit}  Duration: ${r.durationMs}ms`);
      if (r.renderId) lines.push(`- Render ID: ${r.renderId}`);
      if (r.response !== undefined) {
        const body = typeof r.response === "string" ? r.response : JSON.stringify(r.response);
        lines.push(`- Response: ${body}`);
      }
      if (r.error) lines.push(`- Error: ${r.error.name}: ${r.error.message}`);
      lines.push("");
    }
  }
  lines.push(`[full log at ${logPath()}]`);
  lines.push("");
  lines.push("## What I expected vs what happened");
  lines.push("<!-- Describe the issue, request, or question here. -->");
  return lines.join("\n");
}

const MAX_TITLE_LENGTH = 80;

const DEFAULT_TITLE = "Feedback from shotstack CLI";

export function buildTitle(records: LogEntry[]): string {
  const errored = records.find((r) => r.error);
  if (errored && errored.error) {
    return truncate(`${errored.cmd}: ${errored.error.name} — ${errored.error.message}`);
  }

  const failed = records.find((r) => extractFailedRender(r.response) !== null);
  if (failed) {
    const msg = extractFailedRender(failed.response);
    return truncate(`Render failed: ${msg}`);
  }

  const nonZero = records.find((r) => r.exit !== 0);
  if (nonZero) {
    return truncate(`${nonZero.cmd} exited ${nonZero.exit}`);
  }

  return DEFAULT_TITLE;
}

function extractFailedRender(response: unknown): string | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const r = response as { state?: unknown; error?: unknown };
  if (r.state !== "failed") return null;
  return typeof r.error === "string" && r.error.length > 0 ? r.error : "unknown error";
}

function truncate(s: string): string {
  return s.length <= MAX_TITLE_LENGTH ? s : s.slice(0, MAX_TITLE_LENGTH - 1) + "…";
}

function openInBrowser(url: string): void {
  const isWindows = process.platform === "win32";
  const cmd = process.platform === "darwin" ? "open" : isWindows ? "cmd" : "xdg-open";
  const args = isWindows ? ["/c", "start", "", url] : [url];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => {
    console.error(`Could not open browser. Visit: ${url}`);
  });
  child.unref();
}
