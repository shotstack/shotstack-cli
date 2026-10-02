import { describe, test, expect, mock } from "bun:test";
import { InvalidArgumentError } from "commander";
import { buildRequest, parseOptionsJson, parseSeconds, runGenerate, type Generation } from "../src/commands/generate.ts";
import type { GenerationModel } from "../src/commands/models.ts";
import type { Client } from "../src/http/client.ts";

const video: GenerationModel = { model: "seedance-2.0-text-to-video", type: "video", available: true };

function fakeClient(model: GenerationModel, submitted: Generation, ...polls: Generation[]) {
  let i = 0;
  const post = mock(async () => submitted);
  const get = mock(async (path: string) => (path.startsWith("/models/") ? model : polls[Math.min(i++, polls.length - 1)]));
  return { client: { get, post } as unknown as Client, post, get };
}

describe("buildRequest", () => {
  test("takes the asset type from the model and omits unset fields", () => {
    expect(buildRequest(video, { model: "x", prompt: "waves" })).toEqual({
      asset: { type: "video", prompt: "waves", model: "seedance-2.0-text-to-video" },
    });
    expect(buildRequest(video, { model: "x", prompt: "waves", options: { resolution: "480p" }, length: 5 })).toEqual({
      asset: { type: "video", prompt: "waves", model: "seedance-2.0-text-to-video", options: { resolution: "480p" } },
      length: 5,
    });
  });
});

describe("option parsers", () => {
  test("options must be a JSON object", () => {
    expect(parseOptionsJson('{"resolution":"720p"}')).toEqual({ resolution: "720p" });
    expect(() => parseOptionsJson("[1]")).toThrow(InvalidArgumentError);
    expect(() => parseOptionsJson("{resolution")).toThrow(InvalidArgumentError);
  });

  test("length must be a positive number", () => {
    expect(parseSeconds("5")).toBe(5);
    for (const bad of ["abc", "0", "-2"]) expect(() => parseSeconds(bad)).toThrow(InvalidArgumentError);
  });
});

describe("runGenerate", () => {
  test("refuses an unavailable model without submitting", async () => {
    const { client, post } = fakeClient(
      { ...video, available: false, unavailableReason: "AiCapabilityNotIncluded" },
      { id: "g", status: "queued" },
    );
    const result = await runGenerate(client, { model: video.model, prompt: "waves" }, "json", true, 0);
    expect(post).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
  });

  test("returns a cached result without polling", async () => {
    const { client, get } = fakeClient(video, { id: "g", status: "done", url: "https://cdn.example.com/g.mp4" });
    const result = await runGenerate(client, { model: video.model, prompt: "waves" }, "json", true, 0);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBe(0);
  });

  test("polls a queued job until it fails", async () => {
    const { client } = fakeClient(
      video,
      { id: "g", status: "queued" },
      { id: "g", status: "processing" },
      { id: "g", status: "failed", error: "refused" },
    );
    const result = await runGenerate(client, { model: video.model, prompt: "waves" }, "json", true, 0);
    expect(result.response).toEqual({ id: "g", status: "failed", error: "refused" });
    expect(result.exitCode).toBe(1);
  });
});
