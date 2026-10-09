import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { filterBlocks, renderGuides, rewriteLinks } from "../scripts/render-guides";

const rendered = renderGuides();

test("committed guides match the skill (run `bun run render:guides` after editing the skill)", () => {
	for (const [path, content] of rendered) {
		expect(readFileSync(path, "utf8"), path).toBe(content);
	}
});

test("no rendered guide carries CLI-only text, markers or skill file links", () => {
	const cliOnly = /<!--|references\/|`[a-z0-9-]+\.md`|\]\([^)]*\.md|shotstack (validate|studio|render|login|generate|models|ingest)|--env|--quote|node --check/;
	for (const [path, content] of rendered) {
		const hit = content.split("\n").find((line) => cliOnly.test(line));
		expect(hit, path).toBeUndefined();
	}
});

test("Director gets the style defaults only in their own layer; built-in motion rules reach every surface", () => {
	const defaults = "**Defaults when no style is given.**";
	const builtIn = "**Built-in motion has fixed options.**";
	expect(rendered.get("guides/director/agent-core.md")).not.toContain(defaults);
	expect(rendered.get("guides/director/agent-core.md")).toContain(builtIn);
	expect(rendered.get("guides/director/style-defaults.md")).toContain(defaults);
	expect(rendered.get("guides/mcp/agent-core.md")).toContain(defaults);
});

test("a surface block reaches only the surfaces it names", () => {
	const src = "shared\n<!-- surface:cli,mcp -->\ntools\n<!-- /surface -->\nend";
	expect(filterBlocks(src, "mcp", "keep")).toBe("shared\ntools\nend");
	expect(filterBlocks(src, "director", "keep")).toBe("shared\nend");
});

test("malformed markers fail the render", () => {
	expect(() => filterBlocks("<!-- surface:cli -->\nx", "mcp", "keep")).toThrow("never closes");
	expect(() => filterBlocks("x\n<!-- /layer -->", "mcp", "keep")).toThrow("unmatched");
	expect(() => filterBlocks("<!-- surface:cli -->\n<!-- layer:style-defaults -->", "mcp", "keep")).toThrow("nested");
	expect(() => rewriteLinks("see [`new.md`](new.md)", {})).toThrow('no title for linked guide "new.md"');
});
