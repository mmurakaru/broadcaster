---
"broadcaster-mcp": minor
---

**One-line install via `npx -y broadcaster-mcp install`.**

The package now publishes to npm and adds three new subcommands to the binary:

- `install` - detect or install Redis (Homebrew on macOS, Docker fallback), then register the MCP entry in Claude Code via `claude mcp add`. Supports `--yes` for non-interactive use.
- `doctor` - check Redis connectivity and whether the `broadcaster` MCP entry is registered.
- `uninstall` - remove the MCP entry; optionally stop a Docker-bootstrapped Redis container (leaves brew-managed Redis alone since other apps may depend on it).

The default behavior (no args) is unchanged: starts the stdio MCP server. Adds `--help` and `--version` flags. README leads with the one-liner now; manual setup paths preserved under collapsible sections.
