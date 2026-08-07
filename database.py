"""
database.py

Handles all interaction with the SQLite database that stores linen
items registered under RFID tags (data/linen_system.db).
"""

import os
import sqlite3
import sys

from models import STATUS_IN_USE, LinenItem


def _get_base_dir():
    """
    Figure out the folder this program's data should live next to.

    When running from source, that's the folder this .py file is in.
    When running as a PyInstaller-built .exe, __file__ doesn't point
    next to the real .exe - PyInstaller unpacks the app into a
    temporary folder that gets deleted when the app closes - so we
    use the actual .exe's location instead.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


# Build an absolute path to the database file based on where this
# file lives, so the program works no matter which folder it's run
# from (e.g. running via an IDE's "Run" button vs. a terminal) and
# still works once packaged into a standalone .exe.
BASE_DIR = _get_base_dir()
DATABASE_PATH = os.path.join(BASE_DIR, "data", "linen_system.db")


def get_connection():
    """Open and return a connection to the SQLite database."""
    # Make sure the "data" folder exists before connecting, in case
    # it's missing (e.g. a fresh checkout without the data/ folder).
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    return sqlite3.connect(DATABASE_PATH)


def initialize_database():
    """
    Create the linen_items table if it doesn't already exist, and
    migrate older databases that were created before the "status"
    column existed.
    """
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS linen_items (
            tag_id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            room_number TEXT NOT NULL,
            item_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT '{STATUS_IN_USE}'
        )
        """
    )

    # If this database was created before "status" existed, add the
    # column now so old data keeps working (existing rows default to
    # "In Use").
    cursor.execute("PRAGMA table_info(linen_items)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if "status" not in existing_columns:
        cursor.execute(
            f"ALTER TABLE linen_items ADD COLUMN status TEXT NOT NULL DEFAULT '{STATUS_IN_USE}'"
        )

    connection.commit()
    connection.close()


def get_all_items(sort_by="tag_id"):
    """
    Retrieve every linen item currently saved in the database.

    Args:
        sort_by (str): Which column to sort by - "tag_id" or
            "customer_name". Defaults to "tag_id".

    Returns:
        list[LinenItem]: All saved linen items, sorted as requested.
    """
    # Only allow known column names here, since sort_by gets inserted
    # directly into the SQL query below.
    if sort_by not in ("tag_id", "customer_name"):
        sort_by = "tag_id"

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        "SELECT tag_id, customer_name, room_number, item_type, status "
        f"FROM linen_items ORDER BY {sort_by}"
    )
    rows = cursor.fetchall()
    connection.close()
    return [LinenItem(*row) for row in rows]


def get_item_by_tag(tag_id):
    """
    Look up a single linen item by its tag ID.

    Returns:
        LinenItem or None: The matching item, or None if no item has
        been registered under this tag.
    """
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        "SELECT tag_id, customer_name, room_number, item_type, status "
        "FROM linen_items WHERE tag_id = ?",
        (tag_id,),
    )
    row = cursor.fetchone()
    connection.close()
    return LinenItem(*row) if row else None


def delete_linen_item(tag_id):
    """
    Delete a linen item record by its tag ID.

    Does nothing if no item exists under that tag ID.
    """
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM linen_items WHERE tag_id = ?", (tag_id,))
    connection.commit()
    connection.close()


def update_item_status(tag_id, status):
    """
    Update just the status of an existing linen item (e.g. switching
    it between "In Use" and "Checked Out").

    Does nothing if no item exists under that tag ID.
    """
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        "UPDATE linen_items SET status = ? WHERE tag_id = ?",
        (status, tag_id),
    )
    connection.commit()
    connection.close()


def save_linen_item(item: LinenItem):
    """
    Save a LinenItem to the database.

    If the tag_id already exists, its record is updated with the new
    details (including status) instead of creating a duplicate row.
    """
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        """
        INSERT INTO linen_items (tag_id, customer_name, room_number, item_type, status)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(tag_id) DO UPDATE SET
            customer_name = excluded.customer_name,
            room_number = excluded.room_number,
            item_type = excluded.item_type,
            status = excluded.status
        """,
        (item.tag_id, item.customer_name, item.room_number, item.item_type, item.status),
    )
    connection.commit()
    connection.close()
