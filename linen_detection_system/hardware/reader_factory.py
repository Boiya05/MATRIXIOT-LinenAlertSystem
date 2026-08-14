"""
hardware/reader_factory.py

Builds the right RFIDReader for each checkpoint ("entry_reader" or
"exit_reader") based on hardware_config.json, so main.py never has to
know or care whether it got a SimulatedReader or a SerialRFIDReader -
it just calls connect() / start() / poll() the same way either way.
"""

import json
import os
import sys

from .serial_reader import SerialRFIDReader
from .simulated_reader import SimulatedReader


def _get_base_dir():
    """
    Same convention as database.py / alarm.py - see those files for
    why __file__ isn't reliable once this is packaged as a .exe.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    # This file lives in hardware/, one level below the project root
    # that hardware_config.json sits next to.
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


BASE_DIR = _get_base_dir()
HARDWARE_CONFIG_PATH = os.path.join(BASE_DIR, "hardware_config.json")

# Unlike Supabase/Telegram config, hardware config isn't required for
# the app to run - simulated mode needs no configuration at all, so a
# missing hardware_config.json just means "everything simulated"
# rather than an error.
_DEFAULT_CONFIG = {
    "entry_reader": {"type": "simulated"},
    "exit_reader": {"type": "simulated"},
}


def _load_hardware_config():
    """Read hardware_config.json, or fall back to all-simulated if it's missing."""
    if not os.path.exists(HARDWARE_CONFIG_PATH):
        return _DEFAULT_CONFIG
    with open(HARDWARE_CONFIG_PATH, "r", encoding="utf-8") as config_file:
        return json.load(config_file)


def create_reader(role):
    """
    Build the RFIDReader configured for the given role.

    Args:
        role (str): "entry_reader" or "exit_reader" - matches the
            top-level keys in hardware_config.json.

    Returns:
        RFIDReader: a SimulatedReader (the default), or a
        SerialRFIDReader if hardware_config.json sets this role's
        "type" to "serial".
    """
    config = _load_hardware_config().get(role, {"type": "simulated"})
    reader_type = config.get("type", "simulated")

    if reader_type == "serial":
        return SerialRFIDReader(
            role=role,
            port=config["port"],
            baud_rate=config.get("baud_rate", 115200),
        )

    return SimulatedReader(role)
