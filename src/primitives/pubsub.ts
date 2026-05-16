import type { Redis } from "ioredis";
import { ulid } from "ulid";
import type { Config } from "../config.ts";
import { keys } from "../redis.ts";
import { type Envelope, envelopeFromJson, envelopeToJson, makeEnvelope } from "../envelope.ts";
import { AsyncQueue } from "../queue.ts";

export class PubSubManager {
  private subscriptions = new Map<string, string>();
  private queue = new AsyncQueue<Envelope>();
  private wired = false;
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

  async broadcast(topic: string, body: unknown): Promise<string> {
    const env = makeEnvelope({ kind: "topic", topic, sender: this.cfg.agent, body });
    await this.cmd.publish(this.k.topicChannel(topic), envelopeToJson(env));
    return env.id;
  }

  async subscribe(pattern: string): Promise<string> {
    this.wirePubsubHandler();
    const subscriptionId = ulid();
    this.subscriptions.set(subscriptionId, pattern);
    await this.sub.psubscribe(this.k.topicPattern(pattern));
    return subscriptionId;
  }

  nextMessage(timeoutMs: number): Promise<Envelope | null> {
    return this.queue.get(timeoutMs);
  }

  async shutdown(): Promise<void> {
    this.queue.close();
    const patterns = [...new Set(this.subscriptions.values())].map((p) => this.k.topicPattern(p));
    if (patterns.length > 0) {
      try {
        await this.sub.punsubscribe(...patterns);
      } catch {
        // ignore - connection may already be closing
      }
    }
    this.subscriptions.clear();
  }

  private wirePubsubHandler(): void {
    if (this.wired) return;
    this.wired = true;
    this.sub.on("pmessage", (_pattern, _channel, message) => {
      try {
        const env = envelopeFromJson(message);
        if (env.sender !== this.cfg.agent) {
          this.queue.put(env);
        }
      } catch (err) {
        console.error("[broadcaster] bad pubsub envelope:", err);
      }
    });
  }
}
