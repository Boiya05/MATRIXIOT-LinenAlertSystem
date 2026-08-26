"""
database.py

Handles all interaction with the Supabase database that stores linen
items registered under RFID tags. This used to talk to a local SQLite
file - it now talks to a shared Supabase project instead, so the same
data is visible from both this desktop app and the mobile companion
app.

linen_items and theft_alerts have Row Level Security requiring a
logged-in user. This app doesn't have its own login screen, so it
authenticates as Supabase's "service_role" instead, which bypasses RLS
entirely - appropriate here since this is a trusted internal tool, not
a public client. The mobile app takes the opposite approach: it uses
the public "publishable" key and requires the user to log in, so RLS
is what protects the data there.

The Supabase project URL and service_role key are kept in
supabase_config.json (NOT in this file), so the real credentials never
end up hardcoded in source code. See supabase_config.example.json for
the expected format.

Unlike the publishable key used elsewhere in this project, the
service_role key is a real secret - it grants full, unrestricted
access to the database. Treat supabase_config.json with the same care
as telegram_config.json.
"""

import json
import os
import sys

from supabase import create_client

from models import LinenItem

TABLE_NAME = "linen_items"
ALERTS_TABLE_NAME = "theft_alerts"
EVENTS_TABLE_NAME = "linen_item_events"


def _get_base_dir():
    """
    Figure out the folder this program's config should live next to.

    When running from source, that's the folder this .py file is in.
    When running as a PyInstaller-built .exe, __file__ doesn't point
    next to the real .exe - PyInstaller unpacks the app into a
    temporary folder that gets deleted when the app closes - so we
    use the actual .exe's location instead.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


BASE_DIR = _get_base_dir()
SUPABASE_CONFIG_PATH = os.path.join(BASE_DIR, "supabase_config.json")

# The connected Supabase client, created once and reused. See
# get_client() below.
_client = None


def _load_supabase_config():
    """
    Read the Supabase project URL and service_role key from
    supabase_config.json.

    Returns:
        dict: {"url": ..., "service_role_key": ...}

    Raises:
        FileNotFoundError: if supabase_config.json doesn't exist yet.
    """
    if not os.path.exists(SUPABASE_CONFIG_PATH):
        raise FileNotFoundError(
            "supabase_config.json not found. Copy supabase_config.example.json "
            "to supabase_config.json and fill in your project URL and service_role key."
        )
    with open(SUPABASE_CONFIG_PATH, "r", encoding="utf-8") as config_file:
        return json.load(config_file)


def get_client():
    """Return a connected Supabase client, creating it on first use."""
    global _client
    if _client is None:
        config = _load_supabase_config()
        _client = create_client(config["url"], config["service_role_key"])
    return _client


def initialize_database():
    """
    Confirm the app can actually reach the linen_items table.

    Unlike the old SQLite version, this doesn't create tables or run
    migrations - the table lives in Supabase and is managed there
    (see the Supabase dashboard's Table Editor). This just does a
    lightweight check so connection problems are caught early, with a
    clear error, instead of surfacing confusingly later.
    """
    get_client().table(TABLE_NAME).select("tag_id").limit(1).execute()


def get_all_items(sort_by="tag_id"):
    """
    Retrieve every linen item currently saved in the database.

    Args:
        sort_by (str): Which column to sort by - "tag_id",
            "customer_name", or "item_type". Defaults to "tag_id".

    Returns:
        list[LinenItem]: All saved linen items, sorted as requested.
    """
    # Only allow known column names here, since sort_by is used
    # directly in the query below.
    if sort_by not in ("tag_id", "customer_name", "item_type"):
        sort_by = "tag_id"

    response = get_client().table(TABLE_NAME).select("*").order(sort_by).execute()
    return [LinenItem(**row) for row in response.data]


def get_item_by_tag(tag_id):
    """
    Look up a single linen item by its tag ID.

    Returns:
        LinenItem or None: The matching item, or None if no item has
        been registered under this tag.
    """
    response = get_client().table(TABLE_NAME).select("*").eq("tag_id", tag_id).execute()
    return LinenItem(**response.data[0]) if response.data else None


def delete_linen_item(tag_id):
    """
    Delete a linen item record by its tag ID.

    Does nothing if no item exists under that tag ID.
    """
    get_client().table(TABLE_NAME).delete().eq("tag_id", tag_id).execute()


def update_item_status(tag_id, status):
    """
    Update just the status of an existing linen item (e.g. switching
    it between "In Use", "Laundry", and "Storage").

    Does nothing if no item exists under that tag ID.
    """
    get_client().table(TABLE_NAME).update({"status": status}).eq("tag_id", tag_id).execute()


def save_linen_item(item: LinenItem):
    """
    Save a LinenItem to the database.

    If the tag_id already exists, its record is updated with the new
    details (including status) instead of creating a duplicate row.
    """
    get_client().table(TABLE_NAME).upsert(
        {
            "tag_id": item.tag_id,
            "customer_name": item.customer_name,
            "room_number": item.room_number,
            "item_type": item.item_type,
            "status": item.status,
        },
        on_conflict="tag_id",
    ).execute()


def log_theft_alert(tag_id, item=None, message=""):
    """
    Record a theft alert in the theft_alerts table, so the mobile app
    can show it live (via Supabase Realtime) alongside the on-screen
    pop-up and Telegram message.

    Args:
        tag_id (str): The tag ID that triggered the alarm.
        item (LinenItem or None): The matching item's saved details,
            if this tag is registered. If None, the tag isn't in the
            database at all, so "Unknown" is recorded instead.
        message (str): The human-readable alert message shown to the user.
    """
    get_client().table(ALERTS_TABLE_NAME).insert(
        {
            "tag_id": tag_id,
            "item_type": item.item_type if item else "Unknown",
            "room_number": item.room_number if item else "Unknown",
            "customer_name": item.customer_name if item else "Unknown",
            "message": message,
        }
    ).execute()


def has_active_alert(tag_id):
    """
    Check whether this tag already has an undismissed theft alert
    waiting - used by main.py's exit scanner so a tag sitting near (or
    repeatedly passing) the reader only raises one alert instead of a
    fresh one every time it's re-scanned. Once dismissed (from any of
    the three apps - theft_alerts is shared), the next flagged scan of
    that tag raises a new one again.

    Returns:
        bool: True if an undismissed alert already exists for this tag.
    """
    response = (
        get_client()
        .table(ALERTS_TABLE_NAME)
        .select("id")
        .eq("tag_id", tag_id)
        .eq("dismissed", False)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def log_item_event(
    tag_id,
    event_type,
    old_status=None,
    new_status=None,
    customer_name=None,
    room_number=None,
    detail=None,
    actor_label=None,
):
    """
    Record one row in the linen_item_events audit trail - who did
    what to which tag, and when.

    This app has no login screen (see this file's module docstring),
    so there's no automatic "who" the way the mobile/web apps get from
    a signed-in session - actor_label is whatever's typed into the
    Operator Name field in the GUI (see main.py), or None if left
    blank.

    Args:
        tag_id (str): The tag this event is about.
        event_type (str): One of "registered", "edited",
            "status_changed", "deleted", "alert_triggered",
            "alert_dismissed" - matches the CHECK constraint on the
            table, see the mobile app's README for the exact SQL.
        old_status / new_status (str or None): The status before/after,
            for "status_changed"; leave both None for event types
            where status doesn't apply.
        customer_name / room_number (str or None): Whoever/wherever the
            item was assigned to at the time of this event.
        detail (str or None): Free-text extra context that doesn't fit
            a structured column - e.g. the item type, or a summary of
            what an edit changed.
        actor_label (str or None): Human-readable "who did this" - see
            above.

    This is meant to be best-effort at the call site (wrapped in
    try/except there), the same as log_theft_alert: a failure to write
    an audit row should never block or crash the action it describes.
    """
    get_client().table(EVENTS_TABLE_NAME).insert(
        {
            "tag_id": tag_id,
            "event_type": event_type,
            "old_status": old_status,
            "new_status": new_status,
            "customer_name": customer_name,
            "room_number": room_number,
            "detail": detail,
            "actor_label": actor_label,
            "source_app": "desktop",
        }
    ).execute()