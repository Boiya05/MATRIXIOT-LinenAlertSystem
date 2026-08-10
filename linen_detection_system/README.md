# Linen RFID Detection System

A Python project for detecting stolen linen items (towels, sheets, etc.)
using RFID tags. This early version has no physical RFID hardware -
scanning is simulated with buttons in a pop-up window, and theft alerts
show up as both an on-screen warning and a Telegram message to your phone.
Data is stored in a shared Supabase database, so the same items are
visible from this desktop app and the mobile companion app.

## Project structure

```
linen_detection_system/
├── main.py                       # Program entry point - opens the GUI window
├── database.py                   # Saves/reads linen items via the Supabase database
├── detector.py                   # Theft-detection logic (exit-scan rule)
├── alarm.py                      # Pop-up + Telegram alerts for flagged scans
├── models.py                     # Defines data structures (currently: LinenItem)
├── requirements.txt              # Python package dependencies
├── telegram_config.json          # Your real Telegram bot token + chat ID (not committed)
├── telegram_config.example.json  # Template showing the expected format
├── supabase_config.json          # Your real Supabase project URL + key (not committed)
├── supabase_config.example.json  # Template showing the expected format
├── .gitignore                    # Keeps the two files above out of git
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

This app reads and writes to a `linen_items` table in a Supabase
project, shared with the mobile companion app. To set this up (or
re-set it up on another machine):

1. Create a project at [supabase.com](https://supabase.com) if you
   haven't already, and create a `linen_items` table with columns:
   `tag_id` (text, primary key), `customer_name` (text), `room_number`
   (text), `item_type` (text), `status` (text).
2. Make sure **Row Level Security is disabled** on that table (Table
   Editor → the table → RLS toggle) - this is a personal single-user
   tool, so the simplest setup is used rather than writing RLS
   policies. If RLS is left on with no policies, every request will
   silently fail with a permissions error even with correct credentials.
3. In your Supabase project, go to **Settings → API** and copy the
   **Project URL** and **anon public** (a.k.a. "publishable") key.
4. Copy `supabase_config.example.json` to `supabase_config.json` and
   fill in your real values:

   ```json
   {
     "url": "https://your-project-ref.supabase.co",
     "key": "sb_publishable_..."
   }
   ```

`supabase_config.json` is listed in `.gitignore` so it's never
committed - only `supabase_config.example.json` (with placeholder
values) is meant to be shared/committed. Unlike the Telegram bot
token, the publishable key is designed to be embedded in client apps -
the real access control is the RLS setting above, not the key's
secrecy.

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

## Current status

Everything described above is implemented and working:

- **models.py** - defines `LinenItem` (with status)
- **database.py** - reads/writes linen items via Supabase
- **main.py** - scan / batch-assign / status / exit-scan GUI
- **detector.py** - flags exit scans based on registration + status
- **alarm.py** - pop-up warning + Telegram notification

The mobile companion app (`linen-mobile-app-v2`) shares the same
Supabase tables for live viewing (Home stats, rooms/categories, and
theft alerts synced in real time via Supabase Realtime).

Possible next steps:
- Real push notifications on mobile (needs an EAS development build +
  Apple Developer account - see the mobile app's README)
- A real WhatsApp notification channel (bigger project - needs the
  WhatsApp Business API or a paid provider like Twilio)
- A history/log view of past (not just active) theft alerts