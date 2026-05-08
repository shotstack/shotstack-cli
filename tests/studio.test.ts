import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { buildInlineUrl, buildStudioUrl } from "../src/commands/studio.ts";

const sample = {
  timeline: {
    background: "#000000",
    tracks: [
      {
        clips: [
          {
            asset: { type: "rich-text", text: "hello", font: { family: "Roboto", size: 22 } },
            start: 0,
            length: 5,
          },
        ],
      },
    ],
  },
  output: { size: { width: 1920, height: 1080 }, format: "mp4" },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("buildInlineUrl", () => {
  test("emits a shotstack.studio URL with #json= hash", () => {
    const url = buildInlineUrl(sample);
    expect(url.startsWith("https://shotstack.studio/#json=")).toBe(true);
  });

  test("encoded payload uses base64url alphabet (no +, /, =)", () => {
    const url = buildInlineUrl(sample);
    const encoded = url.split("#json=")[1]!;
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("decoding the hash returns identical JSON", () => {
    const url = buildInlineUrl(sample);
    const encoded = url.split("#json=")[1]!;
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded).toEqual(sample);
  });

  test("handles unicode in text fields", () => {
    const tpl = {
      ...sample,
      timeline: {
        ...sample.timeline,
        tracks: [{ clips: [{ asset: { type: "rich-text", text: "héllo 🌏 中文" }, start: 0, length: 1 }] }],
      },
    };
    const url = buildInlineUrl(tpl);
    const encoded = url.split("#json=")[1]!;
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded).toEqual(tpl);
  });
});

describe("buildStudioUrl", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns the short URL when share API succeeds", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://shotstack.studio/api/share");
      return new Response(
        JSON.stringify({ slug: "abc12345", url: "https://shotstack.studio/s/abc12345" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const result = await buildStudioUrl(sample);
    expect(result.url).toBe("https://shotstack.studio/s/abc12345");
    expect(result.shortened).toBe(true);
  });

  test("falls back to inline URL when share API returns 5xx", async () => {
    globalThis.fetch = mock(async () => new Response("upstream broken", { status: 502 })) as typeof fetch;
    const result = await buildStudioUrl(sample);
    expect(result.url).toMatch(/^https:\/\/shotstack\.studio\/#json=/);
    expect(result.shortened).toBe(false);
  });

  test("falls back to inline URL when fetch throws (network down)", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const result = await buildStudioUrl(sample);
    expect(result.url).toMatch(/^https:\/\/shotstack\.studio\/#json=/);
    expect(result.shortened).toBe(false);
  });

  test("--no-shorten skips the share API entirely", async () => {
    const fetchSpy = mock(async () => new Response("should not be called", { status: 500 })) as typeof fetch;
    globalThis.fetch = fetchSpy;
    const result = await buildStudioUrl(sample, { shorten: false });
    expect(result.url).toMatch(/^https:\/\/shotstack\.studio\/#json=/);
    expect(result.shortened).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });
});
