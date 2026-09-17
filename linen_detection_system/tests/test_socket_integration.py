"""
tests/test_socket_integration.py

The only tests here that use REAL pyserial I/O.

test_serial_reader.py deliberately swaps in a fake object for the
serial port, which makes it fast and precise but means pyserial itself
- opening a port, its timeout behaviour, its buffering - is never
actually exercised. These tests close that gap: a real
SerialRFIDReader talks through pyserial's real socket:// transport,
over a real TCP socket, to the fake reader in tools/fake_rd905uw.py
(which validates the CRC of everything it receives, exactly as real
hardware would).

That covers every layer except the physical RF link and the USB/RS485
adapter itself.

Run with:  python -m pytest tests/test_socket_integration.py -v
"""

import os
import socket
import sys
import threading
import time

import pytest

# tools/ isn't a package on the import path by default.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))

from hardware.serial_reader import SerialRFIDReader  # noqa: E402
from fake_rd905uw import FakeReader, _serve_connection  # noqa: E402

TAG_A = "E20000170014026616706B48"
TAG_B = "E28011606000020567891234"


@pytest.fixture
def fake_reader_url():
    """Start the fake reader on a free port; yield its socket:// URL."""
    fake = FakeReader()
    server = socket.socket()
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    host, port = server.getsockname()

    def serve():
        try:
            conn, _ = server.accept()
        except OSError:
            return
        try:
            _serve_connection(fake, conn)
        except OSError:
            pass
        finally:
            conn.close()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()

    yield fake, f"socket://{host}:{port}"

    server.close()


def _drain_until(reader, predicate, timeout=3.0):
    """Poll until predicate(seen_tag_set) is true, or give up.

    The reader runs on its own thread, so a test can't assume a given
    poll has happened yet - this waits for the condition rather than
    sleeping a fixed amount and hoping.
    """
    deadline = time.time() + timeout
    seen = set()
    while time.time() < deadline:
        seen.update(reader.poll())
        if predicate(seen):
            return seen
        time.sleep(0.05)
    return seen


def test_real_pyserial_handshake_and_tag_reads(fake_reader_url):
    fake, url = fake_reader_url
    reader = SerialRFIDReader("exit_reader", url, poll_interval=0.05)

    # connect() runs the real Get Reader Information handshake over a
    # real socket - if the frame or CRC were wrong, this raises.
    reader.connect()
    reader.start()
    try:
        # Nothing in range yet.
        assert _drain_until(reader, lambda s: False, timeout=0.3) == set()

        fake.add(TAG_A)
        seen = _drain_until(reader, lambda s: TAG_A in s)
        assert TAG_A in seen

        fake.add(TAG_B)
        seen = _drain_until(reader, lambda s: {TAG_A, TAG_B} <= s)
        assert {TAG_A, TAG_B} <= seen

        # Every tag ID that came off the wire must be a usable 24-char
        # EPC - this is what would have caught the words-vs-bytes bug
        # against real-ish hardware.
        for tag in seen:
            assert len(tag) == 24, f"{tag} is {len(tag)} chars"

        # Tags leave the field.
        fake.clear()
        time.sleep(0.3)
        reader.poll()  # discard reads still queued from before they left
        time.sleep(0.2)
        assert reader.poll() == []
    finally:
        reader.disconnect()


def test_real_pyserial_connect_fails_cleanly_against_a_dead_port():
    """Nothing listening on this port - connect() must raise something
    intelligible rather than hanging or leaking an open handle."""
    # Bind and immediately close, so the port is almost certainly free.
    probe = socket.socket()
    probe.bind(("127.0.0.1", 0))
    _, dead_port = probe.getsockname()
    probe.close()

    reader = SerialRFIDReader("exit_reader", f"socket://127.0.0.1:{dead_port}", timeout=1.0)
    with pytest.raises(Exception):
        reader.connect()
    assert reader._serial is None
