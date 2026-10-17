import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { buildInlineUrl, buildStudioUrl, shareApiKey } from "../src/commands/studio.ts";
import { ApiError } from "../src/http/client.ts";

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

describe("share API rules", () => {
  // Answers each share call with the next step; an Error step rejects like a timeout or network failure.
  function shareSequence(...steps: (Response | Error)[]) {
    const fetchMock = mock(async (_input: string | URL | Request, _init?: RequestInit) => {
      const step = steps.shift();
      if (!step) throw new Error("Unexpected extra share call");
      if (step instanceof Error) throw step;
      return step;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  const shared = () => new Response(JSON.stringify({ slug: "abc12345", url: "https://shotstack.studio/s/abc12345" }));
  const refusal = (status: number, error: string) => new Response(JSON.stringify({ error }), { status });
  const timeout = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

  let stderr: ReturnType<typeof spyOn>;
  beforeEach(() => {
    stderr = spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    stderr.mockRestore();
  });

  test("sends the API key and prints no expiry note", async () => {
    const fetchMock = shareSequence(shared());
    const result = await buildStudioUrl(sample, { apiKey: "key" });
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("key");
    expect(result.shortened).toBe(true);
    expect(stderr).not.toHaveBeenCalled();
  });

  test("without a key, says on stderr that the link lasts 30 days", async () => {
    const fetchMock = shareSequence(shared());
    await buildStudioUrl(sample);
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBeUndefined();
    expect(String(stderr.mock.calls[0]![0])).toContain("lasts 30 days");
  });

  test("retries once after a timeout", async () => {
    const fetchMock = shareSequence(timeout(), shared());
    const result = await buildStudioUrl(sample, { apiKey: "key" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ url: "https://shotstack.studio/s/abc12345", shortened: true });
  });

  test("retries once after a 429", async () => {
    const fetchMock = shareSequence(new Response('{"message":"Too Many Requests"}', { status: 429 }), shared());
    const result = await buildStudioUrl(sample, { apiKey: "key" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.shortened).toBe(true);
  });

  test("falls back after two 5xx and names the cause", async () => {
    const fetchMock = shareSequence(refusal(502, "storage-failed"), new Response("", { status: 503 }));
    const result = await buildStudioUrl(sample, { apiKey: "key" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.shortened).toBe(false);
    expect(String(stderr.mock.calls[0]![0])).toContain("HTTP 503");
  });

  test("falls back after two timeouts and names the cause", async () => {
    shareSequence(timeout(), timeout());
    const result = await buildStudioUrl(sample, { apiKey: "key" });
    expect(result.shortened).toBe(false);
    expect(String(stderr.mock.calls[0]![0])).toContain("timeout");
  });

  test("a 400 is an error with the share API's reason, not an inline URL", async () => {
    const fetchMock = shareSequence(refusal(400, "edit-missing-timeline-or-output"));
    const err = await buildStudioUrl(sample, { apiKey: "key" }).catch((e: unknown) => e);
    expect((err as Error).message).toContain("edit-missing-timeline-or-output");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a 413 is an ApiError carrying payload-too-large", async () => {
    shareSequence(refusal(413, "payload-too-large"));
    const err = await buildStudioUrl(sample, { apiKey: "key" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(413);
    expect((err as ApiError).message).toContain("payload-too-large");
  });
});

describe("shareApiKey", () => {
  const saved = process.env.SHOTSTACK_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.SHOTSTACK_API_KEY;
    else process.env.SHOTSTACK_API_KEY = saved;
  });

  test("uses the key a sandbox render would use", () => {
    process.env.SHOTSTACK_API_KEY = "stage-key";
    expect(shareApiKey("stage")).toBe("stage-key");
  });

  test("shares anonymously for dev because Studio cannot validate dev keys", () => {
    process.env.SHOTSTACK_API_KEY = "dev-key";
    expect(shareApiKey("dev")).toBeUndefined();
  });
});
