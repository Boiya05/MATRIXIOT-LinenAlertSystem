/**
 * lib/detector.ts
 *
 * The theft-detection rule, ported directly from the desktop app's
 * detector.py - kept in sync intentionally, not accidentally similar.
 * Both checkpoints (desktop and this dashboard's exit scanner) should
 * always agree on what counts as suspicious.
 *
 * A tag detected at the exit is flagged as a possible theft if:
 *   - it isn't registered in the system at all (an unknown tag
 *     showing up at the exit is suspicious on its own), or
 *   - the matching item's status isn't one of the statuses considered
 *     safe to leave with ("Laundry" or "Storage").
 *
 * Deliberately a whitelist (what's safe) rather than a blacklist
 * (what's unsafe, i.e. "In Use"): if `status` ever holds something
 * unexpected - a typo, a bug, a write that bypassed this app - a
 * blacklist would have silently let it pass the exit scanner; a
 * whitelist alarms instead, the safer direction to fail in a theft-
 * detection system. The real backstop is the
 * `linen_items_status_check` constraint in Postgres (see the mobile
 * app's README, "Status constraint") - this is defense in depth for
 * rows written before that existed, or by anything that skips this
 * file.
 */

import type { LinenItem } from '@/data/linen-data';

const SAFE_STATUSES: ReadonlySet<string> = new Set(['Laundry', 'Storage']);

export function checkTag(item: LinenItem | null): boolean {
  if (item === null) {
    // An unregistered tag reaching the exit is suspicious by itself.
    return true;
  }

  return !SAFE_STATUSES.has(item.status);
}
