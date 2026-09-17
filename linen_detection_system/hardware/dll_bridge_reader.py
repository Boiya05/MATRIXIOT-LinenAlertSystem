"""
hardware/dll_bridge_reader.py

An RFIDReader implementation for this specific reader unit (firmware
v5.2, reported reader type 0x86), which rejects the Inventory command
when driven by hardware/serial_reader.py's from-scratch protocol - and
even by the vendor's own 64-bit UHFReader18.dll. Only the vendor's
32-bit DLL build actually works against this unit (confirmed by direct
testing: it reads real tags correctly, including a 125-tag inventory
via the vendor's own demo software).

A 32-bit DLL can't be loaded via ctypes into this app's (64-bit)
Python process, and this app's other dependencies (supabase, etc.)
don't have straightforward 32-bit Windows wheels - so instead of
forcing the whole app onto 32-bit Python, this class launches
hardware/vendor/dll_bridge.py (a small, dependency-free script) as a
subprocess under a 32-bit Python interpreter, and reads tag EPCs from
its stdout, one per line. Everything else about this app (the GUI,
Supabase, the audit trail) is completely unaffected - main.py talks to
this class exactly the same way it talks to SimulatedReader or
SerialRFIDReader, via the same push()/poll() interface from
hardware/base.py.

If a future reader unit turns out to behave like the RD905UW this
project was originally built for (i.e. hardware/serial_reader.py's
plain Inventory command just works), that path is still there and
still simpler - this class is specifically for units that hit the
same 0xFE wall this one did.
"""

import os
import re
import subprocess
import threading

from .base import RFIDReader

BRIDGE_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor", "dll_bridge.py")

_TAG_LINE = re.compile(r"^TAG ([0-9A-Fa-f]+)$")


class DllBridgeReader(RFIDReader):
    """
    Talks to the reader through hardware/vendor/dll_bridge.py, run as a
    subprocess under a 32-bit Python interpreter.

    Args:
        role (str): matches a top-level key in hardware_config.json -
            in practice just "scanner" - see base.py.
        port (int): COM port number, e.g. 5 for COM5.
        python32_path (str): Path to a 32-bit Python interpreter
            (`py -0` lists installed ones; ctypes needs one that
            matches the bundled DLL's architecture, which is 32-bit).
        baud (int): Baud rate - 57600 is this reader family's
            documented default (see hardware/serial_reader.py's own
            comment on this).
        address (int): Reader address to use when opening the port -
            0xFF (broadcast) works regardless of the unit's actual
            configured address, per the vendor's own setup guide.
    """

    def __init__(self, role, port, python32_path, baud=57600, address=0xFF):
        super().__init__(role)
        self.port = port
        self.python32_path = python32_path
        self.baud = baud
        self.address = address
        self._process = None
        self._read_thread = None
        self._running = False

    def connect(self):
        if not os.path.exists(self.python32_path):
            raise RuntimeError(
                f"{self.role}: no 32-bit Python found at {self.python32_path} - "
                "install one (e.g. `winget install --id Python.Python.3.11 --architecture x86`) "
                "or fix hardware_config.json's python32_path."
            )
        if not os.path.exists(BRIDGE_SCRIPT):
            raise RuntimeError(f"{self.role}: bridge script missing at {BRIDGE_SCRIPT}")

        self._process = subprocess.Popen(
            [
                self.python32_path,
                BRIDGE_SCRIPT,
                "--port", str(self.port),
                "--baud", str(self.baud),
                "--address", hex(self.address),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,  # line-buffered, so READY/TAG/ERROR lines arrive as they're printed
        )

        # The bridge prints exactly one line - READY on success, ERROR
        # on failure - before it starts polling, so connect() can fail
        # fast with a clear message the same way SerialRFIDReader's
        # _send_startup_commands() does, instead of leaving main.py
        # thinking a reader connected when the subprocess actually
        # died on its first line.
        first_line = self._process.stdout.readline().strip()
        if first_line.startswith("ERROR"):
            self._process.wait(timeout=2)
            raise RuntimeError(f"{self.role}: {first_line[len('ERROR '):]}")
        if not first_line.startswith("READY"):
            raise RuntimeError(f"{self.role}: unexpected bridge output: {first_line!r}")

        parts = first_line.split()
        version, reader_type, power = parts[1], parts[2], parts[3]
        print(f"[{self.role}] Connected via DLL bridge: firmware v{version}, type {reader_type}, power {power} dBm")

    def disconnect(self):
        self.stop()
        if self._process is not None:
            self._process.terminate()
            try:
                self._process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self._process.kill()
            self._process = None

    def start(self):
        if self._process is None:
            raise RuntimeError(f"{self.role}: connect() must succeed before start().")
        self._running = True
        self._read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._read_thread.start()

    def stop(self):
        self._running = False

    def _read_loop(self):
        """
        Runs on a background thread for as long as self._running is
        True, reading the bridge subprocess's stdout line by line and
        pushing every TAG line onto tag_queue - mirrors
        SerialRFIDReader._read_loop()'s role, just fed by a subprocess
        instead of a serial port directly.
        """
        while self._running:
            line = self._process.stdout.readline()
            if not line:
                # The subprocess's stdout closed - it died. Same
                # non-fatal handling as a serial read error: log it and
                # stop this thread rather than crash the app: main.py
                # carries on without further reads from this reader
                # until it's restarted, the same as SerialRFIDReader's
                # documented lack of auto-reconnect.
                if self._running:
                    print(f"[{self.role}] DLL bridge subprocess exited unexpectedly")
                return

            line = line.strip()
            if not line:
                continue
            match = _TAG_LINE.match(line)
            if match:
                self.push(match.group(1))
            elif line.startswith("ERROR"):
                print(f"[{self.role}] {line}")
            # Anything else (stray stderr merged in via STDOUT) is
            # ignored rather than crashing the read loop.
