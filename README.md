# Broadcaster

A local MCP server that lets independent Claude Code sessions coordinate through shared **rooms**, **pub/sub topics**, **mailboxes**, and a **blackboard** - all backed by a single local Redis.

> Open Claude in three terminal tabs. Each tab joins room `feature-x`. They now have a shared session: durable group chat, presence, replay-on-join, and cross-cutting topic subscriptions. No parent agent required.

See [`PRD.md`](../notes/projects/broadcaster/PRD.md) for the full spec.

## Status

**v0.1 - M1 scaffold.** Rooms + generic pub/sub work end-to-end. Mailboxes (M2) and blackboard (M3) are stubbed.

## Install

Prerequisites:
- macOS or Linux
- [Redis](https://redis.io/) running locally
- Node 24+ (uses native TypeScript via `--experimental-strip-types`)
- [`pnpm`](https://pnpm.io/)

```bash
brew install redis node@24 pnpm
brew services start redis

git clone <this-repo> broadcaster
cd broadcaster
pnpm install
pnpm test
```

## Add to Claude Code

Append the following to `~/.claude/settings.json` (per terminal tab, set a unique `BROADCASTER_AGENT`):

```json
{
  "mcpServers": {
    "broadcaster": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "--no-warnings=ExperimentalWarning",
        "/absolute/path/to/broadcaster/src/index.ts"
      ],
      "env": { "BROADCASTER_AGENT": "alice" }
    }
  }
}
```

Set a **different** `BROADCASTER_AGENT` in each terminal tab - that's how rooms know who's talking.

## Tool surface

### Rooms (first-class)

- `room_join(room)` - start heartbeating presence; begin tailing the room's stream
- `room_leave(room)` - stop heartbeating; publish `agent.left`
- `room_broadcast(room, body)` - append a message to the durable room stream
- `room_history(room, limit?)` - read the last N messages (default 50, max 1000)
- `room_next_message(timeoutSeconds?)` - block until the next live room message arrives
- `room_roster(room)` - list agents currently present (active in the last ~30s)

### Generic pub/sub (cross-room patterns)

- `broadcast(topic, body)` - fire-and-forget publish
- `subscribe(pattern)` - register interest in a topic glob (e.g. `findings.security.*`)
- `next_message(timeoutSeconds?)` - block until the next matching pub/sub message arrives

### Mailboxes (M2)

Not yet implemented. Planned: `send(agent, body)`, `inbox(since?)`, `ack(messageId)`.

### Blackboard (M3)

Not yet implemented. Planned: `post(space, key, value, tags?)`, `query(space, tag?, pattern?)`.

### Diagnostic

- `whoami` - returns the agent name, Redis URL, and key prefix this server is using.

## Example: two tabs in a shared room

**Tab 1 (`BROADCASTER_AGENT=alice`):**
> Join room `feature-x` and broadcast a status update saying I'm starting the auth refactor.

**Tab 2 (`BROADCASTER_AGENT=bob`, opens later):**
> Join room `feature-x`. Show me the last 50 messages. Who's in the room?

Bob's agent calls `room_join("feature-x")` → `room_history("feature-x")` → sees alice's message → `room_roster("feature-x")` → sees `["alice", "bob"]`.

## Configuration

| Env var                       | Default                       | Purpose                            |
|-------------------------------|-------------------------------|------------------------------------|
| `BROADCASTER_AGENT`           | `<hostname>-<pid>`            | This MCP server's stable agent name |
| `REDIS_URL`                   | `redis://localhost:6379/0`    | Redis to connect to                 |
| `BROADCASTER_KEY_PREFIX`      | `bc:v1`                       | Prefix for all Redis keys           |
| `BROADCASTER_HEARTBEAT_MS`    | `10000`                       | Presence heartbeat interval         |
| `BROADCASTER_ROSTER_TTL_S`    | `30`                          | Presence TTL - agent drops off roster after this many seconds without a heartbeat |
| `BROADCASTER_ROOM_MAXLEN`     | `1000`                        | Per-room stream cap (`XADD MAXLEN ~`) |

## Redis schema (`bc:v1:` prefix)

| Key                                       | Type   | Purpose                                  |
|-------------------------------------------|--------|------------------------------------------|
| `bc:v1:room:<name>:stream`                | Stream | Room messages (capped via `MAXLEN ~`)    |
| `bc:v1:room:<name>:roster:<agent>`        | String | Presence beacon; TTL refreshed by heartbeat |
| `bc:v1:topic:<topic>`                     | Channel| Generic pub/sub broadcasts               |
| `bc:v1:mailbox:<agent>`                   | Stream | (M2) Per-agent durable inbox             |
| `bc:v1:space:<name>:*`                    | Hash + Set | (M3) Blackboard entries and tag indices |

The `bc:v1:` prefix is the schema version - we bump it (`bc:v2:`, ...) for breaking changes.

## Development

```bash
pnpm install
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm dev            # start the MCP server on stdio (Ctrl-C to exit)
```

Watch traffic on Redis with:

```bash
redis-cli MONITOR
```

## License

MIT
