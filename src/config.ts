import { resolveAgentName } from "./identity.ts";

export type Config = {
  redisUrl: string;
  keyPrefix: string;
  agent: string;
  heartbeatIntervalMs: number;
  rosterTtlSeconds: number;
  roomStreamMaxLen: number;
};

export function loadConfig(): Config {
  return {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379/0",
    keyPrefix: process.env.BROADCASTER_KEY_PREFIX ?? "bc:v1",
    agent: resolveAgentName(),
    heartbeatIntervalMs: numFromEnv("BROADCASTER_HEARTBEAT_MS", 10_000),
    rosterTtlSeconds: numFromEnv("BROADCASTER_ROSTER_TTL_S", 30),
    roomStreamMaxLen: numFromEnv("BROADCASTER_ROOM_MAXLEN", 1000),
  };
}

function numFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid ${name}=${raw}; expected a positive number`);
  }
  return n;
}
