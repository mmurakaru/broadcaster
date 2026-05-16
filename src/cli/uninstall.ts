import { confirm } from "./prompt.ts";
import { captureStdout, hasBin, run } from "./shell.ts";

export async function runUninstall(): Promise<void> {
  console.log("Broadcaster uninstall\n");

  if (!(await hasBin("claude"))) {
    console.log("  `claude` CLI not found - cannot remove MCP entry automatically.");
  } else {
    console.log("Removing MCP entry...");
    const code = await run("claude", ["mcp", "remove", "broadcaster"]);
    if (code === 0) {
      console.log("  ✓ entry removed\n");
    } else {
      console.log("  (no entry found, or already removed)\n");
    }
  }

  if (await hasBin("docker")) {
    let dockerRedisFound = false;
    try {
      await captureStdout("docker", ["inspect", "broadcaster-redis"]);
      dockerRedisFound = true;
    } catch {
      // not bootstrapped via docker
    }
    if (dockerRedisFound) {
      if (await confirm("Stop and remove the Docker `broadcaster-redis` container?", { defaultYes: false })) {
        await run("docker", ["rm", "-f", "broadcaster-redis"]);
        console.log("  ✓ Docker Redis container removed\n");
      }
    }
  }

  console.log("Done. Note: brew-managed Redis (if any) is intentionally left running -");
  console.log("other apps may depend on it. Stop with `brew services stop redis` if you want.");
}
