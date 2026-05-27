import { readStoredKey } from "./credentials.ts";

export class MissingApiKeyError extends Error {
  constructor(env?: string) {
    const scope = env ? ` for env "${env}"` : "";
    const hint = env ? `shotstack login --env ${env}` : "shotstack login";
    super(
      `No Shotstack API key found${scope}. Run \`${hint}\` to save one, or set SHOTSTACK_API_KEY. Get a key at https://shotstack.io.`,
    );
    this.name = "MissingApiKeyError";
  }
}

/**
 * Resolve the API key for a given environment. Precedence:
 *   1. SHOTSTACK_API_KEY env var — always wins, so CI/automation is unchanged
 *   2. the key saved via `shotstack login` for this env
 * Throws MissingApiKeyError if neither is present.
 */
export function requireApiKey(env: string, credentialsFile?: string): string {
  const fromEnv = process.env.SHOTSTACK_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  const stored = readStoredKey(env, credentialsFile);
  if (stored) return stored;

  throw new MissingApiKeyError(env);
}
