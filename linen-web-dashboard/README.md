# Linen RFID Detection System — Management Dashboard

A web dashboard for the [desktop Linen RFID Detection
System](../linen_detection_system/) - built with Next.js, deployed on
Vercel. It reads the exact same Supabase tables the desktop app and
[mobile app](../linen-mobile-app-v2/) use, so a scan made on the
desktop app shows up here too, with active theft alerts live via
Supabase Realtime.

This is a read-only "management-facing" client - hotel management
checks live status and reviews alerts from a browser. It briefly also
did everything the desktop app's scanning terminal does (register
items, run the exit-scanner theft check) via the browser's Web Serial
API, but that was removed - see **Why there's no Scan page** below.
The desktop app is the only place scanning actually happens; this
dashboard is how everyone else sees what it's doing.

## What's here

- **Login** — email/password via Supabase Auth. There's no public
  sign-up screen: accounts are created directly in the Supabase
  dashboard (**Authentication → Users**), since a management dashboard
  shouldn't let anyone self-register.
- **Dashboard** (`/`) — live item-status counts, active theft alerts
  that update in real time (new alerts appear, dismissals from any
  device remove them) with a dismiss button, and a **Desktop scanner**
  badge showing which Scanner Mode the desktop app's physical reader
  is currently in (Register / Assign to Guest / Exit Scanner, or
  idle) - see **Desktop scanner status** below.
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
│   ├── page.tsx             # Dashboard (stats + live alerts + scanner status badge)
│   ├── inventory/page.tsx   # Full item list, filterable/searchable
│   ├── history/page.tsx     # Dismissed alert history
│   └── layout.tsx           # Root layout - wraps everything in AuthProvider
├── components/
│   ├── nav.tsx               # Top nav shown on every protected page
│   └── protected.tsx         # Redirects to /login if no session
├── contexts/auth-context.tsx # Session state + signIn/signOut - mirrors the mobile app's
├── data/linen-data.ts        # Supabase queries - reads ported from the mobile app,
│                              # writes (saveLinenItem/dismissAlert) ported from the
│                              # desktop app's database.py
├── hooks/
│   ├── use-linen-items.ts     # Live-loads all items
│   ├── use-theft-alerts.ts    # Live-loads active alerts + dismiss
│   ├── use-alert-history.ts   # Live-loads dismissed alerts
│   ├── use-item-events.ts     # Live-loads the audit trail
│   └── use-scanner-status.ts  # Live-loads the desktop app's current Scanner Mode
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

## Why there's no Scan page

This dashboard briefly had a full `/scan` page - Register items,
Assign to guest, and Exit scanner sections, each able to switch from a
manual Tag ID field to a real reader via the [Web Serial
API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).
It was removed once the desktop app's actual physical reader was
brought up and turned out to **reject the plain UHF inventory command
outright** (status `0xFE`, "illegal command") from every from-scratch
protocol implementation thrown at it, including the vendor's own
**64-bit** DLL - only the vendor's **32-bit** DLL build works (see the
desktop app's README, "If `serial` doesn't work"). Web Serial talks
raw bytes over the port, same as any from-scratch implementation
would, with no way to load a vendor DLL from a browser at all - so it
would hit the exact same wall this specific reader unit already beat
every other attempt with. Rather than ship a **Connect real reader**
button that can't actually work with the hardware this project has,
the page was removed. `hardware/`, `hooks/use-reader.ts`, and
`lib/detector.ts` went with it - they had no other callers.

**If a future reader model doesn't have this problem** (i.e. it
accepts the plain serial protocol the way `hardware/serial_reader.py`
was originally written for), a browser-based Scan page using Web
Serial is a reasonable thing to rebuild - nothing about the underlying
idea was wrong, it just doesn't work with this specific unit.

The desktop app is now the only place scanning happens. This dashboard
watches what it's doing instead - see the next section.

## Desktop scanner status

The desktop app has one physical scanner and a Scanner Mode toggle
(Register / Assign to Guest / Exit Scanner - see its README). That
mode is normally just local state inside `main.py`, invisible to every
other app. The **Desktop scanner** badge on `/` makes it visible: the
desktop app writes its current mode to a `scanner_status` table
(`database.update_scanner_status()`) every time the mode changes, and
this dashboard reads it live via Supabase Realtime
(`hooks/use-scanner-status.ts`) - the same "shared Supabase state" as
every other cross-app pattern here, not a network connection to the
desktop app itself.

Run this once in the Supabase SQL Editor (same one-time-per-project
pattern as the mobile app's other setup SQL):

```sql
-- One row, always id 'desktop' - there's exactly one physical scanner
-- in this project. The desktop app upserts it every time main.py's
-- Scanner Mode buttons are pressed, and writes mode: null when it
-- closes, so this doesn't keep showing a stale mode after it's quit.
create table if not exists scanner_status (
  id text primary key,
  mode text check (mode in ('register', 'assign', 'exit')),
  updated_at timestamptz not null default now()
);

alter table scanner_status enable row level security;

-- Same visibility as linen_items/theft_alerts: any signed-in account
-- can see it. Only the desktop app ever writes to it, authenticating
-- as service_role (bypasses RLS entirely, same as linen_items/
-- theft_alerts), so no insert/update policy is needed here.
create policy "Authenticated users can view scanner status"
  on scanner_status for select
  using (auth.uid() is not null);
```

If the badge doesn't update live after running this, double check
**Database → Replication** in the Supabase dashboard has Realtime
turned on for `scanner_status`, the same as it needs to be for
`linen_items`/`theft_alerts`.

Until the desktop app reports in at least once (or after it's been
closed), the badge just shows "idle" - that's the expected state for
"no data yet," not an error.

## Telegram alerts

The desktop app sends a Telegram message straight from Python, using
credentials in its own local `telegram_config.json` (see its README).
The mobile app can't do that safely - an app bundle has no equivalent
private place to keep a bot token; anyone could pull it out of the APK
and use it to message the same chat. So instead it calls a small
server-side route hosted **on this dashboard** -
`app/api/telegram-alert/route.ts` - which holds the real credentials
(as `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` in Vercel's **Settings →
Environment Variables**, never in `.env.example` or any committed
file) and sends the message on its behalf. This dashboard itself has
no scanner of its own to raise an alert from (see **Why there's no
Scan page** above) - it only hosts the route, it doesn't call it.

That route requires a valid Supabase session (checked server-side via
`supabase.auth.getUser()`) before it'll send anything - the same "must
be logged in" boundary that already gates every write to
`theft_alerts` through Row Level Security, reused here instead of
inventing a separate secret to manage. See the mobile app's README for
how it calls this route (`EXPO_PUBLIC_NOTIFY_API_URL`).

If `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` aren't set in this
deployment's environment, the route just returns "not configured"
instead of erroring - same best-effort philosophy as the desktop app's
`alarm.py`: a missing or failed Telegram send should never block the
on-screen alert, the `theft_alerts` row, or the audit log entry that
already happened by the time this is called.

## Current status

Working: login, live dashboard stats, live theft alerts with dismiss,
a live **Desktop scanner** status badge (see **Desktop scanner
status** above), searchable/filterable inventory with bulk delete and
(admin only) an Edit action for fixing a mistake on an
already-registered item - see **Editing a registered item (admin
only)** in the mobile app's README - alert history, the audit trail
(Activity), an Admin page for assigning viewer/staff/admin access by
email (see **Admin role** in the mobile app's README), and hosting the
Telegram relay route the mobile app calls (see **Telegram alerts**
above) - all reading and writing the same Supabase project as the
desktop and mobile apps, protected by the same Row Level Security
policies.

Not yet built:
- Multi-property support (see the root `ARCHITECTURE.md` for the
  `organization_id` design this would use)
