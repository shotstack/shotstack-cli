import { mkdir, appendFile, stat, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { ApiError } from "./http/client.ts";
import { MissingApiKeyError } from "./http/auth.ts";
import { InvalidEnvError } from "./http/env.ts";

const MAX_LOG_BYTES = 1_000_000;
const TRUNCATE_TO_BYTES = 500_000;
const MAX_RESPONSE_BYTES = 2_000;

export function logPath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "shotstack", "log.jsonl");
  }
  return join(homedir(), ".shotstack", "log.jsonl");
}

export interface LogError {
  name: string;
  message: string;
}

export interface LogEntry {
  ts: string;
  cmd: string;
  args: string[];
  exit: number;
  durationMs: number;
  renderId?: string;
  response?: unknown;
  error?: LogError;
}

export interface RecordInput {
  cmd: string;
  args: string[];
  exit: number;
  durationMs: number;
  renderId?: string;
  response?: unknown;
  error?: LogError;
}

export interface CommandResult {
  renderId?: string;
  response?: unknown;
  exitCode?: number;
}

export function buildEntry(input: RecordInput, now: Date = new Date()): LogEntry {
  const entry: LogEntry = {
    ts: now.toISOString(),
    cmd: input.cmd,
    args: input.args.map(sanitiseArg),
    exit: input.exit,
    durationMs: input.durationMs,
  };
  if (input.renderId) entry.renderId = input.renderId;
  if (input.response !== undefined) entry.response = capResponse(sanitiseValue(input.response));
  if (input.error) entry.error = sanitiseError(input.error);
  return entry;
}

function sanitiseError(err: LogError): LogError {
  return {
    name: err.name,
    message: typeof err.message === "string" ? redactSignedUrl(err.message) : String(err.message),
  };
}

export function toLogError(err: unknown): LogError | undefined {
  if (err instanceof Error) return { name: err.name, message: err.message };
  if (err === undefined || err === null) return undefined;
  return { name: "Unknown", message: String(err) };
}

export async function record(input: RecordInput, path: string = logPath()): Promise<void> {
  const entry = buildEntry(input);
  const line = JSON.stringify(entry) + "\n";
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  if (!(await exists(path))) {
    await writeFile(path, "", { mode: 0o600 });
  }
  await appendFile(path, line);
  await rotateIfNeeded(path);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function rotateIfNeeded(path: string): Promise<void> {
  const info = await stat(path).catch(() => null);
  if (!info || info.size <= MAX_LOG_BYTES) return;
  const buf = await readFile(path);
  const tail = buf.subarray(Math.max(0, buf.length - TRUNCATE_TO_BYTES));
  const nl = tail.indexOf(0x0a);
  const trimmed = nl >= 0 ? tail.subarray(nl + 1) : tail;
  await writeFile(path, trimmed, { mode: 0o600 });
}

const URL_RE = /^https?:\/\//i;
const SIGNED_URL_GLOBAL_RE = /(https?:\/\/[^\s'"<>]+?)\?[^\s'"<>]*?(?:Signature|X-Amz-[A-Za-z0-9-]*)=[^\s'"<>]*/gi;

export function redactSignedUrl(value: string): string {
  return value.replace(SIGNED_URL_GLOBAL_RE, "$1?[redacted-signed]");
}

export function sanitiseArg(arg: string): string {
  if (typeof arg !== "string") return arg;
  if (arg.startsWith("-")) return arg;
  if (URL_RE.test(arg)) return redactSignedUrl(arg);
  if (/[\/\\]/.test(arg)) return crossPlatformBasename(arg);
  return arg;
}

function crossPlatformBasename(p: string): string {
  const parts = p.split(/[\/\\]/);
  return parts[parts.length - 1] || p;
}

export function sanitiseValue(value: unknown): unknown {
  if (typeof value === "string") return redactSignedUrl(value);
  if (Array.isArray(value)) return value.map(sanitiseValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitiseValue(v);
    return out;
  }
  return value;
}

export function capResponse(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (json === undefined || json.length <= MAX_RESPONSE_BYTES) return value;
  return json.slice(0, MAX_RESPONSE_BYTES) + "...[truncated]";
}

export async function withRecording(
  cmd: string,
  args: string[],
  fn: () => Promise<CommandResult>,
): Promise<void> {
  const start = Date.now();
  try {
    const result = await fn();
    const exit = result.exitCode ?? 0;
    await record({
      cmd,
      args,
      exit,
      durationMs: Date.now() - start,
      renderId: result.renderId,
      response: result.response,
    }).catch(() => {});
    if (exit !== 0) process.exit(exit);
  } catch (err) {
    const exit = exitCodeFor(err);
    const response = err instanceof ApiError ? err.body : undefined;
    await record({
      cmd,
      args,
      exit,
      durationMs: Date.now() - start,
      response,
      error: toLogError(err),
    }).catch(() => {});
    throw err;
  }
}

function exitCodeFor(err: unknown): number {
  if (err instanceof ApiError) return err.isTransient ? 2 : 1;
  if (err instanceof MissingApiKeyError || err instanceof InvalidEnvError) return 1;
  if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") return 1;
  return 2;
}

export function commandArgv(commandName: string): string[] {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf(commandName);
  return idx >= 0 ? argv.slice(idx + 1) : argv;
}
