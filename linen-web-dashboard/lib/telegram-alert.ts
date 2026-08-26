/**
 * lib/telegram-alert.ts
 *
 * Asks app/api/telegram-alert to send the Telegram notification for a
 * theft alert raised from this dashboard - see that route's own
 * comment for why the actual Telegram call has to happen server-side
 * instead of from here directly.
 *
 * Best-effort by design, same as the desktop app's alarm.py: every
 * caller should fire this off with a .catch() rather than await it as
 * something that can block the alert it accompanies (see
 * ExitScannerSection.handleTag in app/scan/page.tsx).
 */

import type { LinenItem } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

export async function sendTelegramAlert(tagId: string, item: LinenItem): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('No active session - skipping Telegram alert.');
  }

  const response = await fetch('/api/telegram-alert', {
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
      source: 'web',
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Telegram alert request failed: ${body.reason ?? response.statusText}`);
  }
}
