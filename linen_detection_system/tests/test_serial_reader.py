"""
tests/test_serial_reader.py

Verifies hardware/serial_reader.py's actual write-command /
read-response wiring - not just the protocol byte-math (that's
tests/test_uhfreader18_protocol.py), but that SerialRFIDReader really
does write the right command bytes and correctly turns a scripted
response back into tag IDs on tag_queue.

Uses FakeSerial (below) as a drop-in stand-in for pyserial's
serial.Serial - just enough of its interface (write/read/
reset_input_buffer) for SerialRFIDReader to drive. No real or virtual
COM port is opened anywhere in this file; that's the point - this can
be run right now, and re-run any time, without the RS485-to-USB
adapter or the reader itself ever being plugged in.

Run with:  python -m pytest tests/test_serial_reader.py -v
(the `-m` form, not a bare `pytest` - see the README's note on PATH)
"""

import pytest

from hardware import serial_reader as serial_reader_module
from hardware import uhfreader18_protocol as protocol
from hardware.serial_reader import SerialRFIDReader


class FakeSerial:
    """
    Stands in for pyserial's serial.Serial. Bytes given to
    queue_response() are handed back in order to whatever calls
    read(n) - short, just like a real port on timeout, if fewer bytes
    are queued than asked for. Every write() call is recorded so tests
    can assert exactly what SerialRFIDReader sent.
    """

    def __init__(self):
        self._inbox = bytearray()
        self.written = []
        self.closed = False

    def queue_response(self, frame_bytes):
        self._inbox.extend(frame_bytes)

    def write(self, data):
        self.written.append(bytes(data))

    def read(self, size):
        chunk = bytes(self._inbox[:size])
        del self._inbox[:size]
        return chunk

    def reset_input_buffer(self):
        pass

    def close(self):
        self.closed = True


def _make_response_frame(re_cmd, status, data=b"", address=0x00):
    """Hand-build a response frame the same way a real reader would
    send one - independent of anything in serial_reader.py itself, so
    these tests don't just check the code against its own math."""
    payload = bytes([address, re_cmd, status]) + data
    length_byte = len(payload) + 2
    frame_wo_crc = bytes([length_byte]) + payload
    crc = protocol.crc16(frame_wo_crc)
    return frame_wo_crc + bytes([crc & 0xFF, (crc >> 8) & 0xFF])


def _new_reader():
    reader = SerialRFIDReader(role="exit_reader", port="COM_TEST", baud_rate=57600)
    reader._serial = FakeSerial()  # skip real connect() - no COM port needed
    return reader


# ---------------------------------------------------------------------------
# _send_startup_commands() - the connect()-time handshake/self-test
# ---------------------------------------------------------------------------


def test_startup_sends_get_reader_info_and_succeeds_on_valid_reply():
    reader = _new_reader()
    info_data = bytes([2, 36, 0x09, 0b11, 0x00, 0x00, 30, 0x0A])
    reader._serial.queue_response(
        _make_response_frame(protocol.CMD_GET_READER_INFORMATION, 0x00, info_data)
    )

    reader._send_startup_commands()  # must not raise

    assert reader._serial.written == [
        protocol.build_get_reader_information_command(address=reader.address)
    ]


def test_startup_raises_clear_error_when_reader_never_answers():
    reader = _new_reader()
    # Nothing queued - every read() comes back empty, exactly like a
    # real timeout (wrong COM port, wrong baud rate, dead cable).
    with pytest.raises(RuntimeError, match="did not answer"):
        reader._send_startup_commands()


def test_startup_raises_clear_error_on_unparseable_reply():
    reader = _new_reader()
    reader._serial.queue_response(b"\x03\x00\x00\xAB")  # too short to be a valid frame
    with pytest.raises(RuntimeError, match="did not answer"):
        reader._send_startup_commands()


def test_startup_raises_on_reply_with_corrupted_crc():
    reader = _new_reader()
    info_data = bytes([2, 36, 0x09, 0b11, 0x00, 0x00, 30, 0x0A])
    frame = bytearray(
        _make_response_frame(protocol.CMD_GET_READER_INFORMATION, 0x00, info_data)
    )
    frame[-1] ^= 0xFF
    reader._serial.queue_response(bytes(frame))
    with pytest.raises(RuntimeError, match="did not answer"):
        reader._send_startup_commands()


# ---------------------------------------------------------------------------
# connect() - must be all-or-nothing with the underlying port
# ---------------------------------------------------------------------------


def _patch_serial_module(monkeypatch, fake):
    """Make serial_reader's `serial.serial_for_url(...)` hand back our
    fake instead of opening a real COM port."""

    class FakeSerialModule:
        opened_with = []

        @staticmethod
        def serial_for_url(url, baudrate, timeout=None):
            FakeSerialModule.opened_with.append((url, baudrate, timeout))
            return fake

    monkeypatch.setattr(serial_reader_module, "serial", FakeSerialModule)
    return FakeSerialModule


def test_connect_closes_the_port_if_the_handshake_fails(monkeypatch):
    """
    main.py keeps the app running after showing its "reader
    unavailable" warning, so a port left open here would stay locked
    for the rest of the session - blocking a retry, and blocking any
    other program (the vendor's own demo tool, say) from using it.
    """
    fake = FakeSerial()  # nothing queued -> the handshake times out
    _patch_serial_module(monkeypatch, fake)
    reader = SerialRFIDReader(role="exit_reader", port="COM_TEST")

    with pytest.raises(RuntimeError, match="did not answer"):
        reader.connect()

    assert fake.closed is True
    assert reader._serial is None


def test_connect_keeps_the_port_open_on_success(monkeypatch):
    fake = FakeSerial()
    info_data = bytes([2, 36, 0x09, 0b11, 0x00, 0x00, 30, 0x0A])
    fake.queue_response(
        _make_response_frame(protocol.CMD_GET_READER_INFORMATION, 0x00, info_data)
    )
    _patch_serial_module(monkeypatch, fake)
    reader = SerialRFIDReader(role="exit_reader", port="COM_TEST")

    reader.connect()

    assert fake.closed is False
    assert reader._serial is fake


# ---------------------------------------------------------------------------
# _poll_once() - one Answer Mode read cycle
# ---------------------------------------------------------------------------


def test_poll_once_sends_inventory_command():
    reader = _new_reader()
    reader._serial.queue_response(
        _make_response_frame(protocol.CMD_INVENTORY, protocol.STATUS_NO_TAG, b"")
    )

    reader._poll_once()

    assert reader._serial.written == [
        protocol.build_inventory_command(address=reader.address)
    ]


def test_poll_once_returns_epc_when_tag_present():
    reader = _new_reader()
    epc = bytes.fromhex("E20000170014026616706B48")
    data = bytes([1, 12]) + epc  # Num=1, EPC-Len=12 bytes (a 96-bit EPC)
    reader._serial.queue_response(_make_response_frame(protocol.CMD_INVENTORY, 0x01, data))

    assert reader._poll_once() == ["E20000170014026616706B48"]


def test_poll_once_returns_empty_list_when_nothing_in_range():
    reader = _new_reader()
    reader._serial.queue_response(
        _make_response_frame(protocol.CMD_INVENTORY, protocol.STATUS_NO_TAG, b"")
    )

    assert reader._poll_once() == []


def test_poll_once_raises_on_timeout_without_crashing_the_process():
    reader = _new_reader()  # nothing queued
    with pytest.raises(RuntimeError, match="timed out"):
        reader._poll_once()


# ---------------------------------------------------------------------------
# _read_loop() - the actual background-thread body, run for one
# iteration (no thread spun up, no sleeping - deterministic).
# ---------------------------------------------------------------------------


def test_read_loop_pushes_every_tag_from_one_multi_tag_poll():
    reader = _new_reader()
    epc_a = bytes.fromhex("AAAAAAAAAAAAAAAAAAAAAAAA")
    epc_b = bytes.fromhex("BBBBBBBBBBBBBBBBBBBBBBBB")
    data = bytes([2, 12]) + epc_a + bytes([12]) + epc_b
    reader._serial.queue_response(_make_response_frame(protocol.CMD_INVENTORY, 0x01, data))

    # Run exactly one iteration of the loop's body: let it process the
    # one scripted response, then stop before a second iteration would
    # try to read from an empty (and therefore timing-out) FakeSerial.
    real_poll_once = reader._poll_once

    def poll_once_then_stop():
        reader._running = False
        return real_poll_once()

    reader._poll_once = poll_once_then_stop
    reader._running = True

    reader._read_loop()

    assert sorted(reader.poll()) == [
        "AAAAAAAAAAAAAAAAAAAAAAAA",
        "BBBBBBBBBBBBBBBBBBBBBBBB",
    ]


def _record_sleeps(monkeypatch):
    """Capture what the read loop sleeps for, instead of actually
    sleeping (keeps the suite fast and deterministic)."""
    sleeps = []
    monkeypatch.setattr(serial_reader_module.time, "sleep", sleeps.append)
    return sleeps


def test_read_loop_paces_itself_between_polls(monkeypatch):
    """
    REGRESSION GUARD. The reader answers an Inventory *immediately*
    (rather than using its full ScanTime) whenever a tag is actually in
    range, so without a deliberate pause this loop runs flat out
    exactly when a tag is present - hammering the serial bus, spinning
    a CPU core, and pouring duplicate reads into an unbounded queue
    that nothing drains while the GUI thread sits blocked on an alarm
    pop-up. An end-to-end run against an instant-answering fake reader
    managed ~37,000 polls/second before this pause existed.
    """
    sleeps = _record_sleeps(monkeypatch)
    reader = _new_reader()
    reader.poll_interval = 0.05
    reader._serial.queue_response(
        _make_response_frame(protocol.CMD_INVENTORY, protocol.STATUS_NO_TAG, b"")
    )
    real_poll_once = reader._poll_once

    def poll_once_then_stop():
        reader._running = False
        return real_poll_once()

    reader._poll_once = poll_once_then_stop
    reader._running = True

    reader._read_loop()

    assert sleeps == [0.05], "read loop must pause between polls, not spin"


def test_read_loop_paces_itself_even_when_polls_fail(monkeypatch):
    """A port that errors instantly (unplugged mid-session) must not
    spin the thread at full tilt either."""
    sleeps = _record_sleeps(monkeypatch)
    reader = _new_reader()  # nothing queued -> every poll raises
    reader.poll_interval = 0.05
    real_poll_once = reader._poll_once

    def poll_once_then_stop():
        reader._running = False
        return real_poll_once()  # raises

    reader._poll_once = poll_once_then_stop
    reader._running = True

    reader._read_loop()

    assert sleeps == [0.05], "a failing poll must still be paced"


def test_read_loop_survives_a_bad_poll_without_crashing(monkeypatch):
    """A single garbled/timed-out poll must not kill the background
    thread - main.py has no way to notice or restart it if it dies."""
    _record_sleeps(monkeypatch)  # don't actually sleep between the two polls
    reader = _new_reader()  # nothing queued -> _poll_once() raises

    call_count = 0
    real_poll_once = reader._poll_once

    def poll_once_twice_then_stop():
        nonlocal call_count
        call_count += 1
        if call_count >= 2:
            reader._running = False
        return real_poll_once()  # always raises here (nothing queued)

    reader._poll_once = poll_once_twice_then_stop
    reader._running = True

    reader._read_loop()  # must not raise, despite every poll failing

    assert call_count == 2
    assert reader.poll() == []
