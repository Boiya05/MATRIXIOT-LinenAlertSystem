"""
detector.py

Contains the theft-detection logic.

There is a single RFID reader placed at the exit. A tag detected
there is flagged as a possible theft if:
  - it isn't registered in the system at all (an unknown tag showing
    up at the exit is suspicious on its own), or
  - the matching item's status isn't one of the statuses considered
    safe to leave with ("Laundry" or "Storage").

Items marked "Laundry" (picked up to be washed) or "Storage" (stored,
not currently with any customer) are allowed to pass the exit reader
without being flagged - both are treated as normal staff movement,
not a customer walking off with something. Deliberately a whitelist
(what's safe) rather than a blacklist (what's unsafe, i.e. "In Use"):
if `status` ever holds something unexpected - a typo, a bug, a direct
write that bypassed this app - a blacklist would have silently let it
pass the exit scanner; a whitelist alarms instead, which is the safer
direction to fail in a theft-detection system. The real backstop is
the `linen_items_status_check` constraint in Postgres (see the mobile
app's README, "Status constraint") - this is defense in depth for rows
written before that existed, or by anything that skips this file.
"""

from models import STATUS_LAUNDRY, STATUS_STORAGE

SAFE_STATUSES = {STATUS_LAUNDRY, STATUS_STORAGE}


def check_tag(tag_id, item=None):
    """
    Decide whether a tag detected at the exit reader looks like theft.

    Args:
        tag_id (str): The tag ID picked up by the exit reader.
        item (LinenItem or None): The matching item's saved details,
            or None if this tag isn't registered at all.

    Returns:
        bool: True if this scan should trigger the alarm.
    """
    if item is None:
        # An unregistered tag reaching the exit is suspicious by itself.
        return True

    return item.status not in SAFE_STATUSES
