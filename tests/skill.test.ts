import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import pkg from "../package.json" with { type: "json" };

// Agents compare this line with the published CLI version, so a release that forgets to bump it hides every update.
test("SKILL.md states the CLI release it ships with", () => {
  const skill = readFileSync(new URL("../skills/shotstack/SKILL.md", import.meta.url), "utf8");
  expect(skill).toContain(`This skill is version **${pkg.version}**`);
});
