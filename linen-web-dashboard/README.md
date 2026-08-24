# Linen RFID Detection System — Management Dashboard

A web dashboard for the [desktop Linen RFID Detection
System](../linen_detection_system/) - built with Next.js, deployed on
Vercel. It reads the exact same Supabase tables the desktop app and
[mobile app](../linen-mobile-app-v2/) use, so a scan made on the
desktop app shows up here too, with active theft alerts live via
Supabase Realtime.

This started as a read-only "management-facing" client - where hotel
management checks live status and reviews alerts from a browser - but
now also does everything the desktop app's scanning terminal does:
register items and run the exit-scanner theft check, straight from a
browser tab. That makes the desktop app optional, not required: any
machine with Chrome or Edge can now be a scanning checkpoint, not just
the one running the Python app.

## What's here

- **Login** — email/password via Supabase Auth. There's no public
  sign-up screen: accounts are created directly in the Supabase
  dashboard (**Authentication → Users**), since a management dashboard
  shouldn't let anyone self-register.
- **Dashboard** (`/`) — live item-status counts, and active theft
  alerts that update in real time (new alerts appear, dismissals from
  any device remove them) with a dismiss button.
- **Scan** (`/scan`) — register new items (scan + assign a guest/room)
  and run the exit-scanner theft check, in two independent sections
  matching the desktop app's two checkpoints. Each defaults to
  **Simulated** mode - really a manual Tag ID field, works in any
  browser, no hardware needed, and is also how a real USB "keyboard
  wedge" RFID reader reaches this page (see **Real hardware from the
  browser** below) - and can switch to **Web Serial** mode instead for
  a reader that talks over a real serial connection.
- **Inventory** (`/inventory`) — every linen item, with a status
  filter and a search box (tag, guest, room, item type).
- **Alert history** (`/history`) — every already-dismissed alert,
  newest first.
- **Activity** (`/activity`) — the audit trail: who registered,
  edited, moved, or deleted an item, and who triggered or cleared an
  alert, across all three apps, newest first and searchable. See the
  mobile app's README ("Audit trail (who did what, and when)") for the
  SQL that creates the underlying `linen_item_events` table — same
  shared-setup pattern as the RLS/Realtime SQL, only needs running
  once per Supabase project, not once per app.

## Project structure

```
linen-web-dashboard/
├── app/
│   ├── login/page.tsx       # Sign-in form
│   ├── page.tsx             # Dashboard (stats + live alerts)
│   ├── scan/page.tsx        # Register items + exit-scanner theft check
│   ├── inventory/page.tsx   # Full item list, filterable/searchable
│   ├── history/page.tsx     # Dismissed alert history
│   └── layout.tsx           # Root layout - wraps everything in AuthProvider
├── components/
│   ├── nav.tsx               # Top nav shown on every protected page
│   └── protected.tsx         # Redirects to /login if no session
├── contexts/auth-context.tsx # Session state + signIn/signOut - mirrors the mobile app's
├── data/linen-data.ts        # Supabase queries - reads ported from the mobile app,
│                              # writes (saveLinenItem/logTheftAlert) ported from the
│                              # desktop app's database.py
├── lib/detector.ts           # Theft-detection rule, ported from the desktop app's detector.py
├── hardware/                  # RFID reader abstraction - browser-side twin of the
│   │                           # desktop app's hardware/ package, same design
│   ├── base.ts                # RFIDReader interface (queue + poll, same pattern as Python)
│   ├── simulated-reader.ts    # Button/typed-input driven fake reader (default mode)
│   ├── web-serial-reader.ts   # Real USB reader via the Web Serial API - protocol
│   │                           # parsing isolated the same way as serial_reader.py
│   └── web-serial.d.ts        # Ambient types for Web Serial (not in TS's DOM lib yet)
├── hooks/
│   ├── use-reader.ts          # Poll loop + mode switching for the Scan page
│   ├── use-linen-items.ts    # Live-loads all items
│   ├── use-theft-alerts.ts   # Live-loads active alerts + dismiss
│   └── use-alert-history.ts  # Live-loads dismissed alerts
├── .env.example               # Template - copy to .env.local
└── README.md                  # This file
```

## Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase
   project's URL and publishable key - the exact same values the
   mobile app's `.env` uses (**Settings → API** in the Supabase
   dashboard):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_KEY=sb_publishable_...
   ```

   `.env.local` is gitignored - only `.env.example` (placeholders) is
   meant to be committed. Like the mobile app, the publishable key is
   designed to be embedded in client code; Row Level Security on
   `linen_items`/`theft_alerts` is what actually protects the data
   (see the mobile app's README for the exact RLS setup - this
   dashboard uses the same tables and policies, nothing new to run).

3. Create at least one account for yourself in the Supabase dashboard
   (**Authentication → Users → Add user**) if you don't already have
   one from the mobile app - accounts are shared across both apps.

## Running it locally

```powershell
npm run dev
```

Opens at `http://localhost:3000`. Log in with a Supabase Auth account
(same accounts as the mobile app).

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from
   the repo).
2. At [vercel.com](https://vercel.com), **Add New → Project**, import
   the repo, and set the **Root Directory** to `linen-web-dashboard`
   (this is a monorepo - the desktop and mobile apps live in sibling
   folders, so Vercel needs to know to build from this subfolder).
3. Add the two environment variables from `.env.example` (with your
   real values) under **Settings → Environment Variables**.
4. Deploy. Vercel builds and hosts it automatically on every push to
   the connected branch from then on.

Alternatively, from this folder:

```powershell
npx vercel
```

and follow the prompts (link/create a project, confirm the root is
this folder) - `npx vercel --prod` for a production deploy once you're
ready.

## Real hardware from the browser

**If your reader is a USB "keyboard wedge" scanner** (types the tag ID
and presses Enter, shows up as a keyboard to the OS, no COM port) -
none of this section applies. It already works today through the
Simulated-mode Tag ID fields on the Scan page - the browser has no way
to tell "a person typed this" from "a keyboard-emulating scanner typed
this," so it just works, as long as the field has focus when a tag is
scanned. Everything below is for a reader that instead talks over a
real serial connection, via Web Serial.

The Scan page's **Connect real reader** button uses the [Web Serial
API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
to talk to a USB RFID reader directly, the same way the desktop app's
`SerialRFIDReader` does over `pyserial` - opens the port, reads it on
a loop, pushes parsed Tag IDs into the same queue the Simulated mode
uses. A few real constraints worth knowing before relying on it:

- **Chromium only.** Chrome and Edge support Web Serial; Firefox and
  Safari don't, at all - not even behind a flag. The button disables
  itself with an explanatory tooltip when the browser doesn't support
  it, rather than failing after a click.
- **HTTPS or localhost only.** Works on this Vercel deployment and in
  local dev; wouldn't work if this were ever served over plain HTTP.
- **The reader has to be plugged into whatever machine is running the
  browser tab.** Deploying this dashboard to Vercel doesn't change
  that - "scanning from the web" still means a laptop with Chrome
  sitting at the checkpoint with the reader plugged into it. It's a
  different program than the desktop app, not a way to scan from
  anywhere in the world.
- **The protocol is still a placeholder**, exactly like the desktop
  app's `serial_reader.py` - `hardware/web-serial-reader.ts` has the
  same two isolated methods (`sendStartupCommands`,
  `parseTagFromFrame`) waiting on a real reader model and its
  datasheet. Until then, it assumes plain ASCII lines, which almost
  certainly isn't how a real UHF reader actually talks. Keep both
  files in sync if you're implementing the same reader's protocol for
  both the desktop app and this dashboard.

A 5-second per-tag cooldown is built into the exit scanner
(`RESCAN_COOLDOWN_MS` in `app/scan/page.tsx`) so a real reader's
continuous-inventory mode - which reports the same tag many times a
second while it's in range - doesn't log a duplicate theft alert for
every single one of those reads.

## Current status

Working: login, live dashboard stats, live theft alerts with dismiss,
searchable/filterable inventory, alert history, and now item
registration + exit-scan theft detection (simulated by default, real
USB hardware via Web Serial once a reader is connected) - all reading
and writing the same Supabase project as the desktop and mobile apps,
protected by the same Row Level Security policies. Verified against
live data before being committed: a full register → assign → exit-scan
→ theft-alert-logged pass through the real UI, using a throwaway test
account and test rows that were deleted afterward.

Not yet built:
- Multi-property support (see the root `ARCHITECTURE.md` for the
  `organization_id` design this would use)
- Editing an already-registered item's details (status changes and
  new registrations are covered; fixing a mistake on an existing item
  still needs the desktop app's Edit dialog)
- The real reader protocol itself - `hardware/web-serial-reader.ts`'s
  two placeholder methods, same blocker as the desktop app
