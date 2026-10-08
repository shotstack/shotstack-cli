# Rendered agent guides

Generated from `skills/shotstack/` by `scripts/render-guides.ts`, for surfaces that can't read the skill folder:

- `director/` — Director's system prompt layers. `style-defaults.md` holds the defaults for when no style is given, loaded only for models that benefit from them.
- `mcp/agent-core.md` — returned by the MCP server's `get_shotstack_guide`.

Don't edit these files. Edit the skill, run `bun run render:guides`, and commit both. `bun test` fails while they're stale.

Consumers fetch these at a pinned commit, so a change reaches them only when they bump their ref.
