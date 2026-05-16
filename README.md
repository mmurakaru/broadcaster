# Broadcaster

A local MCP server that lets independent Claude Code sessions coordinate through shared **rooms**, **pub/sub topics**, **mailboxes**, and a **blackboard** - all backed by a single local Redis.

> Open Claude in three terminal tabs. Each tab joins room `feature-x`. They now have a shared session: durable group chat, presence, replay-on-join, and cross-cutting topic subscriptions. No parent agent required.

See [`PRD.md`](../notes/projects/broadcaster/PRD.md) for the full spec.

## Status

**v0.2 - rooms + generic pub/sub, ships as `npx`.** Mailboxes (M2) and blackboard (M3) are stubbed.

## Install (one line)

```sh
npx -y broadcaster-mcp install
```

That command:
1. Detects whether Redis is reachable; if not, offers to install via Homebrew (macOS) or start it in a Docker container (anywhere with Docker).
2. Registers `broadcaster` as a user-scope MCP entry in Claude Code via `claude mcp add`.
3. Runs `doctor` to confirm everything's wired up.

Pass `--yes` (or `-y`) to skip the prompts (useful in CI / dotfile setup scripts).

Then open Claude Code in a fresh tab and ask it to `room_join "kitchen"` and `room_broadcast "kitchen" { "msg": "hello" }`. Open a second tab and `room_history "kitchen"` to see it.

### Other subcommands

```sh
npx -y broadcaster-mcp doctor      # check Redis connectivity + MCP entry status
npx -y broadcaster-mcp uninstall   # remove MCP entry; optionally stop Docker Redis
npx -y broadcaster-mcp --version   # print version
npx -y broadcaster-mcp --help      # full usage
```

### Setting agent names per tab

By default every Claude tab spawned via `npx -y broadcaster-mcp` gets the same agent name (`hostname-pid`), which means the live tail filters out cross-tab messages incorrectly. To get a stable identity per tab, set `BROADCASTER_AGENT` in your shell before launching `claude`, or register separate per-name MCP entries:

```sh
claude mcp add broadcaster-alice --scope user -e BROADCASTER_AGENT=alice -- npx -y broadcaster-mcp
claude mcp add broadcaster-bob   --scope user -e BROADCASTER_AGENT=bob   -- npx -y broadcaster-mcp
```

<details>
<summary>Manual install (without the `install` subcommand)</summary>

If you'd rather not let the installer touch your system:

1. Install Redis yourself:
   ```sh
   brew install redis && brew services start redis
   # or:
   docker run -d --name broadcaster-redis -p 6379:6379 redis:7-alpine
   ```
2. Register the MCP entry:
   ```sh
   claude mcp add broadcaster --scope user -- npx -y broadcaster-mcp
   ```
3. Verify:
   ```sh
   npx -y broadcaster-mcp doctor
   ```

</details>

<details>
<summary>Local dev (cloning the repo)</summary>

```sh
brew install redis node@24 pnpm
brew services start redis

git clone https://github.com/mmurakaru/broadcaster
cd broadcaster
pnpm install
pnpm test
pnpm dev        # start the MCP server on stdio
```

</details>

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

```sh
pnpm install
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm dev            # start the MCP server on stdio (Ctrl-C to exit)
```

Watch traffic on Redis with:

```sh
redis-cli MONITOR
```

## License

MIT - see [LICENSE](./LICENSE).
