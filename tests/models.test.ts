import { describe, test, expect } from "bun:test";
import { fetchModel, formatAvailability, type GenerationModel } from "../src/commands/models.ts";
import type { Client } from "../src/http/client.ts";

const model = (fields: Partial<GenerationModel>): GenerationModel => ({ model: "m", type: "image", ...fields });

describe("fetchModel", () => {
  test("requests the model by encoded id", async () => {
    let requestedPath = "";
    const client = {
      get: async (path: string) => {
        requestedPath = path;
        return { model: "seedance 2", type: "video" };
      },
    } as unknown as Client;

    await fetchModel(client, "seedance 2");
    expect(requestedPath).toBe("/models/seedance%202");
  });
});

describe("formatAvailability", () => {
  test("prints the reason a model is unavailable", () => {
    expect(formatAvailability(model({ available: false, unavailableReason: "AiCapabilityNotIncluded" }))).toBe(
      "unavailable: AiCapabilityNotIncluded",
    );
  });

  test("treats a missing flag as unknown, not available", () => {
    expect(formatAvailability(model({}))).toBe("availability unknown");
    expect(formatAvailability(model({ available: true }))).toBe("available");
  });
});
