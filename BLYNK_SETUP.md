# Blynk alert notifications — setup

The last unbuilt piece of the "Proposed System Architecture & Scope"
diagram: **Blynk alert trigger / notification flow**, shown as a child
of the Supabase backend. This wires it up exactly that way — Supabase
stays the single source of truth, and a database trigger tells Blynk
to fire a notification whenever a new theft alert is logged. No app
code changes, no Edge Function to deploy, no new backend to run: it's
one SQL script against the same Supabase project every app already
uses.

This only requires things I don't have access to in this environment
(your Blynk account, and a Supabase CLI/dashboard login) - so this is
a "run this yourself" setup, the same way the RLS policies in the
mobile app's README are.

## 1. Blynk-side setup

1. Create a free account at [blynk.cloud](https://blynk.cloud) if you
   don't have one.
2. Create a new **Template** (Blynk's term for a device type) - call
   it something like "Linen RFID Alerts". You don't need any real
   hardware/device for this; Blynk's HTTP API can log events on behalf
   of a virtual device.
3. Under the template, go to **Events** and create a new event:
   - **Event code**: `theft_alert` (must match the SQL below exactly,
     or change both to match)
   - **Name**: "Theft Alert"
   - Enable **Push notification** (and email/SMS if you want those
     too) on this event
4. Create a **Device** from that template (**Devices → New Device →
   From template**) - this gives you a device-specific **Auth Token**
   (**Device → Device Info → copy the Auth Token**). That token is
   what identifies "which device/channel" a logged event belongs to.
5. Install the **Blynk IoT** app on your phone (iOS/Android) and log
   into the same account, so you actually receive the push
   notifications this triggers.

## 2. Supabase-side setup

Run this once in **Supabase Dashboard → SQL Editor**. Replace
`YOUR_BLYNK_AUTH_TOKEN` with the token from step 4 above before
running it.

```sql
-- pg_net lets Postgres make outbound HTTP requests - this is what
-- actually calls Blynk's API from inside the trigger below.
create extension if not exists pg_net with schema extensions;

-- Stores the Blynk auth token encrypted, rather than hardcoding it in
-- a function body where anyone who can read pg_proc could see it.
select vault.create_secret('YOUR_BLYNK_AUTH_TOKEN', 'blynk_auth_token');

-- Fires on every new theft_alerts row (from any app - desktop, mobile,
-- or the web dashboard, whichever one detected the flagged scan) and
-- calls Blynk's logEvent API, which triggers whatever notification
-- channels you enabled on the "theft_alert" event in step 3 above.
create or replace function notify_blynk_on_theft_alert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  blynk_token text;
begin
  select decrypted_secret into blynk_token
  from vault.decrypted_secrets
  where name = 'blynk_auth_token';

  perform net.http_get(
    url := 'https://blynk.cloud/external/api/logEvent',
    params := jsonb_build_object(
      'token', blynk_token,
      'code', 'theft_alert',
      -- Blynk's description field caps at 300 characters.
      'description', left(new.message, 300)
    )
  );

  return new;
end;
$$;

drop trigger if exists theft_alerts_notify_blynk on theft_alerts;
create trigger theft_alerts_notify_blynk
  after insert on theft_alerts
  for each row
  execute function notify_blynk_on_theft_alert();
```

## 3. Test it

Trigger a real alert from any app - e.g. the web dashboard's
[Scan page](linen-web-dashboard/) exit scanner with an unregistered
Tag ID - and check that a push notification arrives in the Blynk app
within a few seconds.

If nothing arrives, check **Supabase Dashboard → Database →
Extensions → pg_net** has logging you can inspect, or query
`net._http_response` for the request's actual HTTP status - a 401
usually means the auth token is wrong, a 400 usually means the event
code doesn't match what you set up in step 3.

## Why this shape, not an Edge Function

Blynk's `logEvent` endpoint is a single `GET` request - there's no
processing, retry logic, or secret-juggling complex enough to justify
a separate Edge Function deployment (which would also need a Supabase
CLI login this environment doesn't have). A direct database trigger is
the smallest thing that does the job, and it's consistent with how
this project already prefers "SQL you run once" over "infrastructure
you deploy and maintain" wherever that's sufficient - the same reasoning
that ruled out Firebase earlier.

## Where this leaves the rest of the architecture diagram

| Diagram component | Status |
|---|---|
| RFID-tagged property → reader → USB/serial → mobile app | Built - `hardware/usb-serial-reader.ts`, transport works, reader protocol still a placeholder (blocked on choosing a model - see "Items to Confirm") |
| Scan EPC → Process → Record → Upload | Built - the Scan tab's Register/Exit-scanner flow |
| Supabase: Property & RFID records | Built - `linen_items` table |
| Supabase: Detection/event records | Built - `theft_alerts` table |
| Supabase: Blynk alert trigger | **Built by this doc** - run the SQL above |
| API/Integration layer → management software | Partially built - Supabase's own RLS-protected REST API already lets an authorized external system read/write today. A purpose-built, curated API (the "Vercel-hosted API" the diagram shows) is deliberately not built yet, because "Items to Confirm" #5 - what data/functions it should expose - isn't answered yet. Building it before that would mean guessing at another hotel/hospital integrator's needs. |
| Vercel-hosted web components | Built - `linen-web-dashboard/`, live in production |
| Standalone operation | Already true - reader + mobile app + Supabase + alerts work with zero dependency on external management software |
