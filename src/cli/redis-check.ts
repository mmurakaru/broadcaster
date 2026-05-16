import { Redis } from "ioredis";

export type PingResult = { reachable: true; ms: number } | { reachable: false; error: string };

export async function pingRedis(url: string): Promise<PingResult> {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    connectTimeout: 1500,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  client.on("error", () => { /* swallowed: surfaced via thrown error below */ });

  const t0 = Date.now();
  try {
    await client.connect();
    await client.ping();
    return { reachable: true, ms: Date.now() - t0 };
  } catch (e) {
    return { reachable: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    client.disconnect();
  }
}
