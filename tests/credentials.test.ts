import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readStoredKey, storeKey, removeKey, clearKeys, storedEnvs } from "../src/http/credentials.ts";

const tmps: string[] = [];
afterEach(async () => {
  while (tmps.length) await rm(tmps.pop()!, { recursive: true, force: true });
});

async function tmpStore(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ss-cred-"));
  tmps.push(dir);
  return join(dir, "credentials.json");
}

describe("credentials store", () => {
  test("missing file reads as empty", async () => {
    const p = await tmpStore();
    expect(readStoredKey("v1", p)).toBeUndefined();
    expect(storedEnvs(p)).toEqual([]);
  });

  test("store + read round-trips per environment", async () => {
    const p = await tmpStore();
    await storeKey("v1", "prod-key", p);
    await storeKey("stage", "stage-key", p);
    expect(readStoredKey("v1", p)).toBe("prod-key");
    expect(readStoredKey("stage", p)).toBe("stage-key");
    expect(readStoredKey("dev", p)).toBeUndefined();
    expect(storedEnvs(p).sort()).toEqual(["stage", "v1"]);
  });

  test("re-storing an env overwrites its key", async () => {
    const p = await tmpStore();
    await storeKey("v1", "old", p);
    await storeKey("v1", "new", p);
    expect(readStoredKey("v1", p)).toBe("new");
  });

  test("trims whitespace on store and read", async () => {
    const p = await tmpStore();
    await storeKey("v1", "  spaced-key\n", p);
    expect(readStoredKey("v1", p)).toBe("spaced-key");
  });

  test("removeKey deletes one env and reports whether it existed", async () => {
    const p = await tmpStore();
    await storeKey("v1", "k", p);
    expect(await removeKey("stage", p)).toBe(false);
    expect(await removeKey("v1", p)).toBe(true);
    expect(readStoredKey("v1", p)).toBeUndefined();
  });

  test("clearKeys wipes every environment", async () => {
    const p = await tmpStore();
    await storeKey("v1", "a", p);
    await storeKey("stage", "b", p);
    await clearKeys(p);
    expect(storedEnvs(p)).toEqual([]);
  });

  test("writes the file 0600 on POSIX", async () => {
    if (process.platform === "win32") return;
    const p = await tmpStore();
    await storeKey("v1", "k", p);
    expect((await stat(p)).mode & 0o777).toBe(0o600);
  });

  test("tightens permissions on a pre-existing loose file", async () => {
    if (process.platform === "win32") return;
    const p = await tmpStore();
    await writeFile(p, "{}", { mode: 0o644 });
    await storeKey("v1", "k", p);
    expect((await stat(p)).mode & 0o777).toBe(0o600);
  });

  test("malformed JSON is treated as empty and recovers on next write", async () => {
    const p = await tmpStore();
    await writeFile(p, "not json", { mode: 0o600 });
    expect(readStoredKey("v1", p)).toBeUndefined();
    await storeKey("v1", "k", p);
    expect(readStoredKey("v1", p)).toBe("k");
  });
});
