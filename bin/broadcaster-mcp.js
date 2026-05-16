#!/usr/bin/env node
// Thin wrapper that lets `npx broadcaster-mcp` work without a build step.
// Node 24 strips types from .ts files natively under --experimental-strip-types.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "..", "src", "index.ts");

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", entry, ...process.argv.slice(2)],
  { stdio: "inherit" }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
