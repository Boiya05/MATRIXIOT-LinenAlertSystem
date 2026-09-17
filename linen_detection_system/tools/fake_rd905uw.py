"""
tools/fake_rd905uw.py

A stand-in for the physical RD905UW reader, speaking the real
UHFReader18 protocol over a TCP socket. Lets the whole app be run end
to end - GUI, detector, database, alerts, mobile app - driven by
"tag reads" you control by typing, with no reader, no RS485-to-USB
adapter, and no virtual COM port driver installed.

It is a genuine test of the protocol code, not a bypass of it: this
speaks actual bytes over an actual socket through pyserial's real
socket:// transport, and it VALIDATES THE CRC of every command the app
sends. If serial_reader.py ever builds a malformed frame, this rejects
it the same way real hardware would.

--------------------------------------------------------------------
USAGE
--------------------------------------------------------------------
1. Start this in its own terminal:

       python tools/fake_rd905uw.py

   It listens on 127.0.0.1:5000 by default.

2. Point a reader at it in hardware_config.json:

       {
         "entry_reader": { "type": "simulated" },
         "exit_reader": {
           "type": "serial",
           "port": "socket://127.0.0.1:5000"
         }
       }

3. Run the app as usual (python main.py) in another terminal. It will
   connect and start polling.

4. Back in THIS terminal, type commands to control what the reader
   "sees":

       <tag id>   toggle a tag in/out of range (e.g. E20000170014026616706B48)
       add <id>   put a tag in range
       del <id>   take a tag out of range
       list       show what's currently in range
       clear      take every tag out of range
       quiet      stop echoing each poll (default: only echoes tag reads)
       noisy      echo every poll, including empty ones
       quit       shut down

   Anything in range is reported to the app on its next poll, exactly
   as a real reader would report a tag sitting in its field.
--------------------------------------------------------------------
"""

import argparse
import os
import socket
import sys
import threading

# Import the project's own protocol module, so this simulator and the
# code under test agree on the frame format by construction - and so a
# breaking change to one shows up immediately in the other.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hardware import uhfreader18_protocol as protocol  # noqa: E402

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5000

# What the fake reader reports when asked to identify itself (command
# 0x21). Mirrors a real RD905UW: firmware 2.36, type 0x09
# ("UHFREADER18" per the manual), supports 6B+6C, 30dBm, 1s scan time.
READER_INFO = bytes([2, 36, 0x09, 0b11, 0x00, 0x00, 30, 0x0A])


class FakeReader:
    def __init__(self, tags=(), noisy=False):
        self._tags = list(tags)
        self._lock = threading.Lock()
        self.noisy = noisy

    # -- tag control (called from the console thread) --------------

    def add(self, tag_id):
        tag_id = tag_id.strip().upper()
        with self._lock:
            if tag_id not in self._tags:
                self._tags.append(tag_id)
        return tag_id

    def remove(self, tag_id):
        tag_id = tag_id.strip().upper()
        with self._lock:
            if tag_id in self._tags:
                self._tags.remove(tag_id)
                return True
        return False

    def clear(self):
        with self._lock:
            self._tags.clear()

    def in_range(self):
        with self._lock:
            return list(self._tags)

    # -- protocol ---------------------------------------------------

    def _response(self, re_cmd, status, data=b"", address=0x00):
        payload = bytes([address, re_cmd, status]) + data
        frame_wo_crc = bytes([len(payload) + 2]) + payload
        crc = protocol.crc16(frame_wo_crc)
        return frame_wo_crc + bytes([crc & 0xFF, (crc >> 8) & 0xFF])

    def handle_command(self, frame):
        """
        Turn one command frame from the app into the response bytes a
        real reader would send back. Returns None if the frame should
        be ignored entirely (bad CRC - a real reader wouldn't answer).
        """
        try:
            parsed = protocol.parse_frame(frame)
        except protocol.ProtocolError as error:
            print(f"  !! rejected malformed command ({error}) - real hardware would ignore it")
            return None

        # parse_frame labels these fields for a *response*; in a command
        # frame the same byte positions are Cmd and the first Data byte.
        cmd = parsed.re_cmd
        address = parsed.address

        if cmd == protocol.CMD_GET_READER_INFORMATION:
            print("  <- Get Reader Information -> identifying as RD905UW fw2.36")
            return self._response(cmd, 0x00, READER_INFO, address)

        if cmd == protocol.CMD_INVENTORY:
            tags = self.in_range()
            if not tags:
                if self.noisy:
                    print("  <- Inventory -> no tags in range (0xFB)")
                return self._response(cmd, protocol.STATUS_NO_TAG, b"", address)

            data = bytearray([len(tags)])
            for tag in tags:
                tag_bytes = bytes.fromhex(tag)
                data.append(len(tag_bytes))  # length is a BYTE count
                data.extend(tag_bytes)
            print(f"  <- Inventory -> reporting {len(tags)} tag(s): {', '.join(tags)}")
            return self._response(cmd, 0x01, bytes(data), address)

        print(f"  !! unsupported command 0x{cmd:02X} - answering 'illegal command' (0xFE)")
        return self._response(cmd, 0xFE, b"", address)


def serve(reader, server):
    """Accept connections forever on an already-bound listening socket."""
    while True:
        conn, addr = server.accept()
        print(f"** app connected from {addr[0]}:{addr[1]}")
        try:
            _serve_connection(reader, conn)
        except (ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            conn.close()
            print("** app disconnected\n")


def _serve_connection(reader, conn):
    """Read length-prefixed command frames and answer each one."""
    while True:
        length_byte = conn.recv(1)
        if not length_byte:
            return  # app closed the connection
        remaining = length_byte[0]
        body = b""
        while len(body) < remaining:
            chunk = conn.recv(remaining - len(body))
            if not chunk:
                return
            body += chunk
        response = reader.handle_command(length_byte + body)
        if response is not None:
            conn.sendall(response)


def console(reader):
    """Read control commands from stdin on the main thread."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        lowered = line.lower()

        if lowered in {"quit", "exit", "q"}:
            print("bye")
            os._exit(0)
        elif lowered == "list":
            tags = reader.in_range()
            print(f"  in range ({len(tags)}): {', '.join(tags) if tags else '(none)'}")
        elif lowered == "clear":
            reader.clear()
            print("  cleared - nothing in range")
        elif lowered == "noisy":
            reader.noisy = True
            print("  echoing every poll")
        elif lowered == "quiet":
            reader.noisy = False
            print("  only echoing polls that find tags")
        elif lowered.startswith("add "):
            print(f"  in range: {reader.add(line[4:])}")
        elif lowered.startswith(("del ", "rm ")):
            target = line.split(None, 1)[1]
            print("  removed" if reader.remove(target) else "  wasn't in range")
        else:
            # Bare tag ID toggles it.
            tag = line.upper()
            try:
                bytes.fromhex(tag)
            except ValueError:
                print(f"  ? not a hex tag ID or known command: {line}")
                continue
            if reader.remove(tag):
                print(f"  out of range: {tag}")
            else:
                print(f"  in range: {reader.add(tag)}")


def main():
    ap = argparse.ArgumentParser(description="Fake RD905UW reader over socket://")
    ap.add_argument("--host", default=DEFAULT_HOST)
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument(
        "--tags",
        default="",
        help="comma-separated tag IDs to start in range, e.g. E20000170014026616706B48",
    )
    ap.add_argument("--noisy", action="store_true", help="echo every poll, even empty ones")
    args = ap.parse_args()

    start_tags = [t.strip().upper() for t in args.tags.split(",") if t.strip()]
    reader = FakeReader(start_tags, noisy=args.noisy)

    # Bind here rather than inside the serving thread, so a port that's
    # already in use fails immediately with a clear message instead of
    # throwing in a background thread while the console sits there
    # looking like it's working.
    # Deliberately NOT setting SO_REUSEADDR: on Windows it doesn't mean
    # what it means on Linux - it lets a second process bind a port
    # that's already in use, so starting this twice by accident would
    # silently give you two fake readers fighting over one port instead
    # of an error. Without it, the second one fails cleanly below.
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        server.bind((args.host, args.port))
    except OSError as error:
        sys.exit(
            f"Could not listen on {args.host}:{args.port} - {error}\n"
            f"Something else is probably using that port; try --port 5001"
        )
    server.listen(1)

    print(f"Fake RD905UW listening on socket://{args.host}:{args.port}")
    if start_tags:
        print(f"starting with in range: {', '.join(start_tags)}")
    print('Point hardware_config.json at it, then type tag IDs here. "quit" to stop.\n')

    threading.Thread(target=serve, args=(reader, server), daemon=True).start()
    console(reader)


if __name__ == "__main__":
    main()
