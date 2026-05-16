import { hostname } from "node:os";

export function resolveAgentName(): string {
  const fromEnv = process.env.BROADCASTER_AGENT?.trim();
  if (fromEnv) return fromEnv;
  return `${hostname()}-${process.pid}`;
}
