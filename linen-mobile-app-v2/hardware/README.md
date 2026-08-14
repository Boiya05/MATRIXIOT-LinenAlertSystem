# hardware/ - why there's no real reader here yet

The desktop app and web dashboard both have a real-hardware reader
implementation alongside their simulated one (`SerialRFIDReader` /
`WebSerialReader`), because both had a genuinely generic transport
available - USB serial (`pyserial`) and the Web Serial API both work
the same way regardless of which reader model you eventually plug in.

Mobile doesn't have an equivalent generic transport, so building one
here would mean guessing at a specific vendor's SDK rather than
isolating one - the opposite of the approach used everywhere else in
this project. Two real, important facts worth knowing before deciding
how (or whether) to pursue this:

1. **A phone's built-in NFC chip cannot read long-range UHF tags.**
   NFC (what phones have) and UHF RFID (860-960MHz, what "long range"
   scanning needs) are different radio technologies on different
   frequency bands - NFC's read range is a few centimeters by design,
   the opposite of what an exit-scanner checkpoint needs. This isn't
   a software limitation to work around; the hardware physically
   can't do it. If the tags in use are UHF (as the project brief
   specifies), no amount of app code makes a phone's own NFC radio
   read them.

2. **Real scanning on mobile means an external Bluetooth UHF reader
   accessory** (handheld "sleds" that clip onto a phone, sold by
   vendors like Zebra, Chainway, etc.), which means:
   - Picking a specific model - same "unknown protocol" blocker as
     the desktop/web readers, except there's no vendor-agnostic
     fallback the way serial ports are for USB.
   - Integrating its SDK (usually Bluetooth Low Energy) as a native
     module - `react-native-ble-plx` or a vendor-provided module are
     the usual options.
   - **Leaving Expo Go.** Native BLE modules don't run in Expo Go -
     this app would need a custom EAS development build from that
     point on (the project already has EAS Build set up for the APK,
     so this is a config change, not new infrastructure - but it does
     mean Expo Go stops being usable for testing once this is added).

**What exists today**: `simulated-reader.ts` only - the same
`RFIDReader` interface as the other two apps, so a real accessory
reader can be added later as a second implementation without changing
the Scan tab's code, exactly like adding `WebSerialReader` didn't
require changing the web dashboard's Scan page.
