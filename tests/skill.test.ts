import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import pkg from "../package.json" with { type: "json" };

// Agents compare this line with the published CLI version, so a release that forgets to bump it hides every update.
test("SKILL.md states the CLI release it ships with", () => {
  const skill = readFileSync(new URL("../skills/shotstack/SKILL.md", import.meta.url), "utf8");
  expect(skill).toContain(`This skill is version **${pkg.version}**`);
});

test("SKILL.md sends agents through inspect before a v1 render", () => {
  const skill = readFileSync(new URL("../skills/shotstack/SKILL.md", import.meta.url), "utf8");
  expect(skill).toContain("shotstack inspect");
  expect(skill).toMatch(/\*\*[^*]*before a v1 render\.\*\*[^\n]*shotstack inspect/);
});

// Sandboxes and CI images often have no browser; an agent told only to inspect would skip the check in silence.
test("SKILL.md says what to do when inspect finds no browser", () => {
  const skill = readFileSync(new URL("../skills/shotstack/SKILL.md", import.meta.url), "utf8");
  expect(skill).toMatch(/\*\*[^*]*before a v1 render\.\*\*[^\n]*no browser[^\n]*shotstack studio/);
});
