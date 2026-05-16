import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.ts";
import { closeRedis, createRedis } from "./redis.ts";
import { RoomManager } from "./primitives/rooms.ts";
import { PubSubManager } from "./primitives/pubsub.ts";
import { MailboxManager } from "./primitives/mailbox.ts";
import { BlackboardManager } from "./primitives/blackboard.ts";
import { buildServer } from "./server.ts";

async function runServer(): Promise<void> {
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

function printHelp(): void {
  console.log(`broadcaster-mcp - local MCP server for shared agent rooms

Usage:
  npx -y broadcaster-mcp                 Start the MCP server on stdio (default; called by Claude Code)
  npx -y broadcaster-mcp install [-y]    Bootstrap Redis + register the MCP entry in Claude Code
  npx -y broadcaster-mcp doctor          Diagnose Redis connectivity + MCP entry presence
  npx -y broadcaster-mcp uninstall       Remove the MCP entry; optionally stop Docker Redis
  npx -y broadcaster-mcp --version       Print version
  npx -y broadcaster-mcp --help          Show this message

Environment:
  BROADCASTER_AGENT      stable agent name (default: <hostname>-<pid>)
  REDIS_URL              Redis URL (default: redis://localhost:6379/0)
  BROADCASTER_KEY_PREFIX Redis key prefix (default: bc:v1)
`);
}

async function printVersion(): Promise<void> {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as { version: string };
  console.log(pkg.version);
}

async function dispatch(): Promise<void> {
  const sub = process.argv[2];
  switch (sub) {
    case "help":
    case "--help":
    case "-h":
      return printHelp();
    case "--version":
    case "-v":
      return printVersion();
    case "install": {
      const { runInstall } = await import("./cli/install.ts");
      return runInstall(process.argv.slice(3));
    }
    case "doctor": {
      const { runDoctor } = await import("./cli/doctor.ts");
      return runDoctor();
    }
    case "uninstall": {
      const { runUninstall } = await import("./cli/uninstall.ts");
      return runUninstall();
    }
    default:
      return runServer();
  }
}

dispatch().catch((err) => {
  console.error("[broadcaster] fatal:", err);
  process.exit(1);
});
