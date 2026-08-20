# hardware/ - RFID reader abstraction (mobile)

Per the supervisor-reviewed architecture ("Proposed System Architecture
& Scope - Mobile Long-Range UHF RFID Hotel Property / Linen System"),
**this app is now the primary operational RFID application** - it
connects directly to the physical reader, not just the desktop app.
The desktop app and web dashboard remain part of the system (desktop
as a secondary/legacy scanning terminal, the web dashboard as the
management view), but the mobile app is where real scanning is meant
to happen going forward.

## What's here

Same `RFIDReader` interface as the desktop app's `hardware/` and the
web dashboard's `hardware/` - `connect()`/`disconnect()`/`start()`/
`stop()`/`poll()`, so the Scan screen doesn't need to know or care
which implementation is active:

- **`simulated-reader.ts`** - button/typed-input driven, no hardware,
  works everywhere including Expo Go. Still the default mode.
- **`usb-serial-reader.ts`** - the real-hardware path. Talks to a UHF
  reader over USB via Android's USB Host mode (an OTG cable), using
  [`react-native-usb-serialport-for-android`](https://github.com/tofugear/react-native-usb-serialport-for-android).
  Same isolated-placeholder pattern as `serial_reader.py` and
  `web-serial-reader.ts`: the transport (listing devices, requesting
  permission, opening the port, reading data) is fully built; the
  reader-specific protocol (`sendStartupCommands`,
  `parseTagFromFrame`) is a placeholder until a reader model and its
  datasheet are in hand.

## Real constraints worth knowing

- **Android only.** iOS doesn't allow generic USB-serial access to
  third-party apps without MFi hardware certification - not realistic
  for this project. A phone's built-in NFC also cannot substitute for
  this: NFC and long-range UHF RFID are different radio technologies
  entirely (NFC's range is centimeters by design), so there's no
  software path that makes a phone's own NFC chip read these tags.
- **Needs a USB OTG cable/adapter** between the phone and the reader.
- **No longer usable in Expo Go, on any platform, for any screen.**
  Adding `react-native-usb-serialport-for-android` as a native
  dependency means the whole app now needs a dev-client build - Expo
  Go can only run apps built from its fixed set of built-in native
  modules. From here on, use:
  ```powershell
  npx eas-cli build --platform android --profile development
  ```
  (the `development` profile in `eas.json` already has
  `developmentClient: true` set up for exactly this.)
- **Untested against real hardware.** `usb-serial-reader.ts` is
  written directly against the library's documented JS API
  (`UsbSerialManager.list/tryRequestPermission/open`,
  `UsbSerial.send/close/onReceived`), and a development-client build
  was used to confirm it compiles and links correctly - but there's no
  physical Android device + OTG cable + real reader available to
  verify actual on-device behavior (permission dialogs, real data
  flow) in this environment. Treat it as a solid starting point that
  still needs verifying on real hardware, not as confirmed-working.

## What's still unconfirmed (per the architecture doc itself)

The doc's own "Items to Confirm" section lists these as open - they
block `usb-serial-reader.ts`'s two placeholder methods specifically,
not the rest of the app:

- Exact reader model and antenna configuration
- The reader's communication protocol and the commands needed to get
  EPC data out of it
- Required read range and physical detection setup

Everything else (registration, exit-scan logic, Supabase writes, the
Scan screen itself) works today in Simulated mode and doesn't change
once these are answered - only the two placeholder methods do.
