# Shotstack agent skill

An [Agent Skill](https://agentskills.io) that teaches coding agents to make videos with the [Shotstack CLI](https://www.npmjs.com/package/@shotstack/cli): compose an edit, validate it, look at its frames, preview it in Studio and render it. It works with Claude Code, Codex, Cursor, Copilot, Gemini CLI and other agents that read the standard.

```sh
npx skills add shotstack/shotstack-cli
npm install -g @shotstack/cli
```

The skill lives in [`skills/shotstack/`](./skills/shotstack/). Each release of `@shotstack/cli` updates it here, so the skill always documents the CLI version it names. The CLI's own source isn't published here; install it from npm.

Found a problem? Run `shotstack feedback`, or [open an issue](https://github.com/shotstack/shotstack-cli/issues/new?template=bug.yml).
