export type EnvName = "dev" | "stage" | "v1";

const ENV_URLS: Record<EnvName, string> = {
  dev: "https://api.shotstack.io/edit/dev",
  stage: "https://api.shotstack.io/edit/stage",
  v1: "https://api.shotstack.io/edit/v1",
};

export const ENV_NAMES = Object.keys(ENV_URLS) as readonly EnvName[];

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

export function resolveEnv(cliEnv: string | undefined): ResolvedEnv {
  const override = process.env.SHOTSTACK_API_BASE_URL?.trim();
  if (override) return { name: "custom", baseUrl: override };

  const value = cliEnv ?? process.env.SHOTSTACK_ENV?.trim() ?? "v1";
  if (!isEnvName(value)) throw new InvalidEnvError(value);
  return { name: value, baseUrl: ENV_URLS[value] };
}

function isEnvName(value: string): value is EnvName {
  return (ENV_NAMES as readonly string[]).includes(value);
}
