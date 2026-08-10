"""
models.py

Defines the data structures ("models") used throughout the system.

Right now there is one model: LinenItem, which represents a single
linen item registered under an RFID tag (for example, a towel or bed
sheet checked out to a customer/room).
"""

from dataclasses import dataclass

# The three statuses a linen item can have:
#   - IN_USE: the item is currently with a customer (e.g. in their room).
#   - LAUNDRY: the item has been picked up and is being washed.
#   - STORAGE: the item is stored and not currently in use by anyone.
STATUS_IN_USE = "In Use"
STATUS_LAUNDRY = "Laundry"
STATUS_STORAGE = "Storage"


@dataclass
class LinenItem:
    """A linen item tracked by an RFID tag."""

    tag_id: str
    customer_name: str
    room_number: str
    item_type: str
    status: str = STATUS_IN_USE
