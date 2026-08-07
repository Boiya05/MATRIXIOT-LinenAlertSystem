"""
alarm.py

Responsible for alerting staff when detector.py flags a possible
theft. Shows a pop-up warning window using tkinter, and also sends a
Telegram message to your phone via a Telegram bot.

The Telegram bot token and chat ID are kept in telegram_config.json
(NOT in this file), so the real credentials never end up hardcoded in
source code. See telegram_config.example.json for the expected format.
"""

import json
import os
import sys
import threading
import urllib.parse
import urllib.request
from tkinter import messagebox


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
TELEGRAM_CONFIG_PATH = os.path.join(BASE_DIR, "telegram_config.json")


def _load_telegram_config():
    """
    Read the Telegram bot token and chat ID from telegram_config.json.

    Returns:
        dict or None: {"bot_token": ..., "chat_id": ...}, or None if
        the file is missing or can't be parsed.
    """
    if not os.path.exists(TELEGRAM_CONFIG_PATH):
        return None

    try:
        with open(TELEGRAM_CONFIG_PATH, "r", encoding="utf-8") as config_file:
            return json.load(config_file)
    except (OSError, json.JSONDecodeError):
        return None


def _send_telegram_message(text):
    """
    Send a plain text message to your phone through the Telegram bot.

    This is best-effort: if the config file is missing or the request
    fails (e.g. no internet connection), it prints a warning instead
    of crashing the program - a failed Telegram alert shouldn't stop
    the pop-up warning from still appearing.
    """
    config = _load_telegram_config()
    if not config:
        print("Telegram not configured - skipping Telegram alert. See telegram_config.example.json.")
        return

    url = f"https://api.telegram.org/bot{config['bot_token']}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": config["chat_id"], "text": text}).encode("utf-8")

    try:
        urllib.request.urlopen(url, data=data, timeout=5)
    except Exception as error:
        print(f"Failed to send Telegram alert: {error}")


def trigger_alarm(tag_id, item=None):
    """
    Warn about a tag detected at the exit reader: shows a pop-up
    window on screen and sends a matching Telegram message.

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
    else:
        details = (
            f"Tag: {tag_id}\n\n"
            "This tag isn't registered in the system, but it was just "
            "detected leaving through the exit scanner!"
        )

    # messagebox.showerror() below blocks until the user clicks OK, so
    # if we called _send_telegram_message() after it, the Telegram
    # message wouldn't send until the pop-up was dismissed. Sending it
    # on a background thread first lets both go out at the same time.
    telegram_text = f"🚨 THEFT ALERT 🚨\n\n{details}"
    threading.Thread(target=_send_telegram_message, args=(telegram_text,), daemon=True).start()

    messagebox.showerror("⚠ THEFT ALERT ⚠", details)
