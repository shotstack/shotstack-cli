import { describe, test, expect } from "bun:test";
import { buildTitle } from "../src/commands/feedback.ts";
import type { LogEntry } from "../src/recorder.ts";

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    ts: "2026-05-04T05:14:22Z",
    cmd: "render",
    args: [],
    exit: 0,
    durationMs: 1,
    ...overrides,
  };
}

describe("buildTitle", () => {
  test("default title when no records", () => {
    expect(buildTitle([])).toBe("Feedback from shotstack CLI");
  });

  test("default title when all records were successful", () => {
    expect(buildTitle([entry({ exit: 0 }), entry({ exit: 0 })])).toBe("Feedback from shotstack CLI");
  });

  test("uses earlier failure even when latest record was successful", () => {
    const t = buildTitle([
      entry({ cmd: "status", exit: 0 }),
      entry({ cmd: "render", exit: 1, error: { name: "Error", message: "boom" } }),
    ]);
    expect(t).toContain("render");
    expect(t).toContain("boom");
  });

  test("uses error name and message when present", () => {
    const t = buildTitle([
      entry({
        exit: 2,
        error: { name: "SyntaxError", message: "Unexpected token } in JSON at position 12" },
      }),
    ]);
    expect(t).toContain("render");
    expect(t).toContain("SyntaxError");
    expect(t).toContain("Unexpected token");
  });

  test("uses failed-render error from status response", () => {
    const t = buildTitle([
      entry({
        cmd: "status",
        exit: 1,
        response: { state: "failed", error: "Invalid asset URL: scheme=file" },
      }),
    ]);
    expect(t).toBe("Render failed: Invalid asset URL: scheme=file");
  });

  test("falls back to exit code when no error info", () => {
    expect(buildTitle([entry({ cmd: "status", exit: 1 })])).toBe("status exited 1");
  });

  test("truncates titles longer than 80 chars", () => {
    const long = "a".repeat(200);
    const t = buildTitle([entry({ exit: 2, error: { name: "Error", message: long } })]);
    expect(t.length).toBeLessThanOrEqual(80);
    expect(t).toEndWith("…");
  });

  test("prefers errored record over failed-state over non-zero exit", () => {
    const t = buildTitle([
      entry({ cmd: "status", exit: 1 }),
      entry({ cmd: "status", exit: 1, response: { state: "failed", error: "asset-fetch" } }),
      entry({ cmd: "render", exit: 2, error: { name: "SyntaxError", message: "bad json" } }),
    ]);
    expect(t).toContain("render");
    expect(t).toContain("SyntaxError");
  });
});
