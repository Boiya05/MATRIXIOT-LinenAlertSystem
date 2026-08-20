"""
alarm.py

Responsible for alerting staff when detector.py flags a possible
theft. Shows a pop-up warning window using tkinter, and sends both:
- A Telegram message (full alert details - Telegram has no template
  restriction, so this is the channel that actually carries the real
  tag/customer/room/item breakdown).
- A WhatsApp message via Twilio's WhatsApp Sandbox (a generic "check
  the app" ping only - Twilio's sandbox requires a fixed, pre-approved
  Content Template on a Trial account, so it can't carry the real
  details - see WHATSAPP_TEMPLATE_CONTENT_SID below).

Both sets of credentials are kept in their own config files (NOT in
this file), so real credentials never end up hardcoded in source code:
telegram_config.json / telegram_config.example.json and
whatsapp_config.json / whatsapp_config.example.json. Either channel is
independently optional - if one config file is missing, that channel
is just skipped (printed as a warning), the other still fires.
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
TELEGRAM_CONFIG_PATH = os.path.join(BASE_DIR, "telegram_config.json")
WHATSAPP_CONFIG_PATH = os.path.join(BASE_DIR, "whatsapp_config.json")


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

# Twilio's WhatsApp Sandbox rejects free-form message text (error
# 21654 "ContentSid Required") - in testing, this happened even right
# after (re)joining the sandbox, so it isn't just the usual "only
# free-form within 24 hours of the user's last message" WhatsApp rule
# - this sandbox required a template every time. Content Sid below is
# one of Twilio's 3 built-in sandbox templates ("Appointment
# Reminders") - its wording is fixed ("Reminder: Appt...") and not
# customizable on a Trial account (the Content API needed to inspect/
# edit templates returns "not available on a Trial account"), so it
# can't say the real alert details. It reliably delivers though, which
# is what actually matters here - the real details are already fully
# visible in the desktop/mobile/web apps by the time this arrives.
WHATSAPP_TEMPLATE_CONTENT_SID = "HXfe5ab5f00277942d4d4200328b4d403c"


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
    Send a WhatsApp message to your phone through Twilio's WhatsApp
    Sandbox.

    The actual WhatsApp message is NOT `text` - see the
    WHATSAPP_TEMPLATE_CONTENT_SID comment above for why: the sandbox
    only accepts a fixed, pre-approved template, not free-form
    content. `text` is printed to the terminal so the real, full alert
    is visible somewhere, even though it isn't what shows up on
    WhatsApp.

    This is best-effort: if the config file is missing or the request
    fails (e.g. no internet connection), it prints a warning instead
    of crashing the program - a failed WhatsApp alert shouldn't stop
    the pop-up warning from still appearing.
    """
    # Some Windows consoles (cp1252, not UTF-8) can't print emoji and
    # raise UnicodeEncodeError - this print is purely diagnostic, so a
    # console that can't display it should fall back to a safe form
    # instead of crashing the alert flow.
    try:
        print(f"[WhatsApp alert - full text below; WhatsApp itself only shows a generic template]\n{text}")
    except UnicodeEncodeError:
        safe_text = text.encode(sys.stdout.encoding or "ascii", errors="replace").decode(
            sys.stdout.encoding or "ascii"
        )
        print(f"[WhatsApp alert - full text below; WhatsApp itself only shows a generic template]\n{safe_text}")

    config = _load_whatsapp_config()
    if not config:
        print("WhatsApp not configured - skipping WhatsApp alert. See whatsapp_config.example.json.")
        return

    url = f"https://api.twilio.com/2010-04-01/Accounts/{config['account_sid']}/Messages.json"
    data = urllib.parse.urlencode(
        {
            "From": config["from_number"],
            "To": config["to_number"],
            "ContentSid": WHATSAPP_TEMPLATE_CONTENT_SID,
        }
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


def _log_event_to_supabase(tag_id, item, actor_label):
    """
    Record this alert as an "alert_triggered" row in the
    linen_item_events audit trail - see database.log_item_event().

    Best-effort, same reasoning as _log_alert_to_supabase above: this
    is a secondary record of the same event theft_alerts already
    captures, so a failure here shouldn't affect the pop-up, the
    notifications, or the theft_alerts row itself.
    """
    try:
        database.log_item_event(
            tag_id,
            "alert_triggered",
            old_status=item.status if item else None,
            customer_name=item.customer_name if item else None,
            room_number=item.room_number if item else None,
            detail=item.item_type if item else None,
            actor_label=actor_label,
        )
    except Exception as error:
        print(f"Failed to log audit event: {error}")


def trigger_alarm(tag_id, item=None, actor_label=None):
    """
    Warn about a tag detected at the exit reader: shows a pop-up
    window on screen and sends a matching Telegram message (full
    details) and WhatsApp message (generic ping).

    Args:
        tag_id (str): The tag ID that triggered the alarm.
        item (LinenItem or None): The matching item's saved details,
            if this tag has been registered. If None, the tag isn't
            in the database at all.
        actor_label (str or None): Whoever's operating the desktop
            terminal right now (the Operator Name field in main.py),
            for the linen_item_events audit trail - see
            _log_event_to_supabase() below.
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
    #
    # Short and generic on purpose: the WhatsApp message itself can't
    # actually show this text (Twilio's sandbox only sends a fixed
    # template - see WHATSAPP_TEMPLATE_CONTENT_SID above), so there's
    # no point building the full tag/customer/room/item breakdown here
    # the way `details` does for the on-screen pop-up. This still gets
    # printed to the terminal for anyone watching the desktop app
    # directly - the real destination for full details is the app
    # itself (this pop-up, or the mobile/web apps), which is exactly
    # what this message points people to.
    telegram_text = f"🚨 THEFT ALERT 🚨\n\n{details}"
    threading.Thread(target=_send_telegram_message, args=(telegram_text,), daemon=True).start()

    whatsapp_text = "🚨 Theft Alert! Check the app to see what was stolen."
    threading.Thread(target=_send_whatsapp_message, args=(whatsapp_text,), daemon=True).start()

    threading.Thread(
        target=_log_alert_to_supabase, args=(tag_id, item, alert_message), daemon=True
    ).start()

    threading.Thread(
        target=_log_event_to_supabase, args=(tag_id, item, actor_label), daemon=True
    ).start()

    messagebox.showerror("⚠ THEFT ALERT ⚠", details)
