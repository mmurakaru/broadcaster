import type { Redis } from "ioredis";
import type { Config } from "../config.ts";
import { keys } from "../redis.ts";
import { type Envelope, envelopeFromJson, envelopeToJson, makeEnvelope } from "../envelope.ts";
import { AsyncQueue } from "../queue.ts";

type JoinedRoom = {
  lastId: string;
  heartbeat: NodeJS.Timeout;
};

export class RoomManager {
  private joined = new Map<string, JoinedRoom>();
  private queue = new AsyncQueue<Envelope>();
  private tailLoopRunning = false;
  private wakeTail: (() => void) | null = null;
  private shuttingDown = false;
  private readonly cfg: Config;
  private readonly cmd: Redis;
  private readonly sub: Redis;
  private k: ReturnType<typeof keys>;

  constructor(cfg: Config, cmd: Redis, sub: Redis) {
    this.cfg = cfg;
    this.cmd = cmd;
    this.sub = sub;
    this.k = keys(cfg.keyPrefix);
  }

  async join(room: string): Promise<{ room: string; agent: string }> {
    if (this.joined.has(room)) {
      await this.refreshRoster(room);
      return { room, agent: this.cfg.agent };
    }

    await this.refreshRoster(room);

    const heartbeat = setInterval(() => {
      this.refreshRoster(room).catch((err) => {
        console.error(`[broadcaster] roster refresh failed for ${room}:`, err);
      });
    }, this.cfg.heartbeatIntervalMs);
    heartbeat.unref();

    this.joined.set(room, { lastId: "$", heartbeat });

    await this.appendSystemEvent(room, "agent.joined");
    this.kickTailLoop();
    return { room, agent: this.cfg.agent };
  }

  async leave(room: string): Promise<void> {
    const state = this.joined.get(room);
    if (!state) return;
    clearInterval(state.heartbeat);
    this.joined.delete(room);
    await this.cmd.del(this.k.rosterKey(room, this.cfg.agent));
    await this.appendSystemEvent(room, "agent.left");
    this.wakeTail?.();
  }

  async broadcast(room: string, body: unknown): Promise<string> {
    const env = makeEnvelope({ kind: "room", room, sender: this.cfg.agent, body });
    await this.cmd.xadd(
      this.k.roomStream(room),
      "MAXLEN",
      "~",
      String(this.cfg.roomStreamMaxLen),
      "*",
      "data",
      envelopeToJson(env),
    );
    return env.id;
  }

  async history(room: string, limit = 50): Promise<Envelope[]> {
    const entries = await this.cmd.xrevrange(this.k.roomStream(room), "+", "-", "COUNT", limit);
    const out: Envelope[] = [];
    for (const [, fields] of entries) {
      const data = readField(fields, "data");
      if (data) out.push(envelopeFromJson(data));
    }
    return out.reverse();
  }

  async roster(room: string): Promise<string[]> {
    const pattern = this.k.rosterScan(room);
    const prefix = this.k.rosterKey(room, "");
    const found: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await this.cmd.scan(cursor, "MATCH", pattern, "COUNT", "100");
      for (const key of batch) {
        if (key.startsWith(prefix)) found.push(key.slice(prefix.length));
      }
      cursor = next;
    } while (cursor !== "0");
    return found.sort();
  }

  nextMessage(timeoutMs: number): Promise<Envelope | null> {
    return this.queue.get(timeoutMs);
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.wakeTail?.();
    this.queue.close();
    const rooms = [...this.joined.keys()];
    for (const room of rooms) {
      try {
        await this.leave(room);
      } catch (err) {
        console.error(`[broadcaster] leave(${room}) on shutdown failed:`, err);
      }
    }
  }

  private async refreshRoster(room: string): Promise<void> {
    await this.cmd.set(
      this.k.rosterKey(room, this.cfg.agent),
      String(Date.now()),
      "EX",
      this.cfg.rosterTtlSeconds,
    );
  }

  private async appendSystemEvent(room: string, kind: string): Promise<void> {
    const env = makeEnvelope({
      kind: "system",
      room,
      sender: this.cfg.agent,
      body: { event: kind, agent: this.cfg.agent },
    });
    await this.cmd.xadd(
      this.k.roomStream(room),
      "MAXLEN",
      "~",
      String(this.cfg.roomStreamMaxLen),
      "*",
      "data",
      envelopeToJson(env),
    );
  }

  private kickTailLoop(): void {
    if (this.tailLoopRunning) {
      this.wakeTail?.();
      return;
    }
    this.tailLoopRunning = true;
    void this.tailLoop();
  }

  private async tailLoop(): Promise<void> {
    while (!this.shuttingDown) {
      const snapshot = [...this.joined.entries()];
      if (snapshot.length === 0) {
        await this.waitForWake(2000);
        continue;
      }

      const streams = snapshot.map(([room]) => this.k.roomStream(room));
      const ids = snapshot.map(([, s]) => s.lastId);

      try {
        const result = (await this.sub.xread(
          "BLOCK",
          2000,
          "STREAMS",
          ...streams,
          ...ids,
        )) as Array<[string, Array<[string, string[]]>]> | null;

        if (!result) continue;

        for (const [streamKey, entries] of result) {
          const room = streamKeyToRoom(streamKey, this.cfg.keyPrefix);
          if (!room) continue;
          for (const [entryId, fields] of entries) {
            const data = readField(fields, "data");
            if (data) {
              try {
                const env = envelopeFromJson(data);
                if (env.sender !== this.cfg.agent) {
                  this.queue.put(env);
                }
              } catch (err) {
                console.error(`[broadcaster] bad envelope on ${room}/${entryId}:`, err);
              }
            }
            const state = this.joined.get(room);
            if (state) state.lastId = entryId;
          }
        }
      } catch (err) {
        if (this.shuttingDown) break;
        console.error("[broadcaster] xread error:", err);
        await sleep(500);
      }
    }
    this.tailLoopRunning = false;
  }

  private waitForWake(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wakeTail = null;
        resolve();
      }, timeoutMs);
      this.wakeTail = () => {
        clearTimeout(timer);
        this.wakeTail = null;
        resolve();
      };
    });
  }
}

function readField(fields: string[], name: string): string | null {
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i] === name) return fields[i + 1] ?? null;
  }
  return null;
}

function streamKeyToRoom(key: string, prefix: string): string | null {
  const head = `${prefix}:room:`;
  const tail = ":stream";
  if (!key.startsWith(head) || !key.endsWith(tail)) return null;
  return key.slice(head.length, key.length - tail.length);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
