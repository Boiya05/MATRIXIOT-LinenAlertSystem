/**
 * hardware/web-serial-reader.ts
 *
 * Talks to a real UHF RFID reader over USB, directly from the
 * browser, using the Web Serial API - the browser-side equivalent of
 * the desktop app's hardware/serial_reader.py. Same split:
 *
 *   - GENERIC TRANSPORT (top half): requesting/opening the port,
 *     running the read loop, pushing parsed Tag IDs onto the queue.
 *     Works the same no matter which reader you end up with.
 *
 *   - READER-SPECIFIC PROTOCOL (bottom half, clearly marked): what
 *     the raw bytes actually mean. Unknown until a reader model is
 *     chosen - see the matching note in serial_reader.py. The two
 *     methods down there are the ONLY things that should need
 *     rewriting once you have the datasheet.
 *
 * Real constraints worth knowing before relying on this path:
 *   - Web Serial only exists in Chromium browsers (Chrome, Edge) -
 *     not Firefox, not Safari, not mobile browsers at all.
 *   - It only works over HTTPS (or localhost) - fine for both this
 *     Vercel deployment and local dev.
 *   - The browser tab needs the reader physically plugged into
 *     WHATEVER MACHINE IT'S RUNNING ON. Deploying this dashboard to
 *     Vercel doesn't change that - "scanning from the web" still
 *     means a laptop with Chrome sitting at the checkpoint with the
 *     reader plugged into it, the same physical requirement as the
 *     desktop app, just a different program on that machine.
 */

import { RFIDReader, type ReaderRole } from './base';

export class WebSerialReader extends RFIDReader {
  private port: SerialPort | null = null;
  private reading = false;

  constructor(role: ReaderRole) {
    super(role);
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator && navigator.serial != null;
  }

  // ----------------------------------------------------------------
  // Generic transport - shouldn't need to change per reader model.
  // ----------------------------------------------------------------

  async connect() {
    if (!WebSerialReader.isSupported()) {
      throw new Error(
        "This browser doesn't support Web Serial. Use Chrome or Edge (over HTTPS or " +
          'localhost), or switch this reader back to Simulated mode.'
      );
    }
    // Opens the browser's native "select a device" picker - the user
    // chooses which serial port is the RFID reader. Must be called
    // from a user gesture (a button click), which is exactly how
    // the scan page wires this up.
    this.port = await navigator.serial!.requestPort();
    await this.port.open({ baudRate: 115200 });
    await this.sendStartupCommands();
  }

  async disconnect() {
    this.stop();
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  start() {
    if (!this.port) {
      throw new Error(`${this.role}: connect() must succeed before start().`);
    }
    this.reading = true;
    this.readLoop();
  }

  stop() {
    // The read loop checks this.reading between reads and exits on
    // its own once the current read resolves.
    this.reading = false;
  }

  private async readLoop() {
    if (!this.port?.readable) return;
    const reader = this.port.readable.getReader();

    try {
      while (this.reading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const tagId = this.parseTagFromFrame(value);
        if (tagId) this.push(tagId);
      }
    } catch (err) {
      // A serial read can fail if the device is unplugged mid-session.
      // Log it rather than throwing out of an async loop nothing awaits.
      console.warn(`[${this.role}] Serial read error:`, err);
    } finally {
      reader.releaseLock();
    }
  }

  // ================================================================
  // READER-SPECIFIC PROTOCOL - replace both methods below once a
  // reader model and its protocol documentation are in hand. Nothing
  // else in this file, or in the scan page, needs to change when you
  // do. Keep this in sync with the equivalent section in the desktop
  // app's hardware/serial_reader.py - both should end up implementing
  // the same protocol if the same reader is used from both places.
  // ================================================================

  /**
   * Called once, immediately after the port opens. Many UHF readers
   * sit idle until told to start continuous inventory mode; some
   * start streaming reads on their own and need nothing here.
   *
   * PLACEHOLDER: does nothing yet. Replace with a write to
   * this.port's writable stream with whatever startup/config command
   * your reader's protocol requires.
   */
  private async sendStartupCommands() {
    // no-op placeholder
  }

  /**
   * Turn one raw chunk of bytes into a Tag ID string, or null if it
   * should be ignored (a checksum failure, a heartbeat frame, noise,
   * or a partial frame that needs to be buffered and combined with
   * the next chunk - Web Serial delivers arbitrary byte chunks, not
   * pre-split frames, unlike Python's readline()).
   *
   * PLACEHOLDER implementation: assumes the whole chunk is one
   * newline-terminated ASCII line and the line *is* the Tag ID. Real
   * UHF readers commonly send binary frames instead (EPC hex, RSSI,
   * antenna port, a checksum, sometimes several tags per burst).
   * Replace this whole method once you know your reader's protocol.
   */
  private parseTagFromFrame(chunk: Uint8Array): string | null {
    const text = new TextDecoder('ascii', { fatal: false }).decode(chunk).trim().toUpperCase();
    return text || null;
  }
}
