import { mkdir, writeFile, chmod } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

/**
 * Persistent API-key store: one key per environment, written beside the
 * flight-recorder log in ~/.shotstack/ (chmod 600). This is the lowest
 * precedence tier — the SHOTSTACK_API_KEY env var always wins (see auth.ts).
 */
export function credentialsPath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "shotstack", "credentials.json");
  }
  return join(homedir(), ".shotstack", "credentials.json");
}

type Store = Record<string, string>;

function readStore(path: string): Store {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Store;
  } catch {
    // Missing or malformed file → no stored keys.
  }
  return {};
}

export function readStoredKey(env: string, path: string = credentialsPath()): string | undefined {
  return readStore(path)[env]?.trim() || undefined;
}

export function storedEnvs(path: string = credentialsPath()): string[] {
  return Object.keys(readStore(path));
}

export async function storeKey(env: string, apiKey: string, path: string = credentialsPath()): Promise<void> {
  const store = readStore(path);
  store[env] = apiKey.trim();
  await writeStore(path, store);
}

export async function removeKey(env: string, path: string = credentialsPath()): Promise<boolean> {
  const store = readStore(path);
  if (!(env in store)) return false;
  delete store[env];
  await writeStore(path, store);
  return true;
}

export async function clearKeys(path: string = credentialsPath()): Promise<void> {
  await writeStore(path, {});
}

async function writeStore(path: string, store: Store): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
  // writeFile's mode only applies on creation; force 0600 on a pre-existing file too.
  await chmod(path, 0o600).catch(() => {});
}
