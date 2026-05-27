import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireApiKey, MissingApiKeyError } from "../src/http/auth.ts";
import { storeKey } from "../src/http/credentials.ts";

const tmps: string[] = [];
let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.SHOTSTACK_API_KEY;
  delete process.env.SHOTSTACK_API_KEY;
});

afterEach(async () => {
  if (savedKey === undefined) delete process.env.SHOTSTACK_API_KEY;
  else process.env.SHOTSTACK_API_KEY = savedKey;
  while (tmps.length) await rm(tmps.pop()!, { recursive: true, force: true });
});

async function tmpStore(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ss-auth-"));
  tmps.push(dir);
  return join(dir, "credentials.json");
}

describe("requireApiKey precedence", () => {
  test("env var wins over a stored key", async () => {
    const p = await tmpStore();
    await storeKey("v1", "stored-key", p);
    process.env.SHOTSTACK_API_KEY = "env-key";
    expect(requireApiKey("v1", p)).toBe("env-key");
  });

  test("falls back to the stored key for the env when no env var is set", async () => {
    const p = await tmpStore();
    await storeKey("stage", "stage-stored", p);
    expect(requireApiKey("stage", p)).toBe("stage-stored");
  });

  test("stored keys are per-env — the wrong env throws", async () => {
    const p = await tmpStore();
    await storeKey("stage", "stage-stored", p);
    expect(() => requireApiKey("v1", p)).toThrow(MissingApiKeyError);
  });

  test("throws when neither env var nor stored key is present", async () => {
    const p = await tmpStore();
    expect(() => requireApiKey("v1", p)).toThrow(MissingApiKeyError);
  });

  test("the error names the env and points at `shotstack login`", async () => {
    const p = await tmpStore();
    try {
      requireApiKey("stage", p);
      throw new Error("expected requireApiKey to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingApiKeyError);
      expect((err as Error).message).toContain("stage");
      expect((err as Error).message).toContain("shotstack login");
    }
  });

  test("a whitespace-only env var is ignored in favour of the stored key", async () => {
    const p = await tmpStore();
    await storeKey("v1", "stored", p);
    process.env.SHOTSTACK_API_KEY = "   ";
    expect(requireApiKey("v1", p)).toBe("stored");
  });
});
