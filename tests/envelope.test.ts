import { describe, expect, it } from "vitest";
import { envelopeFromJson, envelopeToJson, makeEnvelope } from "../src/envelope.ts";

describe("envelope", () => {
  it("creates a room envelope with id, sender, ts, kind, room, body", () => {
    const env = makeEnvelope({ kind: "room", room: "kitchen", sender: "alice", body: { msg: "hi" } });
    expect(env.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(env.sender).toBe("alice");
    expect(env.kind).toBe("room");
    expect(env.room).toBe("kitchen");
    expect(env.topic).toBeUndefined();
    expect(env.body).toEqual({ msg: "hi" });
    expect(typeof env.ts).toBe("number");
  });

  it("creates a topic envelope", () => {
    const env = makeEnvelope({ kind: "topic", topic: "findings.security.token", sender: "bob", body: { sev: "high" } });
    expect(env.kind).toBe("topic");
    expect(env.topic).toBe("findings.security.token");
    expect(env.room).toBeUndefined();
  });

  it("round-trips through JSON", () => {
    const env = makeEnvelope({ kind: "room", room: "kitchen", sender: "alice", body: { msg: "hi", nested: { x: 1 } } });
    const back = envelopeFromJson(envelopeToJson(env));
    expect(back).toEqual(env);
  });

  it("ulids are monotonically increasing", () => {
    const a = makeEnvelope({ kind: "topic", topic: "t", sender: "s", body: {} });
    const b = makeEnvelope({ kind: "topic", topic: "t", sender: "s", body: {} });
    expect(b.id >= a.id).toBe(true);
  });

  it("rejects invalid JSON envelopes", () => {
    expect(() => envelopeFromJson('{"sender":"alice"}')).toThrow();
  });
});
