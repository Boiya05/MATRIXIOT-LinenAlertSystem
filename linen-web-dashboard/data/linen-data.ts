/**
 * data/linen-data.ts
 *
 * The single place every page goes through to read linen data. Reads
 * the exact same Supabase tables as the desktop app and mobile app -
 * ported directly from the mobile app's data/linen-data.ts, since the
 * schema and business rules are identical. If that schema changes,
 * update both copies.
 */

import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * Turns a failed write into a message worth showing someone.
 *
 * Postgres code 42501 is what a Row Level Security policy rejection
 * looks like ("new row violates row-level security policy for table
 * ...") - since the "Staff can ..." policies (see the mobile app's
 * README, "Role-based permissions") only became a thing once real
 * viewer accounts existed, this is the first place that raw Postgres
 * text would otherwise have reached the screen verbatim. Every other
 * failure still surfaces the actual error, wrapped with what action
 * failed.
 */
function friendlyWriteError(action: string, error: PostgrestError): Error {
  if (error.code === '42501') {
    return new Error("You don't have permission to do this - ask an admin for staff access.");
  }
  return new Error(`Failed to ${action}: ${error.message}`);
}

export type LinenStatus = 'In Use' | 'Laundry' | 'Storage';

export interface LinenItem {
  tagId: string;
  customerName: string;
  roomNumber: string;
  itemType: string;
  status: LinenStatus;
}

export interface AlertEvent {
  id: number;
  tagId: string;
  itemType: string;
  roomNumber: string;
  customerName: string;
  message: string;
  timestamp: string;
}

export type ItemEventType =
  | 'registered'
  | 'edited'
  | 'status_changed'
  | 'deleted'
  | 'alert_triggered'
  | 'alert_dismissed';

export interface ItemEvent {
  id: number;
  tagId: string;
  eventType: ItemEventType;
  oldStatus: string | null;
  newStatus: string | null;
  customerName: string | null;
  roomNumber: string | null;
  detail: string | null;
  actorLabel: string | null;
  sourceApp: 'desktop' | 'mobile' | 'web';
  timestamp: string;
}

function mapRowToItemEvent(row: {
  id: number;
  tag_id: string;
  event_type: ItemEventType;
  old_status: string | null;
  new_status: string | null;
  customer_name: string | null;
  room_number: string | null;
  detail: string | null;
  actor_label: string | null;
  source_app: 'desktop' | 'mobile' | 'web';
  created_at: string;
}): ItemEvent {
  return {
    id: row.id,
    tagId: row.tag_id,
    eventType: row.event_type,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    customerName: row.customer_name,
    roomNumber: row.room_number,
    detail: row.detail,
    actorLabel: row.actor_label,
    sourceApp: row.source_app,
    timestamp: formatAlertTimestamp(row.created_at),
  };
}

// Supabase columns are snake_case (matching the desktop app's SQL
// tables); our TypeScript types are camelCase. These are the two
// places that translate between them.
function mapRowToLinenItem(row: {
  tag_id: string;
  customer_name: string;
  room_number: string;
  item_type: string;
  status: string;
}): LinenItem {
  return {
    tagId: row.tag_id,
    customerName: row.customer_name,
    roomNumber: row.room_number,
    itemType: row.item_type,
    status: row.status as LinenStatus,
  };
}

/**
 * Exported (not just used internally) so the realtime INSERT handler
 * on the dashboard page can turn the raw payload row Supabase sends
 * straight into an AlertEvent, without a second network round-trip to
 * re-fetch the same row it was just given.
 */
export function mapRowToAlertEvent(row: {
  id: number;
  tag_id: string;
  item_type: string;
  room_number: string;
  customer_name: string;
  message: string;
  created_at: string;
}): AlertEvent {
  return {
    id: row.id,
    tagId: row.tag_id,
    itemType: row.item_type,
    roomNumber: row.room_number,
    customerName: row.customer_name,
    message: row.message,
    timestamp: formatAlertTimestamp(row.created_at),
  };
}

function formatAlertTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return isToday ? `Today, ${time}` : `${date.toLocaleDateString()}, ${time}`;
}

/** All linen items currently on record. */
export async function getAllItems(): Promise<LinenItem[]> {
  const { data, error } = await supabase.from('linen_items').select('*').order('tag_id');

  if (error) {
    throw new Error(`Failed to load linen items: ${error.message}`);
  }

  return (data ?? []).map(mapRowToLinenItem);
}

/**
 * Look up a single linen item by its tag ID - used by the exit
 * scanner to check whether a scanned tag is registered, and what
 * status it's in, before deciding whether to flag it. Mirrors the
 * desktop app's database.get_item_by_tag().
 */
export async function getItemByTag(tagId: string): Promise<LinenItem | null> {
  const { data, error } = await supabase.from('linen_items').select('*').eq('tag_id', tagId).maybeSingle();

  if (error) {
    throw new Error(`Failed to look up tag: ${error.message}`);
  }

  return data ? mapRowToLinenItem(data) : null;
}

/**
 * Look up every already-registered tag among a given set of tag IDs,
 * in one call - used by the Register items batch save to catch a race
 * (another device registered one of these tags after this session's
 * local "already registered?" cache was built, but before Save was
 * clicked) without paying a network round-trip per scan. See
 * app/scan/page.tsx's RegisterSection for how the local cache and this
 * function work together.
 */
export async function getItemsByTagIds(tagIds: string[]): Promise<LinenItem[]> {
  if (tagIds.length === 0) return [];

  const { data, error } = await supabase.from('linen_items').select('*').in('tag_id', tagIds);

  if (error) {
    throw new Error(`Failed to check tags: ${error.message}`);
  }

  return (data ?? []).map(mapRowToLinenItem);
}

/**
 * Save a linen item - inserts a new row, or updates the existing one
 * if this tag_id is already registered (same upsert-on-tag_id
 * behavior as the desktop app's database.save_linen_item()).
 */
export async function saveLinenItem(item: LinenItem): Promise<void> {
  const { error } = await supabase.from('linen_items').upsert(
    {
      tag_id: item.tagId,
      customer_name: item.customerName,
      room_number: item.roomNumber,
      item_type: item.itemType,
      status: item.status,
    },
    { onConflict: 'tag_id' }
  );

  if (error) {
    throw friendlyWriteError('save item', error);
  }
}

export interface UpdateItemResult {
  success: boolean;
  message: string;
}

/**
 * Fix a mistake on an already-registered item's details (customer
 * name, room number, item type) - admin only. Unlike saveLinenItem()
 * (a plain upsert any staff/admin account can already do for the
 * ordinary register/status-change flow), this goes through the
 * admin_update_linen_item() RPC, which checks is_admin() on the server
 * before writing - see "Editing a registered item (admin only)" in the
 * mobile app's README for why this can't just be a table-level RLS
 * policy (staff already needs plain UPDATE on linen_items for the scan
 * flow, so restricting the table itself would break that).
 */
export async function updateLinenItemDetails(
  tagId: string,
  details: { customerName: string; roomNumber: string; itemType: string }
): Promise<UpdateItemResult> {
  const { data, error } = await supabase.rpc('admin_update_linen_item', {
    p_tag_id: tagId,
    p_customer_name: details.customerName,
    p_room_number: details.roomNumber,
    p_item_type: details.itemType,
  });

  if (error) {
    throw friendlyWriteError('update item', error);
  }

  const result = data?.[0];
  return result ? { success: result.success, message: result.message } : { success: false, message: 'No response from the server.' };
}

/**
 * Delete a linen item by its tag ID - mirrors the desktop app's
 * database.delete_linen_item(). Used by the Inventory page's bulk
 * delete (see app/inventory/page.tsx); the desktop app is still the
 * only place with a single-item delete UI.
 */
export async function deleteLinenItem(tagId: string): Promise<void> {
  const { error } = await supabase.from('linen_items').delete().eq('tag_id', tagId);

  if (error) {
    throw friendlyWriteError('delete item', error);
  }
}

/**
 * Record a theft alert - mirrors the desktop app's
 * database.log_theft_alert(). Called by the exit scanner when a
 * scanned tag is flagged (see lib/detector.ts).
 */
export async function logTheftAlert(
  tagId: string,
  item: LinenItem | null,
  message: string
): Promise<void> {
  const { error } = await supabase.from('theft_alerts').insert({
    tag_id: tagId,
    item_type: item?.itemType ?? 'Unknown',
    room_number: item?.roomNumber ?? 'Unknown',
    customer_name: item?.customerName ?? 'Unknown',
    message,
  });

  if (error) {
    throw friendlyWriteError('log theft alert', error);
  }
}

/**
 * Whether this tag already has an undismissed theft alert waiting -
 * used by the exit scanner so a tag sitting near (or repeatedly
 * passing) the reader only raises one alert instead of a fresh one
 * every time it's re-scanned. Once dismissed (by anyone, from any of
 * the three apps - theft_alerts is shared), the next flagged scan of
 * that tag raises a new one again.
 */
export async function hasActiveAlert(tagId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('theft_alerts')
    .select('id')
    .eq('tag_id', tagId)
    .eq('dismissed', false)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check active alerts: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

/** Every theft alert that hasn't been dismissed yet, newest first. */
export async function getActiveAlerts(): Promise<AlertEvent[]> {
  const { data, error } = await supabase
    .from('theft_alerts')
    .select('*')
    .eq('dismissed', false)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load alerts: ${error.message}`);
  }

  return (data ?? []).map(mapRowToAlertEvent);
}

/** Every theft alert that has already been dismissed, newest first. */
export async function getAlertHistory(): Promise<AlertEvent[]> {
  const { data, error } = await supabase
    .from('theft_alerts')
    .select('*')
    .eq('dismissed', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load alert history: ${error.message}`);
  }

  return (data ?? []).map(mapRowToAlertEvent);
}

/** Marks an alert as dismissed. */
export async function dismissAlert(alertId: number): Promise<void> {
  const { error } = await supabase.from('theft_alerts').update({ dismissed: true }).eq('id', alertId);

  if (error) {
    throw friendlyWriteError('dismiss alert', error);
  }
}

/**
 * Record one row in the linen_item_events audit trail - who did what
 * to which tag, and when. Mirrors the desktop app's
 * database.log_item_event() and the mobile app's copy of this same
 * function.
 *
 * The actor is read from the current Supabase Auth session rather
 * than passed in, since every caller here already has one (this
 * dashboard requires login) - unlike the desktop app, which has no
 * login and relies on a manually-typed Operator Name instead.
 *
 * This throws on failure like every other function here, but callers
 * should treat it as best-effort (catch and log, don't let it block
 * the action it's describing) - a missed audit row is far less bad
 * than, say, a failed item registration.
 */
export async function logItemEvent(params: {
  tagId: string;
  eventType: ItemEventType;
  oldStatus?: string | null;
  newStatus?: string | null;
  customerName?: string | null;
  roomNumber?: string | null;
  detail?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from('linen_item_events').insert({
    tag_id: params.tagId,
    event_type: params.eventType,
    old_status: params.oldStatus ?? null,
    new_status: params.newStatus ?? null,
    customer_name: params.customerName ?? null,
    room_number: params.roomNumber ?? null,
    detail: params.detail ?? null,
    actor_id: userData.user?.id ?? null,
    actor_label: userData.user?.email ?? null,
    source_app: 'web',
  });

  if (error) {
    throw friendlyWriteError('log item event', error);
  }
}

/**
 * The most recent audit-trail events across every tag, newest first -
 * backs the Activity page. Capped at 200 rows; this is a recent-history
 * view, not a full export.
 */
export async function getRecentItemEvents(): Promise<ItemEvent[]> {
  const { data, error } = await supabase
    .from('linen_item_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load item events: ${error.message}`);
  }

  return (data ?? []).map(mapRowToItemEvent);
}

export interface LinenStats {
  total: number;
  inUse: number;
  laundry: number;
  storage: number;
}

/** Counts of items in each status, for the dashboard's stat cards. */
export function getStats(items: LinenItem[]): LinenStats {
  return {
    total: items.length,
    inUse: items.filter((item) => item.status === 'In Use').length,
    laundry: items.filter((item) => item.status === 'Laundry').length,
    storage: items.filter((item) => item.status === 'Storage').length,
  };
}
