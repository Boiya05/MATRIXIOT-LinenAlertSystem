/**
 * hardware/usb-serial-reader.ts
 *
 * Talks to a real UHF RFID reader over USB, using Android's USB Host
 * mode (an OTG cable) via `react-native-usb-serialport-for-android` -
 * the mobile-app twin of the desktop app's `serial_reader.py` and the
 * web dashboard's `web-serial-reader.ts`. Same split as both:
 *
 *   - GENERIC TRANSPORT (top half): listing devices, requesting
 *     permission, opening the port, listening for data, pushing
 *     parsed Tag IDs onto the queue. Works the same no matter which
 *     reader you end up with.
 *
 *   - READER-SPECIFIC PROTOCOL (bottom half, clearly marked): what
 *     the raw bytes actually mean. Unknown until a reader model is
 *     chosen - see the matching note in the desktop/web versions. The
 *     two methods down there are the ONLY things that should need
 *     rewriting once you have the datasheet.
 *
 * Real constraints worth knowing before relying on this:
 *   - Android only. iOS doesn't allow generic USB-serial access to
 *     third-party apps without MFi hardware certification - not a
 *     realistic path for this project. requestPort()/connect() throws
 *     immediately on iOS rather than pretending to work.
 *   - Needs a USB OTG cable/adapter between the phone and the reader.
 *   - Not usable in Expo Go. Adding this native module to the project
 *     means the whole app - not just this file - needs a dev-client
 *     build (`eas build --profile development`) instead of Expo Go,
 *     on every platform, for every screen.
 *   - UNTESTED against real hardware. This is written directly
 *     against react-native-usb-serialport-for-android's documented
 *     JS API, but there is no physical Android device + OTG reader
 *     available to verify it against in this environment. A
 *     development-client build was used to confirm this compiles and
 *     links correctly - actual on-device behavior (permission
 *     dialogs, real data flow) still needs verifying on real hardware.
 */

import { Platform } from 'react-native';

import { RFIDReader } from './base';

// react-native-usb-serialport-for-android is Android-only and isn't
// safe to import at all on other platforms (it's a native module with
// no iOS implementation) - only require it when actually on Android,
// so this file can still be imported harmlessly elsewhere.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const UsbSerial = Platform.OS === 'android' ? require('react-native-usb-serialport-for-android') : null;

export class UsbSerialReader extends RFIDReader {
  private connection: InstanceType<typeof UsbSerial.UsbSerial> | null = null;
  private receivedSubscription: { remove: () => void } | null = null;

  static isSupported(): boolean {
    return Platform.OS === 'android';
  }

  // ----------------------------------------------------------------
  // Generic transport - shouldn't need to change per reader model.
  // ----------------------------------------------------------------

  async connect() {
    if (!UsbSerialReader.isSupported()) {
      throw new Error(
        'USB reader mode needs Android with a USB OTG cable - not supported on this platform. ' +
          'Use Simulated mode instead.'
      );
    }

    const devices = await UsbSerial.UsbSerialManager.list();
    if (!devices || devices.length === 0) {
      throw new Error('No USB device found. Plug in the reader via an OTG cable and try again.');
    }
    // If more than one USB device is attached, this takes the first -
    // fine for a single-reader setup, but worth revisiting if a phone
    // ever has multiple USB devices attached at once.
    const device = devices[0];

    await UsbSerial.UsbSerialManager.tryRequestPermission(device.deviceId);
    this.connection = await UsbSerial.UsbSerialManager.open(device.deviceId, {
      baudRate: 115200,
      parity: UsbSerial.Parity.None,
      dataBits: 8,
      stopBits: 1,
    });

    await this.sendStartupCommands();
  }

  async disconnect() {
    this.stop();
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  start() {
    if (!this.connection) {
      throw new Error(`${this.role}: connect() must succeed before start().`);
    }
    this.receivedSubscription = this.connection.onReceived((event: { data: string }) => {
      const tagId = this.parseTagFromFrame(event.data);
      if (tagId) this.push(tagId);
    });
  }

  stop() {
    this.receivedSubscription?.remove();
    this.receivedSubscription = null;
  }

  // ================================================================
  // READER-SPECIFIC PROTOCOL - replace both methods below once a
  // reader model and its protocol documentation are in hand. Nothing
  // else in this file, or in the Scan screen, needs to change when
  // you do. Keep this in sync with the equivalent sections in
  // serial_reader.py and web-serial-reader.ts - all three should
  // implement the same protocol if the same reader is used everywhere.
  // ================================================================

  /**
   * Called once, immediately after the port opens. Many UHF readers
   * sit idle until told to start continuous inventory mode; some
   * start streaming reads on their own and need nothing here.
   *
   * PLACEHOLDER: does nothing yet. Replace with a call to
   * this.connection.send(hexString) with whatever startup/config
   * command your reader's protocol requires.
   */
  private async sendStartupCommands() {
    // no-op placeholder
  }

  /**
   * Turn one raw chunk of data into a Tag ID string, or null if it
   * should be ignored (a checksum failure, a heartbeat frame, noise,
   * or a partial frame that needs to be buffered and combined with
   * the next chunk).
   *
   * PLACEHOLDER implementation: this library delivers received data
   * as a hex string (e.g. "48454C4C4F"), not raw bytes, unlike the
   * desktop/web versions - decodes it as ASCII and assumes the whole
   * decoded chunk is one Tag ID. Real UHF readers commonly send
   * binary frames instead (EPC hex, RSSI, antenna port, a checksum,
   * sometimes several tags per burst). Replace this whole method once
   * you know your reader's protocol.
   */
  private parseTagFromFrame(hexData: string): string | null {
    try {
      const bytes = hexData.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
      const text = String.fromCharCode(...bytes).trim().toUpperCase();
      return text || null;
    } catch {
      return null;
    }
  }
}
