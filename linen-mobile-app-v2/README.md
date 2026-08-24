# Linen RFID Detection System - Mobile

Built with Expo (React Native). Per the supervisor-reviewed
architecture ("Proposed System Architecture & Scope - Mobile
Long-Range UHF RFID Hotel Property / Linen System"), **this is now the
primary operational app in the system** - it's meant to connect
directly to the physical UHF RFID reader, not just view data collected
elsewhere. The [desktop app](../linen_detection_system/) remains a
secondary/legacy scanning terminal, and the
[web dashboard](../linen-web-dashboard/) is the management view - all
three read and write the exact same Supabase project, so a scan made
on any of them shows up on the others within seconds.

The **Scan** tab (see below) registers items and runs the exit-scan
theft check. **Simulated** mode works today, everywhere, no hardware
needed. **USB reader mode** talks to a real UHF reader directly over
USB (Android + an OTG cable) - see `hardware/README.md` for exactly
what that requires and what's still unverified. The rest of the app is
for checking on things from your phone - stats, what's in which room,
live theft alerts, and alert history - behind a login.

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
you only need to log in once per install. **Forgot password?** sends a
reset link by email - tapping it opens the app directly to a "set a
new password" screen. See **Password reset setup** below for one
required Supabase dashboard step before this works.

**Home** - live stats (Total / In Use / Laundry / Storage) and a
scrollable theft-alerts section. New alerts appear automatically while
the app is open (Supabase Realtime); press **OK** on an alert to
dismiss it.

**Scan** - two independent sections, matching the desktop app's two
checkpoints, each independently switchable between **Simulated** and
**USB reader** mode:
- **Register items** - scan a tag (a Tag ID field, typed by hand or
  from a real USB "keyboard wedge" scanner - see below), then assign a
  Customer Name + Room Number to everything scanned so far, same
  batch-assign flow as the desktop app.
- **Exit scanner** - a Tag ID (typed, or from a real reader) runs
  through the same theft rule as `detector.py` (`lib/detector.ts`
  here); a flagged scan writes a `theft_alerts` row the same way the
  desktop app's `alarm.py` does.

A USB "keyboard wedge" reader (types the tag ID and presses Enter, no
special driver needed) already works today through Simulated mode's
Tag ID fields, plugged in via a USB OTG cable - Android treats it as a
plain keyboard, same as the desktop app and web dashboard's equivalent
fields. **USB reader mode** (the mode-switch button) is a different,
more involved integration - direct USB Host API access for a reader
that talks a real serial protocol instead - and needs Android + a USB
OTG cable plus a dev-client build instead of Expo Go; see
`hardware/README.md` for the full constraints and what's still
unverified (the actual reader protocol is a placeholder until a model
is chosen, and on-device behavior hasn't been tested against real
hardware).

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

## Role-based permissions (staff vs. viewer)

The setup above gives *every* logged-in account full read/write access
to `linen_items` and `theft_alerts` - fine when you're the only user,
a real gap once other people have accounts. This adds a `user_roles`
table and narrows write access (registering items, dismissing alerts,
editing status) to accounts explicitly marked `staff`; everyone
authenticated can still *view* everything, same as before - only
writing is now gated.

Run this once in the Supabase SQL Editor, applies system-wide (desktop
app, mobile app, web dashboard all read/write the same project, so
this isn't something to repeat per app):

```sql
-- A missing row here = viewer by default. Nobody gets write access
-- automatically just by signing up, unlike the "any authenticated
-- user" policies being replaced below.
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'staff')),
  updated_at timestamptz not null default now()
);

alter table user_roles enable row level security;

-- Users can see their own role (so an app could show/hide staff-only
-- controls) - deliberately NO insert/update/delete policy for regular
-- users. Granting or changing a role only happens here, in the SQL
-- Editor (or Supabase's Table Editor) by someone with real database
-- access - never something an app itself can do, or self-promotion to
-- "staff" would defeat the entire point.
create policy "Users can view their own role"
  on user_roles for select
  using (auth.uid() = user_id);

-- Replace the "any authenticated user" write policies with "staff only"
drop policy if exists "Authenticated users can insert linen items" on linen_items;
create policy "Staff can insert linen items"
  on linen_items for insert
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'));

drop policy if exists "Authenticated users can update linen items" on linen_items;
create policy "Staff can update linen items"
  on linen_items for update
  using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'));

drop policy if exists "Authenticated users can delete linen items" on linen_items;
create policy "Staff can delete linen items"
  on linen_items for delete
  using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'));

drop policy if exists "Authenticated users can insert theft alerts" on theft_alerts;
create policy "Staff can insert theft alerts"
  on theft_alerts for insert
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'));

drop policy if exists "Authenticated users can update theft alerts" on theft_alerts;
create policy "Staff can update theft alerts"
  on theft_alerts for update
  using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'))
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'));

-- The SELECT ("view") policies on linen_items/theft_alerts are
-- untouched - every logged-in account can still see everything.

-- Grant yourself staff access - skip this and you'd lose the ability
-- to register items or dismiss alerts the moment the policies above
-- take effect. Replace the email with your real account's if different.
insert into user_roles (user_id, role)
select id, 'staff' from auth.users where email = 'weihan_05@hotmail.com'
on conflict (user_id) do update set role = 'staff';
```

**To add another staff account later** (e.g. a real hotel employee),
run just the last statement again with their email instead - no need
to re-run the whole block.

**What happens to a non-staff (`viewer`) account today**: they can log
into any of the three apps and see everything - stats, inventory,
alerts, history - completely normally. If they try to register an
item, dismiss an alert, or change a status, the write is silently
rejected by Postgres (RLS denies it before it reaches the table) and
the app shows whatever generic error message that specific action
already has - none of the three apps currently show a friendlier
"you don't have permission" message or hide write controls for
viewers. That's a real, known gap in the UI layer (not the security
layer, which is solid) - worth building once there's an actual
non-staff account to test it against.

## Audit trail (who did what, and when)

Before this, nothing recorded *who* registered an item, changed its
status, edited it, deleted it, or dismissed an alert - the row was
just silently overwritten, which is a real gap for a system whose
whole point is proving what happened to a missing item. This adds an
append-only `linen_item_events` table: every write path in all three
apps now logs one row per action, alongside whatever it was already
doing (registering, marking status, dismissing an alert, etc.) -
nothing here changes what those actions do, only what gets recorded
about them.

Run this once in the Supabase SQL Editor - **requires the
`user_roles` table from "Role-based permissions" above to already
exist**, since the insert policy checks it the same way:

```sql
-- Append-only history of who did what to which tag, and when. Every
-- registration, edit, status change, deletion, and alert
-- trigger/dismissal writes one row here - the apps only ever INSERT
-- into this table, never UPDATE or DELETE, so it stays a trustworthy
-- record even if someone later "fixes" linen_items/theft_alerts.
create table if not exists linen_item_events (
  id bigint generated always as identity primary key,
  tag_id text not null,
  event_type text not null check (event_type in (
    'registered', 'edited', 'status_changed', 'deleted',
    'alert_triggered', 'alert_dismissed'
  )),
  old_status text,
  new_status text,
  customer_name text,
  room_number text,
  detail text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text,
  source_app text not null check (source_app in ('desktop', 'mobile', 'web')),
  created_at timestamptz not null default now()
);

create index if not exists linen_item_events_tag_id_idx
  on linen_item_events (tag_id, created_at desc);

alter table linen_item_events enable row level security;

-- Same visibility as linen_items/theft_alerts: any logged-in account
-- can view the audit trail (it's part of "seeing everything" a
-- viewer already gets), but only staff can write to it - matching
-- exactly who's allowed to perform the actions being logged.
create policy "Authenticated users can view item events"
  on linen_item_events for select
  using (auth.uid() is not null);

create policy "Staff can insert item events"
  on linen_item_events for insert
  with check (exists (select 1 from user_roles where user_id = auth.uid() and role = 'staff'));
```

**Who writes what, and how "who" is known:**
- Mobile and web: `actor_id`/`actor_label` come straight from the
  signed-in Supabase session (`supabase.auth.getUser()`) - real,
  verifiable identity, since both apps require login.
- Desktop: there's still no login screen (it authenticates as
  `service_role`, which bypasses this table's RLS entirely, same as
  `linen_items`/`theft_alerts`), so there's no session to read an
  identity from. A new **Operator Name** field at the top of the
  window is typed in by hand instead and stamped onto every event from
  that session - optional, and not verified against anything, so treat
  desktop-originated `actor_label` values as a courtesy note, not proof
  of identity, unlike mobile/web's.
- Every write is best-effort: a failed audit-log write is caught and
  printed/logged, never allowed to block or fail the actual action
  (registering an item, dismissing an alert, etc.) it's describing.

**Where to see it**: the web dashboard's new **Activity** page lists
the 200 most recent events, searchable by tag/guest/room/actor, live
via Realtime. Mobile and desktop don't have their own viewer for
it - the web dashboard is already the "management reviews things from
a browser" app, so that's where this lives.

## Password reset setup

**One required step in the Supabase dashboard** - without it, the
reset email still sends, but tapping its link won't open the app the
way it's supposed to:

1. Go to **Supabase Dashboard → Authentication → URL Configuration**.
2. Under **Redirect URLs**, add:
   ```
   linenmobileappv2://reset-password
   ```
3. Save.

Supabase silently ignores a custom `redirectTo` passed to
`resetPasswordForEmail()` unless it's in this allow-list - it falls
back to the project's default Site URL instead, with no error at
request time, which makes this easy to miss until you actually click
a reset link and it goes somewhere unexpected.

**How the flow works**, for reference:
- `contexts/auth-context.tsx`'s `requestPasswordReset()` calls
  Supabase's `resetPasswordForEmail()` - **verified working against
  the real project** (confirmed the API call succeeds; a real email
  was sent).
- The emailed link opens the app via its `linenmobileappv2://` scheme.
  `hooks/use-auth-deep-link.ts` catches it (cold start via
  `Linking.getInitialURL()`, or warm start via `Linking.addEventListener`),
  extracts the token/code from the link, and establishes a session by
  hand - Supabase's `detectSessionInUrl` client option is a web-only
  concept (there's no browser URL bar on a phone to read from), so
  this step doesn't happen automatically the way it would on web.
- That session change fires a `PASSWORD_RECOVERY` auth event, tracked
  as `isPasswordRecovery` in the auth context - `app/_layout.tsx`
  checks this *before* its normal "has a session → show the main app"
  check, so a recovery link correctly routes to
  `app/reset-password.tsx` instead of straight into the tabs.
- Submitting a new password calls `updateUser()`, then signs out so
  the next login uses the new password through the normal flow.

**Not yet verified**: the actual deep-link click-through (email → tap
link → app opens to the reset screen with a valid session). That needs
a real device receiving a real email and tapping it, which isn't
something this environment can do - the email-sending half is
confirmed working; the receiving half needs testing on your phone.

## Current status

Working: login/signup with persistent sessions, live item stats,
room/category browsing with drill-down, real-time theft alerts with
dismiss, alert history, per-account settings, and item registration +
exit-scan theft detection from the Scan tab, in both Simulated mode
and (per the supervisor-reviewed architecture doc) a real USB reader
mode via Android's USB Host API - all protected by Supabase Row Level
Security now that real accounts exist, and role-gated so only `staff`
accounts can write. Every registration, edit, status change, deletion,
and alert trigger/dismissal across all three apps also writes to an
append-only audit trail - see **Audit trail** above. Simulated mode
was verified against live data before being committed: a full
register → assign → exit-scan → theft-alert-logged pass through the
real UI, using a throwaway test account and test rows that were
deleted afterward. USB reader mode was verified to compile and link
correctly via a real development-client build, but not yet tested
against physical hardware - see `hardware/README.md`.

Not yet built / not yet confirmed:
- **The real reader's protocol.** `hardware/usb-serial-reader.ts`'s
  two placeholder methods (`sendStartupCommands`,
  `parseTagFromFrame`) can't be finished until a specific reader model
  is chosen and its datasheet is in hand - see the architecture doc's
  own "Items to Confirm" section.
- **On-device verification of USB reader mode.** No physical Android
  device + OTG cable + reader has been available to test the actual
  permission flow and data path yet.
- **The API/integration layer** for external hotel or hospital
  management software to read selected data - the doc calls for this,
  Supabase is structured to support it, but the layer itself (what
  Vercel would host) isn't built.
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
- **On-device verification of the password reset deep link.** The
  email-sending half is confirmed working; tapping the actual link on
  a phone hasn't been tested yet - see **Password reset setup**.
