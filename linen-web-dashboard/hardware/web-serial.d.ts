/**
 * hardware/web-serial.d.ts
 *
 * Minimal ambient types for the Web Serial API - TypeScript's bundled
 * DOM types don't include it yet (it's a Chromium-only API, not part
 * of the standard web platform baseline). Only the subset actually
 * used by hardware/web-serial-reader.ts is declared here.
 */

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
}

interface Serial extends EventTarget {
  requestPort(): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
  readonly serial?: Serial;
}
