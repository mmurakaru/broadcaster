import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.ts";
import { closeRedis, createRedis } from "./redis.ts";
import { RoomManager } from "./primitives/rooms.ts";
import { PubSubManager } from "./primitives/pubsub.ts";
import { MailboxManager } from "./primitives/mailbox.ts";
import { BlackboardManager } from "./primitives/blackboard.ts";
import { buildServer } from "./server.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const redis = createRedis(cfg);
  const rooms = new RoomManager(cfg, redis.cmd, redis.sub);
  const pubsub = new PubSubManager(cfg, redis.cmd, redis.sub);
  const mailbox = new MailboxManager();
  const blackboard = new BlackboardManager();

  const server = buildServer({ cfg, rooms, pubsub, mailbox, blackboard });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.error(`[broadcaster] received ${signal}, shutting down`);
    try {
      await rooms.shutdown();
      await pubsub.shutdown();
      await mailbox.shutdown();
      await blackboard.shutdown();
      await server.close();
      await closeRedis(redis);
    } catch (err) {
      console.error("[broadcaster] shutdown error:", err);
    }
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[broadcaster] ready agent=${cfg.agent} redis=${cfg.redisUrl} prefix=${cfg.keyPrefix}`);
}

main().catch((err) => {
  console.error("[broadcaster] fatal:", err);
  process.exit(1);
});
