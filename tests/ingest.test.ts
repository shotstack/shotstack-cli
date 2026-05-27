import { describe, test, expect, afterEach, mock } from "bun:test";
import { guessContentType, putToSignedUrl, pollSource, type SourceAttributes } from "../src/commands/ingest.ts";
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
