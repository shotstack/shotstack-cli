import { test, expect } from "bun:test";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { findChrome, ChromeNotFoundError, launchChrome } from "../src/lib/chrome.ts";

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAC_EDGE = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const MAC_BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

test("CHROME_PATH wins when it exists", () => {
  const exists = (p: string) => p === "/opt/chrome" || p === MAC_CHROME;
  expect(findChrome({ CHROME_PATH: "/opt/chrome" }, "darwin", exists)).toBe("/opt/chrome");
});

test("finds Google Chrome in Applications on macOS", () => {
  expect(findChrome({}, "darwin", (p) => p === MAC_CHROME)).toBe(MAC_CHROME);
});

test("finds Chromium on the PATH on Linux", () => {
  const exists = (p: string) => p === "/snap/bin/chromium";
  expect(findChrome({ PATH: "/usr/bin:/snap/bin" }, "linux", exists)).toBe("/snap/bin/chromium");
});

test("Chrome is preferred over Edge and Brave", () => {
  expect(findChrome({}, "darwin", (p) => p === MAC_CHROME || p === MAC_EDGE || p === MAC_BRAVE)).toBe(MAC_CHROME);
});

test("finds Edge on macOS when Chrome isn't installed", () => {
  expect(findChrome({}, "darwin", (p) => p === MAC_EDGE)).toBe(MAC_EDGE);
});

test("finds Brave on macOS when neither Chrome nor Edge is installed", () => {
  expect(findChrome({}, "darwin", (p) => p === MAC_BRAVE)).toBe(MAC_BRAVE);
});

test("finds Chrome under Program Files on Windows", () => {
  const env = { PROGRAMFILES: "C:\\Program Files", "PROGRAMFILES(X86)": "C:\\Program Files (x86)", LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local" };
  const chrome = join("C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe");
  expect(findChrome(env, "win32", (p) => p === chrome)).toBe(chrome);
});

test("finds Edge and Brave on the PATH on Linux", () => {
  expect(findChrome({ PATH: "/usr/bin" }, "linux", (p) => p === "/usr/bin/microsoft-edge")).toBe("/usr/bin/microsoft-edge");
  expect(findChrome({ PATH: "/usr/bin" }, "linux", (p) => p === "/usr/bin/brave-browser")).toBe("/usr/bin/brave-browser");
});

test("no browser anywhere says how to fix it", () => {
  expect(() => findChrome({ PATH: "/usr/bin" }, "linux", () => false)).toThrow(ChromeNotFoundError);
  expect(() => findChrome({}, "darwin", () => false)).toThrow(
    "No browser found. Install Google Chrome, or set CHROME_PATH to a Chromium-based browser."
  );
});

test("a launched Chrome keeps the end of what it prints", () => {
  const stderr = new PassThrough();
  const child = { stdio: [null, null, stderr, new PassThrough(), new PassThrough()], once() {}, kill() {} };
  const chrome = launchChrome({ path: "/chrome", profileDir: "/p", spawn: (() => child) as never });
  stderr.write("x".repeat(5000));
  stderr.write("\nRunning as root without --no-sandbox is not supported.\n");
  expect(chrome.output().endsWith("Running as root without --no-sandbox is not supported.")).toBe(true);
  expect(chrome.output().length).toBeLessThanOrEqual(2000);
});
