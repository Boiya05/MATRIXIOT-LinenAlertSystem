/**
 * hardware/simulated-reader.ts
 *
 * The browser-side equivalent of the desktop app's
 * hardware/simulated_reader.py. Nothing here talks to any hardware -
 * connect()/start()/stop() are no-ops, and a tag is only ever "read"
 * when simulateScan() is called directly, driven by the scan page's
 * "Scan" button or its manual Tag ID field. This is the default mode
 * for both checkpoints, and works in every browser (no Web Serial
 * support required).
 */

import { RFIDReader, type ReaderRole } from './base';

export class SimulatedReader extends RFIDReader {
  constructor(role: ReaderRole) {
    super(role);
  }

  async connect() {
    // nothing to connect to
  }

  async disconnect() {
    // nothing to close
  }

  start() {
    // nothing to start - simulateScan() is called directly instead
  }

  stop() {}

  /**
   * Push a fake tag read onto the queue, exactly as if a real reader
   * had just picked it up. Everything downstream of this call is the
   * real code path - this method is the only thing that's actually
   * "simulated".
   */
  simulateScan(tagId: string) {
    this.push(tagId);
  }
}
