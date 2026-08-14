/**
 * hardware/base.ts
 *
 * The mobile-app twin of the desktop app's hardware/base.py and the
 * web dashboard's hardware/base.ts - same interface, same queue+poll
 * pattern, kept consistent across all three so a reader implementation
 * (once one exists) is easy to reason about no matter which app it's
 * in. See hardware/README.md in this folder for why there's no real
 * hardware reader here yet, unlike the desktop and web versions.
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
