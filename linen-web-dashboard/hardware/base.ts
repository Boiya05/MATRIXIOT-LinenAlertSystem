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

  /** Push a tag read onto the queue - called by subclasses as they read tags. */
  protected push(tagId: string) {
    this.queue.push(tagId);
  }

  /** Drain every tag read that's arrived since the last poll. */
  poll(): string[] {
    const tagIds = this.queue;
    this.queue = [];
    return tagIds;
  }
}
