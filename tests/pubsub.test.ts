import { afterEach, beforeEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import type { Config } from "../src/config.ts";
import { PubSubManager } from "../src/primitives/pubsub.ts";

function testConfig(agent: string): Config {
  return {
    redisUrl: "redis://mock",
    keyPrefix: "bc:v1",
    agent,
    heartbeatIntervalMs: 60_000,
    rosterTtlSeconds: 30,
    roomStreamMaxLen: 1000,
  };
}

describe("PubSubManager", () => {
  let alice: PubSubManager;
  let aliceCmd: Redis;
  let aliceSub: Redis;

  beforeEach(async () => {
    aliceCmd = new RedisMock() as unknown as Redis;
    aliceSub = new RedisMock() as unknown as Redis;
    await aliceCmd.flushall();
    alice = new PubSubManager(testConfig("alice"), aliceCmd, aliceSub);
  });

  afterEach(async () => {
    await alice.shutdown();
  });

  it("broadcast returns a ulid id", async () => {
    const id = await alice.broadcast("findings.security.token", { sev: "high" });
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("subscribe returns a subscription id", async () => {
    const sid = await alice.subscribe("findings.security.*");
    expect(sid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("next_message times out and returns null when nothing matches", async () => {
    await alice.subscribe("never-published.*");
    const result = await alice.nextMessage(50);
    expect(result).toBeNull();
  });
});
