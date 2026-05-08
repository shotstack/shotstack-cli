import { describe, test, expect } from "bun:test";
import { validateEdit, formatIssues } from "../src/lib/validate.ts";

const validEdit = {
  timeline: {
    tracks: [
      {
        clips: [
          {
            asset: { type: "rich-text", text: "hi", font: { family: "Roboto", size: 22 } },
            start: 0,
            length: 1,
          },
        ],
      },
    ],
  },
  output: { format: "mp4", size: { width: 1280, height: 720 } },
};

describe("validateEdit", () => {
  test("accepts a minimal valid edit", () => {
    expect(validateEdit(validEdit)).toEqual({ ok: true });
  });

  test("rejects unrecognized keys with did-you-mean for CSS-instinct names", () => {
    const bad = structuredClone(validEdit);
    (bad.timeline.tracks[0]!.clips[0]!.asset as Record<string, unknown>).alignment = "center";

    const result = validateEdit(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues.find((i) => i.path.endsWith("alignment"));
    expect(issue).toBeDefined();
    expect(issue!.code).toBe("unrecognized_keys");
    expect(issue!.suggestion).toBe("align");
    expect(issue!.path).toBe("timeline.tracks[0].clips[0].asset.alignment");
  });

  test("rejects wrong types with descriptive messages", () => {
    const result = validateEdit({ timeline: "nope", output: { format: "mp4" } });
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const timelineIssue = result.issues.find((i) => i.path === "timeline");
    expect(timelineIssue).toBeDefined();
    expect(timelineIssue!.message).toMatch(/expected object/i);
  });

  test("rejects missing required fields", () => {
    const result = validateEdit({ timeline: { tracks: [] } });
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const outputIssue = result.issues.find((i) => i.path === "output");
    expect(outputIssue).toBeDefined();
  });

  test("formats array indices with bracket notation", () => {
    const bad = structuredClone(validEdit);
    (bad.timeline.tracks[0]!.clips[0]!.asset as Record<string, unknown>).duration = 5;

    const result = validateEdit(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const issue = result.issues[0]!;
    expect(issue.path).toMatch(/tracks\[0\]\.clips\[0\]/);
    expect(issue.suggestion).toBe("length");
  });
});

describe("formatIssues", () => {
  test("renders a multi-line stderr-friendly summary", () => {
    const issues = [
      { path: "timeline.tracks[0]", code: "x", message: "bad", suggestion: "good" },
      { path: "output.format", code: "y", message: "wrong" },
    ];
    const formatted = formatIssues(issues);
    expect(formatted).toContain("✗ Edit JSON failed validation:");
    expect(formatted).toContain("timeline.tracks[0]: bad (did you mean 'good'?)");
    expect(formatted).toContain("output.format: wrong");
  });
});
