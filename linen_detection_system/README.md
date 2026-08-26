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
  Selected** to change an already-registered item instead.
- Scan as many items as you like - they all wait in the pending list.
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
  background thread. **The actual protocol - how to interpret the raw
  bytes a specific reader model sends - is deliberately left as a
  placeholder**, isolated in two clearly marked methods:
  - `_send_startup_commands()` - some readers need a command sent
    before they start streaming tag reads; this is a no-op until
    filled in.
  - `_parse_tag_from_frame()` - turns one raw frame of bytes into a
    Tag ID string. The placeholder assumes plain newline-delimited
    ASCII text, which works for simple modules but not typical UHF
    readers (binary frames, checksums, multiple tags per burst, etc).

  **Once a reader model is chosen, only these two methods need to be
  rewritten** - the port-opening, threading, and everything else in
  `main.py` stays exactly as-is.
- `hardware/reader_factory.py` reads `hardware_config.json` and builds
  a `SimulatedReader` or `SerialRFIDReader` for each role accordingly.

**Switching a checkpoint to real hardware:**

1. Copy `hardware_config.example.json` to `hardware_config.json` if
   you haven't already.
2. Set the role's `type` to `"serial"` and fill in its COM port (check
   Windows Device Manager once the reader is plugged in) and baud rate:

   ```json
   {
     "entry_reader": { "type": "simulated" },
     "exit_reader": {
       "type": "serial",
       "port": "COM3",
       "baud_rate": 115200
     }
   }
   ```

3. `pip install -r requirements.txt` if you haven't already run it
   since `pyserial` was added.
4. Fill in `_send_startup_commands()` and `_parse_tag_from_frame()` in
   `hardware/serial_reader.py` per your reader's protocol datasheet.
5. Run the app. A reader set to `"serial"` scans automatically in the
   background - its GUI control (the Scan button or exit field) shows
   a message instead of acting, since manual input only applies in
   simulated mode.

`hardware_config.json` is machine-specific (COM ports differ per PC),
so like the other config files it's listed in `.gitignore` and never
committed - only `hardware_config.example.json` is. A missing
`hardware_config.json` is not an error - it just means both
checkpoints stay simulated, same as before this layer existed.

**Known open question, not yet decided:** a real UHF tag typically only
carries a Tag ID (its EPC) - not a human-readable item type like
"Bath Towel". `main.py`'s `_resolve_item_type()` is a placeholder that
currently guesses randomly, same as the old fully-simulated behavior.
Once real tags are in use, this needs a real answer - most likely
either a dropdown for staff to pick the type at registration time, or
a separate tag_id → item_type lookup maintained elsewhere.

## Current status

Everything described above is implemented and working:

- **models.py** - defines `LinenItem` (with status)
- **database.py** - reads/writes linen items via Supabase
- **main.py** - scan / batch-assign / status / exit-scan GUI, wired to
  the hardware layer below rather than generating scans itself
- **hardware/** - RFID reader abstraction (see **Hardware setup**
  above); both checkpoints run in simulated mode by default, with the
  serial transport built out and ready for a real reader once one is
  chosen - only its protocol parsing is still a placeholder
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
- Picking a real UHF reader model and filling in
  `hardware/serial_reader.py`'s two placeholder methods (see
  **Hardware setup**) - this is the one piece intentionally left
  undone until a reader is chosen
- Deciding how item type is determined from a real tag (dropdown at
  registration vs. a tag_id → item_type lookup - see **Hardware
  setup**'s open question)
- Real push notifications on mobile (needs an EAS development build +
  Apple Developer account - see the mobile app's README)
- Getting the actual alert details (item/room/customer) into the
  WhatsApp message itself, instead of a fixed generic template - see
  the content limitation in **WhatsApp alerts setup**
- A history/log view of past (not just active) theft alerts