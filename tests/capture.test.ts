import { test, expect, mock } from "bun:test";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { captureSheets, ChromeLaunchError } from "../src/lib/capture.ts";
import type { Cdp } from "../src/lib/cdp.ts";
import type { Chrome } from "../src/lib/chrome.ts";

const RESULT = { sheets: [{ times: [0.5], image: "data:image/jpeg;base64,AAA" }], skipped: [] };

// A Chrome whose page is ready at once and answers capture() with `evaluate`.
function fakeChrome(evaluate: (expression: string) => unknown, { closed = false, navigate = {} as object, output = "" } = {}): Chrome & { calls: unknown[][]; kill: ReturnType<typeof mock> } {
  const calls: unknown[][] = [];
  const cdp: Cdp = {
    async send<T>(method: string, params?: object, sessionId?: string) {
      calls.push([method, params, sessionId]);
      if (closed) throw new Error("Chrome closed the DevTools pipe.");
      if (method === "Target.createTarget") return { targetId: "t1" } as T;
      if (method === "Target.attachToTarget") return { sessionId: "s1" } as T;
      if (method === "Page.navigate") return navigate as T;
      if (method === "Runtime.evaluate") {
        const { expression } = params as { expression: string };
        if (expression === "window.captureReady === true") return { result: { value: true } } as T;
        return evaluate(expression) as T;
      }
      return {} as T;
    },
    close() {},
  };
  return { cdp, exited: new Promise(() => {}), kill: mock(), output: () => output, calls };
}

const options = (launch: (dir: string) => Chrome) => ({ pageUrl: "https://shotstack.studio/capture.html", timeoutMs: 60_000, profileDir: "/home/me/.shotstack/chrome", launch });

test("navigates to the page and returns what capture() resolves with", async () => {
  const chrome = fakeChrome(() => ({ result: { value: RESULT } }));
  const input = { edit: { timeline: {}, output: {} }, times: [0.5] };
  expect(await captureSheets(input, options(() => chrome))).toEqual(RESULT);
  expect(chrome.calls).toContainEqual(["Page.navigate", { url: "https://shotstack.studio/capture.html" }, "s1"]);
  expect(chrome.calls).toContainEqual(["Runtime.evaluate", { expression: `capture(${JSON.stringify(input)})`, awaitPromise: true, returnByValue: true }, "s1"]);
  expect(chrome.kill).toHaveBeenCalled();
});

test("an error thrown in the page rejects with its message", async () => {
  const chrome = fakeChrome(() => ({ exceptionDetails: { text: "Uncaught", exception: { description: "Error: Time -1.00s is before the edit starts.\n    at capture" } } }));
  expect(captureSheets({ src: "https://x/v.mp4", times: [-1] }, options(() => chrome))).rejects.toThrow(/^Time -1\.00s is before the edit starts\.$/);
});

test("a page that never answers times out and kills Chrome", async () => {
  const chrome = fakeChrome(() => new Promise(() => {}));
  const run = captureSheets({ src: "https://x/v.mp4", times: [1] }, { ...options(() => chrome), timeoutMs: 50 });
  expect(run).rejects.toThrow("Capture timed out after 0.05 s");
  await run.catch(() => {});
  expect(chrome.kill).toHaveBeenCalled();
});

test("a profile another Chrome holds falls back to a temporary one, removed afterwards", async () => {
  const dirs: string[] = [];
  const held = fakeChrome(() => ({}), { closed: true });
  const fresh = fakeChrome(() => ({ result: { value: RESULT } }));
  const launch = (dir: string) => (dirs.push(dir), dirs.length === 1 ? held : fresh);
  expect(await captureSheets({ src: "https://x/v.mp4", times: [1] }, options(launch))).toEqual(RESULT);
  expect(dirs[0]).toBe("/home/me/.shotstack/chrome");
  expect(dirs[1]?.startsWith(`${tmpdir()}/shotstack-chrome-`)).toBe(true);
  expect(existsSync(dirs[1]!)).toBe(false);
  expect(held.kill).toHaveBeenCalled();
});

test("a Chrome that can't start reports what it printed", async () => {
  const held = fakeChrome(() => ({}), { closed: true });
  const broken = fakeChrome(() => ({}), { closed: true, output: "Running as root without --no-sandbox is not supported." });
  let launches = 0;
  const run = captureSheets({ src: "https://x/v.mp4", times: [1] }, options(() => (++launches === 1 ? held : broken)));
  expect(run).rejects.toThrow(ChromeLaunchError);
  expect(run).rejects.toThrow("Running as root without --no-sandbox is not supported.");
});
