import { test, expect } from "bun:test";
import { PassThrough } from "node:stream";
import { connectPipe } from "../src/lib/cdp.ts";

function pipe() {
  const toChrome = new PassThrough();
  const fromChrome = new PassThrough();
  const written: string[] = [];
  toChrome.on("data", (chunk: Buffer) => written.push(chunk.toString()));
  return { cdp: connectPipe(toChrome, fromChrome), fromChrome, written };
}

test("messages go out as JSON ending in a NUL byte, with the session when given", async () => {
  const { cdp, written } = pipe();
  void cdp.send("Page.navigate", { url: "about:blank" }, "s1");
  await Bun.sleep(0);
  expect(written.join("")).toBe(`${JSON.stringify({ id: 1, method: "Page.navigate", params: { url: "about:blank" }, sessionId: "s1" })}\0`);
});

test("a reply split across chunks resolves its call", async () => {
  const { cdp, fromChrome } = pipe();
  const reply = cdp.send("Target.createTarget");
  const text = `${JSON.stringify({ id: 1, result: { targetId: "t1" } })}\0`;
  fromChrome.write(text.slice(0, 10));
  fromChrome.write(text.slice(10));
  expect(await reply).toEqual({ targetId: "t1" });
});

test("two replies in one chunk resolve both calls", async () => {
  const { cdp, fromChrome } = pipe();
  const first = cdp.send("A");
  const second = cdp.send("B");
  fromChrome.write(`${JSON.stringify({ id: 2, result: "b" })}\0${JSON.stringify({ id: 1, result: "a" })}\0`);
  expect([await first, await second]).toEqual(["a", "b"]);
});

test("a protocol error rejects with its message", async () => {
  const { cdp, fromChrome } = pipe();
  const reply = cdp.send("Nope");
  fromChrome.write(`${JSON.stringify({ id: 1, error: { message: "'Nope' wasn't found" } })}\0`);
  expect(reply).rejects.toThrow("'Nope' wasn't found");
});

test("a closed pipe rejects every call still waiting", async () => {
  const { cdp, fromChrome } = pipe();
  const reply = cdp.send("Target.createTarget");
  fromChrome.end();
  expect(reply).rejects.toThrow("Chrome closed the DevTools pipe.");
});
