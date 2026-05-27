import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { resolveEnv, InvalidEnvError } from "../src/http/env.ts";

const VARS = ["SHOTSTACK_ENV", "SHOTSTACK_API_BASE_URL", "SHOTSTACK_INGEST_BASE_URL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const v of VARS) {
    saved[v] = process.env[v];
    delete process.env[v];
  }
});

afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

describe("resolveEnv", () => {
  test("defaults to the edit v1 endpoint", () => {
    expect(resolveEnv(undefined)).toEqual({ name: "v1", baseUrl: "https://api.shotstack.io/edit/v1" });
  });

  test("builds the edit endpoint for a named env", () => {
    expect(resolveEnv("stage")).toEqual({ name: "stage", baseUrl: "https://api.shotstack.io/edit/stage" });
  });

  test("builds the ingest endpoint when api is ingest", () => {
    expect(resolveEnv("stage", "ingest")).toEqual({
      name: "stage",
      baseUrl: "https://api.shotstack.io/ingest/stage",
    });
    expect(resolveEnv(undefined, "ingest")).toEqual({
      name: "v1",
      baseUrl: "https://api.shotstack.io/ingest/v1",
    });
  });

  test("honours SHOTSTACK_ENV when no flag is passed", () => {
    process.env.SHOTSTACK_ENV = "stage";
    expect(resolveEnv(undefined, "ingest").baseUrl).toBe("https://api.shotstack.io/ingest/stage");
  });

  test("rejects an unknown env", () => {
    expect(() => resolveEnv("prod")).toThrow(InvalidEnvError);
  });

  test("SHOTSTACK_API_BASE_URL overrides edit only, not ingest", () => {
    process.env.SHOTSTACK_API_BASE_URL = "http://localhost:9999/edit";
    expect(resolveEnv("v1")).toEqual({ name: "custom", baseUrl: "http://localhost:9999/edit" });
    expect(resolveEnv("v1", "ingest").baseUrl).toBe("https://api.shotstack.io/ingest/v1");
  });

  test("SHOTSTACK_INGEST_BASE_URL overrides ingest only, not edit", () => {
    process.env.SHOTSTACK_INGEST_BASE_URL = "http://localhost:9999/ingest";
    expect(resolveEnv("v1", "ingest")).toEqual({ name: "custom", baseUrl: "http://localhost:9999/ingest" });
    expect(resolveEnv("v1").baseUrl).toBe("https://api.shotstack.io/edit/v1");
  });
});
