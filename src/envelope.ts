import { monotonicFactory } from "ulid";

const nextId = monotonicFactory();

export type EnvelopeKind = "room" | "topic" | "system";

export type Envelope = {
  id: string;
  sender: string;
  ts: number;
  kind: EnvelopeKind;
  room?: string;
  topic?: string;
  body: unknown;
};

export type EnvelopeInput =
  | { kind: "room"; room: string; sender: string; body: unknown }
  | { kind: "topic"; topic: string; sender: string; body: unknown }
  | { kind: "system"; room?: string; topic?: string; sender: string; body: unknown };

export function makeEnvelope(input: EnvelopeInput): Envelope {
  const base = { id: nextId(), ts: Date.now(), sender: input.sender, body: input.body };
  switch (input.kind) {
    case "room":
      return { ...base, kind: "room", room: input.room };
    case "topic":
      return { ...base, kind: "topic", topic: input.topic };
    case "system":
      return { ...base, kind: "system", ...(input.room ? { room: input.room } : {}), ...(input.topic ? { topic: input.topic } : {}) };
  }
}

export function envelopeToJson(env: Envelope): string {
  return JSON.stringify(env);
}

export function envelopeFromJson(raw: string): Envelope {
  const parsed = JSON.parse(raw) as Envelope;
  if (typeof parsed.id !== "string" || typeof parsed.sender !== "string" || typeof parsed.ts !== "number") {
    throw new Error("invalid envelope: missing id/sender/ts");
  }
  return parsed;
}
