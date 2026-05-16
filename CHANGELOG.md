# broadcaster-mcp

## 0.2.0

### Minor Changes

- 0eb392a: **One-line install via `npx -y broadcaster-mcp install`.**

  The package now publishes to npm and adds three new subcommands to the binary:

  - `install` - detect or install Redis (Homebrew on macOS, Docker fallback), then register the MCP entry in Claude Code via `claude mcp add`. Supports `--yes` for non-interactive use.
  - `doctor` - check Redis connectivity and whether the `broadcaster` MCP entry is registered.
  - `uninstall` - remove the MCP entry; optionally stop a Docker-bootstrapped Redis container (leaves brew-managed Redis alone since other apps may depend on it).

  The default behavior (no args) is unchanged: starts the stdio MCP server. Adds `--help` and `--version` flags. README leads with the one-liner now; manual setup paths preserved under collapsible sections.

## 0.1.0

### Minor Changes

- e302eb0: Initial M1 scaffold: rooms as a first-class primitive (join, leave, broadcast, history, roster, live tail), generic pub/sub topics, ULID-based message envelopes, presence via heartbeat-refreshed roster keys, and a `whoami` diagnostic tool. Mailboxes (M2) and blackboard (M3) are stubbed with planned schemas documented inline. Backed by Redis Streams + pub/sub; runs as a stdio MCP server per Claude Code session with agent identity sourced from `BROADCASTER_AGENT`.
