import { describe, test, expect } from "bun:test";
import { fetchModel, formatAvailability, formatPrice, type GenerationModel } from "../src/commands/models.ts";
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

describe("formatPrice", () => {
  test("flat rate per generation", () => {
    expect(formatPrice({ credits: 0.1, effectiveFrom: "legacy" })).toBe("0.1 credits per generation");
  });

  test("rate per counted unit", () => {
    expect(
      formatPrice({ credits: 1, quantity: { measure: "promptCharacters", per: 1000 }, effectiveFrom: "legacy" }),
    ).toBe("1 credit per 1000 characters");
  });

  test("tiered rate names the option and marks its default", () => {
    expect(
      formatPrice({
        credits: { "480p": 0.9375, "720p": 1.8962 },
        tieredBy: { option: "resolution", default: "720p" },
        quantity: { measure: "clipSeconds", per: 1 },
        effectiveFrom: "2026-08-13",
      }),
    ).toBe("credits per second by resolution: 480p 0.9375, 720p 1.8962 (default)");
  });
});
