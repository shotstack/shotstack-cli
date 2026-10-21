import { describe, test, expect, afterEach, mock, spyOn } from "bun:test";
import {
  guessContentType,
  putToSignedUrl,
  pollSource,
  html5Steps,
  requestSteps,
  type SourceAttributes,
} from "../src/commands/ingest.ts";
import type { Client } from "../src/http/client.ts";
import { ApiError } from "../src/http/client.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("guessContentType", () => {
  test("maps common media extensions", () => {
    expect(guessContentType("clip.mp4")).toBe("video/mp4");
    expect(guessContentType("track.mp3")).toBe("audio/mpeg");
    expect(guessContentType("logo.png")).toBe("image/png");
    expect(guessContentType("subs.srt")).toBe("application/x-subrip");
  });

  test("is case-insensitive on the extension", () => {
    expect(guessContentType("CLIP.MP4")).toBe("video/mp4");
    expect(guessContentType("/abs/path/Photo.JPEG")).toBe("image/jpeg");
  });

  test("returns undefined for unknown or missing extensions", () => {
    expect(guessContentType("mystery.xyz")).toBeUndefined();
    expect(guessContentType("README")).toBeUndefined();
  });
});

describe("putToSignedUrl", () => {
  test("PUTs the raw bytes with the given Content-Type", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    let captured: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(input), init: init ?? {} };
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    await putToSignedUrl("https://s3.example.com/upload?Signature=abc", body, "video/mp4");

    expect(captured?.url).toBe("https://s3.example.com/upload?Signature=abc");
    expect(captured?.init.method).toBe("PUT");
    expect((captured?.init.headers as Record<string, string>)["content-type"]).toBe("video/mp4");
    expect(captured?.init.body).toBe(body);
  });

  test("omits the Content-Type header when none is supplied", async () => {
    let headers: HeadersInit | undefined;
    globalThis.fetch = mock(async (_input: string | URL | Request, init?: RequestInit) => {
      headers = init?.headers;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    await putToSignedUrl("https://s3.example.com/upload?Signature=abc", new Uint8Array([0]));
    expect(headers).toBeUndefined();
  });

  test("throws ApiError carrying the S3 status on failure", async () => {
    globalThis.fetch = mock(async () => new Response("<Error>AccessDenied</Error>", { status: 403 })) as typeof fetch;

    const promise = putToSignedUrl("https://s3.example.com/upload?Signature=abc", new Uint8Array([0]));
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await promise.catch((err: ApiError) => {
      expect(err.status).toBe(403);
      expect(err.message).not.toContain("Signature");
    });
  });
});

describe("pollSource", () => {
  function clientReturning(...states: SourceAttributes["status"][]): { client: Client; calls: () => number } {
    let i = 0;
    const get = mock(async () => {
      const status = states[Math.min(i, states.length - 1)]!;
      i += 1;
      const attributes: SourceAttributes = { id: "src-1", status };
      if (status === "ready") attributes.source = "https://cdn.example.com/src-1/source.mp4";
      return { data: { type: "source", id: "src-1", attributes } };
    });
    return { client: { get } as unknown as Client, calls: () => get.mock.calls.length };
  }

  test("returns after a single poll when not watching", async () => {
    const { client, calls } = clientReturning("importing");
    const result = await pollSource(client, "src-1", "json", false, 0);
    expect(result.status).toBe("importing");
    expect(calls()).toBe(1);
  });

  test("loops until a terminal state when watching", async () => {
    const { client, calls } = clientReturning("queued", "importing", "ready");
    const result = await pollSource(client, "src-1", "json", true, 0);
    expect(result.status).toBe("ready");
    expect(result.source).toBe("https://cdn.example.com/src-1/source.mp4");
    expect(calls()).toBe(3);
  });

  test("stops on a failed terminal state", async () => {
    const { client } = clientReturning("importing", "failed");
    const result = await pollSource(client, "src-1", "json", true, 0);
    expect(result.status).toBe("failed");
  });
});

const SRC = "https://shotstack-ingest-api-stage-sources.s3.ap-southeast-2.amazonaws.com/owner/src-1/source";

function readySource(ext: string, width?: number, height?: number): SourceAttributes {
  const source: SourceAttributes = { id: "src-1", status: "ready", source: `${SRC}.${ext}` };
  if (width) source.width = width;
  if (height) source.height = height;
  return source;
}

describe("html5Steps", () => {
  test("sizes a landscape image's steps by width, below its long edge", () => {
    expect(html5Steps(readySource("jpg", 3000, 2000))).toEqual([
      { format: "webp", size: { width: 512 }, filename: "html5-512" },
      { format: "webp", size: { width: 1024 }, filename: "html5-1024" },
      { format: "webp", size: { width: 2048 }, filename: "html5-2048" },
    ]);
  });

  test("sizes a portrait image's steps by height", () => {
    expect(html5Steps(readySource("PNG", 1200, 1600))).toEqual([
      { format: "webp", size: { height: 512 }, filename: "html5-512" },
      { format: "webp", size: { height: 1024 }, filename: "html5-1024" },
    ]);
  });

  test("never requests a step as large as the source", () => {
    expect(html5Steps(readySource("webp", 1024, 768)).map((s) => s.filename)).toEqual(["html5-512"]);
    expect(html5Steps(readySource("jpeg", 400, 300))).toEqual([]);
  });

  test("skips sources that aren't raster images, aren't ready or have no size", () => {
    for (const ext of ["mp4", "gif", "svg", "woff2"]) expect(html5Steps(readySource(ext, 3000, 2000))).toEqual([]);
    expect(html5Steps({ ...readySource("jpg", 3000, 2000), status: "importing" })).toEqual([]);
    expect(html5Steps(readySource("jpg"))).toEqual([]);
  });
});

describe("requestSteps", () => {
  type Step = { status: string; url: string };
  function stepsClient(rounds: Step[][], postError?: Error) {
    let i = 0;
    const post = mock(async () => {
      if (postError) throw postError;
      return {};
    });
    const get = mock(async () => {
      const renditions = rounds[Math.min(i, rounds.length - 1)]!;
      i += 1;
      return { data: { type: "source", id: "src-1", attributes: { ...readySource("jpg", 1600, 900), outputs: { renditions } } } };
    });
    return { client: { post, get } as unknown as Client, post, get };
  }
  const step = (status: string, s: number) => ({ status, url: `https://renditions.example.com/owner/src-1/html5-${s}.webp` });

  test("requests the steps once, then waits until each one is done", async () => {
    const { client, post, get } = stepsClient([
      [step("processing", 512), step("queued", 1024)],
      [step("ready", 512), step("failed", 1024)],
    ]);
    const result = await requestSteps(client, readySource("jpg", 1600, 900), "json", { timeoutMs: 60_000, intervalMs: 0 });

    expect(post.mock.calls).toEqual([
      ["/sources/src-1/renditions", { outputs: { renditions: html5Steps(readySource("jpg", 1600, 900)) } }],
    ]);
    expect(get.mock.calls.length).toBe(2);
    expect(result.outputs?.renditions?.map((r) => r.status)).toEqual(["ready", "failed"]);
  });

  test("returns the steps still processing when the wait runs out", async () => {
    const { client } = stepsClient([[step("processing", 512), step("processing", 1024)]]);
    const result = await requestSteps(client, readySource("jpg", 1600, 900), "json", { timeoutMs: 0, intervalMs: 0 });
    expect(result.status).toBe("ready");
    expect(result.outputs?.renditions?.map((r) => r.status)).toEqual(["processing", "processing"]);
  });

  test("names a step by its size in text output until it has a URL", async () => {
    const pending = { status: "processing", transformation: { format: "webp", size: { width: 1024 } } };
    const { client } = stepsClient([[step("ready", 512), pending as unknown as Step]]);
    const lines: string[] = [];
    const log = spyOn(console, "log").mockImplementation((line: string) => void lines.push(line));
    try {
      await requestSteps(client, readySource("jpg", 1600, 900), "text", { timeoutMs: 0, intervalMs: 0 });
    } finally {
      log.mockRestore();
    }
    expect(lines.at(-1)).toEndWith("\n  ready  https://renditions.example.com/owner/src-1/html5-512.webp\n  processing  1024px");
  });

  test("leaves a source with no steps alone", async () => {
    const { client, post, get } = stepsClient([[]]);
    const source = readySource("mp4", 1920, 1080);
    expect(await requestSteps(client, source, "json", { timeoutMs: 0, intervalMs: 0 })).toBe(source);
    expect(post.mock.calls.length + get.mock.calls.length).toBe(0);
  });

  test("returns the source when the steps can't be requested", async () => {
    const { client, get } = stepsClient([[]], new ApiError(400, undefined, "POST /sources/src-1/renditions → 400"));
    const source = readySource("jpg", 1600, 900);
    expect(await requestSteps(client, source, "json", { timeoutMs: 60_000, intervalMs: 0 })).toBe(source);
    expect(get.mock.calls.length).toBe(0);
  });
});
