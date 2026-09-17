# Linen RFID Detection System — Full Architecture Teardown

> **This document is a historical snapshot, not the current architecture.** It was written when the desktop app was the only place writing happened, the mobile app was read-only, and RFID scanning was 100% simulated - none of that is true anymore. Current state, in brief:
> - **`linen_detection_system/`** (desktop) is wired up to a real physical UHF RFID scanner - a single reader, switched between Register / Assign to Guest / Exit Scanner modes in the GUI, rather than the two-checkpoint simulated setup this document describes. See its `README.md` ("Hardware setup") for the real protocol work, including what to do if a given reader unit rejects the plain UHF Inventory command (some do).
> - **`linen-mobile-app-v2/`** also has a **Scan** tab (registration + exit-scan), in Simulated mode or - per its own README - a real USB reader mode via Android's USB Host API.
> - **`linen-web-dashboard/`** is a Next.js app (deployed on Vercel) that didn't exist when this document was written - a live dashboard, inventory, alert history, activity/audit trail, admin role management, and a live "what's the desktop scanner doing right now" status badge. It does **not** have its own Scan page (it used to, via the Web Serial API, but that was removed - the browser can't drive this project's actual reader hardware any better than the from-scratch desktop protocol could; see its README, "Why there's no Scan page").
> - **An audit trail now exists** (`linen_item_events`) - who registered, edited, moved, or deleted an item, and who triggered or dismissed an alert, across all three apps. This document's "no audit trail" security finding (§7, §11) is resolved.
> - **`status` now has a database CHECK constraint** (`linen_items_status_check`) - this document's "status is unconstrained free text" finding (§7, §11) is resolved, assuming that migration has actually been run against the live project (see the mobile app's README, "Status constraint").
> - **RLS is now role-based** (`viewer`/`staff`/`admin`, via a `user_roles` table), not just "logged in or not" - this document's "any valid login can rewrite item status" finding (§7, §11) is resolved. See the mobile app's README, "Role-based permissions" and "Admin role".
> - **Blynk was tried and removed.** It was wired up as a Supabase database trigger (no app code) and the HTTP call to Blynk's API consistently succeeded (`200`, confirmed via `net._http_response`), but the notification itself never reliably showed up despite working through the usual causes (event code, device/token mismatches). Rather than keep debugging an unofficial-feeling dead end, it was dropped in favor of what already worked.
> - **WhatsApp via Twilio was also tried and removed** (it wasn't being used, and Twilio's Sandbox could only ever send a fixed-content template, never the real alert details). Alerts now go through **Telegram** only - full detail, proven reliable, free.
>
> Treat each app's own `README.md` as the current source of truth for what's actually implemented. This document is kept for the parts of the original teardown (Realtime wiring mechanics, general request/response tracing, the "why Supabase is your backend" framing) that are still accurate as general explanation, not as an up-to-date map of what writes where or which security findings still apply.

This is a from-the-code (not from-the-README) walkthrough of your project, as it stood before the mobile-primary shift above. Two applications shared one backend:

- **`linen_detection_system/`** — Python + Tkinter desktop app. Originally where all writing happened: registering items, changing status, running the exit scanner. Now a secondary scanning terminal, not the only one.
- **`linen-mobile-app-v2/`** — Expo/React Native phone app. Originally a read-only viewer; now the primary operational app, with its own Scan tab.
- **Supabase** (hosted Postgres + Auth + Realtime) — the only backend. There is no custom server you wrote; Supabase's own REST/websocket API *is* your API layer. Still accurate - `linen-web-dashboard/` reads/writes the same project, no new backend.
- **Telegram Bot API** and **Twilio's WhatsApp API** — external notification channels, both called directly from the desktop app (`alarm.py`). Blynk was tried as a third channel and removed - see the note above.

---

## 1. Big-picture architecture

```text
Staff member (physical world)
       │  scans a (simulated) RFID tag / walks a linen item to the exit
       ▼
┌────────────────────────────┐
│   DESKTOP APP (Windows)    │   <- the only place data is WRITTEN
│   Python + Tkinter          │
│   main.py / detector.py /   │
│   alarm.py / database.py    │
└──────────────┬──────────────┘
               │ authenticates as service_role (full DB access, bypasses security rules)
               ▼
┌──────────────────────────────────────────────┐
│                SUPABASE                        │
│   Postgres database  +  Auth  +  Realtime      │
│   tables: linen_items, theft_alerts,           │
│           user_settings                        │
└──────────────┬───────────────────┬────────────┘
               │ authenticates as          │ pushes live change
               │ logged-in user (RLS)      │ events over websocket
               ▼                            ▼
┌────────────────────────────┐   ┌─────────────────────────────┐
│   MOBILE APP (phone)        │   │  Telegram Bot API           │
│   Expo / React Native        │   │  (external service, called  │
│   read-only viewer          │   │   directly from the desktop) │
└────────────────────────────┘   └─────────────────────────────┘
```

**What each layer is responsible for, and why it exists:**

- **Desktop app (the "application logic" + the only writer).** In a normal system there'd be a physical RFID reader here feeding raw tag IDs into your program. You've built the software as if that reader exists (`Scan (Simulated)`, `Simulate Exit Scan`), so swapping in real hardware later only means replacing *how a tag ID is obtained*, not anything downstream. This is a genuinely good architectural decision — you separated "get a tag ID from somewhere" from "what to do with a tag ID."
- **Supabase (your entire backend).** Normally you'd write a backend server (Node/Express, Django, etc.) that owns the database and exposes an API. You didn't — Supabase auto-generates a REST API and a websocket API directly on top of Postgres, and both apps talk to that generated API using Supabase's client libraries (`supabase-py`, `@supabase/supabase-js`). This means **there is no code of yours enforcing business rules on the server.** Rules exist only as (a) Postgres Row Level Security policies (who can touch which rows) and (b) whatever your Tkinter/React code decides to send. This is the single most important architectural fact about this project and it comes up again in sections 6–8.
- **Mobile app.** A pure consumer of the same data. It never writes to `linen_items` — it only reads, and writes to two narrow things: `theft_alerts.dismissed` (dismiss button) and its own row in `user_settings`.
- **Telegram Bot API.** A one-way notification sink. Your desktop app POSTs a message to it; Telegram delivers to your phone via Telegram's own infrastructure. No data flows back from Telegram into your system.

---

## 2. Detailed architecture diagram (components + protocols)

```text
                          ┌───────────────────────────────────────┐
                          │            STAFF / GUEST                │
                          └───────────────────┬─────────────────────┘
                                               │ physical linen movement
                                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  DESKTOP APP  (linen_detection_system/, Windows, Python 3.12 + Tkinter)   │
│                                                                            │
│   main.py (GUI + event handlers)                                          │
│      │            │                    │                                 │
│      ▼            ▼                    ▼                                 │
│  database.py   detector.py          alarm.py                             │
│  (Supabase     (theft-detection     (pop-up + Telegram +                 │
│   client)       rule, pure logic)    alert logging)                      │
└──────┬─────────────────────────────────────────────────┬─────────────────┘
       │ HTTPS REST (PostgREST, via supabase-py)          │ HTTPS POST
       │ auth: service_role key (bypasses RLS)            │ (Telegram Bot API)
       ▼                                                   ▼
┌───────────────────────────────────────────┐      ┌──────────────────────┐
│              SUPABASE PROJECT               │      │   api.telegram.org   │
│  ┌────────────────────────────────────┐    │      │   (Telegram servers)  │
│  │  Postgres tables:                    │    │      └──────────┬────────────┘
│  │   - linen_items                      │    │                 │ Telegram's own push
│  │   - theft_alerts                     │    │                 ▼
│  │   - user_settings                    │    │        ┌──────────────────┐
│  │   - auth.users (Supabase-managed)    │    │        │  Staff's phone,   │
│  └────────────────────────────────────┘    │        │  Telegram app      │
│  Row Level Security policies (per table)     │        └──────────────────┘
│  Supabase Auth (email + password → JWT)      │
│  Supabase Realtime (Postgres change → WS)    │
└──────┬─────────────────────────┬─────────────┘
       │ HTTPS REST (PostgREST)  │ WebSocket (Realtime,
       │ auth: user JWT + RLS    │ Phoenix channels protocol)
       ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  MOBILE APP  (linen-mobile-app-v2/, Expo/React Native, TypeScript)        │
│                                                                            │
│  lib/supabase.ts (client + session storage: AsyncStorage / localStorage)  │
│      │                              │                                    │
│      ▼                              ▼                                    │
│  data/linen-data.ts             hooks/use-theft-alerts.ts,                │
│  data/user-settings.ts          hooks/use-alert-history.ts                │
│  (one-shot fetches)             (fetch + live websocket subscription)     │
│      │                              │                                    │
│      ▼                              ▼                                    │
│  app/(tabs)/*.tsx, app/room/*, app/category.tsx   (screens/UI)            │
│      │                                                                    │
│      ▼                                                                    │
│  lib/notifications.ts → expo-notifications → on-device OS notification    │
└──────────────────────────────────────────────────────────────────────────┘
```

No Bluetooth, Serial, or physical hardware protocol exists yet anywhere in the code — "RFID scanning" is 100% a GUI button click generating a random string. That's an intentional stand-in, clearly commented as such in `main.py`.

---

## 3. Project structure walkthrough

### `linen_detection_system/` (desktop — Python)

| File | What it does | Talks to | Layer | Depth needed |
|---|---|---|---|---|
| `main.py` | Tkinter GUI: builds every widget, wires button clicks to handler methods (`_on_scan_simulated`, `_on_assign`, `_on_exit_scan`, `_on_mark_status`, `_on_delete_selected`, `_on_edit_selected`), holds `pending_items` as in-memory state before they're assigned. | `alarm.py`, `database.py`, `detector.py`, `models.py` | Frontend (of the desktop app) + application logic | **Must understand deeply** — this is where every user action starts. |
| `database.py` | All Supabase reads/writes for `linen_items` and `theft_alerts`. Loads credentials from `supabase_config.json`, creates one shared `Client` (`get_client()`), and exposes plain functions (`get_all_items`, `get_item_by_tag`, `save_linen_item`, `update_item_status`, `delete_linen_item`, `log_theft_alert`). | Supabase (network) | Data-access layer (your "backend," minus any business rules) | **Must understand deeply** — every write and read in the whole desktop app funnels through this one file. |
| `detector.py` | Pure function `check_tag(tag_id, item)` — no I/O, no side effects, just the theft rule: flag if unregistered, or if registered and status is exactly `"In Use"`. | Called by `main.py` | Business logic | **Must understand** — it's small but it's the entire "why does this app exist" logic. |
| `alarm.py` | Reacts to a flagged tag: shows a blocking Tkinter pop-up, fires a background thread to POST to Telegram, fires another background thread to insert into `theft_alerts` via `database.log_theft_alert`. | `database.py`, Telegram API, Tkinter | Notification/integration layer | **Must understand** — good example of "best-effort side effects shouldn't block or crash the main action." |
| `models.py` | `LinenItem` dataclass + the three status string constants. | Used everywhere | Data model | Should understand; it's tiny. |
| `supabase_config.json` / `.example.json` | Real vs. template credentials (project URL + **service_role key**). | Read by `database.py` | Configuration / secrets | **Must understand the concept**, don't need to memorize the file. |
| `telegram_config.json` / `.example.json` | Real vs. template Telegram bot token + chat ID. | Read by `alarm.py` | Configuration / secrets | Same as above. |
| `data/linen_system.db`, `linen_items_export.csv` | Leftovers from the pre-Supabase SQLite version / a manual export. Nothing in current code reads them. | Nothing (dead weight) | N/A | **Don't waste time** — safe to ignore or delete. |
| `dist/`, `build/`, `*.spec`, `__pycache__/` | PyInstaller packaging output and Python bytecode cache. | N/A | Build artifacts | **Don't waste time** on internals, but see the security section — `dist/` currently contains real copies of your two secret config files. |

### `linen-mobile-app-v2/` (mobile — Expo/React Native/TypeScript)

| File | What it does | Talks to | Layer | Depth needed |
|---|---|---|---|---|
| `lib/supabase.ts` | Creates the one shared Supabase client for the whole app; picks AsyncStorage (native) or a guarded `localStorage` wrapper (web) to persist the login session. | Supabase | Infra/config | Should understand the *why* (session persistence), not every line. |
| `data/linen-data.ts` | The single place that queries `linen_items`/`theft_alerts` and converts Postgres's `snake_case` rows into the app's `camelCase` types. Also contains pure helper functions (`getStats`, `getActiveRooms`, `getGroupedByType`, etc.) that just filter/group data **already in memory** — no extra network calls. | Supabase | Data-access layer | **Must understand deeply** — every screen's data ultimately comes from here. |
| `data/user-settings.ts` | Reads/writes the signed-in user's row in `user_settings`, creating one with defaults on first login. | Supabase | Data-access layer | Should understand. |
| `contexts/auth-context.tsx` | Tracks the current session; exposes `signIn`/`signUp`/`signOut`; listens for Supabase's `onAuthStateChange` so login/logout propagate app-wide instantly. | Supabase Auth | Global state | **Must understand** — the pattern (Context + listener) is broadly reusable. |
| `hooks/use-linen-items.ts` | Fetches all items into local state on mount; exposes a manual `refresh()`. **No realtime subscription.** | `data/linen-data.ts` | State + data-fetching | **Must understand** — and note what it does *not* do (see §10). |
| `hooks/use-theft-alerts.ts` | Fetches active alerts, subscribes to a Supabase Realtime channel on `theft_alerts`, re-fetches on any change, and fires a local notification specifically on `INSERT` events (new alerts only, not dismissals). Also does the optimistic "remove locally, roll back on failure" dismiss. | `data/linen-data.ts`, `data/user-settings.ts`, `lib/notifications.ts`, Supabase Realtime | State + realtime + notifications | **Must understand deeply** — this is the most sophisticated file in the app. |
| `hooks/use-alert-history.ts` | Same realtime pattern as above, but for dismissed alerts. | Same | State + realtime | Should understand (same pattern as above, less critical). |
| `lib/notifications.ts` | Wraps `expo-notifications`: configures the Android channel, checks/requests OS permission, and schedules a **local** (on-device) notification — explicitly not a remote push, since that needs server infrastructure this project doesn't have. | `expo-notifications` | Device integration | Should understand the local-vs-remote-push distinction; don't memorize the API calls. |
| `app/_layout.tsx` | Root layout: decides "show login screens" vs. "show the app" based on `session` from `AuthProvider`, using `expo-router`'s `Stack.Protected` guard. | `contexts/auth-context.tsx`, `contexts/theme-preference-context.tsx` | Routing/frontend shell | Should understand the auth-guard pattern. |
| `app/(auth)/login.tsx`, `signup.tsx` | Login/signup forms calling `useAuth().signIn`/`signUp`. | `auth-context` | Frontend (screen) | Boilerplate-ish; skim it. |
| `app/(tabs)/index.tsx` (Home) | Stats cards (via `getStats`) + live alert list (via `useTheftAlerts`), with skeleton loading states and swipe-to-dismiss. | `hooks/use-linen-items.ts`, `hooks/use-theft-alerts.ts` | Frontend (screen) | Should understand the composition (screen = hooks + pure helpers + UI), not every styling line. |
| `app/(tabs)/list.tsx`, `app/room/[roomNumber].tsx`, `app/category.tsx` | Segmented/drill-down views. **Important:** these do *not* run new database queries when you tap into a room/category — they filter the *already-fetched* `items` array client-side (`getItemsForRoom`, `getItemsByStatusAndType`). | `hooks/use-linen-items.ts` | Frontend (screen) | Understand this pattern — it's a real architectural choice with real trade-offs (see §10). |
| `app/(tabs)/settings.tsx` | Notification/sound toggles → `saveUserSettings`; theme toggle → `ThemePreferenceProvider`; sign out. | `data/user-settings.ts`, `lib/notifications.ts`, `auth-context` | Frontend (screen) | Skim. |
| `components/`, `constants/theme.ts`, `hooks/use-color-scheme*.ts`, `hooks/use-theme-color.ts`, `hooks/use-has-loaded-once.ts` | Reusable UI primitives, theming, and a small hook that tracks "has this list ever finished loading once" (used to avoid re-flashing skeletons). | Various screens | Frontend (presentation) | **Don't waste time** memorizing; useful to know they exist. |
| `.env` / `.env.example` | Supabase URL + **publishable** key, inlined into the JS bundle at build time by Expo (`EXPO_PUBLIC_*` prefix). | `lib/supabase.ts` | Configuration | Understand *why* this key is safe to ship in a client app (see §8). |
| `app.json`, `eas.json` | Expo app metadata (bundle ID, icons, plugins) and EAS Build profiles (dev/preview/production) for producing real installable app binaries later. | Expo/EAS tooling | Deployment config | Should understand at a high level (see §11). |

---

## 4. The most important workflows, traced end-to-end

### Workflow 1 — Registering an item (Scan → Assign)

```text
Staff clicks "Scan (Simulated)"
    ↓
main.py: _on_scan_simulated()
    - _generate_tag_id() makes a "TAGxxx" id not already pending/saved
    - random.choice(ITEM_TYPES) picks an item type
    - appended to self.pending_items (in-memory list, NOT yet in the DB)
    - row added to the Pending Items Treeview
    ↓
Staff types Customer Name + Room Number, clicks "Assign"
    ↓
main.py: _on_assign()
    - validates: at least one pending item, both fields non-empty
      (client-side validation only — nothing enforces this in Postgres)
    - for each pending (tag_id, item_type): builds a LinenItem
      (status defaults to STATUS_IN_USE) and calls database.save_linen_item(item)
    ↓
database.py: save_linen_item()
    - get_client().table("linen_items").upsert({...}, on_conflict="tag_id").execute()
    - HTTPS request to Supabase's PostgREST endpoint, authenticated as service_role
    ↓
Postgres: INSERT ... ON CONFLICT (tag_id) DO UPDATE  (one row per item)
    ↓
main.py: pending list cleared, status label updated, _refresh_item_table()
    re-queries database.get_all_items() and repaints the Saved Items table
```
No response ever comes back to the mobile app automatically here — `linen_items` has no Realtime subscription, so this item only appears on a phone the next time that screen's hook re-fetches (app foreground, pull-to-refresh, or remount).

### Workflow 2 — Exit-scan theft detection (the core feature)

```text
Staff (or a thief) has a tag pass the exit reader; tag ID typed/scanned into
the Exit Scanner box, Enter pressed
    ↓
main.py: _on_exit_scan()
    - tag_id = entry text, uppercased
    - item = database.get_item_by_tag(tag_id)
        → GET .../linen_items?tag_id=eq.TAGxxx  (single REST read)
    - detector.check_tag(tag_id, item)
        → item is None            → return True  (unregistered tag = suspicious)
        → item.status == "In Use" → return True  (should not be leaving)
        → otherwise (Laundry/Storage) → return False
    ↓ (if True)
alarm.py: trigger_alarm(tag_id, item)
    - builds human-readable "details" and "alert_message" strings
    - starts TWO background threads (non-blocking):
        1) _send_telegram_message() → HTTPS POST to api.telegram.org
        2) _log_alert_to_supabase() → database.log_theft_alert()
             → INSERT into theft_alerts (tag_id, item_type, room_number,
               customer_name, message) — dismissed defaults to false,
               created_at defaults to now()
    - messagebox.showerror(...) blocks the Tkinter thread with the on-screen
      pop-up (this is why the network calls are fired first, on threads,
      before the blocking pop-up call)
    ↓
Supabase Postgres row inserted into theft_alerts
    ↓ (Realtime: Postgres logical replication → Supabase's websocket layer)
Any mobile app with an open theft_alerts_changes channel receives an
INSERT event over its existing websocket connection
    ↓
hooks/use-theft-alerts.ts: channel callback fires
    - load() re-fetches getActiveAlerts() → new alert appears in state → UI re-renders
    - because eventType === 'INSERT': looks up the user's settings
      (alerts_enabled / sound_enabled) and, if enabled, calls
      lib/notifications.ts → notifyTheftAlert() → expo-notifications shows
      an on-device banner/sound
    ↓
Meanwhile, Telegram's servers deliver the bot message to the staff's phone
independently, via Telegram's own push infrastructure — this path has
nothing to do with the mobile app at all.
```

### Workflow 3 — Changing an item's status (In Use / Laundry / Storage)

```text
Staff selects a row in Saved Items, clicks "Mark Laundry"
    ↓
main.py: _on_mark_status(STATUS_LAUNDRY)
    - reads tag_id from the selected Treeview row
    - database.update_item_status(tag_id, "Laundry")
        → UPDATE linen_items SET status = 'Laundry' WHERE tag_id = 'TAGxxx'
    - _refresh_item_table() re-fetches and repaints
```
Note: no history is kept of *who* changed the status or *when* — the row is simply overwritten. This matters later (§8, §12).

### Workflow 4 — Mobile login

```text
User types email/password on app/(auth)/login.tsx, taps "Log In"
    ↓
useAuth().signIn(email, password)
    → supabase.auth.signInWithPassword({ email, password })
    → HTTPS request to Supabase Auth; on success, Supabase returns a JWT
      session, which the client library automatically persists via
      AsyncStorage (native) or localStorage (web)
    ↓
contexts/auth-context.tsx: supabase.auth.onAuthStateChange fires
    → setSession(newSession)
    ↓
app/_layout.tsx: RootNavigator re-renders because `session` changed
    → Stack.Protected guard flips from showing (auth) screens to (tabs)
    (no manual navigation call anywhere — this is state-driven routing)
```

### Workflow 5 — Dismissing a theft alert (optimistic update)

```text
User taps "OK" (or swipes) on an alert card on Home
    ↓
hooks/use-theft-alerts.ts: dismiss(alertId)
    - setAlerts(current => current.filter(a => a.id !== alertId))   // UI updates INSTANTLY
    - await dismissAlert(alertId)   → UPDATE theft_alerts SET dismissed = true WHERE id = ...
    - on failure: reload from server (load()) so the alert reappears
      rather than silently vanishing while still active server-side
```
This is a real, transferable pattern: **update the UI optimistically for responsiveness, then reconcile with the server, rolling back on failure.**

### Workflow 6 — Drilling into a room or category (no new query!)

```text
User taps "Room 204" on List View
    ↓
router.push(`/room/204`)
    ↓
app/room/[roomNumber].tsx: useLinenItems() runs AGAIN in this new screen
    (a fresh mount → a fresh fetch of the WHOLE item list, not just room 204)
    ↓
getItemsForRoom(allItems, "204") — pure in-memory filter, no query parameter
    sent to Supabase for "give me only room 204's items"
```
Worth understanding: every screen re-fetches the *entire* `linen_items` table itself, then filters client-side. Fine at your current scale (tens/hundreds of rows); a real cost at large scale (§12).

---

## 5. Database architecture

There is no migrations folder in this repo — the schema was created by hand via Supabase's SQL editor / Table Editor (the exact `CREATE TABLE`/RLS statements are pasted into the two READMEs, not tracked as versioned migration files). That's a reproducibility gap worth knowing about (§12).

**Tables, inferred from `database.py`, `linen-data.ts`, and the README's SQL:**

```text
auth.users  (Supabase-managed — you never created or query this table directly)
    id  (uuid, PK)
    email, encrypted_password, ... (managed entirely by Supabase Auth)
       │
       │ 1-to-1 (user_id is both PK and FK)
       ▼
USER_SETTINGS
    user_id          uuid  PK, FK → auth.users.id  (on delete cascade)
    alerts_enabled   boolean, default true
    sound_enabled    boolean, default true
    updated_at       timestamptz, default now()

LINEN_ITEMS                              THEFT_ALERTS
    tag_id          text  PK                id              (PK, auto-increment)
    customer_name   text                    tag_id          text  (NOT a real
    room_number     text                                          foreign key —
    item_type       text                                          see below)
    status          text  ("In Use" |       item_type       text
                    "Laundry" | "Storage",  room_number     text
                    plain text — no CHECK   customer_name   text
                    constraint enforced)    message         text
                                            created_at      timestamptz, default now()
                                            dismissed       boolean, default false
```

```text
LINEN_ITEMS
   │
   └┈┈< THEFT_ALERTS      (dotted = same tag_id value can appear in both,
                            but there is NO enforced foreign key —
                            intentional, since an *unregistered* tag
                            (no linen_items row at all) must still be
                            able to trigger and log an alert)
```

**Who reads/writes each table:**

- `linen_items` — written only by the desktop app (`database.py`: `save_linen_item`, `update_item_status`, `delete_linen_item`). Read by both apps (`database.get_all_items`/`get_item_by_tag` on desktop, `getAllItems` on mobile).
- `theft_alerts` — written by the desktop app (`log_theft_alert`, insert-only) and by the mobile app (`dismissAlert`, update-only — it only ever flips `dismissed`). Read by both.
- `user_settings` — written and read only by the mobile app, scoped to the signed-in user.

**Why this schema looks the way it does (and its trade-offs):** it's intentionally flat — there's no `customers` table, no `rooms` table, no `hotels` table. `customer_name` and `room_number` are just free-text columns copied onto every row. That's fine for a single-property MVP with a handful of staff, but it means there's no single source of truth for "who is guest X" or "what room is 204" — a typo in one row (`"Jon Smith"` vs `"John Smith"`) silently creates what looks like two different guests, and you can't query "everything this guest has ever had" cleanly. A more normalized design would pull `customers` and `rooms` into their own tables with `linen_items` holding foreign keys to them.

---

## 6. Frontend ↔ backend ↔ database communication

**Does the frontend talk directly to the database?** Yes — quite literally. There is no backend server of yours in between. Both `database.py` (desktop) and `data/linen-data.ts` (mobile) call the Supabase client library, which sends HTTPS requests straight to Supabase's auto-generated REST API (PostgREST) sitting directly in front of Postgres. **The "backend" here is Supabase itself, not code you wrote.**

**Full example, traced line-by-line — mobile app loading Home screen stats:**

```text
1. app/(tabs)/index.tsx calls useLinenItems()      (hooks/use-linen-items.ts)
2. useEffect runs on mount → setLoading(true) → calls getAllItems()
3. data/linen-data.ts: getAllItems()
       const { data, error } = await supabase.from('linen_items').select('*').order('tag_id');
   This builds a PostgREST query string under the hood, roughly:
       GET https://<project>.supabase.co/rest/v1/linen_items?select=*&order=tag_id
       Headers: apikey: <publishable key>, Authorization: Bearer <user's JWT>
4. Postgres runs the query, but ALSO evaluates the RLS policy on linen_items
   ("authenticated users can view linen items" → auth.uid() is not null)
   before returning any rows at all
5. Rows come back as JSON; `error` is null on success
6. mapRowToLinenItem() converts each snake_case row to the app's camelCase LinenItem type
7. setItems(data) in the hook → triggers React re-render
8. HomeScreen: useMemo(() => getStats(items), [items]) recomputes stat counts
   (pure client-side math, zero additional network calls)
9. UI renders the four StatCards with the new numbers
```

**Asynchronous handling:** every data function is `async`/`await`-based, wrapped in a `.then()/.catch()/.finally()` chain inside each hook. Errors are always caught, logged with `console.warn` (so you can debug), and converted into a generic user-facing string (`"Couldn't load linen items. Pull to refresh to try again."`) — raw Postgres/network error text is never shown to the end user. That's a genuinely good practice worth keeping.

**State update after a data change:** two different mechanisms exist side-by-side —
1. **Manual/pull-based**: `useLinenItems` only re-fetches when its `refreshKey` changes (pull-to-refresh) or the hook remounts (navigating to a new screen).
2. **Push-based (Realtime)**: `useTheftAlerts`/`useAlertHistory` keep an open websocket and re-fetch automatically whenever Postgres reports a change to `theft_alerts`.

---

## 7. Authentication and security

**Authentication (who are you?):**
- Mobile: Supabase Auth, email + password → JWT session, persisted locally, auto-refreshed. This is real, standard auth.
- Desktop: **none.** There is no login screen. It authenticates to Supabase as the **`service_role`** key, which Supabase treats as a superuser that bypasses Row Level Security entirely. This is a deliberate, documented decision ("trusted internal tool"), not an oversight — but it means the desktop app *is* the credential; anyone who can run it (or steal its config file) has full database control.

**Authorization (what are you allowed to do?):**
- `linen_items` / `theft_alerts`: any authenticated user may `SELECT`/`INSERT`/`UPDATE`/`DELETE` — there is no per-user or per-role restriction beyond "logged in or not." This matches the current design (one shared inventory, small trusted staff), but has real limits at scale (§12).
- `user_settings`: restricted to `auth.uid() = user_id` — correctly private per account.
- The **publishable/anon key** used by the mobile app is *meant* to be public — it identifies which Supabase project you're talking to, not who you are. The actual gatekeeper is RLS, evaluated per request based on the JWT. This is the standard Supabase (and broader "public API key vs. session token") pattern.
- The **service_role key** used by the desktop app is a real secret equivalent to a database root password — it ignores RLS completely.

**Secrets inventory:**

| Secret | Where it lives | Sensitivity |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_KEY` (publishable) | `.env` (mobile), compiled into the JS bundle | Low — designed to be public |
| `supabase_config.json` → `service_role_key` | Next to `main.py` when run from source; **also copied into `dist/` next to the compiled `.exe`** | **Critical** — full unrestricted DB access |
| `telegram_config.json` → `bot_token`/`chat_id` | Next to `main.py`; also in `dist/` | Moderate — lets someone impersonate/spam your alert channel, no DB access |

Both real config files and the `dist/`/`build/` folders are correctly `.gitignore`d and I confirmed they are **not** committed to git history — good practice, already in place.

**Security findings, classified:**

- **Critical — service_role key sits in plaintext next to a distributable `.exe`.** `dist/supabase_config.json` is a local file (not committed to git) but it is exactly the file you'd need to hand-copy alongside `dist/LinenRFIDDetectionSystem.exe` to run the packaged app on another machine. Anyone who receives that folder (a USB stick, a shared drive, a backup) receives full read/write/delete access to your entire database, not just linen data. *What would normally be done instead:* never ship a full-access key with a distributable binary; either keep the desktop app tied to a single controlled machine, or introduce a scoped service account / dedicated backend endpoint the exe calls instead of hitting Postgres directly with root-equivalent credentials.
- **Critical — the theft-detection rule can be defeated by any logged-in mobile account.** Because RLS only checks "are you logged in," any authenticated session (including via a raw API call, not just the app's UI) can run `UPDATE linen_items SET status='Storage' WHERE tag_id=...` on *any* row. A dishonest staff member (or anyone with a valid login) could mark a stolen item "Storage" moments before walking it out, and the exit scanner would wave it through. *What would normally be done instead:* status transitions belong behind a real authorization/business-rule layer (e.g., only certain roles can flip to Storage/Laundry, and only via an audited action) — RLS alone ("logged in or not") isn't a fine-grained enough authorization model for a security-relevant status field.
- **Critical — `status` has no database-level constraint.** It's a free-text column. `detector.check_tag` only alarms when `status == "In Use"` *exactly*; any other value (a typo, a bad client, a malicious write of `"in use "` with a trailing space) silently passes the exit scanner without an alert. *What would normally be done instead:* a Postgres `CHECK (status IN ('In Use','Laundry','Storage'))` constraint or an `enum` type, so bad data can't even be written, and ideally detector logic should whitelist the *safe* statuses rather than blacklist one *unsafe* one.
- **Important — no audit trail.** Nothing records who changed a status or when (no `updated_by`/`updated_at` on `linen_items`). If an item goes missing, you can't reconstruct its status history.
- **Important — no server-side input validation.** "Customer name and room number required" is enforced only in `main.py`'s Tkinter code; a direct API call could insert garbage or empty values.
- **Minor — no password reset flow** on mobile (already known/documented by you).

---

## 8. Networking

```text
Desktop app  ──HTTPS (PostgREST)──►  Supabase Postgres      (reads/writes, service_role)
Desktop app  ──HTTPS POST──────────►  Telegram Bot API        (fire-and-forget alert)
Mobile app   ──HTTPS (PostgREST)──►  Supabase Postgres      (reads, RLS-restricted)
Mobile app   ──WebSocket (Realtime)─►  Supabase              (live theft_alerts changes)
Mobile app   ──(none, local only)──►  expo-notifications      (on-device notification)
```

| Scenario | Currently handled? | What actually happens |
|---|---|---|
| Internet disappears (desktop, at startup) | ✅ Handled | `initialize_database()` is wrapped in try/except in `main()`; shows a friendly popup instead of crashing. |
| Internet disappears (desktop, mid-session) | ❌ Not handled | Button handlers like `_on_assign`/`_on_exit_scan` call `database.*` with no try/except — an exception mid-session would surface as Tkinter's default (ugly but non-fatal) traceback dialog, not a friendly message. |
| Wi-Fi disconnects (mobile) | ✅ Handled reasonably | Every hook's `.catch()` sets a generic `error` string shown in the UI with a "pull to refresh" prompt. |
| Supabase becomes unavailable | ✅ Handled the same as "offline" | No local cache/offline mode exists (explicitly, by design, per the README) — every screen just shows its error state until a request succeeds again. |
| Request times out | ⚠️ Partially | No explicit custom timeout/retry logic anywhere except Telegram's 5-second `urlopen` timeout; everything else relies on the underlying HTTP client's defaults and surfaces as a generic error. |
| Same request sent twice (double-click / double Enter) | ❌ Not handled | `save_linen_item` is an upsert, so double-submitting *assign* is harmless (idempotent by `tag_id`). But `_on_exit_scan` calls `log_theft_alert`, which is a plain **insert** — scanning/pressing Enter twice on the same tag creates two alert rows and sends two Telegram messages for one real event. |
| Two devices modify the same row simultaneously | ❌ Not handled | Postgres itself won't corrupt data (writes are serialized per row), but there's no optimistic-locking/version column, so it's a classic **lost update**: the second write silently wins with no warning to either staff member. |

---

## 9. State management

- **Local component state** — form fields, segmented-control selection, submit/loading flags: plain `useState` inside each screen, wiped on unmount.
- **Global state** — exactly two React Contexts: `AuthProvider` (session/user) and `ThemePreferenceProvider` (light/dark/system). No Redux/Zustand/MobX; deliberately minimal.
- **Server state (source of truth)** — lives entirely in Postgres. There is **no client-side cache** (no React Query/SWR) — each screen's hook independently calls Supabase and stores the result in its own `useState`. Home and List View, for example, each run their own separate `useLinenItems()` call rather than sharing one cached copy — they can briefly disagree until each has fetched.
- **Push-driven state** — only `theft_alerts` has a live Realtime subscription. When it changes, the hook does a full re-fetch (`load()`), not a targeted patch, and replaces state wholesale.
- **A precise, important correction to the README's "stays in sync" claim:** `linen_items` has **no** Realtime subscription. A status change or new item registered on the desktop app does *not* push to an open mobile app; the phone only sees it on the next manual pull-to-refresh or screen remount. Only theft alerts are truly "live."
- **Device state** — notification permission is asked live from the OS each time (`expo-notifications`), never cached in your own state; the Supabase Auth session token is the one thing persisted to disk (AsyncStorage/localStorage) so login survives app restarts.
- **Optimistic update example** — dismissing an alert removes it from local state *before* the network call resolves, then reconciles (re-fetches) on failure. This is the general "assume success, roll back on error" pattern used in most polished apps.

---

## 10. Deployment

```text
Desktop app:
  source (.py files) ──PyInstaller (LinenRFIDDetectionSystem.spec)──► dist/LinenRFIDDetectionSystem.exe
  (config files must be manually copied next to the .exe — they are NOT baked in)

Mobile app:
  source (TS/TSX) ──npx expo start──► Metro dev server ──LAN Wi-Fi──► phone running Expo Go
  (no production build exists yet; the path forward is `eas build`, using the
   development/preview/production profiles already scaffolded in eas.json)

Backend:
  Fully hosted by Supabase's cloud. No server of yours to deploy at all.
  Schema exists only because someone pasted SQL into Supabase's SQL editor by
  hand — there's no migrations folder, so rebuilding the DB from scratch means
  manually re-running the SQL blocks documented in the two READMEs.
```

**What currently only works because a development machine is running:**
- The entire mobile app experience, full stop — it only runs inside Expo Go, connected live to your computer's `expo start` process over the same Wi-Fi network. If your laptop is off or on a different network than the phone, the mobile app doesn't work at all. This goes away once an EAS production build exists.
- Nothing about the backend depends on your machine — Supabase's cloud infrastructure runs independent of any device you own.
- Real (closed-app) push notifications aren't implemented at all yet — that's not a "runs on my machine" issue, it's a genuinely unbuilt feature requiring new cloud infrastructure (a Supabase Edge Function + Firebase/FCM).

---

## 11. Architectural weaknesses — engineering review

| # | What's wrong | Why it matters | What would normally be done instead |
|---|---|---|---|
| 1 | service_role key ships alongside the packaged `.exe` in `dist/` | Full, unrestricted DB access leaks to anyone who receives that folder | Keep root-equivalent credentials off distributable artifacts entirely; use a scoped backend/service account instead |
| 2 | RLS on `linen_items`/`theft_alerts` is "logged in or not," with no finer authorization | Any valid login can rewrite item status and defeat the entire theft-detection premise | Role- or action-based authorization (e.g., Postgres policies keyed to a `staff_role` claim, or a real backend endpoint that enforces business rules before writing) |
| 3 | `status` is unconstrained free text | Bad data (typo, bug, malicious write) silently disables the alarm for that item | `CHECK` constraint / Postgres `enum`, and detector logic that whitelists safe statuses instead of blacklisting one unsafe one |
| 4 | No idempotency on exit-scan alert logging | Duplicate scans of the same tag produce duplicate alert rows and duplicate Telegram messages | De-dupe key (e.g., ignore a repeat scan of the same tag within N seconds) or an idempotency token per physical scan event |
| 5 | No optimistic locking / version column anywhere | Two staff editing the same item concurrently → silent lost update, no conflict warning | A `updated_at`/version column checked on write, or "someone else changed this, reload?" UX |
| 6 | Every screen re-fetches and client-filters the *entire* `linen_items` table | Fine at tens/hundreds of rows; degrades badly as data grows (§13 walks through exactly where) | Server-side filtering/pagination (`.eq()`, `.range()` in PostgREST), or a shared cache layer so screens don't each independently re-fetch everything |
| 7 | Flat, unnormalized schema (`customer_name`/`room_number` as free text on every row) | No single source of truth for a guest or a room; typos silently fragment data; can't easily query "this guest's full history" | Separate `customers`/`rooms` tables with foreign keys from `linen_items` |
| 8 | No audit trail on status changes | Can't answer "who marked this Storage and when" during an actual investigation — ironic for a *theft-detection* system | An `linen_item_events`/history table, or `updated_by`/`updated_at` columns, written on every change |
| 9 | No schema migrations tracked in version control | Rebuilding or evolving the database isn't reproducible from the repo alone | A `supabase/migrations/` folder (Supabase CLI supports this natively) checked into git |
| 10 | Desktop mid-session network failures are unhandled (only startup is wrapped in try/except) | A dropped connection mid-action surfaces as a raw Tkinter traceback dialog instead of a clear message | Wrap each `database.*` call site (or centralize in `database.py`) with the same friendly-error pattern already used at startup |
| 11 | No client-side request debouncing on buttons like "Assign" or exit-scan Enter key | Rapid double-presses can duplicate network calls/rows (see #4) | Disable the control while a request is in flight, as is already sensibly done on the mobile login button (`submitting` state) but not on desktop |
| 12 | Single global Telegram recipient, single global "exit scanner" concept | Doesn't scale to multiple properties/locations/roles without a redesign | Per-location config, per-recipient/role alert routing |

---

## 12. What to actually learn from this (AI helped build a lot of it)

**MUST UNDERSTAND — these transfer to almost any system you build next:**
- Client-server thinking: why shared data lives in one backend instead of copies in each app, and what "the backend" even means when you didn't write server code yourself (Supabase's generated API *is* your backend).
- The difference between **authentication** ("who are you," JWT sessions) and **authorization** ("what are you allowed to do," RLS policies) — and why they're separate concerns.
- Public/anon keys vs. secret/root-equivalent keys, and the general principle of "some credentials are safe to ship in a client binary, some are catastrophic to."
- Row-level, policy-based data access control (the concept generalizes far beyond Supabase — it's the same idea as any fine-grained authorization system).
- Race conditions and lost updates in concurrent systems — why "last write wins" isn't automatically safe, and what optimistic locking is for.
- Idempotency — why "the same request sent twice should have the same effect as once," and where this project doesn't have it.
- REST (request/response) vs. WebSocket/Realtime (server pushes to you) — when each is the right tool.
- Separation of concerns: UI → data-access function → backend, and why business rules belong closer to the data, not just in the UI layer.

**SHOULD UNDERSTAND — useful now, don't need mastery yet:**
- React's `useState`/`useEffect`/Context pattern for fetching and sharing data (this specific style, not general web-dev depth).
- Expo Router's file-based routing and the `Stack.Protected` auth-guard pattern.
- Supabase Realtime's specific mechanism (Postgres logical replication → websocket "Postgres Changes" events).
- Tkinter's event/callback GUI model.
- Why background threads were used in `alarm.py` (so a blocking pop-up doesn't delay network sends).
- PyInstaller packaging basics (why `sys.frozen` / `sys.executable` checks exist in your code).

**DON'T WASTE TIME MEMORIZING:**
- Exact `StyleSheet`/Tailwind-esque styling values, Tkinter `grid()`/`pack()` parameter tuning.
- Specific npm/pip package version numbers.
- Generated/cache folders: `node_modules/`, `.expo/`, `__pycache__/`, `build/`, `dist/` internals.
- The exact wording of setup instructions in the READMEs.

---

*Prepared by inspecting the actual source files in both `linen_detection_system/` and `linen-mobile-app-v2/`, not just the READMEs. No code was modified.*
