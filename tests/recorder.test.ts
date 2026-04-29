import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildEntry,
  capResponse,
  record,
  redactSignedUrl,
  sanitiseArg,
  sanitiseValue,
  toLogError,
} from "../src/recorder.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

async function makeTempLog(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ss-rec-"));
  tempDirs.push(dir);
  return join(dir, "log.jsonl");
}

describe("redactSignedUrl", () => {
  test("redacts AWS S3 signed query", () => {
    const url = "https://shotstack-output.s3.amazonaws.com/render/abc.mp4?X-Amz-Signature=deadbeef&X-Amz-Date=20260428T000000Z";
    expect(redactSignedUrl(url)).toBe("https://shotstack-output.s3.amazonaws.com/render/abc.mp4?[redacted-signed]");
  });

  test("redacts CloudFront-style signed query", () => {
    const url = "https://cdn.shotstack.io/render/abc.mp4?Signature=foo&Expires=123";
    expect(redactSignedUrl(url)).toBe("https://cdn.shotstack.io/render/abc.mp4?[redacted-signed]");
  });

  test("leaves plain URLs untouched", () => {
    expect(redactSignedUrl("https://example.com/a.mp4")).toBe("https://example.com/a.mp4");
  });

  test("leaves non-URL strings untouched", () => {
    expect(redactSignedUrl("not a url at all")).toBe("not a url at all");
  });
});

describe("sanitiseArg", () => {
  test("reduces POSIX absolute path to basename", () => {
    expect(sanitiseArg("/Users/alice/projects/template.json")).toBe("template.json");
  });

  test("reduces Windows path to basename", () => {
    expect(sanitiseArg("C:\\Users\\alice\\template.json")).toBe("template.json");
  });

  test("leaves bare filenames alone", () => {
    expect(sanitiseArg("template.json")).toBe("template.json");
  });

  test("leaves render IDs alone", () => {
    expect(sanitiseArg("01ja7-x8m2k-39rzv-cmvxve")).toBe("01ja7-x8m2k-39rzv-cmvxve");
  });

  test("leaves CLI flags alone", () => {
    expect(sanitiseArg("--watch")).toBe("--watch");
    expect(sanitiseArg("--output")).toBe("--output");
    expect(sanitiseArg("--env")).toBe("--env");
  });

  test("redacts signed URL passed as an argument", () => {
    expect(sanitiseArg("https://s3.amazonaws.com/bucket/k?X-Amz-Signature=abc"))
      .toBe("https://s3.amazonaws.com/bucket/k?[redacted-signed]");
  });
});

describe("sanitiseValue", () => {
  test("redacts signed URLs nested in response objects", () => {
    const input = { url: "https://s3.amazonaws.com/x?X-Amz-Signature=abc", state: "done" };
    expect(sanitiseValue(input)).toEqual({
      url: "https://s3.amazonaws.com/x?[redacted-signed]",
      state: "done",
    });
  });

  test("walks arrays", () => {
    expect(sanitiseValue([{ url: "https://x.com/a?Signature=z" }]))
      .toEqual([{ url: "https://x.com/a?[redacted-signed]" }]);
  });

  test("preserves primitives", () => {
    expect(sanitiseValue(42)).toBe(42);
    expect(sanitiseValue(null)).toBe(null);
    expect(sanitiseValue(true)).toBe(true);
  });
});

describe("capResponse", () => {
  test("passes small payloads through unchanged", () => {
    const small = { state: "done", url: "https://example.com/a.mp4" };
    expect(capResponse(small)).toEqual(small);
  });

  test("truncates oversize payloads with marker", () => {
    const big = { blob: "a".repeat(3000) };
    const out = capResponse(big);
    expect(typeof out).toBe("string");
    expect(out as string).toEndWith("...[truncated]");
    expect((out as string).length).toBeLessThanOrEqual(2_000 + "...[truncated]".length);
  });
});

describe("buildEntry", () => {
  test("sanitises path-like argv to basename", () => {
    const entry = buildEntry({
      cmd: "render",
      args: ["/abs/path/template.json", "--output", "json"],
      exit: 0,
      durationMs: 1,
    });
    expect(entry.args).toEqual(["template.json", "--output", "json"]);
  });

  test("sanitises signed URL in argv", () => {
    const entry = buildEntry({
      cmd: "render",
      args: ["https://s3.amazonaws.com/x?X-Amz-Signature=abc"],
      exit: 0,
      durationMs: 1,
    });
    expect(entry.args[0]).toBe("https://s3.amazonaws.com/x?[redacted-signed]");
  });

  test("sanitises and preserves response shape", () => {
    const entry = buildEntry({
      cmd: "status",
      args: ["id"],
      exit: 0,
      durationMs: 5,
      response: { url: "https://x.com/a?Signature=z", state: "done" },
    });
    expect(entry.response).toEqual({
      url: "https://x.com/a?[redacted-signed]",
      state: "done",
    });
  });

  test("uses provided timestamp", () => {
    const entry = buildEntry(
      { cmd: "render", args: [], exit: 0, durationMs: 1 },
      new Date("2026-04-28T05:14:01.000Z"),
    );
    expect(entry.ts).toBe("2026-04-28T05:14:01.000Z");
  });

  test("includes error when provided", () => {
    const entry = buildEntry({
      cmd: "render",
      args: ["broken.json"],
      exit: 2,
      durationMs: 4,
      error: { name: "SyntaxError", message: "Unexpected token } in JSON at position 12" },
    });
    expect(entry.error).toEqual({
      name: "SyntaxError",
      message: "Unexpected token } in JSON at position 12",
    });
  });

  test("redacts signed URLs from error messages", () => {
    const entry = buildEntry({
      cmd: "render",
      args: ["t.json"],
      exit: 1,
      durationMs: 1,
      error: {
        name: "Error",
        message: "fetch failed for https://s3.amazonaws.com/x?X-Amz-Signature=LEAKY",
      },
    });
    expect(entry.error?.message).not.toContain("LEAKY");
  });
});

describe("toLogError", () => {
  test("converts Error instances", () => {
    expect(toLogError(new SyntaxError("bad json"))).toEqual({
      name: "SyntaxError",
      message: "bad json",
    });
  });

  test("returns undefined for null/undefined", () => {
    expect(toLogError(undefined)).toBeUndefined();
    expect(toLogError(null)).toBeUndefined();
  });

  test("coerces non-Error throws to a generic record", () => {
    expect(toLogError("oops")).toEqual({ name: "Unknown", message: "oops" });
  });
});

describe("record (file)", () => {
  test("does not capture environment variables", async () => {
    const path = await makeTempLog();
    const previous = process.env.SHOTSTACK_API_KEY;
    process.env.SHOTSTACK_API_KEY = "DEADBEEF-SECRET-KEY";
    try {
      await record(
        {
          cmd: "render",
          args: ["template.json"],
          exit: 0,
          durationMs: 12,
          renderId: "01ja7",
          response: { id: "01ja7" },
        },
        path,
      );
      const content = await readFile(path, "utf8");
      expect(content).not.toContain("DEADBEEF-SECRET-KEY");
      expect(content).not.toContain("SHOTSTACK_API_KEY");
      const lines = content.split("\n").filter(Boolean);
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.cmd).toBe("render");
      expect(parsed.renderId).toBe("01ja7");
    } finally {
      if (previous === undefined) delete process.env.SHOTSTACK_API_KEY;
      else process.env.SHOTSTACK_API_KEY = previous;
    }
  });

  test("redacts signed URLs from argv before writing", async () => {
    const path = await makeTempLog();
    await record(
      {
        cmd: "render",
        args: ["https://s3.amazonaws.com/x?X-Amz-Signature=SUPER_SECRET"],
        exit: 0,
        durationMs: 1,
      },
      path,
    );
    const content = await readFile(path, "utf8");
    expect(content).not.toContain("SUPER_SECRET");
    expect(content).toContain("[redacted-signed]");
  });

  test("redacts signed URLs nested in the response", async () => {
    const path = await makeTempLog();
    await record(
      {
        cmd: "status",
        args: ["01ja7"],
        exit: 0,
        durationMs: 9,
        response: {
          state: "done",
          url: "https://cdn.shotstack.io/v1/output.mp4?X-Amz-Signature=LEAKY&X-Amz-Date=2026",
        },
      },
      path,
    );
    const content = await readFile(path, "utf8");
    expect(content).not.toContain("LEAKY");
    expect(content).toContain("[redacted-signed]");
  });

  test("creates the log file with 0600 permissions on POSIX", async () => {
    if (process.platform === "win32") return;
    const path = await makeTempLog();
    await record(
      { cmd: "render", args: ["t.json"], exit: 0, durationMs: 1 },
      path,
    );
    const info = await stat(path);
    expect(info.mode & 0o777).toBe(0o600);
  });

  test("appends multiple entries as JSONL", async () => {
    const path = await makeTempLog();
    await record({ cmd: "render", args: ["a.json"], exit: 0, durationMs: 1 }, path);
    await record({ cmd: "status", args: ["id"], exit: 0, durationMs: 2 }, path);
    const content = await readFile(path, "utf8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).cmd).toBe("render");
    expect(JSON.parse(lines[1]).cmd).toBe("status");
  });
});
