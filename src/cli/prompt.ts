import { createInterface } from "node:readline/promises";

export type ConfirmOptions = { defaultYes?: boolean; skipPrompt?: boolean };

export async function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  const def = options.defaultYes !== false;
  if (options.skipPrompt) return def;
  const hint = def ? "Y/n" : "y/N";
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${message} [${hint}] `)).trim().toLowerCase();
    if (answer === "") return def;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
