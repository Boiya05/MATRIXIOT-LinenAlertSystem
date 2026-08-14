# Linen RFID Detection System — Management Dashboard

A web dashboard for the [desktop Linen RFID Detection
System](../linen_detection_system/) - built with Next.js, deployed on
Vercel. It reads the exact same Supabase tables the desktop app and
[mobile app](../linen-mobile-app-v2/) use, so a scan made on the
desktop app shows up here too, with active theft alerts live via
Supabase Realtime.

This is the "management-facing" client in the system: where hotel
management checks live status and reviews alerts from a browser,
rather than the on-site scanning terminal (desktop app) or the
on-the-go viewer (mobile app).

## What's here

- **Login** — email/password via Supabase Auth. There's no public
  sign-up screen: accounts are created directly in the Supabase
  dashboard (**Authentication → Users**), since a management dashboard
  shouldn't let anyone self-register.
- **Dashboard** (`/`) — live item-status counts, and active theft
  alerts that update in real time (new alerts appear, dismissals from
  any device remove them) with a dismiss button.
- **Inventory** (`/inventory`) — every linen item, with a status
  filter and a search box (tag, guest, room, item type).
- **Alert history** (`/history`) — every already-dismissed alert,
  newest first.

## Project structure

```
linen-web-dashboard/
├── app/
│   ├── login/page.tsx       # Sign-in form
│   ├── page.tsx             # Dashboard (stats + live alerts)
│   ├── inventory/page.tsx   # Full item list, filterable/searchable
│   ├── history/page.tsx     # Dismissed alert history
│   └── layout.tsx           # Root layout - wraps everything in AuthProvider
├── components/
│   ├── nav.tsx               # Top nav shown on every protected page
│   └── protected.tsx         # Redirects to /login if no session
├── contexts/auth-context.tsx # Session state + signIn/signOut - mirrors the mobile app's
├── data/linen-data.ts        # Supabase queries - ported directly from the mobile app
├── hooks/
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

## Known follow-up

**Realtime replication is only enabled for `theft_alerts` in the
current Supabase project, not `linen_items`.** The dashboard's
Inventory page still loads correctly (a normal one-time fetch), but
won't auto-update if an item's status changes elsewhere - refresh the
page to see the latest. To make it fully live, enable Realtime for
`linen_items` in **Supabase Studio → Database → Replication** (a
toggle, not a code change).

## Current status

Working: login, live dashboard stats, live theft alerts with dismiss,
searchable/filterable inventory, alert history - all reading the same
Supabase project as the desktop and mobile apps, protected by the same
Row Level Security policies.

Not yet built:
- Multi-property support (see the root `ARCHITECTURE.md` for the
  `organization_id` design this would use)
- Role-based permissions (currently, any authenticated account has
  full read/write access - same open item flagged for the mobile app)
- Item registration/editing from the dashboard (currently read +
  dismiss only, matching the mobile app's read-only design; scanning
  and registration stay desktop-only)
