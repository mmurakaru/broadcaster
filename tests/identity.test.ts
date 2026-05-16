import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAgentName } from "../src/identity.ts";

describe("resolveAgentName", () => {
  const saved = process.env.BROADCASTER_AGENT;

  beforeEach(() => {
    delete process.env.BROADCASTER_AGENT;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.BROADCASTER_AGENT;
    else process.env.BROADCASTER_AGENT = saved;
  });

  it("reads BROADCASTER_AGENT when set", () => {
    process.env.BROADCASTER_AGENT = "alice";
    expect(resolveAgentName()).toBe("alice");
  });

  it("trims whitespace", () => {
    process.env.BROADCASTER_AGENT = "  bob  ";
    expect(resolveAgentName()).toBe("bob");
  });

  it("falls back to hostname-pid when unset", () => {
    const name = resolveAgentName();
    expect(name).toMatch(/.+-\d+$/);
  });
});
