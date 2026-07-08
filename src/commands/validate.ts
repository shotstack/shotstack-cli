import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { parseOutputFormat } from "../output.ts";
import { validateEdit, formatIssues, type ValidationIssue } from "../lib/validate.ts";

export const validateCommand = new Command("validate")
  .description(
    "Validate an Edit JSON offline — schema (property names, enums, types) plus " +
      "same-track overlaps, unloaded fonts, non-public asset URLs and html5 JS syntax errors. No API key, no credits.",
  )
  .argument("<file>", "Path to a Shotstack Edit JSON file")
  .option("--strict", "Treat warnings as errors (exit 1 on any warning)")
  .option("--output <format>", "Output format: text | json", "text")
  .action(async (file: string, options: { strict?: boolean; output: string }) => {
    const format = parseOutputFormat(options.output);
    const path = resolve(process.cwd(), file);
    const raw = await readFile(path, "utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const issue: ValidationIssue = { path: "<root>", code: "invalid_json", level: "error", message };
      if (format === "json") console.log(JSON.stringify({ ok: false, issues: [issue] }));
      else console.error(`✗ ${file}: invalid JSON — ${message}`);
      process.exitCode = 1;
      return;
    }

    const result = validateEdit(parsed);
    const hasWarnings = result.issues.some((i) => i.level === "warning");
    const failed = !result.ok || (options.strict === true && hasWarnings);

    if (format === "json") {
      console.log(JSON.stringify({ ok: !failed, issues: result.issues }));
    } else if (result.issues.length === 0) {
      console.log(`✓ ${file} is valid`);
    } else {
      const text = formatIssues(result.issues);
      // Warnings-only on a non-strict run go to stdout (informational, exit 0);
      // anything that fails the run goes to stderr.
      if (failed) console.error(text);
      else console.log(text);
    }

    process.exitCode = failed ? 1 : 0;
  });
