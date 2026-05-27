import { userAgent } from "../version.ts";
import type { ResolvedEnv } from "./env.ts";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isTransient(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

export interface ClientOptions {
  apiKey: string;
  env: ResolvedEnv;
}

export type Client = ReturnType<typeof createClient>;

export function createClient(options: ClientOptions) {
  const baseUrl = options.env.baseUrl.replace(/\/$/, "");

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "x-api-key": options.apiKey,
        "x-shotstack-origin": "cli",
        "x-shotstack-environment": options.env.name,
        "user-agent": userAgent,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const parsed: unknown = text ? safeJsonParse(text) : undefined;

    if (!response.ok) {
      throw new ApiError(
        response.status,
        parsed ?? text,
        `${method} ${path} → ${response.status} ${response.statusText}`,
      );
    }
    return parsed as T;
  }

  return {
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    get: <T>(path: string) => request<T>("GET", path),
    del: <T>(path: string) => request<T>("DELETE", path),
  };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
