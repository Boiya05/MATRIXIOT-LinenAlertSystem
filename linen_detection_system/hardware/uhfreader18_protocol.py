"""
hardware/uhfreader18_protocol.py

Byte-level protocol for the reader that actually ships in the MS9
package: an RD905UW, built on the "UHFReader18" reference design.
Every function here is a pure transformation on bytes - nothing opens
a port, nothing sleeps, nothing touches tkinter. That's deliberate: it
means the whole protocol can be exercised and verified by
tests/test_uhfreader18_protocol.py without any reader (real or
virtual) ever being plugged in. hardware/serial_reader.py is the only
thing that calls into this module; it owns all the actual I/O.

Source of truth: "UHF RFID Reader UHFReader18 User's Manual V2.0.doc"
(bundled in the MS9 package under 3.二次开发/SDK.../english/manual/),
cross-checked against a real captured frame from the MS9 config guides
(2.配置指引) - see the CRC-16 known-answer test in the test suite,
which validates this module's crc16() against that real device output
byte-for-byte, not just against the algorithm description.

Frame formats (identical over RS232, RS485, and TCP - only the
transport differs, never these bytes):

    Command  (host -> reader):  Len | Adr | Cmd   | Data[] | CRC-LSB | CRC-MSB
    Response (reader -> host):  Len | Adr | reCmd | Status | Data[] | CRC-LSB | CRC-MSB

  - Len: length of everything AFTER itself. For a command that's
    Adr+Cmd+Data[]+CRC(2) = 3+len(Data[]); for a response it's
    Adr+reCmd+Status+Data[]+CRC(2) = 4+len(Data[]).
  - Adr: reader address, 0x00 default, 0xFF = broadcast.
  - CRC-16 covers every byte from Len through the end of Data[]
    (i.e. the whole frame except the two CRC bytes themselves), and is
    sent least-significant byte first.

IMPORTANT - why this targets Answer Mode's Inventory command (0x01)
and NOT the "0xEE" active-output frame shown in the MS9 config guides
(2.配置指引/1.主动读卡.../2.主动读卡-TCP...): those guides describe
Scan Mode / Trigger Mode, where the reader free-runs and pushes data
on its own. Per 5.写EPC号/写EPC号软件/说明.txt, the RD905UW is
factory-fixed to Answer Mode and cannot be switched into that
free-running mode. In Answer Mode the host must ask for a read with
the standard Inventory command (manual section 8.2.1) and the reader
replies once, synchronously - so that's the command/response pair
implemented below.
"""

from dataclasses import dataclass
from typing import List, Optional

# ---------------------------------------------------------------------------
# CRC-16
# ---------------------------------------------------------------------------

# Straight translation of the C reference implementation given in the
# manual (section 3.2, "Cyclic Redundancy Check (CRC) computation").
# Verified against a real captured frame from the MS9 docs in
# tests/test_uhfreader18_protocol.py - not just against this
# description of the algorithm.
_CRC_PRESET_VALUE = 0xFFFF
_CRC_POLYNOMIAL = 0x8408


def crc16(data: bytes) -> int:
    """
    Compute the reader's CRC-16 over `data`.

    Returns the 16-bit CRC as an int (0x0000-0xFFFF). Callers append it
    little-endian (LSB byte first, then MSB byte) - see _append_crc().
    """
    crc = _CRC_PRESET_VALUE
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x0001:
                crc = (crc >> 1) ^ _CRC_POLYNOMIAL
            else:
                crc = crc >> 1
    return crc & 0xFFFF


def _append_crc(payload: bytes) -> bytes:
    crc = crc16(payload)
    return payload + bytes([crc & 0xFF, (crc >> 8) & 0xFF])


# ---------------------------------------------------------------------------
# Command codes actually used here (there are many more in the manual;
# only what this integration needs is listed - see the manual for the
# full command set if more are ever needed).
# ---------------------------------------------------------------------------

CMD_INVENTORY = 0x01
CMD_GET_READER_INFORMATION = 0x21

DEFAULT_ADDRESS = 0x00
BROADCAST_ADDRESS = 0xFF

# Inventory response Status byte meanings (manual section 8.2.1) - note
# these are Inventory-specific and NOT the generic 0x00-means-success
# convention most other commands use.
STATUS_INVENTORY_OK = 0x01  # command finished, all found tags' EPCs returned
STATUS_INVENTORY_SCAN_TIME_OVERFLOW = 0x02  # timed out; returns what it found so far
STATUS_INVENTORY_MORE_DATA = 0x03  # too many tags for one message; sent in parts
STATUS_INVENTORY_FLASH_FULL = 0x04  # more tags than the reader's buffer could hold
# Any Inventory response with one of the four statuses above carries a
# usable (if possibly partial) EPC list in Data[]. Everything else is
# an error status shared across commands (manual section 5) - the two
# genuinely routine ones are called out below; anything else is a real
# problem (bad CRC on the way in, wrong reader, wrong baud, etc.).
_INVENTORY_OK_STATUSES = frozenset(
    {
        STATUS_INVENTORY_OK,
        STATUS_INVENTORY_SCAN_TIME_OVERFLOW,
        STATUS_INVENTORY_MORE_DATA,
        STATUS_INVENTORY_FLASH_FULL,
    }
)
STATUS_NO_TAG = 0xFB  # "No Tag Operable" - normal when nothing is in range
STATUS_ILLEGAL_COMMAND = 0xFE  # unrecognized command or CRC error - usually means
# wrong baud rate, wrong address, or a non-UHFReader18 device on the other end


class ProtocolError(Exception):
    """Raised for anything that means the bytes on the wire don't make
    sense as a UHFReader18 frame - too short, CRC mismatch, or a
    Len byte that doesn't match how much data actually arrived."""


@dataclass
class ParsedFrame:
    """One fully decoded response frame - see the module docstring for
    what each field means."""

    address: int
    re_cmd: int
    status: int
    data: bytes


# ---------------------------------------------------------------------------
# Building commands (host -> reader)
# ---------------------------------------------------------------------------


def build_command(cmd: int, data: bytes = b"", address: int = DEFAULT_ADDRESS) -> bytes:
    """
    Build one complete command frame ready to write to the serial port.

    Len is computed automatically from len(data) - callers never pass
    it directly, which rules out an entire class of off-by-one bugs.
    """
    payload = bytes([address, cmd]) + data
    length_byte = len(payload) + 2  # +2 for the two CRC bytes this frame will carry
    return _append_crc(bytes([length_byte]) + payload)


def build_inventory_command(address: int = DEFAULT_ADDRESS) -> bytes:
    """
    The read command actually used every poll cycle. AdrTID/LenTID are
    deliberately omitted (manual: "It will get tags' EPC values when
    the AdrTID and LenTID vacant") - supplying them switches the
    reader to returning TID instead of EPC, which isn't what the app
    tracks tags by.
    """
    return build_command(CMD_INVENTORY, data=b"", address=address)


def build_get_reader_information_command(address: int = DEFAULT_ADDRESS) -> bytes:
    """
    A handshake/self-test command: ask the reader who it is. Used once
    at connect() time to fail fast (with a clear error) if what's on
    the other end of the port isn't actually responding like a
    UHFReader18-protocol reader - wrong baud rate, wrong COM port, or
    a different device entirely - instead of silently polling a device
    that will never produce a valid tag read.
    """
    return build_command(CMD_GET_READER_INFORMATION, data=b"", address=address)


# ---------------------------------------------------------------------------
# Parsing responses (reader -> host)
# ---------------------------------------------------------------------------


def parse_frame(frame: bytes) -> ParsedFrame:
    """
    Validate and decode one complete response frame (Len byte
    included, i.e. exactly what _read_exact_frame() in
    serial_reader.py hands back).

    Raises ProtocolError if the frame is too short, the Len byte
    doesn't match the number of bytes actually supplied, or the CRC
    doesn't check out - any of those mean these bytes did not
    genuinely come from a UHFReader18-protocol reader (or arrived
    corrupted), and should never be treated as a tag read.
    """
    if len(frame) < 5:
        raise ProtocolError(
            f"Frame too short to be a response ({len(frame)} bytes; minimum is 5)"
        )

    length_byte = frame[0]
    if length_byte != len(frame) - 1:
        raise ProtocolError(
            f"Len byte says {length_byte} bytes follow, but {len(frame) - 1} were given"
        )

    payload, crc_lsb, crc_msb = frame[:-2], frame[-2], frame[-1]
    received_crc = crc_lsb | (crc_msb << 8)
    expected_crc = crc16(payload)
    if received_crc != expected_crc:
        raise ProtocolError(
            f"CRC mismatch: frame says 0x{received_crc:04X}, computed 0x{expected_crc:04X}"
        )

    address = frame[1]
    re_cmd = frame[2]
    status = frame[3]
    data = frame[4:-2]
    return ParsedFrame(address=address, re_cmd=re_cmd, status=status, data=data)


def extract_epcs_from_inventory_response(parsed: ParsedFrame) -> List[str]:
    """
    Pull the EPC list out of an already-parsed Inventory (0x01)
    response.

    Data[] layout (manual section 8.2.1): Num (1 byte - tag count),
    then that many (EPC-Len, EPC-Data) pairs back to back, where
    EPC-Len is a BYTE count and EPC-Data is that many bytes,
    most-significant byte first.

    EPC-Len counts BYTES, not words - worth stating explicitly because
    the manual only says "EPC (TID) Len is one byte" (the field's
    size, not its unit), and almost every *other* EPC length in this
    protocol is expressed in words ("ENum: EPC length, in word units").
    The vendor's own C# demo settles it - see Form1.cs in the MS9
    package, which reads EPClen*2 hex characters (= EPClen bytes) and
    advances its byte cursor by EPClen+1. It also has to be bytes for
    the arithmetic to work out: a standard 96-bit EPC is 12 bytes / 24
    hex characters (base.py's TAG_ID_HEX_LENGTH), which only comes out
    right if the length byte reads 12.

    Returns a list of uppercase hex strings (one per tag found this
    poll - normally 0 or 1 in this app's use, but a real exit gate can
    see several tags in the same instant, e.g. a stack of towels
    passing together, so every tag reported is returned). Returns an
    empty list - not an error - for STATUS_NO_TAG, since "nothing in
    range right now" is the normal, constant state of an idle scanner.
    """
    if parsed.re_cmd != CMD_INVENTORY:
        raise ProtocolError(
            f"Not an Inventory response (reCmd=0x{parsed.re_cmd:02X}, expected 0x{CMD_INVENTORY:02X})"
        )

    if parsed.status == STATUS_NO_TAG:
        return []

    if parsed.status not in _INVENTORY_OK_STATUSES:
        raise ProtocolError(
            f"Inventory failed with status 0x{parsed.status:02X} "
            f"({_describe_status(parsed.status)})"
        )

    data = parsed.data
    if not data:
        return []

    num_tags = data[0]
    offset = 1
    epcs = []
    for _ in range(num_tags):
        if offset >= len(data):
            raise ProtocolError("Inventory response truncated mid tag list")
        epc_len_bytes = data[offset]  # a BYTE count - see this function's docstring
        offset += 1
        epc_bytes = data[offset : offset + epc_len_bytes]
        if len(epc_bytes) != epc_len_bytes:
            raise ProtocolError("Inventory response truncated mid EPC value")
        offset += epc_len_bytes
        if epc_bytes:  # a zero-length EPC isn't a tag read - don't emit an empty tag ID
            epcs.append(epc_bytes.hex().upper())
    return epcs


def _describe_status(status: int) -> str:
    """Best-effort human-readable label for a few statuses worth
    calling out specifically in error messages; falls back to just the
    hex value for anything else (see the manual's full status table)."""
    return {
        STATUS_ILLEGAL_COMMAND: "illegal command or CRC error - check baud rate/address, "
        "or that this is really a UHFReader18-protocol reader",
    }.get(status, "see manual section 5, LIST OF COMMAND EXECUTION RESULT STATUS")


def parse_reader_information(parsed: ParsedFrame) -> dict:
    """
    Decode a Get Reader Information (0x21) response (manual section
    8.4.1) into a small dict - just enough to log at connect() time so
    a human can eyeball "yes, this is genuinely an RD905UW/UHFReader18
    device" rather than trusting an assumption.
    """
    if parsed.re_cmd != CMD_GET_READER_INFORMATION:
        raise ProtocolError(
            f"Not a Get Reader Information response (reCmd=0x{parsed.re_cmd:02X}, "
            f"expected 0x{CMD_GET_READER_INFORMATION:02X})"
        )
    if parsed.status != 0x00:
        raise ProtocolError(f"Get Reader Information failed with status 0x{parsed.status:02X}")

    data = parsed.data
    if len(data) < 8:
        raise ProtocolError(f"Get Reader Information response too short ({len(data)} data bytes)")

    version_major, version_minor, reader_type, tr_type, dmaxfre, dminfre, power, scntm = data[:8]
    return {
        "version": f"{version_major}.{version_minor}",
        "reader_type": reader_type,  # manual: 0x09 = "UHFREADER18 lines"
        "supports_18000_6c": bool(tr_type & 0b10),
        "supports_18000_6b": bool(tr_type & 0b01),
        "power_dbm": None if power == 0xFF else power,
        "inventory_scan_time_ms": scntm * 100,
    }
