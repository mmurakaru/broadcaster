import { Redis } from "ioredis";
import type { Config } from "./config.ts";

export type RedisHandles = {
  cmd: Redis;
  sub: Redis;
};

export type { Redis };

export function createRedis(cfg: Config): RedisHandles {
  const cmd = new Redis(cfg.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 });
  const sub = cmd.duplicate();
  return { cmd, sub };
}

export async function closeRedis(h: RedisHandles): Promise<void> {
  await Promise.allSettled([h.sub.quit(), h.cmd.quit()]);
}

export function keys(prefix: string) {
  return {
    roomStream: (room: string) => `${prefix}:room:${room}:stream`,
    rosterKey: (room: string, agent: string) => `${prefix}:room:${room}:roster:${agent}`,
    rosterScan: (room: string) => `${prefix}:room:${room}:roster:*`,
    topicChannel: (topic: string) => `${prefix}:topic:${topic}`,
    topicPattern: (pattern: string) => `${prefix}:topic:${pattern}`,
  };
}
