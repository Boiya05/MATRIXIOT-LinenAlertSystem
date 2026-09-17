"""
hardware/serial_reader.py

Talks to a real UHF RFID reader over a serial (COM) port - concretely,
the RD905UW that ships in the MS9 package, speaking the "UHFReader18"
protocol (see hardware/uhfreader18_protocol.py for the byte-level
format, and its module docstring for the docs this was built from).

This file is split into two halves:

  - The GENERIC TRANSPORT (top half): opening the port, running the
    background read thread, pushing parsed Tag IDs onto tag_queue.
    Works the same regardless of reader protocol details, and
    shouldn't need to change.

  - The READER-SPECIFIC PROTOCOL (bottom half, clearly marked): what
    the bytes on the wire actually mean, delegated entirely to
    hardware/uhfreader18_protocol.py (a pure, hardware-free module -
    see tests/test_uhfreader18_protocol.py, which verifies it against
    a real captured frame from the reader without needing any COM
    port). This is the half to change if a different reader model
    ever replaces the RD905UW.

One thing that's NOT the same shape as a typical placeholder swap: the
RD905UW is factory-fixed to "Answer Mode" (see
5.写EPC号/写EPC号软件/说明.txt in the MS9 package) - it never streams
data on its own. Every read is the host explicitly asking a question
("Inventory") and the reader answering once. So unlike a reader that
just streams lines for a passive read loop to consume, _read_loop
below has to *send* a command each cycle before it has anything to
read - see _poll_once().
"""

import threading
import time

try:
    import serial
except ImportError:
    # pyserial is only required if a "serial" reader is actually
    # configured (see reader_factory.py) - a pure-simulated setup
    # never imports this far, so it shouldn't need to be installed
    # just to run the app in simulated mode.
    serial = None

from .base import RFIDReader
from . import uhfreader18_protocol as protocol


class SerialRFIDReader(RFIDReader):
    """A serial-port RFID reader speaking the RD905UW/UHFReader18 protocol."""

    def __init__(self, role, port, baud_rate=57600, address=0x00, timeout=2.0,
                 poll_interval=0.2):
        super().__init__(role)
        self.port = port
        self.baud_rate = baud_rate
        # 57600 bps is the RD905UW/UHFReader18 protocol's documented
        # default (manual section 1, COMMUNICATION INTERFACE
        # SPECIFICATION) - not a generic serial-device guess. It's
        # still overridable per hardware_config.json in case a unit
        # was reconfigured to a different rate with the "Set Baud
        # Rate" command (0x28).
        self.address = address
        # Reader address (manual default 0x00). Only matters if more
        # than one reader shares an RS485 bus - see reader_factory.py.
        self.timeout = timeout
        # 2.0s comfortably covers the reader's default Inventory
        # ScanTime (1s, per manual section 8.2.1) plus its documented
        # up-to-75ms slop, with headroom. If ScanTime is ever
        # reconfigured higher (command 0x25), this needs to grow too.
        self.poll_interval = poll_interval
        # Pause between poll cycles. Without one this loop runs as fast
        # as the reader can answer - and it answers *immediately*
        # (rather than using its full ScanTime) whenever a tag is
        # actually in range, which is exactly when we least want a hot
        # loop: it hammers the serial bus, spins a CPU core, and pours
        # thousands of duplicate reads a second into an unbounded
        # queue.Queue that nothing drains while the GUI thread is
        # blocked on an alarm pop-up. 0.2s (~5 polls/sec) is far more
        # responsive than a person can walk through a doorway, and
        # main.py's own RESCAN_COOLDOWN_SECONDS already collapses the
        # repeat reads that do get through into one alert per event.
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
        # serial_for_url() rather than Serial(): a plain port name like
        # "COM3" behaves exactly as before, but it also accepts pyserial
        # URLs. Two things that buys us, with no downside for real
        # hardware:
        #   - "socket://127.0.0.1:5000" points this at the fake reader in
        #     tools/fake_rd905uw.py, so the whole app can be exercised
        #     end to end - through the real pyserial stack - with no
        #     reader, adapter, or virtual COM port driver involved.
        #   - the RD905UW's optional RJ45/TCP interface (MS9 docs,
        #     2.配置指引, default port 6000) becomes usable the same way,
        #     if that variant is ever used instead of RS485.
        self._serial = serial.serial_for_url(
            self.port, self.baud_rate, timeout=self.timeout
        )
        try:
            self._send_startup_commands()
        except Exception:
            # Don't leave the COM port held open by a connection that
            # failed its handshake - main.py carries on running after
            # showing the warning, and a port left locked can't be
            # retried or used by anything else (the vendor's own demo
            # tool, say) for the rest of the session.
            self._serial.close()
            self._serial = None
            raise

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
        # The read loop checks self._running between polls and exits
        # on its own within one poll cycle - nothing to force here.
        # It's a daemon thread, so it also won't block the app from
        # closing even if it's mid-poll.
        self._running = False

    def _read_loop(self):
        """
        Runs on a background thread for as long as self._running is
        True. Each cycle asks the reader "what do you see right now?"
        (_poll_once()) and pushes every tag ID it answers with onto
        tag_queue for main.py's poll() to pick up next - zero, one, or
        several, since a real exit gate can see more than one tag at
        once (e.g. a stack of towels passing together). Never touches
        tkinter directly - that's what makes this thread-safe (see
        base.py's docstring).
        """
        while self._running:
            try:
                tag_ids = self._poll_once()
            except Exception as error:
                # A serial read can fail if the device is unplugged
                # mid-session, times out, or answers with something
                # that doesn't parse as a valid frame (wrong baud,
                # noise on the line, etc.). Don't let that kill the
                # background thread - log it and keep trying.
                # (Auto-reconnect isn't implemented yet - see the
                # README's hardware section.)
                print(f"[{self.role}] Read error: {error}")
                tag_ids = []

            for tag_id in tag_ids:
                self.push(tag_id)

            # Paced deliberately - see self.poll_interval's comment in
            # __init__. Applies after a failed poll too, so a port
            # that errors instantly (unplugged mid-session) can't spin
            # this thread at full tilt either.
            time.sleep(self.poll_interval)

    # ================================================================
    # READER-SPECIFIC PROTOCOL (RD905UW / UHFReader18) - replace this
    # section if a different reader model ever replaces the RD905UW.
    # Nothing above this point, and nothing in main.py, needs to
    # change when you do; the byte-level details themselves live in
    # hardware/uhfreader18_protocol.py, not here.
    # ================================================================

    def _send_startup_commands(self):
        """
        Called once, immediately after the port opens.

        The RD905UW doesn't need to be told to start scanning (that
        only applies to Scan/Trigger Mode, which this reader can't be
        switched into - see the module docstring). Instead this sends
        a Get Reader Information request as a connect-time handshake:
        if a real UHFReader18-protocol reader is on the other end of
        this port at the right baud rate, it answers with its version,
        type, and power; if it doesn't (wrong COM port, wrong baud
        rate, a different device entirely, a dead cable), this raises
        immediately with a clear message instead of leaving the app
        silently polling a connection that will never produce a valid
        tag read. main.py's _connect_reader() already shows whatever
        this raises to the user in a warning dialog.
        """
        command = protocol.build_get_reader_information_command(address=self.address)
        try:
            frame = self._send_and_receive(command)
            info = protocol.parse_reader_information(protocol.parse_frame(frame))
        except Exception as error:
            raise RuntimeError(
                f"{self.role}: reader on {self.port} @ {self.baud_rate}bps did not answer "
                f"like a UHFReader18-protocol reader (RD905UW expected): {error}"
            ) from error

        print(
            f"[{self.role}] Connected: reader firmware v{info['version']}, "
            f"type 0x{info['reader_type']:02X}, "
            f"power {info['power_dbm']} dBm, "
            f"inventory scan time {info['inventory_scan_time_ms']}ms"
        )

    def _poll_once(self):
        """
        One full Answer Mode read cycle: send an Inventory command and
        read back exactly the one response frame it produces, then
        pull out every EPC it found this cycle.

        Returns:
            list[str]: zero or more tag IDs found this cycle
            (uppercase hex, 24 chars for a standard 96-bit EPC - see
            base.py's TAG_ID_HEX_LENGTH). Empty, not an error, when
            nothing is currently in range (the reader's normal idle
            state - protocol.STATUS_NO_TAG).
        """
        command = protocol.build_inventory_command(address=self.address)
        frame = self._send_and_receive(command)
        parsed = protocol.parse_frame(frame)
        return protocol.extract_epcs_from_inventory_response(parsed)

    def _send_and_receive(self, command_bytes):
        """
        Write one command frame and read back exactly the one response
        frame it produces. Shared by both the startup handshake and
        every poll cycle, since both are the same "ask a question, get
        one answer" shape - only the command and how the response gets
        interpreted differ.
        """
        self._serial.reset_input_buffer()  # discard anything stale before asking a fresh question
        self._serial.write(command_bytes)
        return self._read_length_prefixed_frame()

    def _read_length_prefixed_frame(self):
        """
        Read exactly one complete UHFReader18 response frame: a 1-byte
        Len field, followed by exactly that many more bytes (Adr,
        reCmd, Status, Data[], CRC-LSB, CRC-MSB - see
        uhfreader18_protocol's module docstring for the full layout).
        Every response this reader ever sends is self-describing this
        way, no matter which command it's answering, which is what
        makes one implementation of this enough for both the startup
        handshake and every Inventory poll.

        Raises RuntimeError if the reader doesn't answer within the
        configured serial timeout (self.timeout) - either read below
        can come back short in that case, since pyserial's read()
        returns whatever it has when its timeout elapses rather than
        blocking forever.
        """
        length_byte = self._serial.read(1)
        if len(length_byte) != 1:
            raise RuntimeError(
                f"No response from reader within {self.timeout}s (serial read timed out)"
            )
        remaining_length = length_byte[0]
        rest = self._serial.read(remaining_length)
        if len(rest) != remaining_length:
            raise RuntimeError(
                f"Incomplete response from reader: expected {remaining_length} bytes "
                f"after the length byte, got {len(rest)} (serial read timed out)"
            )
        return length_byte + rest
