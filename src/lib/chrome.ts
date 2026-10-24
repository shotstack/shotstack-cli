import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { connectPipe, type Cdp } from "./cdp.ts";

export class ChromeNotFoundError extends Error {
  constructor() {
    super("No browser found. Install Google Chrome, or set CHROME_PATH to a Chromium-based browser.");
    this.name = "ChromeNotFoundError";
  }
}

// Chrome first, since the capture page is checked against it.
const MAC_APPS = ["Google Chrome.app/Contents/MacOS/Google Chrome", "Chromium.app/Contents/MacOS/Chromium", "Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "Brave Browser.app/Contents/MacOS/Brave Browser"];
const LINUX_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable", "brave-browser"];

function candidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  if (platform === "darwin") return MAC_APPS.map((app) => join("/Applications", app));
  // Windows looks only for Chrome: Edge and Brave are untested there, so they go through CHROME_PATH.
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter((root): root is string => Boolean(root));
    return roots.map((root) => join(root, "Google", "Chrome", "Application", "chrome.exe"));
  }
  const dirs = (env.PATH ?? "").split(delimiter).filter(Boolean);
  return LINUX_NAMES.flatMap((name) => dirs.map((dir) => join(dir, name)));
}

export function findChrome(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, exists: (path: string) => boolean = existsSync): string {
  const found = [env.CHROME_PATH, ...candidates(env, platform)].find((path): path is string => Boolean(path) && exists(path!));
  if (!found) throw new ChromeNotFoundError();
  return found;
}

// SwiftShader gives WebGL to a machine without a usable GPU; with a GPU it is never used.
export const CHROME_FLAGS = [
  "--headless=new",
  "--remote-debugging-pipe",
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--enable-unsafe-swiftshader",
];

export interface Chrome {
  cdp: Cdp;
  exited: Promise<void>;
  kill(): void;
  /** The end of what Chrome printed, for saying why it wouldn't start. */
  output(): string;
}

export function launchChrome({ path, profileDir, spawn: spawnChrome = spawn }: { path: string; profileDir: string; spawn?: typeof spawn }): Chrome {
  // Chrome reads DevTools messages on fd 3 and writes replies on fd 4.
  const child = spawnChrome(path, [...CHROME_FLAGS, `--user-data-dir=${profileDir}`], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  let output = "";
  (child.stdio[2] as Readable).on("data", (chunk: Buffer | string) => {
    output = (output + chunk.toString()).slice(-2000);
  });
  const exited = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.once("error", () => resolve());
  });
  return {
    cdp: connectPipe(child.stdio[3] as Writable, child.stdio[4] as Readable),
    exited,
    kill: () => void child.kill("SIGKILL"),
    output: () => output.trim(),
  };
}
