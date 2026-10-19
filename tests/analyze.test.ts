import { describe, test, expect, mock, spyOn } from "bun:test";
import { analyzeCommand, formatSummary, runAnalyze, type Analysis } from "../src/commands/analyze.ts";
import { createClient, type Client } from "../src/http/client.ts";

const steady = {
  bpm: 120.01,
  meter: 4,
  bar: 1.9998,
  origin: 0.062,
  steady: true,
  bars: { start: 0.06, count: 111, energy: [] },
  drops: [{}, {}, {}],
  sections: Array.from({ length: 7 }, () => ({})),
};

function fakeClient(submitted: Analysis, ...polls: Analysis[]) {
  let i = 0;
  const post = mock(async () => submitted);
  const get = mock(async () => polls[Math.min(i++, polls.length - 1)]);
  return { client: { get, post } as unknown as Client, post, get };
}

async function capture(run: () => Promise<unknown>) {
  const log = spyOn(console, "log").mockImplementation(() => {});
  const err = spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await run();
    return { result, lines: log.mock.calls.map((c) => String(c[0])) };
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
}

const MAP_URL = "https://cdn.example.com/a.json";
const body = { asset: { type: "audio", model: "shotstack-music-analysis", src: "https://example.com/lit.mp3" } };

async function withMapFetch(run: (fetchMock: ReturnType<typeof spyOn>) => Promise<void>) {
  const fetchMock = spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(steady)));
  try {
    await run(fetchMock);
  } finally {
    fetchMock.mockRestore();
  }
}

describe("runAnalyze", () => {
  test("posts the analysis model, polls until done, then prints the map fetched without a key", async () => {
    const { client, post, get } = fakeClient(
      { id: "a", status: "queued" },
      { id: "a", status: "processing" },
      { id: "a", status: "done", url: MAP_URL },
    );
    await withMapFetch(async (fetchMock) => {
      const { result, lines } = await capture(() => runAnalyze(client, "https://example.com/lit.mp3", "json", 0));
      expect(post).toHaveBeenCalledWith("/generate", body);
      expect(get).toHaveBeenCalledWith("/generate/a");
      expect(get).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls).toEqual([[MAP_URL]]);
      expect(lines).toEqual([JSON.stringify(steady)]);
      expect(result).toMatchObject({ exitCode: 0 });
    });
  });

  test("a cached 200 done response fetches the map without polling", async () => {
    const { client, get } = fakeClient({ id: "a", status: "done", url: MAP_URL });
    await withMapFetch(async (fetchMock) => {
      const { lines } = await capture(() => runAnalyze(client, "https://example.com/lit.mp3", "json", 0));
      expect(get).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(lines).toEqual([JSON.stringify(steady)]);
    });
  });

  test("exits 1 with the API's error when the track can't be read", async () => {
    const failed: Analysis = { id: "a", status: "failed", error: "could not read audio" };
    const { client } = fakeClient({ id: "a", status: "queued" }, failed);
    const { result, lines } = await capture(() => runAnalyze(client, "https://example.com/a.mp3", "json", 0));
    expect(lines).toEqual([JSON.stringify(failed)]);
    expect(result).toMatchObject({ exitCode: 1 });
  });
});

describe("analyze command", () => {
  test("sends the account's API key to /generate but not to the map URL", async () => {
    const saved = process.env.SHOTSTACK_API_KEY;
    process.env.SHOTSTACK_API_KEY = "test-key";
    const log = spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).endsWith("/generate")
        ? new Response(JSON.stringify({ id: "a", status: "done", url: MAP_URL }))
        : new Response(JSON.stringify(steady)),
    );
    try {
      await analyzeCommand.parseAsync(["node", "analyze", "https://example.com/a.mp3", "--output", "json"]);
      const [generate, map] = fetchMock.mock.calls;
      expect((generate![1]!.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
      expect(map).toEqual([MAP_URL]);
    } finally {
      fetchMock.mockRestore();
      log.mockRestore();
      if (saved === undefined) delete process.env.SHOTSTACK_API_KEY;
      else process.env.SHOTSTACK_API_KEY = saved;
    }
  });
});

describe("formatSummary", () => {
  test("describes a steady grid", () => {
    expect(formatSummary(steady)).toBe("120.01 BPM, 4/4, bar 2.00 s from 0.06 s, 111 bars, 3 drops, 7 sections");
  });

  test("describes a track whose tempo varies", () => {
    const varies = { bpm: 120, steady: false, beats: Array(822), downbeats: Array(227), drops: [{}, {}], sections: Array(9) };
    expect(formatSummary(varies)).toBe("tempo varies (about 120 BPM): 822 beats, 227 downbeats, 2 drops, 9 sections");
  });
});

describe("createClient", () => {
  test("sends no API key when it has none", async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    try {
      await createClient({ env: { name: "v1", baseUrl: "https://api.example.com" } }).get("/x");
      expect(fetchMock.mock.calls[0]![1]!.headers).not.toHaveProperty("x-api-key");
    } finally {
      fetchMock.mockRestore();
    }
  });
});
