import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { findChrome, launchChrome, type Chrome } from "./chrome.ts";
import type { Cdp } from "./cdp.ts";

export type CaptureInput = { times: number[]; grid?: boolean } & ({ edit: unknown } | { src: string });
export type CaptureResult = { sheets: Array<{ times: number[]; image: string }>; skipped: number[] };

export class ChromeLaunchError extends Error {
  override name = "ChromeLaunchError";
}

export interface CaptureOptions {
  pageUrl: string;
  timeoutMs: number;
  profileDir: string;
  launch?: (profileDir: string) => Chrome;
}

/** An error the capture page threw, such as a time before the edit starts. */
export class PageError extends Error {
  override name = "PageError";
}

interface Evaluated {
  result?: { value?: unknown };
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

async function evaluate(cdp: Cdp, sessionId: string, expression: string): Promise<unknown> {
  const { result, exceptionDetails } = await cdp.send<Evaluated>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (exceptionDetails) {
    const description = exceptionDetails.exception?.description ?? exceptionDetails.text ?? "The capture page threw an error.";
    throw new PageError(description.split("\n")[0]!.replace(/^Error: /, ""));
  }
  return result?.value;
}

export async function captureSheets(input: CaptureInput, { pageUrl, timeoutMs, profileDir, launch }: CaptureOptions): Promise<CaptureResult> {
  const start = launch ?? ((dir: string) => launchChrome({ path: findChrome(), profileDir: dir }));
  let chrome: Chrome | undefined;
  let tempProfile: string | undefined;

  const run = async () => {
    chrome = start(profileDir);
    let target = await chrome.cdp.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" }).catch(() => undefined);
    if (!target) {
      // Headless Chrome aborts on a profile another Chrome holds, so try once on a fresh one.
      chrome.kill();
      tempProfile = await mkdtemp(join(tmpdir(), "shotstack-chrome-"));
      const retry = start(tempProfile);
      chrome = retry;
      target = await retry.cdp.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" }).catch(() => {
        const output = retry.output();
        throw new ChromeLaunchError(`Chrome couldn't start${output ? `:\n${output}` : "."}`);
      });
    }
    const { cdp } = chrome;
    const { sessionId } = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    const { errorText } = await cdp.send<{ errorText?: string }>("Page.navigate", { url: pageUrl }, sessionId);
    if (errorText) throw new PageError(`Couldn't load ${pageUrl}: ${errorText}`);
    while ((await evaluate(cdp, sessionId, "window.captureReady === true")) !== true) await sleep(50);
    return (await evaluate(cdp, sessionId, `capture(${JSON.stringify(input)})`)) as CaptureResult;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Capture timed out after ${timeoutMs / 1000} s`)), timeoutMs);
  });
  try {
    return await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
    chrome?.kill();
    if (tempProfile) await rm(tempProfile, { recursive: true, force: true });
  }
}
