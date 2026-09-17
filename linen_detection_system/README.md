# Linen RFID Detection System

A Python project for detecting stolen linen items (towels, sheets, etc.)
using RFID tags. There's no physical RFID reader wired in yet - scanning
defaults to simulated buttons in a pop-up window - but the app is built
around a generic hardware abstraction (see **Hardware setup** below) so a
real serial UHF reader can be plugged in later without touching the rest
of the app. Theft alerts show up as both an on-screen warning and a
WhatsApp message to your phone. Data is stored in a shared Supabase
database, so the same items are visible from this desktop app and the
mobile companion app.

## Project structure

```
linen_detection_system/
├── main.py                       # Program entry point - opens the GUI window
├── database.py                   # Saves/reads linen items via the Supabase database
├── detector.py                   # Theft-detection logic (exit-scan rule)
├── alarm.py                      # Pop-up + WhatsApp alerts for flagged scans
├── models.py                     # Defines data structures (currently: LinenItem)
├── hardware/                     # RFID reader abstraction - see "Hardware setup" below
│   ├── base.py                   # RFIDReader interface every reader implements
│   ├── simulated_reader.py       # Button/typed-input driven fake reader (today's default)
│   ├── serial_reader.py          # Generic serial transport + isolated protocol placeholder
│   └── reader_factory.py         # Builds the right reader per role from hardware_config.json
├── requirements.txt              # Python package dependencies
├── whatsapp_config.json          # Your real Twilio credentials (not committed)
├── whatsapp_config.example.json  # Template showing the expected format
├── supabase_config.json          # Your real Supabase project URL + key (not committed)
├── supabase_config.example.json  # Template showing the expected format
├── hardware_config.json          # Your real reader config, per checkpoint (not committed)
├── hardware_config.example.json  # Template showing the expected format
├── .gitignore                    # Keeps the real config files above out of git
└── README.md                     # This file
```

## Requirements

- Python 3.12 or newer
- `tkinter` (included with the standard Windows Python installer - no
  separate install needed)
- The `supabase` package (see `requirements.txt`) - install with:

  ```powershell
  pip install -r requirements.txt
  ```

- WhatsApp alerts use only Python's built-in `urllib`/`base64`, no
  extra package needed there.

## How to run (PowerShell)

1. Open PowerShell and move into the project folder:

   ```powershell
   cd "linen_detection_system"
   ```

2. Run the program:

   ```powershell
   python main.py
   ```

   (If `python` doesn't work, try `py` instead, e.g. `py main.py`.)

3. A window titled "Linen RFID Detection System" will pop up.

## Expected behavior

**Operator Name (for the audit trail):** an optional text field at the
top of the window. This app has no login screen (see **Supabase
setup** below - it authenticates as `service_role`, not as a specific
person), so there's no automatic "who" the way the mobile/web apps get
from a signed-in session. Type a name here and it's attached to every
action taken from this window (registering, editing, changing status,
deleting, triggering an alert) in the `linen_item_events` audit trail
- leave it blank and those events just record no actor. See the mobile
app's README ("Audit trail (who did what, and when)") for the full
setup and what gets logged where.

**Registering items (scan + batch save):**
- Pick an **Item Type** first - a real UHF tag only carries an ID, not
  what the item actually is, so this is what tells the app that (and
  is the only thing sorting a tag into a category actually requires).
- Use the **Scan / type Tag ID** field for an actual USB RFID reader -
  the "keyboard wedge" kind that just types the tag ID and presses
  Enter, no COM port or configuration needed (this is the first reader
  type this app supports for real - see **Hardware setup** below).
  Click into the field once so it has focus, then scan away; it clears
  and refocuses itself after each tag, and a tag still sitting in
  range - which a real reader reads many times a second, not once -
  only gets added to the pending list the first time, not once per
  read. No reader on hand? Type a Tag ID by hand and press Enter -
  same field, same result.
- **A tag that's already registered can't be registered again** -
  scanning one shows its current status in the status line instead of
  adding it to the pending list. Re-registering it would silently
  overwrite its existing customer/room/status (saving is an upsert
  keyed by Tag ID), so the same physical tag can't end up belonging to
  two different registrations. Use **Assign to Guest** or **Edit
  Selected** to change an already-registered item instead. This check
  runs against a local, in-memory copy of what's registered (kept in
  sync every time the Saved Items table refreshes) rather than a fresh
  database lookup on every single scan - with a real reader flooding
  reads during a batch, that per-scan network round-trip was the
  actual limit on how fast you could move through a stack of items.
  Because that local copy can still be a few seconds stale (another
  device registering the same tag in the meantime), clicking **Save**
  re-checks the whole pending batch against the database in one go
  first, and quietly skips anything that turns out to already be
  registered rather than overwriting it - see `database.get_items_by_tags()`.
- Scan as many items as you like - they all wait in the pending list,
  with a live **Pending Items: N scanned** count above it so a fast
  run of scans is visibly being captured, not just silently queued.
- **Customer Name** and **Room Number** are optional. Click **Save**
  with them blank to register the pending tags as unassigned stock -
  sorted into a category by Item Type alone, status **Storage** - and
  attach a guest to them later. Fill them in first to also assign a
  guest in this same step, same as this always used to work; either
  way the pending list clears and the items show up in the **Saved
  Items** table.

**Assign to Guest (already-registered tags):** a separate section, batch
like the Save section above, for attaching one Customer Name + Room
Number to any number of tags that are already in the database - either
stock that was registered without one above, or items being handed to
a different guest than before. Scan or type a Tag ID and click **Add**
(or press Enter) to queue it - repeat for as many tags as this guest
is getting - then fill in Customer Name + Room Number and click
**Assign to Guest** to apply both to everything queued at once. Flips
each item's status to **In Use**. Scanning a tag that isn't registered
yet tells you instead of guessing - register it above first.

**Item status:**
- Every saved item has a status shown in the Saved Items table:
  - **In Use** - currently with a customer
  - **Laundry** - picked up and currently being washed
  - **Storage** - stored, not currently with any customer (also what
    a newly-registered, not-yet-assigned tag starts as)
- Select a row and click **Mark In Use** / **Mark Laundry** / **Mark
  Storage** to switch its status.

**Exit scanner (theft detection):**
- Type or scan a Tag ID into the **Exit Scanner** box and press Enter
  (or click **Simulate Exit Scan**) - same real-reader-or-typed-by-hand
  field as the entry side.
- `detector.py`'s rule: a scan is flagged as a possible theft only if
  the tag is **registered** and its status is anything other than
  **Laundry** or **Storage** (in practice, that means **In Use**). An
  **unregistered tag is never flagged by itself** - not every item is
  necessarily tagged in the system yet, and other RFID-bearing things
  (a room key card, someone's own tag) can pass the exit reader without
  it meaning anything.
- A flagged scan triggers `alarm.py`:
  - An on-screen "⚠ THEFT ALERT ⚠" pop-up with the item's details
  - A matching WhatsApp message sent to your phone via Twilio
- A real reader reads the same tag many times a second for as long as
  it's in range - a 5-second cooldown per tag
  (`RESCAN_COOLDOWN_SECONDS` in `main.py`) means one tag walking past
  only triggers the alarm once, not once per read.
- Beyond that cooldown, a tag with an alert already active (not yet
  dismissed) doesn't raise a second one either - re-scanning it, or a
  reader that keeps seeing it well past the cooldown, won't spam more
  alerts for the same event (`database.has_active_alert()`). Dismiss
  the existing alert from the mobile app or web dashboard (desktop
  itself has no dismiss button - `theft_alerts` is shared across all
  three apps) to let the next flagged scan raise a new one.

Close the window to exit the program.

## Supabase setup

This app reads and writes to `linen_items` and `theft_alerts` tables
in a Supabase project, shared with the mobile companion app. To set
this up (or re-set it up on another machine):

1. Create a project at [supabase.com](https://supabase.com) if you
   haven't already, and create a `linen_items` table with columns:
   `tag_id` (text, primary key), `customer_name` (text), `room_number`
   (text), `item_type` (text), `status` (text). See the mobile app's
   README for the `theft_alerts` table schema.
2. **Row Level Security is enabled** on both tables, requiring a
   logged-in Supabase Auth session (`auth.uid() is not null`) - this
   is what keeps the mobile app's data private to logged-in users.
   This desktop app doesn't have its own login screen, so instead of
   authenticating, it uses Supabase's **service_role** key, which
   bypasses RLS entirely. That's appropriate for a trusted internal
   tool like this one, but **treat that key as a real secret** - it
   grants full, unrestricted database access, unlike the publishable
   key the mobile app uses.
3. In your Supabase project, go to **Settings → API** and copy the
   **Project URL** and the **service_role** key (click "reveal" - it's
   hidden by default).
4. Copy `supabase_config.example.json` to `supabase_config.json` and
   fill in your real values:

   ```json
   {
     "url": "https://your-project-ref.supabase.co",
     "service_role_key": "eyJ..."
   }
   ```

`supabase_config.json` is listed in `.gitignore` so it's never
committed - only `supabase_config.example.json` (with placeholder
values) is meant to be shared/committed. Handle this file with the
same care as `whatsapp_config.json`.

If `supabase_config.json` is missing or the connection fails, the app
shows a clear pop-up on startup explaining the problem instead of
crashing with a raw error.

## WhatsApp alerts setup

Theft alerts are sent to your phone through Twilio's **WhatsApp
Sandbox** - a free tier meant for personal/development use, not for
messaging your own guests or customers (it only reaches numbers that
have explicitly joined your sandbox). To set this up:

1. Create a free account at [twilio.com](https://www.twilio.com).
2. In the Twilio Console, go to **Messaging → Try it out → Send a
   WhatsApp message** to activate the sandbox. You'll be given a
   Twilio phone number and a join code that looks like
   `join <two-words>`.
3. From the phone that should receive alerts, send that exact join
   code as a WhatsApp message to the sandbox number shown. Twilio
   confirms once it's joined - this step only needs doing once per
   phone number, but sandbox sessions can expire after a period of
   inactivity, at which point you'll need to rejoin.
4. From the Twilio Console's dashboard, copy your **Account SID** and
   **Auth Token** (**Account → API keys & tokens**, or right on the
   main Console homepage).
5. Copy `whatsapp_config.example.json` to `whatsapp_config.json` and
   fill in your real values:

   ```json
   {
     "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
     "auth_token": "your_twilio_auth_token",
     "from_number": "whatsapp:+14155238886",
     "to_number": "whatsapp:+10000000000"
   }
   ```

   `from_number` is Twilio's sandbox number - **don't assume it's the
   commonly-documented `+14155238886`, confirm it in your own Console**;
   Twilio can assign a different sandbox number per account/region (a
   real gotcha that cost real debugging time getting this working -
   ours turned out to be a `+1737...` number, not the usual one).
   `to_number` is the phone that joined the sandbox in step 3, in
   international format with a `whatsapp:` prefix, e.g.
   `whatsapp:+15551234567`.

`whatsapp_config.json` is listed in `.gitignore` so it's never
committed alongside source code - only `whatsapp_config.example.json`
(with placeholder values) is meant to be shared/committed.

If `whatsapp_config.json` is missing or invalid, `alarm.py` just prints
a warning and skips the WhatsApp message - the on-screen pop-up still
works either way.

**Confirmed working, but with a real content limitation worth knowing
up front.** Twilio's WhatsApp Sandbox rejects free-form message text
entirely (error `21654: ContentSid Required`) - not just outside the
usual "24 hours since the user last messaged you" WhatsApp rule, it
rejected it consistently even right after rejoining the sandbox. The
fix that actually works: send one of Twilio's 3 built-in sandbox
Content Templates instead of custom text. `alarm.py` uses the
"Appointment Reminders" template's Content SID
(`WHATSAPP_TEMPLATE_CONTENT_SID` near the top of the file) -
**its wording is fixed** ("Reminder: Appt Tue Oct 29..."), not the
actual alert details, because:
- Trial accounts can't use Twilio's Content API to inspect or edit
  templates (`"This feature is not available on a Trial account"`),
  so there's no way to see or change what variables (if any) it
  accepts from a Trial account.
- Passing `ContentVariables` to try to fill in custom text had no
  effect on this particular template - it appears to be fully static.

**In practice this means WhatsApp becomes a "something happened, go
check the app" ping, not a message with the actual item/room/customer
details** - those are already fully visible in the desktop, mobile, and
web apps the moment you open any of them. The full alert text is still
printed to the terminal (`[WhatsApp alert - full text below...]`) for
anyone watching the desktop app directly. If you want the real details
in the WhatsApp message itself, either check Twilio's other 2 sandbox
templates ("Order Notifications", "Verification Codes") for one with a
usable variable, or upgrade past the Trial tier to create a real custom
template through Content Template Builder.

**Sandbox limits worth knowing:** only reaches numbers that have
joined via the join code, sessions can expire and need rejoining, and
this isn't the path to messaging guests/customers directly - that
would need the full WhatsApp Business Platform (Meta business
verification + approved message templates + per-message cost),
deliberately not set up here to keep this simple.

## Hardware setup

There are two RFID checkpoints in this app - an **entry reader** (used
when registering new items) and an **exit reader** (used for theft
detection) - and each is built on the same `hardware/` abstraction, so
either one can be simulated or a real serial reader independently of
the other.

**If your reader is a USB "keyboard wedge" scanner** (types the tag ID
and presses Enter, shows up as a keyboard to Windows, no COM port) -
you don't need anything below this. That kind of reader already works
today through the **Scan / type Tag ID** field (registering) and the
**Exit Scanner** field (theft detection) - just click into whichever
field so it has focus, then scan. Everything below is for a reader
that instead talks over a real serial port, which needs the setup
(and the still-unwritten protocol parsing) described here.

**A keyboard-wedge reader in continuous-inventory mode can drop the
Enter keystroke between two very fast back-to-back reads** - confirmed
happening in practice, not just a theoretical risk - which lands as
one long string that's actually two (or more) tag IDs glued together
with no separator. `hardware/base.py`'s `push()` recovers from this:
a read that's all hex characters and an exact multiple of 24 (the
fixed length of this hardware's tag IDs) gets split back into
individual tag IDs before anything else sees it, since every reader
implementation funnels through `push()` rather than touching the
queue directly. A read that doesn't match that exact pattern is passed
through unchanged - a barcode, a different tag format, or someone
typing something else into the field is never mangled.

**How it's structured:**

- `hardware/base.py` defines the `RFIDReader` interface every reader
  implements: `connect()`, `disconnect()`, `start()`, `stop()`, and
  `poll()`. `main.py` only ever talks to this interface - it doesn't
  know or care whether a given reader is simulated or real.
- `hardware/simulated_reader.py` is what both checkpoints use by
  default. It's driven directly by the GUI - the "Scan / type Tag ID"
  and exit scanner fields - rather than any hardware, which is also
  how a real keyboard-wedge reader reaches the app (see the note
  above).
- `hardware/serial_reader.py` is the real-hardware path: a generic
  serial (COM port) transport that opens the port and reads it on a
  background thread.
- `hardware/uhfreader18_protocol.py` is the actual reader protocol -
  the MS9 package's RD905UW, which speaks the "UHFReader18" binary
  frame protocol (`Len|Adr|Cmd|Data[]|CRC16`) over RS232, RS485, or
  TCP. It's a pure, hardware-free module (no serial/socket code at
  all) that builds command frames and parses response frames -
  `serial_reader.py` is the only thing that calls into it. See its
  module docstring for the exact frame layout and which manual
  sections it's built from.

  The RD905UW is factory-fixed to **Answer Mode**: it never streams
  data on its own, so `serial_reader.py`'s read loop sends an
  Inventory command and reads back exactly one response every cycle,
  rather than passively listening (see `_poll_once()`). `connect()`
  also sends a one-off Get Reader Information request as a
  self-test - if the reply doesn't parse as a real UHFReader18-protocol
  response (wrong COM port, wrong baud rate, a different device
  entirely), it fails immediately with a clear message instead of
  silently polling a connection that will never produce a tag read.
- `hardware/reader_factory.py` reads `hardware_config.json` and builds
  a `SimulatedReader` or `SerialRFIDReader` for each role accordingly.

**Verifying the protocol implementation (no reader or adapter needed):**

```
pip install -r requirements-dev.txt
python -m pytest -v
```

(Use `python -m pytest`, not a bare `pytest` - pip installs `pytest.exe`
into a `Scripts\` directory that isn't on PATH by default on this
machine, so the bare command gives "pytest is not recognized". The
`-m` form doesn't depend on PATH at all.)

`tests/test_uhfreader18_protocol.py` checks the CRC-16 and frame
parsing against a real frame captured straight from the MS9 package's
own config guides (not just against the algorithm description), plus
edge cases (no tag in range, multiple tags in one read, corrupted CRC,
truncated data, wrong reader responding). `tests/test_serial_reader.py`
drives `SerialRFIDReader` against a fake stand-in for the serial port
to verify the actual write-command/read-response wiring.
`tests/test_socket_integration.py` goes one layer further and uses
**real pyserial I/O** over a real socket (see below). Re-run all of it
any time - after touching either file, or once real hardware is
connected, as a fast sanity check before troubleshooting further.

**Running the whole app against a fake reader (no hardware at all):**

`tools/fake_rd905uw.py` impersonates the physical reader, speaking the
real UHFReader18 protocol over a TCP socket - so the entire app (GUI,
detector, database, alerts, mobile app) can be exercised end to end
with tag reads you control by typing. It validates the CRC of every
command the app sends, so it catches malformed frames exactly as real
hardware would.

1. In one terminal:

   ```
   python tools/fake_rd905uw.py
   ```

2. Point a checkpoint at it in `hardware_config.json` - note the
   `socket://` URL in place of a COM port:

   ```json
   {
     "entry_reader": { "type": "simulated" },
     "exit_reader": { "type": "serial", "port": "socket://127.0.0.1:5000" }
   }
   ```

3. In another terminal, run the app as usual (`python main.py`). Watch
   for the `[exit_reader] Connected: reader firmware v2.36...` line.

4. Back in the fake reader's terminal, type a tag ID and press Enter to
   put it "in range"; type it again to take it away. `list`, `clear`
   and `quit` also work. Whatever is in range gets reported to the app
   on its next poll, exactly as a real tag sitting in the reader's
   field would be.

This works because `connect()` uses pyserial's `serial_for_url()`, so a
port can be a plain COM name *or* a pyserial URL. The same mechanism
would let the RD905UW's optional RJ45/TCP interface be used instead of
RS485 (`"port": "socket://192.168.1.192:6000"`).

**Switching a checkpoint to real hardware:**

1. Copy `hardware_config.example.json` to `hardware_config.json` if
   you haven't already.
2. Set the role's `type` to `"serial"` and fill in its COM port (check
   Windows Device Manager once the reader/adapter is plugged in).
   Everything except `port` has a sensible default and can be omitted:

   ```json
   {
     "entry_reader": { "type": "simulated" },
     "exit_reader": {
       "type": "serial",
       "port": "COM3",
       "baud_rate": 57600,
       "address": 0,
       "poll_interval": 0.2
     }
   }
   ```

   | Key | Default | What it's for |
   |---|---|---|
   | `port` | *(required)* | COM port, e.g. `"COM3"` |
   | `baud_rate` | `57600` | The RD905UW's documented default |
   | `address` | `0` | Reader address - only matters if several readers share one RS485 bus |
   | `poll_interval` | `0.2` | Seconds between reads. Don't set this to 0 - the reader answers instantly whenever a tag is in range, so an unpaced loop hammers the bus and floods the queue (see `serial_reader.py`) |

3. `pip install -r requirements.txt` if you haven't already run it
   since `pyserial` was added.
4. Run the app. A reader set to `"serial"` scans automatically in the
   background - its GUI control (the Scan button or exit field) shows
   a message instead of acting, since manual input only applies in
   simulated mode. If it can't connect, a warning dialog shows exactly
   why (wrong port, wrong baud, no response) instead of the app
   crashing or silently doing nothing.

`hardware_config.json` is machine-specific (COM ports differ per PC),
so like the other config files it's listed in `.gitignore` and never
committed - only `hardware_config.example.json` is. A missing
`hardware_config.json` is not an error - it just means both
checkpoints stay simulated, same as before this layer existed.

**If `"serial"` doesn't work - a third reader type, `"uhfreader18_dll"`:**

The real reader unit this was actually tested against (firmware v5.2,
reporting reader type `0x86`) **rejects** the plain Inventory command
that `serial_reader.py`/`uhfreader18_protocol.py` sends, with status
`0xFE` ("illegal command") - confirmed to be a genuine incompatibility
with this specific unit, not a bug here: the vendor's own **64-bit**
`UHFReader18.dll` fails identically against it. Only the vendor's
**32-bit** DLL build actually works (confirmed reading 100+ real tags
correctly, both via the vendor's own demo software and via this app).

A 32-bit DLL can't be loaded into this app's 64-bit Python process via
`ctypes`, and this app's other dependencies (`supabase`, etc.) don't
have straightforward 32-bit Windows wheels - building `cryptography`
from source for 32-bit Windows fails outright (a Rust/MSVC linker
issue, `/SAFESEH` incompatibility). So rather than forcing the whole
app onto 32-bit Python, `hardware/dll_bridge_reader.py` launches a
tiny, dependency-free helper (`hardware/vendor/dll_bridge.py`) as a
**subprocess** under a separate 32-bit Python interpreter, and reads
tag EPCs from its stdout, one per line. Everything else (the GUI,
Supabase, the audit trail) stays on the app's normal 64-bit Python -
this is the only piece that needs to be 32-bit, and it's isolated to
its own process.

If your reader unit works fine with the plain `"serial"` type above,
you don't need any of this - it's specifically for units that hit the
same `0xFE` wall this one did.

1. Install a 32-bit Python interpreter (separate from the one running
   the app):
   ```
   winget install --id Python.Python.3.11 --architecture x86
   ```
2. Set the role's `type` to `"uhfreader18_dll"` and fill in its COM
   port number (as an int, not a string):
   ```json
   {
     "entry_reader": { "type": "simulated" },
     "exit_reader": {
       "type": "uhfreader18_dll",
       "port": 5,
       "baud_rate": 57600,
       "address": 255,
       "python32_path": "C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python311-32\\python.exe"
     }
   }
   ```

   | Key | Default | What it's for |
   |---|---|---|
   | `port` | *(required)* | COM port **number** (`5` for COM5), not a string |
   | `baud_rate` | `57600` | Same default as `"serial"` |
   | `address` | `255` (0xFF, broadcast) | Works regardless of the unit's actual configured address - the vendor's own demo software defaults to this for the same reason |
   | `python32_path` | the path `winget` installs to above | Only needed if your 32-bit Python ended up somewhere else |

3. `hardware/vendor/UHFReader18_x86.dll` is already bundled in this
   repo (copied from a working demo install) - nothing else to
   install for the bridge script itself, since it has zero
   dependencies beyond the Python standard library.
4. Run the app as usual. Watch for
   `[exit_reader] Connected via DLL bridge: firmware v5.2, type 0x86, ...`
   instead of the plain `Connected:` line `"serial"` prints.

**How item type is determined:** a real UHF tag only carries a Tag ID
(its EPC), not a human-readable type like "Bath Towel". That's
resolved by having staff pick the type at registration time: the
**Item Type** dropdown next to the scan field (`ITEM_TYPES` in
`main.py`) is read whenever a tag is scanned in, so each pending item
carries the type that was selected when it was scanned. Nothing needs
to be encoded on the tag itself.

## Current status

Everything described above is implemented and working:

- **models.py** - defines `LinenItem` (with status)
- **database.py** - reads/writes linen items via Supabase
- **main.py** - scan / batch-assign / status / exit-scan GUI, wired to
  the hardware layer below rather than generating scans itself
- **hardware/** - RFID reader abstraction (see **Hardware setup**
  above); both checkpoints run in simulated mode by default.
  `uhfreader18_protocol.py` implements the RD905UW/UHFReader18 wire
  protocol and is covered by `tests/` (verified against a real
  captured frame from the MS9 docs); `serial_reader.py` wires it up to
  an actual COM port. Now verified end to end against real physical
  hardware over a real USB-to-RS485 adapter - a full register → hold
  a real tag at the exit → alarm → `theft_alerts` row pass, using the
  `dll_bridge_reader.py` path (see **If "serial" doesn't work** above)
  since this specific unit doesn't accept `serial_reader.py`'s plain
  Inventory command
- **detector.py** - flags exit scans based on registration + status
- **alarm.py** - pop-up warning + WhatsApp notification, confirmed
  delivering via Twilio's WhatsApp Sandbox (a fixed-content template,
  not the actual alert details - see **WhatsApp alerts setup**)
- **Audit trail** - every registration, edit, status change, deletion,
  and alert trigger writes a row to `linen_item_events`, tagged with
  the typed Operator Name if one was given - see the mobile app's
  README for the full setup and the web dashboard's Activity page for
  where to view it

The mobile companion app (`linen-mobile-app-v2`) shares the same
Supabase tables for live viewing (Home stats, rooms/categories, and
theft alerts synced in real time via Supabase Realtime).

Possible next steps:
- Confirming `hardware/uhfreader18_protocol.py` and
  `hardware/serial_reader.py` against the physical RD905UW once the
  RS485-to-USB adapter arrives - everything so far is verified against
  the documented protocol and a real captured frame (`tests/`), but not
  yet against the actual reader hardware
- Deciding how item type is determined from a real tag (dropdown at
  registration vs. a tag_id → item_type lookup - see **Hardware
  setup**'s open question)
- Real push notifications on mobile (needs an EAS development build +
  Apple Developer account - see the mobile app's README)
- Getting the actual alert details (item/room/customer) into the
  WhatsApp message itself, instead of a fixed generic template - see
  the content limitation in **WhatsApp alerts setup**
- A history/log view of past (not just active) theft alerts