"""
detector.py

Contains the theft-detection logic.

There is a single RFID reader placed at the exit. A tag detected
there is flagged as a possible theft if:
  - it isn't registered in the system at all (an unknown tag showing
    up at the exit is suspicious on its own), or
  - the matching item's status is "In Use" (it's currently with a
    customer, so it shouldn't be leaving on its own).

Items marked "Laundry" (picked up to be washed) or "Storage" (stored,
not currently with any customer) are allowed to pass the exit reader
without being flagged - both are treated as normal staff movement,
not a customer walking off with something.
"""

from models import STATUS_IN_USE


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

    # Registered items only alarm while they're "In Use" (with a
    # customer). "Laundry" and "Storage" items are allowed to pass.
    return item.status == STATUS_IN_USE
