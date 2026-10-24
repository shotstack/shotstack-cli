import { test, expect, mock, spyOn } from "bun:test";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTimes, resolveInput, runInspect, sheetPaths } from "../src/commands/inspect.ts";
import type { CaptureResult } from "../src/lib/capture.ts";

const EDIT = {
  timeline: { tracks: [{ clips: [{ asset: { type: "image", src: "https://cdn.example.com/a.jpg" }, start: 0, length: 10 }] }] },
  output: { format: "mp4", resolution: "hd" },
};
const jpeg = (bytes: string) => `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;

async function quietly<T>(run: () => Promise<T>) {
  const log = spyOn(console, "log").mockImplementation(() => {});
  const err = spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await run();
    return { result, lines: log.mock.calls.map((c) => String(c[0])), errors: err.mock.calls.map((c) => String(c[0])) };
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
}

test("--at reads seconds separated by commas", () => {
  expect(parseTimes("0.5,8.05")).toEqual([0.5, 8.05]);
  expect(parseTimes(" 1 , 2 ")).toEqual([1, 2]);
});

test("--at rejects anything that isn't seconds", () => {
  expect(() => parseTimes("a")).toThrow("--at takes seconds separated by commas, e.g. 0.5,8.05");
  expect(() => parseTimes("")).toThrow("--at takes seconds separated by commas, e.g. 0.5,8.05");
});

test("one sheet keeps the path; several are numbered", () => {
  expect(sheetPaths("inspect.jpg", 1)).toEqual(["inspect.jpg"]);
  expect(sheetPaths("out/sheet.jpg", 2)).toEqual(["out/sheet-1.jpg", "out/sheet-2.jpg"]);
});

test("writes every sheet and prints where, with the times", async () => {
  const dir = await mkdtemp(join(tmpdir(), "inspect-test-"));
  const result: CaptureResult = { sheets: [{ times: [1, 2, 3, 4, 5, 6], image: jpeg("one") }, { times: [7], image: jpeg("two") }], skipped: [] };
  const capture = mock(async () => result);
  const { result: outcome, lines } = await quietly(() => runInspect({ edit: EDIT, times: [1, 2, 3, 4, 5, 6, 7] }, { out: join(dir, "inspect.jpg"), format: "json", capture }));
  expect(outcome.exitCode).toBe(0);
  expect((await readdir(dir)).sort()).toEqual(["inspect-1.jpg", "inspect-2.jpg"]);
  expect(await readFile(join(dir, "inspect-2.jpg"), "utf8")).toBe("two");
  expect(JSON.parse(lines[0]!)).toEqual({
    sheets: [
      { path: join(dir, "inspect-1.jpg"), times: [1, 2, 3, 4, 5, 6] },
      { path: join(dir, "inspect-2.jpg"), times: [7] },
    ],
    skipped: [],
  });
});

test("an invalid edit exits 1 without starting Chrome", async () => {
  const capture = mock(async () => ({ sheets: [], skipped: [] }));
  const { result } = await quietly(() => runInspect({ edit: { timeline: EDIT.timeline }, times: [1] }, { out: "inspect.jpg", format: "text", capture }));
  expect(result.exitCode).toBe(1);
  expect(capture).not.toHaveBeenCalled();
});

test("a local file in the edit exits 1, because the page can't load it", async () => {
  const local = structuredClone(EDIT);
  local.timeline.tracks[0]!.clips[0]!.asset.src = "./clip.jpg";
  const capture = mock(async () => ({ sheets: [], skipped: [] }));
  const { result, errors } = await quietly(() => runInspect({ edit: local, times: [1] }, { out: "inspect.jpg", format: "text", capture }));
  expect(result.exitCode).toBe(1);
  expect(capture).not.toHaveBeenCalled();
  expect(errors.join("\n")).toContain("shotstack ingest upload");
});

test("times past the end are reported on stderr", async () => {
  const dir = await mkdtemp(join(tmpdir(), "inspect-test-"));
  const capture = mock(async () => ({ sheets: [{ times: [1], image: jpeg("x") }], skipped: [40] }));
  const { result, errors } = await quietly(() => runInspect({ edit: EDIT, times: [1, 40] }, { out: join(dir, "inspect.jpg"), format: "text", capture }));
  expect(result.exitCode).toBe(0);
  expect(errors).toContain("skipped 40.00s: past the edit's end");
});

test("every time past the end writes nothing and exits 1", async () => {
  const capture = mock(async () => ({ sheets: [], skipped: [40] }));
  const { result } = await quietly(() => runInspect({ edit: EDIT, times: [40] }, { out: "inspect.jpg", format: "text", capture }));
  expect(result.exitCode).toBe(1);
});

const RENDER_ID = "d2b46ed6-998a-4d6b-9d91-b8cf0193a655";

function inputDeps({ files = {} as Record<string, unknown>, render = { status: "done", url: "https://cdn.example.com/r.mp4" } as { status: string; url?: string } } = {}) {
  return {
    exists: (path: string) => path in files,
    readEdit: mock(async (path: string) => files[path]),
    getRender: mock(async () => render),
  };
}

test("a URL is inspected as a video, with no file read or API call", async () => {
  const deps = inputDeps();
  expect(await resolveInput("https://cdn.example.com/x.mp4", deps)).toEqual({ src: "https://cdn.example.com/x.mp4" });
  expect(deps.readEdit).not.toHaveBeenCalled();
  expect(deps.getRender).not.toHaveBeenCalled();
});

test("a path to a file is read as an edit", async () => {
  const deps = inputDeps({ files: { "edit.json": EDIT } });
  expect(await resolveInput("edit.json", deps)).toEqual({ edit: EDIT });
  expect(deps.getRender).not.toHaveBeenCalled();
});

test("a render ID is inspected as its video once done", async () => {
  const deps = inputDeps();
  expect(await resolveInput("d2b46ed6-998a-4d6b-9d91-b8cf0193a655", deps)).toEqual({ src: "https://cdn.example.com/r.mp4" });
  expect(deps.getRender).toHaveBeenCalledWith("d2b46ed6-998a-4d6b-9d91-b8cf0193a655");
});

test("a render that isn't done yet says so", async () => {
  const deps = inputDeps({ render: { status: "rendering" } });
  expect(resolveInput(RENDER_ID, deps)).rejects.toThrow(`Render ${RENDER_ID} is rendering. Inspect it once it's done.`);
});

test("a failed render says there's nothing to inspect", async () => {
  const deps = inputDeps({ render: { status: "failed" } });
  expect(resolveInput(RENDER_ID, deps)).rejects.toThrow(`Render ${RENDER_ID} failed, so there's nothing to inspect.`);
});

test("a path that isn't there is still read as a file, so a typo never reaches the API", async () => {
  const deps = inputDeps();
  deps.readEdit.mockImplementation(async () => {
    throw Object.assign(new Error("ENOENT: no such file or directory, open 'edit.jsn'"), { code: "ENOENT" });
  });
  expect(resolveInput("edit.jsn", deps)).rejects.toThrow("ENOENT");
  expect(deps.getRender).not.toHaveBeenCalled();
});
