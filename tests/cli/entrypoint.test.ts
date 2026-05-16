import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileP = promisify(execFile);
const ENTRY = resolve(import.meta.dirname, "..", "..", "src", "index.ts");

const NODE_ARGS = ["--experimental-strip-types", "--no-warnings=ExperimentalWarning"];

describe("CLI entrypoint dispatch", () => {
  it("--help prints usage with all subcommands", async () => {
    const { stdout } = await execFileP("node", [...NODE_ARGS, ENTRY, "--help"]);
    expect(stdout).toContain("broadcaster-mcp");
    expect(stdout).toContain("install");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("uninstall");
  }, 10_000);

  it("--version prints a semver string", async () => {
    const { stdout } = await execFileP("node", [...NODE_ARGS, ENTRY, "--version"]);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  }, 10_000);
});
