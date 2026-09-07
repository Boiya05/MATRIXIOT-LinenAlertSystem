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
- **Scan** (`/scan`) — three independent sections: **Register items**
  (scan tags into a category - guest/room are optional, leave them
  blank to save as unassigned stock; a tag that's already registered
  can't be scanned into a new registration, since that would silently
  overwrite its existing data - use **Assign to guest** for it
  instead; a live "N scanned" count tracks the pending batch, and the
  duplicate check runs against a local cache rather than a network
  call per scan, so a real reader's rapid reads aren't bottlenecked by
  round-trip latency - see **Real hardware from the browser** below),
  **Assign to guest** (scan any
  number of already-registered tags, then attach or change one
  guest/room for all of them at once), and **Exit scanner** (the theft
  check). The two entry-side sections default to **Simulated** mode -
  really a manual Tag ID field, works in any browser, no hardware
  needed, and is also how a real USB "keyboard wedge" RFID reader
  reaches this page (see **Real hardware from the browser** below) -
  and can switch to **Web Serial** mode instead for a reader that
  talks over a real serial connection.
- **Inventory** (`/inventory`) — every linen item, with a status
  filter, a search box (tag, guest, room, item type), and checkboxes
  to bulk-delete selected items (staff only).
- **Alert history** (`/history`) — every already-dismissed alert,
  newest first.
- **Activity** (`/activity`) — the audit trail: who registered,
  edited, moved, or deleted an item, and who triggered or cleared an
  alert, across all three apps, newest first and searchable. See the
  mobile app's README ("Audit trail (who did what, and when)") for the
  SQL that creates the underlying `linen_item_events` table — same
  shared-setup pattern as the RLS/Realtime SQL, only needs running
  once per Supabase project, not once per app.
- **Admin** (`/admin`) — only shown in the nav to `admin` accounts.
  Assign viewer/staff/admin access to any account by email, and see
  everyone who currently has a role. See the mobile app's README
  ("Admin role") for the SQL and how the actual security boundary
  works — this page is a convenience layer on top of it, not the
  boundary itself.

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
4. Optionally, also add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
   (the same values as the desktop app's `telegram_config.json`) under
   the same **Environment Variables** page - these power the Telegram
   relay described in **Telegram alerts** above. They're deliberately
   left out of `.env.example`/`NEXT_PUBLIC_*`: unlike the Supabase
   key, this is a real secret that must never reach the browser
   bundle, so it's only ever read server-side, inside
   `app/api/telegram-alert/route.ts`. Leave them unset and this
   dashboard (and the mobile app, which relays through it) simply
   won't send Telegram alerts - everything else still works.
5. Deploy. Vercel builds and hosts it automatically on every push to
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

**A keyboard-wedge reader can occasionally drop the Enter keystroke
between two very fast back-to-back reads** - confirmed happening in
practice, not just a theoretical risk - landing as one long string
that's actually two (or more) tag IDs glued together with no
separator. `hardware/base.ts`'s `push()` recovers from this: a read
that's all hex characters and an exact multiple of 24 (the fixed
length of this hardware's tag IDs) gets split back into individual tag
IDs before anything downstream sees it, since both `SimulatedReader`
and `WebSerialReader` funnel through `push()` rather than touching the
queue directly. A read that doesn't match that exact pattern passes
through unchanged.

Beyond that cooldown, a tag with an alert already active (not yet
dismissed) doesn't raise a second one either (`hasActiveAlert()` in
`data/linen-data.ts`) - re-scanning it, or a reader that keeps seeing
it well past the cooldown, won't spam more alerts for the same event.
Dismissing the existing alert - from this dashboard, the mobile app,
or the desktop app - is what lets the next flagged scan raise a new
one; `theft_alerts` is shared across all three.

**Register items' "already registered?" check runs against a local
cache**, not a fresh `getItemByTag()` call per scan - loaded once when
the section mounts, and kept current as items are saved. With a real
reader flooding reads during a batch registration, that per-scan
network round-trip used to be the actual limit on how fast you could
move through a stack of items. Since the cache can still go a few
seconds stale (a different device registering the same tag in the
meantime), clicking **Save** does one batched re-check of the whole
pending list against the database first (`getItemsByTagIds()` in
`data/linen-data.ts`) and quietly skips anything that turns out to
already be registered, rather than overwriting it.

## Telegram alerts

The desktop app sends a Telegram message straight from Python, using
credentials in its own local `telegram_config.json` (see its README).
Neither this dashboard nor the mobile app can do that safely - a
browser tab or an app bundle has no equivalent private place to keep a
bot token; anyone could pull it out of dev tools or the APK and use it
to message the same chat. So instead, both call a small server-side
route on this dashboard - `app/api/telegram-alert/route.ts` - which
holds the real credentials (as `TELEGRAM_BOT_TOKEN` /
`TELEGRAM_CHAT_ID` in Vercel's **Settings → Environment Variables**,
never in `.env.example` or any committed file) and sends the message
on their behalf.

That route requires a valid Supabase session (checked server-side via
`supabase.auth.getUser()`) before it'll send anything - the same "must
be logged in" boundary that already gates every write to
`theft_alerts` through Row Level Security, reused here instead of
inventing a separate secret to manage. `lib/telegram-alert.ts` is what
this dashboard's own exit scanner calls; the mobile app has its own
copy pointed at this dashboard's deployed URL (see the mobile app's
README).

If `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` aren't set in this
deployment's environment, the route just returns "not configured"
instead of erroring - same best-effort philosophy as the desktop app's
`alarm.py`: a missing or failed Telegram send should never block the
on-screen alert, the `theft_alerts` row, or the audit log entry that
already happened by the time this is called.

## Current status

Working: login, live dashboard stats, live theft alerts with dismiss,
searchable/filterable inventory with bulk delete and (admin only) an
Edit action for fixing a mistake on an already-registered item - see
**Editing a registered item (admin only)** in the mobile app's README
- alert history, the audit trail (Activity), an Admin page for
assigning viewer/staff/admin access by email (see **Admin role** in
the mobile app's README), and item registration (optional guest/room,
real USB hardware via a manual field or Web Serial, local-cache
duplicate checking, and recovery from merged/concatenated reads - see
**Real hardware from the browser** above) + a separate Assign to guest
step + exit-scan theft detection (which now also relays a Telegram
alert, the same as the desktop app - see **Telegram alerts** above) -
all reading and writing the same Supabase project as the desktop and
mobile apps, protected by the same Row Level Security policies.
Verified against live data before being committed: a full register →
assign → exit-scan → theft-alert-logged pass through the real UI,
using a throwaway test account and test rows that were deleted
afterward.

Not yet built:
- Multi-property support (see the root `ARCHITECTURE.md` for the
  `organization_id` design this would use)
- The real reader protocol itself - `hardware/web-serial-reader.ts`'s
  two placeholder methods, same blocker as the desktop app
