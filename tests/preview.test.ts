import { describe, test, expect } from "bun:test";
import { buildPreviewUrl } from "../src/commands/preview.ts";

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

describe("buildPreviewUrl", () => {
  test("emits a shotstack.studio URL with #json= hash", () => {
    const url = buildPreviewUrl(sample);
    expect(url.startsWith("https://shotstack.studio/#json=")).toBe(true);
  });

  test("encoded payload uses base64url alphabet (no +, /, =)", () => {
    const url = buildPreviewUrl(sample);
    const encoded = url.split("#json=")[1]!;
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("decoding the hash returns identical JSON", () => {
    const url = buildPreviewUrl(sample);
    const encoded = url.split("#json=")[1]!;
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded).toEqual(sample);
  });

  test("handles unicode in text fields", () => {
    const tpl = { ...sample, timeline: { ...sample.timeline, tracks: [{ clips: [{ asset: { type: "rich-text", text: "héllo 🌏 中文" }, start: 0, length: 1 }] }] } };
    const url = buildPreviewUrl(tpl);
    const encoded = url.split("#json=")[1]!;
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded).toEqual(tpl);
  });
});
