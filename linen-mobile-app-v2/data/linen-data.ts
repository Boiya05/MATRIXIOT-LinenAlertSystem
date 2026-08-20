/**
 * linen-data.ts
 *
 * The single place every screen goes through to read linen data. This
 * used to return hardcoded mock data so the UI could be built without
 * a backend connection - it now reads from the same Supabase table
 * the desktop app uses, so both apps show the same live data. No
 * screen needed to change for this swap, only the functions below.
 */

import { supabase } from '@/lib/supabase';

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
 * Exported (not just used internally) so the realtime INSERT handler in
 * hooks/use-theft-alerts.ts can turn the raw payload row Supabase sends
 * straight into an AlertEvent for a notification, without a second
 * network round-trip to re-fetch the same row it was just given.
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
 * Look up a single linen item by its tag ID - used by the Scan tab's
 * exit scanner to check whether a scanned tag is registered, and what
 * status it's in, before deciding whether to flag it. Mirrors the
 * desktop app's database.get_item_by_tag() and the web dashboard's
 * function of the same name.
 */
export async function getItemByTag(tagId: string): Promise<LinenItem | null> {
  const { data, error } = await supabase.from('linen_items').select('*').eq('tag_id', tagId).maybeSingle();

  if (error) {
    throw new Error(`Failed to look up tag: ${error.message}`);
  }

  return data ? mapRowToLinenItem(data) : null;
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
    throw new Error(`Failed to save item: ${error.message}`);
  }
}

/**
 * Record a theft alert - mirrors the desktop app's
 * database.log_theft_alert(). Called by the Scan tab's exit scanner
 * when a scanned tag is flagged (see lib/detector.ts).
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
    throw new Error(`Failed to log theft alert: ${error.message}`);
  }
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

/** Marks an alert as dismissed (pressing "OK" on it). */
export async function dismissAlert(alertId: number): Promise<void> {
  const { error } = await supabase.from('theft_alerts').update({ dismissed: true }).eq('id', alertId);

  if (error) {
    throw new Error(`Failed to dismiss alert: ${error.message}`);
  }
}

/**
 * Record one row in the linen_item_events audit trail - who did what
 * to which tag, and when. Mirrors the desktop app's
 * database.log_item_event() and the web dashboard's copy of this same
 * function.
 *
 * The actor is read from the current Supabase Auth session rather
 * than passed in, since every caller here already has one (this app
 * requires login) - unlike the desktop app, which has no login and
 * relies on a manually-typed Operator Name instead.
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
    source_app: 'mobile',
  });

  if (error) {
    throw new Error(`Failed to log item event: ${error.message}`);
  }
}

export interface LinenStats {
  total: number;
  inUse: number;
  laundry: number;
  storage: number;
}

/** Counts of items in each status, for the Home screen's stat cards. */
export function getStats(items: LinenItem[]): LinenStats {
  return {
    total: items.length,
    inUse: items.filter((item) => item.status === 'In Use').length,
    laundry: items.filter((item) => item.status === 'Laundry').length,
    storage: items.filter((item) => item.status === 'Storage').length,
  };
}

export interface RoomSummary {
  roomNumber: string;
  customerName: string;
  itemCount: number;
}

/**
 * Rooms that currently have linen in them - i.e. rooms with at least
 * one item still marked "In Use". Items in Laundry or Storage aren't
 * physically in a room anymore, so they don't count here.
 */
export function getActiveRooms(items: LinenItem[]): RoomSummary[] {
  const inUseItems = items.filter((item) => item.status === 'In Use');
  const roomsByNumber = new Map<string, RoomSummary>();

  for (const item of inUseItems) {
    const existing = roomsByNumber.get(item.roomNumber);
    if (existing) {
      existing.itemCount += 1;
    } else {
      roomsByNumber.set(item.roomNumber, {
        roomNumber: item.roomNumber,
        customerName: item.customerName,
        itemCount: 1,
      });
    }
  }

  return Array.from(roomsByNumber.values()).sort((a, b) =>
    a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
  );
}

/** The linen items currently in use in a specific room. */
export function getItemsForRoom(items: LinenItem[], roomNumber: string): LinenItem[] {
  return items.filter((item) => item.roomNumber === roomNumber && item.status === 'In Use');
}

export interface TypeSummary {
  itemType: string;
  count: number;
}

/**
 * Items with the given status (Laundry or Storage), grouped by item
 * type and sorted alphabetically. Unlike "In Use" items, these aren't
 * tied to a customer/room anymore, so they're categorized by what
 * they are instead of where they are.
 */
export function getGroupedByType(items: LinenItem[], status: LinenStatus): TypeSummary[] {
  const matching = items.filter((item) => item.status === status);
  const countsByType = new Map<string, number>();

  for (const item of matching) {
    countsByType.set(item.itemType, (countsByType.get(item.itemType) ?? 0) + 1);
  }

  return Array.from(countsByType.entries())
    .map(([itemType, count]) => ({ itemType, count }))
    .sort((a, b) => a.itemType.localeCompare(b.itemType));
}

/** The tag IDs of items matching a specific status + item type. */
export function getItemsByStatusAndType(
  items: LinenItem[],
  status: LinenStatus,
  itemType: string
): LinenItem[] {
  return items.filter((item) => item.status === status && item.itemType === itemType);
}