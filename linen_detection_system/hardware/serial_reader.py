"""
hardware/serial_reader.py

Talks to a real UHF RFID reader over a serial (COM) port.

This file is deliberately split into two halves:

  - The GENERIC TRANSPORT (top half): opening the port, running the
    background read thread, pushing parsed Tag IDs onto tag_queue.
    This works the same no matter which reader you end up buying, and
    shouldn't need to change.

  - The READER-SPECIFIC PROTOCOL (bottom half, clearly marked): what
    the raw bytes off the wire actually mean. This is unknown until a
    reader model is chosen - different UHF readers frame their data
    completely differently (plain ASCII lines, binary frames with a
    checksum, multiple tags per read burst, a required startup command
    before they'll stream anything, etc.). The two methods down there
    are placeholders with a reasonable default so the app keeps
    running, but they are the ONLY things you should need to rewrite
    once you have your reader's protocol datasheet in hand - nothing
    above them, and nothing in main.py, should need to change.
"""

import threading

try:
    import serial
except ImportError:
    # pyserial is only required if a "serial" reader is actually
    # configured (see reader_factory.py) - a pure-simulated setup
    # never imports this far, so it shouldn't need to be installed
    # just to run the app in simulated mode.
    serial = None

from .base import RFIDReader


class SerialRFIDReader(RFIDReader):
    """
    A generic serial-port RFID reader. The transport is fully built
    out; the protocol is a placeholder until a real reader is picked.
    """

    def __init__(self, role, port, baud_rate=115200, timeout=1.0):
        super().__init__(role)
        self.port = port
        self.baud_rate = baud_rate
        self.timeout = timeout
        self._serial = None
        self._read_thread = None
        self._running = False

    # ----------------------------------------------------------------
    # Generic transport - shouldn't need to change per reader model.
    # ----------------------------------------------------------------

    def connect(self):
        if serial is None:
            raise RuntimeError(
                "pyserial isn't installed. Run 'pip install pyserial' to use a "
                "real serial reader, or set this reader's \"type\" back to "
                "\"simulated\" in hardware_config.json until hardware is ready."
            )
        self._serial = serial.Serial(self.port, self.baud_rate, timeout=self.timeout)
        self._send_startup_commands()

    def disconnect(self):
        self.stop()
        if self._serial is not None:
            self._serial.close()
            self._serial = None

    def start(self):
        if self._serial is None:
            raise RuntimeError(f"{self.role}: connect() must succeed before start().")
        self._running = True
        self._read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._read_thread.start()

    def stop(self):
        # The read loop checks self._running between reads and exits
        # on its own within one read timeout - nothing to force here.
        # It's a daemon thread, so it also won't block the app from
        # closing even if it's mid-read.
        self._running = False

    def _read_loop(self):
        """
        Runs on a background thread for as long as self._running is
        True. Reads one frame at a time and, if it parses to a valid
        Tag ID, pushes it onto tag_queue for main.py's poll() to pick
        up next. Never touches tkinter directly - that's what makes
        this thread-safe (see base.py's docstring).
        """
        while self._running:
            try:
                raw_frame = self._read_one_frame()
            except Exception as error:
                # A serial read can fail if the device is unplugged
                # mid-session, or on a timeout depending on platform.
                # Don't let that kill the background thread - log it
                # and keep trying. (Auto-reconnect isn't implemented
                # yet - see the README's hardware section.)
                print(f"[{self.role}] Serial read error: {error}")
                continue

            if not raw_frame:
                continue  # read timed out with nothing received - normal, keep looping

            tag_id = self._parse_tag_from_frame(raw_frame)
            if tag_id:
                self.push(tag_id)

    def _read_one_frame(self):
        """
        Read exactly one "frame" of data from the serial port - as
        much raw data as one tag read produces, before handing it to
        _parse_tag_from_frame() below.

        PLACEHOLDER assumption: treats each newline-terminated line as
        one frame, which is how simple ASCII serial RFID modules
        behave. Replace this if your reader instead sends fixed-length
        binary frames, an STX/ETX-delimited packet, or something else
        - check your reader's protocol datasheet. This is really part
        of the reader-specific section below; it's only up here
        because it calls self._serial directly.
        """
        return self._serial.readline()

    # ================================================================
    # READER-SPECIFIC PROTOCOL - replace both methods below once a
    # reader model and its protocol documentation are in hand. Nothing
    # else in this file, or in main.py, needs to change when you do.
    # ================================================================

    def _send_startup_commands(self):
        """
        Called once, immediately after the port opens.

        Many UHF readers sit idle until told to start continuous
        inventory mode (a specific command byte sequence sent over
        serial); some start streaming reads on their own and need
        nothing here.

        PLACEHOLDER: does nothing yet. Replace with self._serial.write(...)
        of whatever startup/config command your reader's protocol requires.
        """
        pass

    def _parse_tag_from_frame(self, raw_frame):
        """
        Turn one raw frame of bytes into a Tag ID string, or None if
        the frame should be ignored (e.g. a checksum failure, a
        heartbeat/keepalive frame, or noise).

        PLACEHOLDER implementation: assumes the frame is plain ASCII
        text and the whole line *is* the Tag ID (decoded, whitespace
        stripped, uppercased). That's a reasonable default for simple
        serial modules, but real UHF readers commonly send binary
        frames instead - EPC hex, RSSI, antenna port, a checksum, and
        sometimes several tags per read burst that need splitting into
        multiple calls to self.tag_queue.put(). Replace this whole
        method with real parsing once you know your reader's protocol.
        """
        try:
            tag_id = raw_frame.decode("ascii", errors="ignore").strip().upper()
        except Exception:
            return None
        return tag_id or None
