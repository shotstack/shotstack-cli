// Renders the skill's guides for surfaces that can't read the skill folder
// (Director's system prompt, the MCP server's get_shotstack_guide). Source
// blocks are marked in the skill files:
//   <!-- surface:cli,mcp --> … <!-- /surface -->   kept only for those surfaces
//   <!-- layer:style-defaults --> … <!-- /layer -->   defaults for when no style is given
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Surface = "cli" | "director" | "mcp";
type LayerMode = "keep" | "strip" | "only";
type Guide = { sources: string[]; layer: LayerMode; titles?: Record<string, string> };

const SKILL = "skills/shotstack";

const TITLES: Record<string, string> = {
	"agent-core": "the agent guide",
	html5: "the HTML5 guide",
	"html5-effects": "the HTML5 effects palette",
	"html5-snippets": "the HTML5 snippets",
	motion: "the motion guide",
	positioning: "the positioning guide",
	caption: "the captions guide",
	fonts: "the fonts guide",
	svg: "the SVG guide",
	timeline: "the timeline guide",
	generation: "the generation guide",
	troubleshooting: "the troubleshooting guide",
	ingest: "the ingest guide",
	onboarding: "the onboarding guide",
	"asset-library": "the placeholder asset library",
};

const HTML5_TOGETHER = { html5: "the HTML5 guide above", "html5-effects": "the effects palette below", "html5-snippets": "the snippets below" };

export const GUIDES: Record<Exclude<Surface, "cli">, Record<string, Guide>> = {
	director: {
		"agent-core.md": { sources: ["shared/agent-core.md"], layer: "strip" },
		"style-defaults.md": { sources: ["shared/agent-core.md"], layer: "only" },
		"html5.md": { sources: ["references/html5.md", "references/html5-effects.md", "references/html5-snippets.md"], layer: "keep", titles: HTML5_TOGETHER },
		"motion.md": { sources: ["references/motion.md"], layer: "keep" },
	},
	mcp: {
		"agent-core.md": { sources: ["shared/agent-core.md"], layer: "keep" },
	},
};

const OPEN = /^\s*<!--\s*(surface|layer):([a-z0-9,-]+)\s*-->\s*$/;
const CLOSE = /^\s*<!--\s*\/(surface|layer)\s*-->\s*$/;

export function filterBlocks(text: string, surface: Surface, layer: LayerMode, file = "<input>"): string {
	const out: string[] = [];
	const lines = text.split("\n");
	let open: { kind: string; values: string[]; line: number } | null = null;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const o = line.match(OPEN);
		const c = line.match(CLOSE);
		if (o) {
			if (open) throw new Error(`${file}:${i + 1}: nested ${o[1]} block inside ${open.kind} block from line ${open.line}`);
			open = { kind: o[1], values: o[2].split(","), line: i + 1 };
			continue;
		}
		if (c) {
			if (!open || open.kind !== c[1]) throw new Error(`${file}:${i + 1}: unmatched /${c[1]}`);
			open = null;
			continue;
		}
		if (open?.kind === "surface" && !open.values.includes(surface)) continue;
		const inLayer = open?.kind === "layer";
		if ((layer === "strip" && inLayer) || (layer === "only" && !inLayer)) continue;
		out.push(line);
	}
	if (open) throw new Error(`${file}: ${open.kind} block from line ${open.line} never closes`);
	return out.join("\n");
}

export function rewriteLinks(text: string, titles: Record<string, string>, file = "<input>"): string {
	const title = (name: string) => {
		const t = titles[name] ?? TITLES[name];
		if (!t) throw new Error(`${file}: no title for linked guide "${name}.md"; add it to TITLES`);
		return t;
	};
	return text
		.replace(/\[[^\]]*\]\((?:\.\.\/)?(?:references\/|shared\/)?([a-z0-9-]+)\.md(?:#[^)]*)?\)/g, (_, name) => title(name))
		.replace(/`(?:\.\.\/)?(?:(?:references|shared)\/)?([a-z0-9-]+)\.md`/g, (_, name) => title(name));
}

export function renderGuides(root = "."): Map<string, string> {
	const out = new Map<string, string>();
	for (const [surface, guides] of Object.entries(GUIDES) as [Exclude<Surface, "cli">, Record<string, Guide>][]) {
		for (const [name, guide] of Object.entries(guides)) {
			const parts = guide.sources.map((src) => {
				const raw = readFileSync(join(root, SKILL, src), "utf8");
				return rewriteLinks(filterBlocks(raw, surface, guide.layer, src), guide.titles ?? {}, src).trim();
			});
			const body = parts.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n");
			out.set(`guides/${surface}/${name}`, `${body}\n`);
		}
	}
	return out;
}

if (import.meta.main) {
	for (const [path, content] of renderGuides()) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
		console.log(`wrote ${path}`);
	}
}
