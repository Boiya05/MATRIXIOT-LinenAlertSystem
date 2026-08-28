/**
 * hardware/base.ts
 *
 * The browser-side equivalent of the desktop app's hardware/base.py -
 * same interface, same queue+poll pattern, same reasoning: reader
 * implementations push tag IDs onto a queue as they read them; the
 * page drains that queue on a timer instead of receiving a direct
 * callback. On the desktop, that's because a real reader's I/O runs
 * on a background thread and tkinter can only be touched from the
 * main thread. Here, the same shape is kept for a different reason -
 * it keeps SimulatedReader and WebSerialReader interchangeable from
 * the scan page's point of view, exactly like the desktop app's
 * SimulatedReader/SerialRFIDReader are interchangeable from main.py's.
 */

export type ReaderRole = 'entry_reader' | 'exit_reader';

// A UHF EPC Gen2 tag ID is a fixed-length hex string - every real tag
// seen from this hardware has been exactly 24 hex characters (96-bit
// EPC, the standard length for ISO18000-6C tags). A keyboard-wedge
// reader in continuous-inventory mode can occasionally drop the Enter
// keystroke between two back-to-back reads - confirmed happening in
// practice, not just a theoretical risk - which lands here as one
// long string that's actually two (or more) tag IDs glued together
// with no separator. push() below recovers from that.
const TAG_ID_HEX_LENGTH = 24;

/**
 * Recover from two or more tag reads landing as one string with no
 * separator between them (see TAG_ID_HEX_LENGTH's comment above).
 *
 * Deliberately narrow: only splits a string that's *entirely* hex and
 * an exact multiple of TAG_ID_HEX_LENGTH - a genuinely different tag
 * format (a different reader, a barcode, someone typing something
 * else into the field) never matches that pattern, so it's passed
 * through unchanged rather than mangled.
 */
function splitConcatenatedReads(raw: string): string[] {
  const cleaned = raw.trim().toUpperCase();
  const isHex = cleaned.length > 0 && /^[0-9A-F]+$/.test(cleaned);
  if (isHex && cleaned.length > TAG_ID_HEX_LENGTH && cleaned.length % TAG_ID_HEX_LENGTH === 0) {
    const chunks: string[] = [];
    for (let i = 0; i < cleaned.length; i += TAG_ID_HEX_LENGTH) {
      chunks.push(cleaned.slice(i, i + TAG_ID_HEX_LENGTH));
    }
    return chunks;
  }
  return [raw];
}

export abstract class RFIDReader {
  readonly role: ReaderRole;
  private queue: string[] = [];

  constructor(role: ReaderRole) {
    this.role = role;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract start(): void;
  abstract stop(): void;

  /**
   * Push a tag read onto the queue - called by subclasses as they
   * read tags. Splits a suspiciously long, all-hex read back into
   * individual tag IDs first - see splitConcatenatedReads() above.
   */
  protected push(tagId: string) {
    for (const id of splitConcatenatedReads(tagId)) {
      this.queue.push(id);
    }
  }

  /** Drain every tag read that's arrived since the last poll. */
  poll(): string[] {
    const tagIds = this.queue;
    this.queue = [];
    return tagIds;
  }
}
