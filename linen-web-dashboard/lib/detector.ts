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
 *   - the matching item's status is "In Use" (it's currently with a
 *     customer, so it shouldn't be leaving on its own).
 *
 * Items marked "Laundry" or "Storage" are allowed to pass the exit
 * reader without being flagged - both are treated as normal staff
 * movement, not a customer walking off with something.
 */

import type { LinenItem } from '@/data/linen-data';

export function checkTag(item: LinenItem | null): boolean {
  if (item === null) {
    // An unregistered tag reaching the exit is suspicious by itself.
    return true;
  }

  return item.status === 'In Use';
}
