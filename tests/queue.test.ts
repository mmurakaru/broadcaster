import { describe, expect, it } from "vitest";
import { AsyncQueue } from "../src/queue.ts";

describe("AsyncQueue", () => {
  it("returns a pre-filled item immediately", async () => {
    const q = new AsyncQueue<number>();
    q.put(1);
    q.put(2);
    expect(await q.get(100)).toBe(1);
    expect(await q.get(100)).toBe(2);
  });

  it("blocks until put resolves", async () => {
    const q = new AsyncQueue<string>();
    const got = q.get(500);
    setTimeout(() => q.put("hello"), 20);
    expect(await got).toBe("hello");
  });

  it("returns null on timeout", async () => {
    const q = new AsyncQueue<string>();
    const start = Date.now();
    const got = await q.get(50);
    expect(got).toBeNull();
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });

  it("close() unblocks pending waiters with null", async () => {
    const q = new AsyncQueue<number>();
    const got = q.get(1000);
    q.close();
    expect(await got).toBeNull();
  });
});
