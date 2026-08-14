# Linen RFID Detection System

A Python project for detecting stolen linen items (towels, sheets, etc.)
using RFID tags. There's no physical RFID reader wired in yet - scanning
defaults to simulated buttons in a pop-up window - but the app is built
around a generic hardware abstraction (see **Hardware setup** below) so a
real serial UHF reader can be plugged in later without touching the rest
of the app. Theft alerts show up as both an on-screen warning and a
Telegram message to your phone. Data is stored in a shared Supabase
database, so the same items are visible from this desktop app and the
mobile companion app.

## Project structure

```
linen_detection_system/
├── main.py                       # Program entry point - opens the GUI window
├── database.py                   # Saves/reads linen items via the Supabase database
├── detector.py                   # Theft-detection logic (exit-scan rule)
├── alarm.py                      # Pop-up + Telegram alerts for flagged scans
├── models.py                     # Defines data structures (currently: LinenItem)
├── hardware/                     # RFID reader abstraction - see "Hardware setup" below
│   ├── base.py                   # RFIDReader interface every reader implements
│   ├── simulated_reader.py       # Button/typed-input driven fake reader (today's default)
│   ├── serial_reader.py          # Generic serial transport + isolated protocol placeholder
│   └── reader_factory.py         # Builds the right reader per role from hardware_config.json
├── requirements.txt              # Python package dependencies
├── telegram_config.json          # Your real Telegram bot token + chat ID (not committed)
├── telegram_config.example.json  # Template showing the expected format
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

- Telegram alerts use only Python's built-in `urllib`, no extra package
  needed there.

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

**Registering items (scan + batch assign):**
- Click **Scan (Simulated)** to simulate an RFID reader picking up a tag.
  Each click adds a random Tag ID + Item Type to the **Pending Items**
  table (as if the tag itself already encodes both).
- Scan as many items as you like - they all wait in the pending list.
- Type a **Customer Name** and **Room Number**, then click **Assign** to
  apply those details to *every* pending item at once and save them all
  to the database. The pending list clears and the items show up in the
  **Saved Items** table at the bottom, with a status of **In Use**.

**Item status:**
- Every saved item has a status shown in the Saved Items table:
  - **In Use** - currently with a customer (the default when assigned)
  - **Laundry** - picked up and currently being washed
  - **Storage** - stored, not currently with any customer
- Select a row and click **Mark In Use** / **Mark Laundry** / **Mark
  Storage** to switch its status.

**Exit scanner (theft detection):**
- Type a Tag ID into the **Exit Scanner** box and press Enter (or click
  **Simulate Exit Scan**) to simulate that tag passing the exit reader.
- `detector.py`'s rule: a scan is flagged as a possible theft if the tag
  isn't registered at all, or if the matching item's status is **In
  Use**. Items marked **Laundry** or **Storage** pass through without an
  alert (treated as normal staff movement, not a customer walking off
  with something).
- A flagged scan triggers `alarm.py`:
  - An on-screen "⚠ THEFT ALERT ⚠" pop-up with the item's details
  - A matching message sent to your phone via your Telegram bot

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
same care as `telegram_config.json`.

If `supabase_config.json` is missing or the connection fails, the app
shows a clear pop-up on startup explaining the problem instead of
crashing with a raw error.

## Telegram alerts setup

Theft alerts are sent to your phone through a Telegram bot you create
and control. To set this up (or re-set it up, e.g. after regenerating
your bot token):

1. In Telegram, message **@BotFather**, send `/newbot`, and follow the
   prompts to get a bot token (looks like `123456:ABC-...`).
2. Search for your new bot by its username and send it any message
   (e.g. "hi") so it's allowed to message you back.
3. Find your chat ID by visiting this URL in a browser (with your token
   filled in) right after messaging the bot:
   `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   Look for `"chat":{"id": ...}` in the response - that number is your
   chat ID.
4. Copy `telegram_config.example.json` to `telegram_config.json` and
   fill in your real `bot_token` and `chat_id`:

   ```json
   {
     "bot_token": "123456:ABC-your-real-token",
     "chat_id": "111222333"
   }
   ```

`telegram_config.json` is listed in `.gitignore` so it's never committed
alongside source code - only `telegram_config.example.json` (with
placeholder values) is meant to be shared/committed.

If `telegram_config.json` is missing or invalid, `alarm.py` just prints
a warning and skips the Telegram message - the on-screen pop-up still
works either way.

## Hardware setup

There are two RFID checkpoints in this app - an **entry reader** (used
when registering new items) and an **exit reader** (used for theft
detection) - and each is built on the same `hardware/` abstraction, so
either one can be simulated or a real serial reader independently of
the other.

**How it's structured:**

- `hardware/base.py` defines the `RFIDReader` interface every reader
  implements: `connect()`, `disconnect()`, `start()`, `stop()`, and
  `poll()`. `main.py` only ever talks to this interface - it doesn't
  know or care whether a given reader is simulated or real.
- `hardware/simulated_reader.py` is what both checkpoints use today.
  It's driven directly by the GUI (the "Scan (Simulated)" button and
  the exit scanner's typed Tag ID field) rather than any hardware.
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
- **alarm.py** - pop-up warning + Telegram notification

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
- A real WhatsApp notification channel (bigger project - needs the
  WhatsApp Business API or a paid provider like Twilio)
- A history/log view of past (not just active) theft alerts