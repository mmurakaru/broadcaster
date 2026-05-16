// M3 - blackboard (Hashes + per-tag index + keyspace notifications).
//
// Planned Redis schema:
//   Entry hash:     bc:v1:space:<space>:entry:<key>   fields: value, ts, sender, tags (CSV)
//   Tag index:      bc:v1:space:<space>:tag:<tag>     SET of entry keys
//   Change channel: bc:v1:space:<space>:changes       pub/sub for post/remove events
//
// Planned tools:
//   post(space, key, value, tags?)   HSET entry; SADD each tag index; PUBLISH change event
//   query(space, tag?, pattern?)     SINTERSTORE on tag indices; HGETALL each match;
//                                       fallback to SCAN with pattern when no tags supplied
//
// Subscribers wanting "react on change" subscribe to the change channel via pub/sub.

const NOT_IMPLEMENTED = "blackboard tools land in M3 - see src/primitives/blackboard.ts for spec";

export class BlackboardManager {
  post(): never {
    throw new Error(NOT_IMPLEMENTED);
  }
  query(): never {
    throw new Error(NOT_IMPLEMENTED);
  }
  async shutdown(): Promise<void> {}
}
