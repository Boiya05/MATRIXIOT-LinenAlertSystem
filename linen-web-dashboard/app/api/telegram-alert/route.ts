/**
 * app/api/telegram-alert/route.ts
 *
 * Sends the same Telegram notification the desktop app's alarm.py
 * sends, but on behalf of the web dashboard and mobile app - neither
 * of which can safely send it directly. The desktop app keeps its bot
 * token in a local, gitignored config file on a trusted machine; a
 * browser tab or a mobile app bundle has no equivalent safe place -
 * anything shipped to either would be extractable by anyone who opens
 * dev tools or unpacks the APK. So the token lives only here, as a
 * server-side environment variable (TELEGRAM_BOT_TOKEN /
 * TELEGRAM_CHAT_ID in Vercel's project settings, never in
 * .env.example), and this route is what both clients call instead.
 *
 * Anyone who found this URL could otherwise spam alerts to the same
 * Telegram chat, so this requires a valid Supabase session (the same
 * "you must be logged in" boundary that already gates every write to
 * theft_alerts via Row Level Security) rather than inventing a
 * separate secret to manage and leak.
 *
 * Best-effort by design, like alarm.py's own Telegram sender: a
 * missing config or a failed request returns a non-200 the caller can
 * choose to ignore, instead of ever being allowed to block the actual
 * alert (the on-screen result, the theft_alerts row, the audit log).
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

interface TelegramAlertPayload {
  tagId: string;
  itemType?: string | null;
  roomNumber?: string | null;
  customerName?: string | null;
  status?: string | null;
  source?: 'web' | 'mobile';
}

export async function POST(request: Request) {
  if (!telegramBotToken || !telegramChatId) {
    // Not configured on this deployment - fail soft, same reasoning as
    // alarm.py printing a warning instead of crashing when
    // telegram_config.json is missing.
    return NextResponse.json({ ok: false, reason: 'Telegram not configured on server' }, { status: 200 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, reason: 'Supabase not configured on server' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!accessToken) {
    return NextResponse.json({ ok: false, reason: 'Missing session' }, { status: 401 });
  }

  // Verify this is a real, currently-valid session rather than trusting
  // the caller - a fresh client is used here (not a shared singleton)
  // since this route is stateless per-request anyway.
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !userData.user) {
    return NextResponse.json({ ok: false, reason: 'Invalid session' }, { status: 401 });
  }

  let payload: TelegramAlertPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.tagId) {
    return NextResponse.json({ ok: false, reason: 'Missing tagId' }, { status: 400 });
  }

  // Same wording/shape as alarm.py's trigger_alarm(), so a Telegram
  // subscriber sees one consistent alert format no matter which app
  // raised it.
  const details =
    `Tag: ${payload.tagId}\n` +
    `Customer: ${payload.customerName ?? 'Unknown'}\n` +
    `Room: ${payload.roomNumber ?? 'Unknown'}\n` +
    `Item: ${payload.itemType ?? 'Unknown'}\n` +
    `Status: ${payload.status ?? 'Unknown'}\n\n` +
    'This item was just detected leaving through the exit scanner!';

  const sourceLabel = payload.source === 'mobile' ? 'mobile app' : 'web dashboard';
  const text = `🚨 THEFT ALERT 🚨\n\n${details}\n\n(reported via the ${sourceLabel})`;

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ chat_id: telegramChatId, text }),
    });

    const telegramResult = await telegramResponse.json();
    if (!telegramResult.ok) {
      console.error('Telegram API rejected the alert:', telegramResult);
      return NextResponse.json({ ok: false, reason: 'Telegram API error' }, { status: 502 });
    }
  } catch (error) {
    console.error('Failed to reach Telegram:', error);
    return NextResponse.json({ ok: false, reason: 'Network error reaching Telegram' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
