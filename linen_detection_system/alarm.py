"""
alarm.py

Responsible for alerting staff when detector.py flags a possible
theft. Shows a pop-up warning window using tkinter, and also sends a
WhatsApp message to your phone via Twilio's WhatsApp Sandbox.

The Twilio credentials are kept in whatsapp_config.json (NOT in this
file), so the real credentials never end up hardcoded in source code.
See whatsapp_config.example.json for the expected format and the
desktop app's README for how to get a sandbox set up.
"""

import base64
import json
import os
import sys
import threading
import urllib.parse
import urllib.request
from tkinter import messagebox

import database


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
WHATSAPP_CONFIG_PATH = os.path.join(BASE_DIR, "whatsapp_config.json")


def _load_whatsapp_config():
    """
    Read the Twilio account SID, auth token, and phone numbers from
    whatsapp_config.json.

    Returns:
        dict or None: {"account_sid": ..., "auth_token": ...,
        "from_number": ..., "to_number": ...}, or None if the file is
        missing or can't be parsed.
    """
    if not os.path.exists(WHATSAPP_CONFIG_PATH):
        return None

    try:
        with open(WHATSAPP_CONFIG_PATH, "r", encoding="utf-8") as config_file:
            return json.load(config_file)
    except (OSError, json.JSONDecodeError):
        return None


def _send_whatsapp_message(text):
    """
    Send a plain text message to your phone through Twilio's WhatsApp
    API.

    This is best-effort: if the config file is missing or the request
    fails (e.g. no internet connection, or the phone hasn't joined the
    Twilio sandbox), it prints a warning instead of crashing the
    program - a failed WhatsApp alert shouldn't stop the pop-up
    warning from still appearing.
    """
    config = _load_whatsapp_config()
    if not config:
        print("WhatsApp not configured - skipping WhatsApp alert. See whatsapp_config.example.json.")
        return

    url = f"https://api.twilio.com/2010-04-01/Accounts/{config['account_sid']}/Messages.json"
    data = urllib.parse.urlencode(
        {"From": config["from_number"], "To": config["to_number"], "Body": text}
    ).encode("utf-8")

    # Twilio's API uses HTTP Basic Auth (Account SID as the username,
    # Auth Token as the password) rather than a bearer token - built
    # by hand here rather than pulling in the official `twilio`
    # package, the same reasoning as using plain urllib for Telegram
    # before: one HTTP call doesn't need a whole SDK dependency.
    credentials = base64.b64encode(f"{config['account_sid']}:{config['auth_token']}".encode("utf-8")).decode(
        "ascii"
    )
    request = urllib.request.Request(url, data=data, headers={"Authorization": f"Basic {credentials}"})

    try:
        urllib.request.urlopen(request, timeout=5)
    except Exception as error:
        print(f"Failed to send WhatsApp alert: {error}")


def _log_alert_to_supabase(tag_id, item, message):
    """
    Save this alert to the theft_alerts table so the mobile app's Home
    screen can show it live via Supabase Realtime.

    Best-effort, same as _send_whatsapp_message: a logging failure
    (e.g. no internet) shouldn't stop the pop-up or WhatsApp alert.
    """
    try:
        database.log_theft_alert(tag_id, item, message)
    except Exception as error:
        print(f"Failed to log theft alert to Supabase: {error}")


def trigger_alarm(tag_id, item=None):
    """
    Warn about a tag detected at the exit reader: shows a pop-up
    window on screen and sends a matching WhatsApp message.

    Args:
        tag_id (str): The tag ID that triggered the alarm.
        item (LinenItem or None): The matching item's saved details,
            if this tag has been registered. If None, the tag isn't
            in the database at all.
    """
    if item is not None:
        details = (
            f"Tag: {item.tag_id}\n"
            f"Customer: {item.customer_name}\n"
            f"Room: {item.room_number}\n"
            f"Item: {item.item_type}\n"
            f"Status: {item.status}\n\n"
            "This item was just detected leaving through the exit scanner!"
        )
        alert_message = (
            f"{item.item_type} ({tag_id}) was detected at the exit scanner "
            f"while marked {item.status}."
        )
    else:
        details = (
            f"Tag: {tag_id}\n\n"
            "This tag isn't registered in the system, but it was just "
            "detected leaving through the exit scanner!"
        )
        alert_message = f"Unregistered tag {tag_id} was detected at the exit scanner."

    # messagebox.showerror() below blocks until the user clicks OK, so
    # if we called the network sends after it, they wouldn't go out
    # until the pop-up was dismissed. Sending both on background
    # threads first lets everything go out at the same time.
    whatsapp_text = f"🚨 THEFT ALERT 🚨\n\n{details}"
    threading.Thread(target=_send_whatsapp_message, args=(whatsapp_text,), daemon=True).start()
    threading.Thread(
        target=_log_alert_to_supabase, args=(tag_id, item, alert_message), daemon=True
    ).start()

    messagebox.showerror("⚠ THEFT ALERT ⚠", details)
