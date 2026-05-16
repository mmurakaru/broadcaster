import { afterEach, beforeEach, describe, expect, it } from "vitest";
import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import type { Config } from "../src/config.ts";
import { RoomManager } from "../src/primitives/rooms.ts";

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

function newMock(): Redis {
  return new RedisMock() as unknown as Redis;
}

describe("RoomManager", () => {
  let cmd: Redis;
  let sub: Redis;
  let alice: RoomManager;

  beforeEach(async () => {
    cmd = newMock();
    sub = newMock();
    await cmd.flushall();
    alice = new RoomManager(testConfig("alice"), cmd, sub);
  });

  afterEach(async () => {
    await alice.shutdown();
  });

  it("broadcast then history returns the message", async () => {
    await alice.join("kitchen");
    const id = await alice.broadcast("kitchen", { msg: "hello world" });
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const history = await alice.history("kitchen", 50);
    // history includes the agent.joined system event + our message
    const userMessages = history.filter((e) => e.kind === "room");
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0]!.body).toEqual({ msg: "hello world" });
    expect(userMessages[0]!.sender).toBe("alice");
    expect(userMessages[0]!.id).toBe(id);
  });

  it("history is ordered oldest-first", async () => {
    await alice.join("kitchen");
    await alice.broadcast("kitchen", { n: 1 });
    await alice.broadcast("kitchen", { n: 2 });
    await alice.broadcast("kitchen", { n: 3 });

    const history = await alice.history("kitchen", 50);
    const userMessages = history.filter((e) => e.kind === "room");
    expect(userMessages.map((e) => (e.body as { n: number }).n)).toEqual([1, 2, 3]);
  });

  it("roster lists joined agent and clears after leave", async () => {
    await alice.join("kitchen");
    expect(await alice.roster("kitchen")).toEqual(["alice"]);

    await alice.leave("kitchen");
    expect(await alice.roster("kitchen")).toEqual([]);
  });

  it("roster lists multiple agents sharing the same Redis", async () => {
    const bob = new RoomManager(testConfig("bob"), cmd, sub);
    try {
      await alice.join("kitchen");
      await bob.join("kitchen");
      expect(await alice.roster("kitchen")).toEqual(["alice", "bob"]);
    } finally {
      await bob.shutdown();
    }
  });

  it("history limit truncates oldest", async () => {
    await alice.join("kitchen");
    for (let i = 0; i < 5; i++) {
      await alice.broadcast("kitchen", { n: i });
    }
    const last3 = await alice.history("kitchen", 3);
    expect(last3).toHaveLength(3);
    const userMessages = last3.filter((e) => e.kind === "room");
    expect(userMessages.length).toBeGreaterThan(0);
  });
});
