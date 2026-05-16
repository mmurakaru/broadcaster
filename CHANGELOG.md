# broadcaster-mcp

## 0.1.0

### Minor Changes

- e302eb0: Initial M1 scaffold: rooms as a first-class primitive (join, leave, broadcast, history, roster, live tail), generic pub/sub topics, ULID-based message envelopes, presence via heartbeat-refreshed roster keys, and a `whoami` diagnostic tool. Mailboxes (M2) and blackboard (M3) are stubbed with planned schemas documented inline. Backed by Redis Streams + pub/sub; runs as a stdio MCP server per Claude Code session with agent identity sourced from `BROADCASTER_AGENT`.
