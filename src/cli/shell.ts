import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export async function hasBin(name: string): Promise<boolean> {
  try {
    await execFileP(process.platform === "win32" ? "where" : "which", [name]);
    return true;
  } catch {
    return false;
  }
}

export function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

export async function captureStdout(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP(cmd, args);
  return stdout;
}
