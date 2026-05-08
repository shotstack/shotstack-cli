import { editSchema } from "@shotstack/schemas/zod";
import type { ZodError, ZodIssue } from "zod";

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
  suggestion?: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

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

export function validateEdit(input: unknown): ValidationResult {
  const result = editSchema.safeParse(input);
  if (result.success) return { ok: true };
  return { ok: false, issues: toIssues(result.error) };
}

export function formatIssues(issues: ValidationIssue[]): string {
  const lines = ["✗ Edit JSON failed validation:"];
  for (const issue of issues) {
    const hint = issue.suggestion ? ` (did you mean '${issue.suggestion}'?)` : "";
    lines.push(`  ${issue.path || "<root>"}: ${issue.message}${hint}`);
  }
  return lines.join("\n");
}

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
