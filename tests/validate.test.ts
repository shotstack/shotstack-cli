import { describe, test, expect } from "bun:test";
import { validateEdit, formatIssues } from "../src/lib/validate.ts";

const ANTON_URL = "https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm0K08i4gS7lu.ttf";
const ANTON_FAMILY = "1Ptgg87LROyAm0K08i4gS7lu";

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

function baseEdit(): any {
  return {
    timeline: {
      background: "#ffffff",
      fonts: [{ src: ANTON_URL }],
      tracks: [
        {
          clips: [
            { asset: { type: "rich-text", text: "A", font: { family: ANTON_FAMILY, size: 40 } }, start: 0, length: 2 },
          ],
        },
        {
          clips: [{ asset: { type: "image", src: "https://example.com/a.jpg" }, start: 0, length: 5 }],
        },
      ],
    },
    output: { format: "mp4", size: { width: 1080, height: 1920 } },
  };
}

const codes = (r: ReturnType<typeof validateEdit>) => r.issues.map((i) => i.code);

describe("validateEdit — schema", () => {
  test("accepts a minimal valid edit", () => {
    const result = validateEdit(validEdit);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test("rejects unrecognized keys with did-you-mean for CSS-instinct names", () => {
    const bad = structuredClone(validEdit);
    (bad.timeline.tracks[0]!.clips[0]!.asset as Record<string, unknown>).alignment = "center";

    const result = validateEdit(bad);
    expect(result.ok).toBe(false);

    const issue = result.issues.find((i) => i.path.endsWith("alignment"));
    expect(issue).toBeDefined();
    expect(issue!.code).toBe("unrecognized_keys");
    expect(issue!.suggestion).toBe("align");
    expect(issue!.path).toBe("timeline.tracks[0].clips[0].asset.alignment");
  });

  test("rejects wrong types with descriptive messages", () => {
    const result = validateEdit({ timeline: "nope", output: { format: "mp4" } });
    expect(result.ok).toBe(false);
    const timelineIssue = result.issues.find((i) => i.path === "timeline");
    expect(timelineIssue).toBeDefined();
    expect(timelineIssue!.message).toMatch(/expected object/i);
  });

  test("rejects missing required fields", () => {
    const result = validateEdit({ timeline: { tracks: [] } });
    expect(result.ok).toBe(false);
    expect(result.issues.find((i) => i.path === "output")).toBeDefined();
  });

  test("formats array indices with bracket notation", () => {
    const bad = structuredClone(validEdit);
    (bad.timeline.tracks[0]!.clips[0]!.asset as Record<string, unknown>).duration = 5;

    const result = validateEdit(bad);
    expect(result.ok).toBe(false);
    const issue = result.issues.find((i) => i.suggestion === "length");
    expect(issue).toBeDefined();
    expect(issue!.path).toMatch(/tracks\[0\]\.clips\[0\]/);
  });

  test("a clean multi-track edit passes with no issues", () => {
    const result = validateEdit(baseEdit());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

describe("validateEdit — same-track overlaps", () => {
  test("overlapping clips on one track is an error", () => {
    const edit = baseEdit();
    edit.timeline.tracks = [
      {
        clips: [
          { asset: { type: "image", src: "https://x/a.jpg" }, start: 0, length: 3 },
          { asset: { type: "image", src: "https://x/b.jpg" }, start: 2, length: 3 },
        ],
      },
    ];
    const result = validateEdit(edit);
    expect(result.ok).toBe(false);
    const overlap = result.issues.find((i) => i.code === "clip_overlap");
    expect(overlap?.level).toBe("error");
    expect(overlap?.path).toBe("timeline.tracks[0].clips");
  });

  test("the same clips on separate tracks are fine", () => {
    const edit = baseEdit();
    edit.timeline.tracks = [
      { clips: [{ asset: { type: "image", src: "https://x/a.jpg" }, start: 0, length: 3 }] },
      { clips: [{ asset: { type: "image", src: "https://x/b.jpg" }, start: 0, length: 3 }] },
    ];
    expect(codes(validateEdit(edit))).not.toContain("clip_overlap");
  });

  test("touching clips (end == next start) do not overlap", () => {
    const edit = baseEdit();
    edit.timeline.tracks = [
      {
        clips: [
          { asset: { type: "image", src: "https://x/a.jpg" }, start: 0, length: 3 },
          { asset: { type: "image", src: "https://x/b.jpg" }, start: 3, length: 2 },
        ],
      },
    ];
    expect(codes(validateEdit(edit))).not.toContain("clip_overlap");
  });
});

describe("validateEdit — fonts", () => {
  test("an unloaded custom family is a warning, not an error", () => {
    const edit = baseEdit();
    edit.timeline.fonts = [];
    edit.timeline.tracks[0].clips[0].asset.font.family = "Helvetica";
    const result = validateEdit(edit);
    expect(result.ok).toBe(true);
    expect(result.issues.find((i) => i.code === "font_not_loaded")?.level).toBe("warning");
  });

  test("a built-in font needs no timeline.fonts[] entry", () => {
    const edit = baseEdit();
    edit.timeline.fonts = [];
    edit.timeline.tracks[0].clips[0].asset.font.family = "Roboto";
    expect(codes(validateEdit(edit))).not.toContain("font_not_loaded");
  });

  test("a loaded family produces no warning", () => {
    expect(codes(validateEdit(baseEdit()))).not.toContain("font_not_loaded");
  });
});

describe("validateEdit — asset URLs", () => {
  test("a local path is a warning", () => {
    const edit = baseEdit();
    edit.timeline.tracks[1].clips[0].asset.src = "./shoe.jpg";
    const result = validateEdit(edit);
    expect(result.ok).toBe(true);
    expect(result.issues.find((i) => i.code === "src_not_public")?.level).toBe("warning");
  });

  test("an https URL is accepted", () => {
    expect(codes(validateEdit(baseEdit()))).not.toContain("src_not_public");
  });
});

describe("validateEdit — html5 JS syntax", () => {
  test("valid JS passes without issue", () => {
    const edit = baseEdit();
    edit.timeline.tracks[0].clips[0].asset = {
      type: "html5",
      html: "<div>hi</div>",
      js: "gsap.to('.x',{opacity:1,duration:0.6});",
    };
    expect(codes(validateEdit(edit))).not.toContain("js_syntax_error");
  });

  test("JS with a syntax error is caught", () => {
    const edit = baseEdit();
    edit.timeline.tracks[0].clips[0].asset = {
      type: "html5",
      html: "<div>hi</div>",
      js: "gsap.to('.x',{opacity:1,duration:0.6})var broken=1;",
    };
    const result = validateEdit(edit);
    expect(result.ok).toBe(false);
    const issue = result.issues.find((i) => i.code === "js_syntax_error");
    expect(issue?.level).toBe("error");
    expect(issue?.path).toBe("timeline.tracks[0].clips[0].asset.js");
    expect(issue?.message).toMatch(/syntax error/);
    expect(issue?.message).toMatch(/blank/);
  });

  test("empty js string is skipped", () => {
    const edit = baseEdit();
    edit.timeline.tracks[0].clips[0].asset = {
      type: "html5",
      html: "<div>hi</div>",
      js: "",
    };
    expect(codes(validateEdit(edit))).not.toContain("js_syntax_error");
  });
});

describe("formatIssues", () => {
  test("renders a multi-line stderr-friendly summary", () => {
    const issues = [
      { path: "timeline.tracks[0]", code: "x", message: "bad", suggestion: "good" },
      { path: "output.format", code: "y", message: "wrong" },
    ];
    const formatted = formatIssues(issues);
    expect(formatted).toContain("failed validation");
    expect(formatted).toContain("timeline.tracks[0]: bad (did you mean 'good'?)");
    expect(formatted).toContain("output.format: wrong");
  });

  test("headlines a warnings-only result", () => {
    const formatted = formatIssues([{ path: "a", code: "x", message: "careful", level: "warning" }]);
    expect(formatted).toContain("⚠");
    expect(formatted).toContain("1 warning");
  });
});
