import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.ts";
import type { RoomManager } from "./primitives/rooms.ts";
import type { PubSubManager } from "./primitives/pubsub.ts";
import type { MailboxManager } from "./primitives/mailbox.ts";
import type { BlackboardManager } from "./primitives/blackboard.ts";

type Deps = {
  cfg: Config;
  rooms: RoomManager;
  pubsub: PubSubManager;
  mailbox: MailboxManager;
  blackboard: BlackboardManager;
};

export function buildServer(deps: Deps): McpServer {
  const { cfg, rooms, pubsub, mailbox, blackboard } = deps;

  const server = new McpServer({ name: "broadcaster", version: "0.1.0" });

  server.tool(
    "whoami",
    "Return this MCP server's agent name, Redis url, and key prefix.",
    {},
    async () => ok({ agent: cfg.agent, redisUrl: cfg.redisUrl, keyPrefix: cfg.keyPrefix }),
  );

  // -- rooms ---------------------------------------------------------------
  server.tool(
    "room_join",
    "Join a named room. Starts heartbeating presence and tailing the room's message stream.",
    { room: z.string().min(1) },
    async ({ room }) => ok(await rooms.join(room)),
  );

  server.tool(
    "room_leave",
    "Leave a room. Removes presence and stops tailing.",
    { room: z.string().min(1) },
    async ({ room }) => {
      await rooms.leave(room);
      return ok({ room, left: true });
    },
  );

  server.tool(
    "room_broadcast",
    "Append a message to a room's durable stream. All current and future room members will receive it. The `body` MUST be a JSON object (not a stringified JSON), e.g. { \"msg\": \"hello\" } or { \"event\": \"deploy\", \"sha\": \"abc\" }.",
    { room: z.string().min(1), body: z.record(z.string(), z.unknown()) },
    async ({ room, body }) => ok({ id: await rooms.broadcast(room, body) }),
  );

  server.tool(
    "room_history",
    "Read the last N messages from a room's stream. Use right after room_join to catch up.",
    {
      room: z.string().min(1),
      limit: z.number().int().positive().max(1000).optional(),
    },
    async ({ room, limit }) => ok(await rooms.history(room, limit ?? 50)),
  );

  server.tool(
    "room_next_message",
    "Block until the next live message arrives in any joined room, or until timeout. Returns null on timeout. Skips own messages.",
    { timeoutSeconds: z.number().positive().max(60).optional() },
    async ({ timeoutSeconds }) => ok(await rooms.nextMessage((timeoutSeconds ?? 5) * 1000)),
  );

  server.tool(
    "room_roster",
    "List agents currently present in a room (active in the last ~30s).",
    { room: z.string().min(1) },
    async ({ room }) => ok(await rooms.roster(room)),
  );

  // -- generic pub/sub -----------------------------------------------------
  server.tool(
    "broadcast",
    "Publish to a global topic (no membership concept). Fire-and-forget; not durable. The `body` MUST be a JSON object (not a stringified JSON), e.g. { \"msg\": \"hello\" } or { \"severity\": \"high\", \"finding\": \"token leak\" }.",
    { topic: z.string().min(1), body: z.record(z.string(), z.unknown()) },
    async ({ topic, body }) => ok({ id: await pubsub.broadcast(topic, body) }),
  );

  server.tool(
    "subscribe",
    "Register interest in topics matching a glob pattern (e.g. 'findings.security.*'). Returns a subscription id.",
    { pattern: z.string().min(1) },
    async ({ pattern }) => ok({ subscriptionId: await pubsub.subscribe(pattern) }),
  );

  server.tool(
    "next_message",
    "Block until the next pub/sub message matching one of your subscriptions arrives, or until timeout. Returns null on timeout. Skips own messages.",
    { timeoutSeconds: z.number().positive().max(60).optional() },
    async ({ timeoutSeconds }) => ok(await pubsub.nextMessage((timeoutSeconds ?? 5) * 1000)),
  );

  // -- mailboxes (M2 stub) -------------------------------------------------
  server.tool(
    "send",
    "[M2 - not yet implemented] Append a message to another agent's mailbox.",
    { agent: z.string().min(1), body: z.unknown() },
    async () => {
      mailbox.send();
      return ok({});
    },
  );
  server.tool(
    "inbox",
    "[M2 - not yet implemented] Read this agent's mailbox.",
    { since: z.string().optional() },
    async () => {
      mailbox.inbox();
      return ok({});
    },
  );
  server.tool(
    "ack",
    "[M2 - not yet implemented] Acknowledge a mailbox message.",
    { messageId: z.string().min(1) },
    async () => {
      mailbox.ack();
      return ok({});
    },
  );

  // -- blackboard (M3 stub) ------------------------------------------------
  server.tool(
    "post",
    "[M3 - not yet implemented] Post a tagged entry to a blackboard space.",
    {
      space: z.string().min(1),
      key: z.string().min(1),
      value: z.unknown(),
      tags: z.array(z.string()).optional(),
    },
    async () => {
      blackboard.post();
      return ok({});
    },
  );
  server.tool(
    "query",
    "[M3 - not yet implemented] Query a blackboard space by tag or key pattern.",
    {
      space: z.string().min(1),
      tag: z.string().optional(),
      pattern: z.string().optional(),
    },
    async () => {
      blackboard.query();
      return ok({});
    },
  );

  return server;
}

function ok(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}
