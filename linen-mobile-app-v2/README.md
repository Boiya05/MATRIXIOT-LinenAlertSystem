# Linen RFID Detection System - Mobile Companion

A live-viewing companion app for the [desktop Linen RFID Detection
System](../linen_detection_system/) - built with Expo (React Native).
It reads the same Supabase tables the desktop app writes to, so a scan
made on the Windows app shows up here within seconds, with no manual
refresh needed for theft alerts.

This app is currently **read-only** by design: all scanning,
assigning, and exit-scan detection happens on the desktop app. This
app is for checking on things from your phone - stats, what's in which
room, and live theft alerts.

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
   designed to be embedded in client apps; the actual access control is
   the Row Level Security setting on the Supabase tables (see the
   desktop app's README for that setup).

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

**Home** - live stats (Total / In Use / Laundry / Storage) and a
scrollable theft-alerts section. New alerts appear automatically while
the app is open (Supabase Realtime); press **OK** on an alert to
dismiss it.

**List View** - a segmented view of all linen:
- **In Use** - grouped by room, showing the customer and item count; tap a room to see who's in it and exactly which items
- **Laundry** / **Storage** - grouped by item type instead (customer/room aren't meaningful once an item isn't with a guest), with a count per type; tap a category to see its list of Tag IDs

**Settings** - notification/sound toggles (local only for now), and a
connection status row.

## How it stays in sync

Every screen reads through `data/linen-data.ts`, which queries
Supabase directly - no local mock data or caching layer. Theft alerts
additionally subscribe to Supabase Realtime (`hooks/use-theft-alerts.ts`),
so a new alert logged by the desktop app's exit scanner appears here
live, without needing to reopen or refresh the app.

## Current status

Working: live item stats, room/category browsing with drill-down, and
real-time theft alerts with dismiss.

Not yet built:
- **Real push notifications.** Expo Go can no longer receive remote
  push notifications - that requires moving to a development build via
  [EAS Build](https://docs.expo.dev/build/introduction/), which in turn
  needs an Apple Developer Program membership ($99/year) for iOS. Until
  then, alerts only show up while the app is open.
- Scanning/assigning from the phone itself (currently desktop-only)
