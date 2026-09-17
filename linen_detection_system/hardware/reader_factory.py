"""
hardware/reader_factory.py

Builds the RFIDReader for the app's one physical scanner ("scanner" in
hardware_config.json), so main.py never has to know or care whether it
got a SimulatedReader, a SerialRFIDReader, or a DllBridgeReader - it
just calls connect() / start() / poll() the same way regardless. Which
of the two things a tag read *means* (register vs. exit-scan) is a
runtime mode toggle in main.py, not a separate reader/role - see its
module docstring.
"""

import json
import os
import sys

from .dll_bridge_reader import DllBridgeReader
from .serial_reader import SerialRFIDReader
from .simulated_reader import SimulatedReader

# Default location of a 32-bit Python interpreter for DllBridgeReader -
# see its own docstring for why one is needed at all. Overridable per
# reader via hardware_config.json's "python32_path", since this is
# just where `winget install --id Python.Python.3.11 --architecture x86`
# happens to have put it on the machine this was set up on.
_DEFAULT_PYTHON32_PATH = r"C:\Users\Administrator\AppData\Local\Programs\Python\Python311-32\python.exe"


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
# missing hardware_config.json just means "simulated" rather than an
# error.
_DEFAULT_CONFIG = {
    "scanner": {"type": "simulated"},
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
        role (str): matches a top-level key in hardware_config.json -
            in practice just "scanner", the app's one physical reader.

    Returns:
        RFIDReader: a SimulatedReader (the default), a SerialRFIDReader
        if hardware_config.json sets this role's "type" to "serial",
        or a DllBridgeReader if set to "uhfreader18_dll" - see
        DllBridgeReader's own docstring for which reader units actually
        need that third option.
    """
    config = _load_hardware_config().get(role, {"type": "simulated"})
    reader_type = config.get("type", "simulated")

    if reader_type == "serial":
        return SerialRFIDReader(
            role=role,
            port=config["port"],
            # 57600bps is the RD905UW/UHFReader18 protocol's documented
            # default (see hardware/serial_reader.py) - not a generic
            # serial guess, so that's the fallback if a config omits it.
            baud_rate=config.get("baud_rate", 57600),
            address=config.get("address", 0x00),
            poll_interval=config.get("poll_interval", 0.2),
        )

    if reader_type == "uhfreader18_dll":
        return DllBridgeReader(
            role=role,
            port=config["port"],
            python32_path=config.get("python32_path", _DEFAULT_PYTHON32_PATH),
            baud=config.get("baud_rate", 57600),
            address=config.get("address", 0xFF),
        )

    return SimulatedReader(role)
