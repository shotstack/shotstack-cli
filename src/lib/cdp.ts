import type { Readable, Writable } from "node:stream";

export interface Cdp {
  send<T = unknown>(method: string, params?: object, sessionId?: string): Promise<T>;
  close(): void;
}

interface Waiter {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

// Chrome's --remote-debugging-pipe frames each message as JSON followed by a NUL byte.
export function connectPipe(toChrome: Writable, fromChrome: Readable): Cdp {
  const waiting = new Map<number, Waiter>();
  let nextId = 0;
  let buffer = "";

  fromChrome.setEncoding("utf8");
  fromChrome.on("data", (chunk: string) => {
    buffer += chunk;
    for (let end = buffer.indexOf("\0"); end !== -1; end = buffer.indexOf("\0")) {
      const message = JSON.parse(buffer.slice(0, end)) as { id?: number; result?: unknown; error?: { message: string } };
      buffer = buffer.slice(end + 1);
      const waiter = message.id === undefined ? undefined : waiting.get(message.id);
      if (!waiter) continue;
      waiting.delete(message.id!);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    }
  });
  const closed = () => {
    for (const waiter of waiting.values()) waiter.reject(new Error("Chrome closed the DevTools pipe."));
    waiting.clear();
  };
  fromChrome.on("end", closed);
  fromChrome.on("close", closed);
  fromChrome.on("error", closed);

  return {
    send<T>(method: string, params: object = {}, sessionId?: string) {
      return new Promise<T>((resolve, reject) => {
        const id = ++nextId;
        waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
        toChrome.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
      });
    },
    close: () => toChrome.end(),
  };
}
