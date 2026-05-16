// M2 - mailboxes (Streams + consumer groups + ack semantics).
//
// Planned Redis schema:
//   Stream:        bc:v1:mailbox:<agent>
//   Consumer group: bc:v1:mailbox:<agent> (group name = "broadcaster", consumer = agent process id)
//
// Planned tools:
//   send(agent, body)          XADD bc:v1:mailbox:<agent> * data <envelope>, returns envelope id
//   inbox(since?, limit?)      XREADGROUP GROUP broadcaster <consumer> COUNT <limit> STREAMS <stream> >
//                                (or XRANGE <since> when `since` is provided for replay)
//   ack(messageId)             XACK <stream> broadcaster <messageId>
//
// At-least-once delivery: messages stay in the pending entries list (PEL) until ack'd.
// On restart, agents pull pending entries first via XREADGROUP with id "0".

const NOT_IMPLEMENTED = "mailbox tools land in M2 - see src/primitives/mailbox.ts for spec";

export class MailboxManager {
  send(): never {
    throw new Error(NOT_IMPLEMENTED);
  }
  inbox(): never {
    throw new Error(NOT_IMPLEMENTED);
  }
  ack(): never {
    throw new Error(NOT_IMPLEMENTED);
  }
  async shutdown(): Promise<void> {}
}
