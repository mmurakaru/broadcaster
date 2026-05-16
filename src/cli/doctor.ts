import { loadConfig } from "../config.ts";
import { captureStdout, hasBin } from "./shell.ts";
import { pingRedis } from "./redis-check.ts";

export async function runDoctor(): Promise<void> {
  const cfg = loadConfig();
  let allGreen = true;

  const ping = await pingRedis(cfg.redisUrl);
  if (ping.reachable) {
    console.log(`  ✓ Redis      reachable at ${cfg.redisUrl} (${ping.ms}ms)`);
  } else {
    allGreen = false;
    console.log(`  ✗ Redis      not reachable at ${cfg.redisUrl}`);
    console.log(`               ${ping.error}`);
  }

  if (!(await hasBin("claude"))) {
    allGreen = false;
    console.log("  ✗ MCP entry  `claude` CLI not found in PATH");
  } else {
    try {
      const out = await captureStdout("claude", ["mcp", "list"]);
      // Match the exact entry name `broadcaster` (not `broadcaster-alice` etc.)
      if (/(^|\s)broadcaster(\s|:|$)/m.test(out)) {
        console.log("  ✓ MCP entry  `broadcaster` registered in Claude Code");
      } else {
        allGreen = false;
        console.log("  ✗ MCP entry  `broadcaster` not registered (run `npx -y broadcaster-mcp install`)");
      }
    } catch (e) {
      allGreen = false;
      console.log(`  ✗ MCP entry  failed to query \`claude mcp list\`: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`  ${allGreen ? "✓" : "✗"} agent name  ${cfg.agent}`);

  if (!allGreen) process.exitCode = 1;
}
