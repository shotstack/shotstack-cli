import { editSchema } from "@shotstack/schemas/zod";
import type { ZodError, ZodIssue } from "zod";

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
  suggestion?: string;
  /** Defaults to "error" when absent. Warnings do not make `ok` false. */
  level?: IssueLevel;
}

export interface ValidationResult {
  /** false when there is at least one error-level issue. */
  ok: boolean;
  issues: ValidationIssue[];
}

const KEY_SUGGESTIONS: Record<string, string> = {
  alignment: "align",
  duration: "length",
  transitions: "transition",
  name: "family",
};

const VALUE_SUGGESTIONS: Record<string, Record<string, string>> = {
  "align.vertical": { center: "middle" },
  fit: { cover: "crop" },
};

// Built-in render-engine fonts (no timeline.fonts[] entry needed). Lower-cased,
// both spaced and concatenated spellings — see references/fonts.md.
const BUILTIN_FONTS = new Set([
  "arapey", "clear sans", "clearsans", "didact gothic", "didactgothic",
  "montserrat", "movlette", "notoemoji", "open sans", "opensans",
  "permanent marker", "permanentmarker", "roboto", "sue ellen francisco",
  "sueellenfrancisco", "uni neue", "unineue", "work sans", "worksans",
]);

// Asset types whose `src` must be a public, fetchable URL.
const URL_SRC_TYPES = new Set(["image", "video", "audio", "luma"]);

export function validateEdit(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  const result = editSchema.safeParse(input);
  if (!result.success) {
    for (const issue of toIssues(result.error)) issues.push({ ...issue, level: "error" });
  }

  // Semantic checks the JSON schema can't express (run regardless of schema
  // result, defensively — they surface alongside any schema errors).
  for (const issue of semanticChecks(input)) issues.push(issue);

  const ok = !issues.some((issue) => (issue.level ?? "error") === "error");
  return { ok, issues };
}

export function formatIssues(issues: ValidationIssue[]): string {
  const errors = issues.filter((i) => (i.level ?? "error") === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const lines: string[] = [];
  if (errors.length) {
    const w = warnings.length ? `, ${warnings.length} warning${plural(warnings.length)}` : "";
    lines.push(`✗ Edit JSON failed validation (${errors.length} error${plural(errors.length)}${w}):`);
  } else {
    lines.push(`⚠ Edit JSON valid, with ${warnings.length} warning${plural(warnings.length)}:`);
  }

  for (const issue of issues) {
    const glyph = (issue.level ?? "error") === "error" ? "✗" : "⚠";
    const hint = issue.suggestion ? ` (did you mean '${issue.suggestion}'?)` : "";
    lines.push(`  ${glyph} ${issue.path || "<root>"}: ${issue.message}${hint}`);
  }
  return lines.join("\n");
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

// ---------------------------------------------------------------------------
// Semantic checks (beyond the JSON schema)
// ---------------------------------------------------------------------------

function semanticChecks(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const edit = input as any;
  const timeline = edit?.timeline;
  const tracks = timeline?.tracks;
  if (!Array.isArray(tracks)) return issues;

  // Custom font families that are actually loaded.
  const loaded = new Set<string>();
  if (Array.isArray(timeline?.fonts)) {
    for (const font of timeline.fonts) {
      const base = fontBasename(font?.src);
      if (base) loaded.add(base);
    }
  }

  tracks.forEach((track: any, ti: number) => {
    const clips = track?.clips;
    if (!Array.isArray(clips)) return;

    // --- same-track overlap (error) -----------------------------------------
    const intervals = clips
      .map((clip: any, ci: number) => ({ ci, start: clip?.start, len: clip?.length }))
      .filter((x: any) => typeof x.start === "number" && typeof x.len === "number");

    for (let a = 0; a < intervals.length; a++) {
      for (let b = a + 1; b < intervals.length; b++) {
        const A = intervals[a]!;
        const B = intervals[b]!;
        if (A.start < B.start + B.len && B.start < A.start + A.len) {
          const [lo, hi] = A.ci < B.ci ? [A.ci, B.ci] : [B.ci, A.ci];
          issues.push({
            path: `timeline.tracks[${ti}].clips`,
            code: "clip_overlap",
            level: "error",
            message:
              `clips [${lo}] and [${hi}] overlap in time — clips on one track must not ` +
              `overlap (they flicker). Put simultaneous elements on separate tracks.`,
          });
        }
      }
    }

    // --- per-clip checks ----------------------------------------------------
    clips.forEach((clip: any, ci: number) => {
      const asset = clip?.asset;
      const at = `timeline.tracks[${ti}].clips[${ci}]`;

      const family = asset?.font?.family;
      if (typeof family === "string" && family.length > 0) {
        if (!loaded.has(family) && !BUILTIN_FONTS.has(family.toLowerCase())) {
          issues.push({
            path: `${at}.asset.font.family`,
            code: "font_not_loaded",
            level: "warning",
            message:
              `font.family '${family}' is neither a built-in font nor loaded via ` +
              `timeline.fonts[] — it will fail at render with "Font not found". Add its ` +
              `URL to timeline.fonts[] (family must equal the URL's file basename).`,
          });
        }
      }

      // --- html5 JS syntax check --------------------------------------------
      const type = asset?.type;
      if (type === "html5" && typeof asset?.js === "string" && asset.js.length > 0) {
        const jsIssue = checkJsSyntax(asset.js, `${at}.asset.js`);
        if (jsIssue) issues.push(jsIssue);
      }

      const src = asset?.src;
      if (typeof type === "string" && URL_SRC_TYPES.has(type) && typeof src === "string") {
        if (/^https:\/\//i.test(src) || /^alias:\/\//i.test(src)) {
          // ok
        } else if (/^data:/i.test(src)) {
          issues.push({
            path: `${at}.asset.src`,
            code: "src_not_public",
            level: "warning",
            message: `data: URIs aren't fetched by render workers — host the asset and use a public https:// URL.`,
          });
        } else if (/^http:\/\//i.test(src)) {
          issues.push({
            path: `${at}.asset.src`,
            code: "src_not_https",
            level: "warning",
            message: `http:// sources are blocked/upgraded — use https://.`,
          });
        } else {
          issues.push({
            path: `${at}.asset.src`,
            code: "src_not_public",
            level: "warning",
            message:
              `'${truncate(src, 48)}' is not a public https:// URL — local paths don't render. ` +
              `Host it with 'shotstack ingest upload' and use the returned URL.`,
          });
        }
      }
    });
  });

  return issues;
}

function fontBasename(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const noQuery = src.split("?")[0] ?? src;
  const base = noQuery.split("/").pop() ?? "";
  const stripped = base.replace(/\.(ttf|otf|woff2?|eot)$/i, "");
  return stripped.length ? stripped : null;
}

function checkJsSyntax(js: string, path: string): ValidationIssue | null {
  try {
    // Wrap in a function body so top-level const/var/return are valid.
    new Function(js);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      path,
      code: "js_syntax_error",
      level: "error",
      message: `asset.js has a syntax error — the html5 clip will render completely blank with no render error. ${message}`,
    };
  }
  return null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// ---------------------------------------------------------------------------
// Zod issue formatting (schema errors)
// ---------------------------------------------------------------------------

function toIssues(error: ZodError): ValidationIssue[] {
  return error.issues.flatMap((issue) => expandIssue(issue));
}

function expandIssue(issue: ZodIssue): ValidationIssue[] {
  const basePath = formatPath(issue.path);

  if (issue.code === "unrecognized_keys" && "keys" in issue) {
    return issue.keys.map((key) => ({
      path: appendKey(basePath, key),
      code: issue.code,
      message: `unrecognized key '${key}'`,
      suggestion: KEY_SUGGESTIONS[key],
    }));
  }

  const suggestion = lookupValueSuggestion(basePath, issue);

  return [
    {
      path: basePath,
      code: issue.code,
      message: issue.message,
      ...(suggestion ? { suggestion } : {}),
    },
  ];
}

function lookupValueSuggestion(path: string, issue: ZodIssue): string | undefined {
  const semanticPath = path.replace(/\[\d+\]/g, "");
  const tail = semanticPath.split(".").slice(-2).join(".");
  if (issue.code === "invalid_value" && "received" in issue) {
    const received = String(issue.received);
    return VALUE_SUGGESTIONS[tail]?.[received] ?? VALUE_SUGGESTIONS[semanticPath]?.[received];
  }
  return undefined;
}

function formatPath(parts: ReadonlyArray<PropertyKey>): string {
  return parts.reduce<string>((acc, part) => {
    if (typeof part === "number") return `${acc}[${part}]`;
    const key = String(part);
    return acc ? `${acc}.${key}` : key;
  }, "");
}

function appendKey(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}
