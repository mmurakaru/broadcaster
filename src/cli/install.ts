import { loadConfig } from "../config.ts";
import { confirm } from "./prompt.ts";
import { hasBin, run } from "./shell.ts";
import { pingRedis } from "./redis-check.ts";
import { runDoctor } from "./doctor.ts";

export async function runInstall(args: string[]): Promise<void> {
  const skipPrompt = args.includes("--yes") || args.includes("-y");
  const cfg = loadConfig();

  console.log("Broadcaster install\n");

  // ─── Step 1: Redis ──────────────────────────────────────────────────────
  console.log("Step 1/3: Checking Redis...");
  let ping = await pingRedis(cfg.redisUrl);

  if (ping.reachable) {
    console.log(`  ✓ Redis reachable at ${cfg.redisUrl} (${ping.ms}ms)\n`);
  } else {
    console.log(`  ✗ Redis not reachable at ${cfg.redisUrl}`);
    console.log(`    ${ping.error}\n`);
    await bootstrapRedis({ skipPrompt });

    ping = await pingRedis(cfg.redisUrl);
    if (!ping.reachable) {
      console.error(`Redis still unreachable after bootstrap. Aborting.\n  ${ping.error}`);
      process.exit(1);
    }
    console.log(`  ✓ Redis reachable at ${cfg.redisUrl} (${ping.ms}ms)\n`);
  }

  // ─── Step 2: MCP registration ───────────────────────────────────────────
  console.log("Step 2/3: Registering MCP entry with Claude Code...");
  if (!(await hasBin("claude"))) {
    console.log("  ✗ `claude` CLI not found in PATH.");
    console.log("    Install Claude Code first, then re-run.");
    console.log("    Or add this snippet manually to your Claude config:");
    printManualSnippet();
    process.exit(1);
  }

  if (await confirm("Register `broadcaster` MCP entry at user scope?", { defaultYes: true, skipPrompt })) {
    const code = await run("claude", [
      "mcp", "add", "broadcaster",
      "--scope", "user",
      "--", "npx", "-y", "broadcaster-mcp",
    ]);
    if (code !== 0) {
      console.log("  (registration exited non-zero; entry may already exist - continuing)");
    } else {
      console.log("  ✓ MCP entry registered\n");
    }
  } else {
    console.log("  Skipped MCP registration. Run later with:");
    console.log("    claude mcp add broadcaster --scope user -- npx -y broadcaster-mcp\n");
  }

  // ─── Step 3: Verify ─────────────────────────────────────────────────────
  console.log("Step 3/3: Verifying...");
  await runDoctor();
  console.log("\nDone. Open Claude Code in a new tab and try: `room_join` then `room_broadcast`.");
}

async function bootstrapRedis({ skipPrompt }: { skipPrompt: boolean }): Promise<void> {
  const isMac = process.platform === "darwin";

  if (isMac && (await hasBin("brew"))) {
    if (await confirm("Install Redis via Homebrew and start it as a background service?", { defaultYes: true, skipPrompt })) {
      const installCode = await run("brew", ["install", "redis"]);
      if (installCode !== 0) {
        console.error("  brew install failed");
        process.exit(1);
      }
      const startCode = await run("brew", ["services", "start", "redis"]);
      if (startCode !== 0) {
        console.error("  brew services start failed");
        process.exit(1);
      }
      console.log("  ✓ Redis installed and started via brew\n");
      return;
    }
  }

  if (await hasBin("docker")) {
    if (await confirm("Start Redis in a Docker container (broadcaster-redis on port 6379)?", { defaultYes: true, skipPrompt })) {
      const code = await run("docker", [
        "run", "-d",
        "--name", "broadcaster-redis",
        "-p", "6379:6379",
        "--restart", "unless-stopped",
        "redis:7-alpine",
      ]);
      if (code !== 0) {
        console.error("  docker run failed (container may already exist - try `docker start broadcaster-redis`)");
        process.exit(1);
      }
      console.log("  ✓ Redis started in Docker (container: broadcaster-redis)\n");
      return;
    }
  }

  console.log("  Could not bootstrap Redis automatically. Install manually:");
  if (isMac) console.log("    macOS:  brew install redis && brew services start redis");
  console.log("    Docker: docker run -d --name broadcaster-redis -p 6379:6379 redis:7-alpine");
  process.exit(1);
}

function printManualSnippet(): void {
  console.log(`
  {
    "mcpServers": {
      "broadcaster": {
        "command": "npx",
        "args": ["-y", "broadcaster-mcp"]
      }
    }
  }
  `);
}
