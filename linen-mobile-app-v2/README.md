# Linen RFID Detection System - Mobile Companion

A live-viewing companion app for the [desktop Linen RFID Detection
System](../linen_detection_system/) - built with Expo (React Native).
It reads the same Supabase tables the desktop app writes to, so a scan
made on the Windows app shows up here within seconds, with no manual
refresh needed for theft alerts.

Started as **read-only** by design, with scanning kept desktop-only.
It now also has a **Scan** tab (see below) that can register items and
run the exit-scan theft check directly from your phone - in
**Simulated** mode today, since real UHF hardware isn't buildable on
mobile yet (see `hardware/README.md` for exactly why). The rest of the
app is still for checking on things from your phone - stats, what's in
which room, live theft alerts, and alert history - behind a login.

## Requirements

- Node.js 18+ and npm
- The [Expo Go](https://expo.dev/go) app on your phone, matching this
  project's SDK version (currently **SDK 54** - Expo Go on the App
  Store/Play Store only supports the latest SDK at any given time, so
  if you see a "Project is incompatible" error, this project's SDK and
  your Expo Go app's SDK have drifted apart)
- Access to the same Supabase project the desktop app uses

## Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase project's
   URL and publishable key (**Settings → API** in the Supabase
   dashboard) - the same project the desktop app connects to:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
   ```

   `.env` is gitignored - only `.env.example` (placeholders) is meant
   to be committed. Unlike a real secret, Supabase's publishable key is
   designed to be embedded in client apps - see **Supabase Auth & RLS
   setup** below for what actually protects the data.

3. Run the Supabase setup below before your first login.

## Running it

```powershell
npx expo start
```

This starts a local dev server. Open the **Expo Go** app on your
phone (same Wi-Fi network as your computer) and either scan the QR
code the terminal prints, or enter the `exp://<your-ip>:8081` URL it
shows manually.

> If your phone can't reach the dev server, check that your PC's
> firewall allows inbound connections on port 8081 - a common blocker
> on networks set to "Public" in Windows.

## What's in the app

**Login / Sign Up** - the app opens to a login screen. New accounts
sign up with an email + password. Sessions persist across restarts, so
you only need to log in once per install.

**Home** - live stats (Total / In Use / Laundry / Storage) and a
scrollable theft-alerts section. New alerts appear automatically while
the app is open (Supabase Realtime); press **OK** on an alert to
dismiss it.

**Scan** - two independent sections, matching the desktop app's two
checkpoints:
- **Register items** - tap **+ Scan (simulated)** to generate a Tag
  ID, then assign a Customer Name + Room Number to everything scanned
  so far, same batch-assign flow as the desktop app.
- **Exit scanner** - type a Tag ID and submit to run it through the
  same theft rule as `detector.py` (`lib/detector.ts` here); a flagged
  scan writes a `theft_alerts` row the same way the desktop app's
  `alarm.py` does.

Both are Simulated-only for now - no real reader integration exists on
mobile yet. See `hardware/README.md` for why (short version: a phone's
NFC can't read long-range UHF tags at all, and a real external reader
accessory would need leaving Expo Go for a custom dev build).

**List View** - a segmented view of all linen:
- **In Use** - grouped by room, showing the customer and item count; tap a room to see who's in it and exactly which items
- **Laundry** / **Storage** - grouped by item type instead (customer/room aren't meaningful once an item isn't with a guest), with a count per type; tap a category to see its list of Tag IDs

**History** - every alert you've already dismissed, newest first, with its original timestamp - kept separate from Home's active-alerts banner.

**Settings** - notification/sound toggles, saved to your account (so
they follow you across devices/reinstalls), plus your email and a
**Log Out** button.

## How it stays in sync

Every screen reads through `data/linen-data.ts`, which queries
Supabase directly - no local mock data or caching layer. Theft alerts
and alert history additionally subscribe to Supabase Realtime
(`hooks/use-theft-alerts.ts`, `hooks/use-alert-history.ts`), so a new
alert logged by the desktop app's exit scanner - or a dismissal from
another device - appears here live.

## Supabase Auth & RLS setup

This app requires a Supabase Auth session to do anything - both to log
in, and because `linen_items` and `theft_alerts` now require one via
Row Level Security. Run this in the Supabase SQL Editor (once per
project):

```sql
-- Per-account settings (Settings screen toggles)
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alerts_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users can view their own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Require login to read/write the shared linen data
alter table linen_items enable row level security;

create policy "Authenticated users can view linen items"
  on linen_items for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert linen items"
  on linen_items for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update linen items"
  on linen_items for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Authenticated users can delete linen items"
  on linen_items for delete
  using (auth.uid() is not null);

alter table theft_alerts enable row level security;

create policy "Authenticated users can view theft alerts"
  on theft_alerts for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert theft alerts"
  on theft_alerts for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can update theft alerts"
  on theft_alerts for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
```

**Already ran this setup on an existing project before the `with check` clauses were
added above?** `create policy` will fail with "policy already exists" if you just
re-run the block. Run this instead to add the checks to your existing policies:

```sql
alter policy "Users can update their own settings" on user_settings
  with check (auth.uid() = user_id);

alter policy "Authenticated users can update linen items" on linen_items
  with check (auth.uid() is not null);

alter policy "Authenticated users can update theft alerts" on theft_alerts
  with check (auth.uid() is not null);
```

`user_settings` restricts each row to the account it belongs to
(`auth.uid() = user_id`) - one person's settings are never visible to
another's. `linen_items`/`theft_alerts` stay shared across every
logged-in account (this is a single shared inventory, not per-user
data) but now require *some* valid session to access at all - the
publishable key alone, without logging in, no longer works.

The desktop app doesn't have its own login screen, so it authenticates
as Supabase's `service_role` instead, which bypasses RLS entirely -
see the desktop app's README for that setup.

**Email confirmation:** by default, Supabase requires confirming your
email before you can log in, and its built-in email sending is
aggressively rate-limited (a handful of emails per hour) - fine for a
real deployment with proper SMTP configured, but likely to get in your
way while testing. Consider turning off "Confirm email" under
**Authentication → Sign In / Providers → Email** for a smoother local
testing loop.

## Current status

Working: login/signup with persistent sessions, live item stats,
room/category browsing with drill-down, real-time theft alerts with
dismiss, alert history, per-account settings, and now item
registration + exit-scan theft detection (Simulated mode) from the
Scan tab - all protected by Supabase Row Level Security now that real
accounts exist. The Scan flow was verified against live data before
being committed: a full register → assign → exit-scan →
theft-alert-logged pass through the real UI, using a throwaway test
account and test rows that were deleted afterward.

Not yet built:
- **Real RFID hardware on mobile.** See `hardware/README.md` - a
  phone's NFC can't read the long-range UHF tags this project uses at
  all (different radio tech entirely), so this would need an external
  Bluetooth reader accessory, a specific model chosen, and leaving
  Expo Go for a custom dev build. None of that is set up yet.
- **Real (background/closed-app) push notifications.** Theft alerts
  currently notify you locally - Settings → Notifications → "Theft
  alerts" - which works while the app is open or briefly
  backgrounded, but Android suspends the app's JS/network within
  seconds of switching away, so it doesn't reliably fire once you've
  moved on to another app or the screen's off. A fully reliable
  version needs a server-side push trigger (Supabase Edge Function +
  Firebase/FCM), which is real infrastructure outside this repo, not
  just app code - intentionally not set up, to keep the project
  simple.
- **Password reset.** The login screen has no recovery flow yet.
