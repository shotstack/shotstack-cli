export class MissingApiKeyError extends Error {
  constructor() {
    super("SHOTSTACK_API_KEY is not set. Get a key at https://shotstack.io.");
    this.name = "MissingApiKeyError";
  }
}

export function requireApiKey(): string {
  const key = process.env.SHOTSTACK_API_KEY?.trim();
  if (!key) throw new MissingApiKeyError();
  return key;
}
