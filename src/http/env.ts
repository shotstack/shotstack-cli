export type EnvName = "dev" | "stage" | "v1";
export type ApiName = "edit" | "ingest";

const HOST = "https://api.shotstack.io";

export const ENV_NAMES = ["dev", "stage", "v1"] as const satisfies readonly EnvName[];

export class InvalidEnvError extends Error {
  constructor(value: string) {
    super(`Invalid environment "${value}". Use one of: ${ENV_NAMES.join(", ")}.`);
    this.name = "InvalidEnvError";
  }
}

export interface ResolvedEnv {
  name: EnvName | "custom";
  baseUrl: string;
}

/**
 * Resolve just the environment tier (dev | stage | v1), ignoring any base-URL
 * override. Used by `login`/`logout` to key the credential store, and by
 * resolveEnv below.
 */
export function resolveEnvName(cliEnv: string | undefined): EnvName {
  const value = cliEnv ?? process.env.SHOTSTACK_ENV?.trim() ?? "v1";
  if (!isEnvName(value)) throw new InvalidEnvError(value);
  return value;
}

export function resolveEnv(cliEnv: string | undefined, api: ApiName = "edit"): ResolvedEnv {
  const override = apiOverride(api);
  if (override) return { name: "custom", baseUrl: override };

  const value = resolveEnvName(cliEnv);
  return { name: value, baseUrl: `${HOST}/${api}/${value}` };
}

function apiOverride(api: ApiName): string | undefined {
  const raw = api === "ingest" ? process.env.SHOTSTACK_INGEST_BASE_URL : process.env.SHOTSTACK_API_BASE_URL;
  return raw?.trim() || undefined;
}

function isEnvName(value: string): value is EnvName {
  return (ENV_NAMES as readonly string[]).includes(value);
}
