/**
 * lib/telegram-alert.ts
 *
 * Asks the web dashboard's app/api/telegram-alert route to send the
 * Telegram notification for a theft alert raised from this app. This
 * app has no server of its own, so it can't safely hold the Telegram
 * bot token the way the desktop app's telegram_config.json does -
 * anything shipped inside the APK/IPA is extractable, so the token
 * lives only on the dashboard's Vercel deployment (see that route's
 * own comment) and this just calls it over HTTPS.
 *
 * EXPO_PUBLIC_NOTIFY_API_URL is the dashboard's base URL - defaults to
 * its stable production domain, but can be overridden in .env (e.g.
 * to point at a preview deployment or localhost during development).
 *
 * Best-effort by design, same as the desktop app's alarm.py: every
 * caller should fire this off with a .catch() rather than await it as
 * something that can block the alert it accompanies (see
 * ExitScannerSection.handleTag in app/(tabs)/scan.tsx).
 */

import type { LinenItem } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

const NOTIFY_API_URL = process.env.EXPO_PUBLIC_NOTIFY_API_URL ?? 'https://linen-web-dashboard.vercel.app';

export async function sendTelegramAlert(tagId: string, item: LinenItem): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('No active session - skipping Telegram alert.');
  }

  const response = await fetch(`${NOTIFY_API_URL}/api/telegram-alert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tagId,
      itemType: item.itemType,
      roomNumber: item.roomNumber,
      customerName: item.customerName,
      status: item.status,
      source: 'mobile',
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Telegram alert request failed: ${body.reason ?? response.statusText}`);
  }
}
