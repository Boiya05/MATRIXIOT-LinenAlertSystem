"""
tests/test_uhfreader18_protocol.py

Verifies hardware/uhfreader18_protocol.py against the actual MS9/
RD905UW documentation - not just against the algorithm description,
but against a real captured frame from the vendor's own config guides
(see test_crc16_matches_real_captured_frame below). Pure byte-level
tests: no serial port, no COM port, no hardware of any kind is needed
to run this file, which is the whole point - it can be run right now,
before the RS485-to-USB adapter even arrives, and re-run any time
(after any protocol change, before/after connecting real hardware, in
CI, etc.) to keep proving the implementation is still correct.

Run with:  python -m pytest tests/test_uhfreader18_protocol.py -v
(the `-m` form, not a bare `pytest` - see the README's note on PATH)
"""

import pytest

from hardware.base import TAG_ID_HEX_LENGTH
from hardware.uhfreader18_protocol import (
    CMD_GET_READER_INFORMATION,
    CMD_INVENTORY,
    STATUS_NO_TAG,
    ParsedFrame,
    ProtocolError,
    build_command,
    build_get_reader_information_command,
    build_inventory_command,
    crc16,
    extract_epcs_from_inventory_response,
    parse_frame,
    parse_reader_information,
)

# A real frame captured straight from the MS9 package's own config
# guides (2.配置指引/1.主动读卡-RS232RS485.../2.主动读卡-TCP...), given
# there as an example of what the reader actually sends on the wire.
# This is ground truth, not test data invented for this suite.
REAL_CAPTURED_FRAME_HEX = "11 00 EE 00 E2 00 00 17 00 14 02 66 16 70 6B 48 83 37"


def _hex_to_bytes(spaced_hex):
    return bytes.fromhex(spaced_hex.replace(" ", ""))


# ---------------------------------------------------------------------------
# CRC-16
# ---------------------------------------------------------------------------


def test_crc16_matches_real_captured_frame():
    """
    The single most important test in this file: proves crc16() isn't
    just "an implementation of the algorithm the manual describes" but
    actually reproduces the CRC a real RD905UW put on a real frame.
    """
    frame = _hex_to_bytes(REAL_CAPTURED_FRAME_HEX)
    payload, crc_lsb, crc_msb = frame[:-2], frame[-2], frame[-1]
    expected_crc = crc_lsb | (crc_msb << 8)

    assert crc16(payload) == expected_crc


def test_crc16_deterministic():
    assert crc16(b"\x00\x21") == crc16(b"\x00\x21")


def test_crc16_sensitive_to_every_byte():
    """A CRC that doesn't change when the input does is worse than
    useless - it would silently accept corrupted frames."""
    base = crc16(b"\x04\x00\x21")
    for i in range(3):
        mutated = bytearray(b"\x04\x00\x21")
        mutated[i] ^= 0xFF
        assert crc16(bytes(mutated)) != base


# ---------------------------------------------------------------------------
# parse_frame() - generic frame decoding, using the real captured frame
# ---------------------------------------------------------------------------


def test_parse_frame_decodes_real_captured_frame():
    frame = _hex_to_bytes(REAL_CAPTURED_FRAME_HEX)
    parsed = parse_frame(frame)

    assert parsed.address == 0x00
    assert parsed.re_cmd == 0xEE
    assert parsed.status == 0x00
    assert parsed.data == _hex_to_bytes("E2 00 00 17 00 14 02 66 16 70 6B 48")


def test_parse_frame_rejects_corrupted_crc():
    frame = bytearray(_hex_to_bytes(REAL_CAPTURED_FRAME_HEX))
    frame[-1] ^= 0xFF  # flip the CRC's high byte
    with pytest.raises(ProtocolError, match="CRC mismatch"):
        parse_frame(bytes(frame))


def test_parse_frame_rejects_wrong_length_byte():
    frame = bytearray(_hex_to_bytes(REAL_CAPTURED_FRAME_HEX))
    frame[0] = 0x05  # Len no longer matches the actual byte count
    with pytest.raises(ProtocolError, match="Len byte says"):
        parse_frame(bytes(frame))


def test_parse_frame_rejects_too_short():
    with pytest.raises(ProtocolError, match="too short"):
        parse_frame(b"\x02\x00")


# ---------------------------------------------------------------------------
# Building commands
# ---------------------------------------------------------------------------


def test_build_command_round_trips_through_parse_frame():
    """A built command isn't a response frame (different field
    meanings), but it's byte-identical in shape (Len|Adr|X|Data|CRC),
    so parse_frame() can still decode it - a cheap way to check
    build_command()'s Len and CRC math without a second implementation
    of either to compare against."""
    built = build_command(0x21, data=b"", address=0x00)
    parsed = parse_frame(built)  # re_cmd field here is really Cmd; status/data don't apply
    assert parsed.address == 0x00
    assert parsed.re_cmd == 0x21

    # Spelled out explicitly too, since the reinterpretation above is a
    # little too clever to be the only check:
    assert built[0] == 0x04  # Len: Adr+Cmd+CRC(2) = 4, no Data[]
    assert built[1] == 0x00  # Adr
    assert built[2] == 0x21  # Cmd
    assert len(built) == 5  # Len byte + the 4 bytes it describes


def test_build_inventory_command_has_no_data_bytes():
    """AdrTID/LenTID must be omitted entirely (not zero-filled) - the
    manual specifically says EPC (vs TID) values come back only when
    they're "vacant", and this app wants EPCs."""
    built = build_inventory_command(address=0x00)
    assert built == build_command(CMD_INVENTORY, data=b"", address=0x00)
    assert built[0] == 0x04  # Len=4 means zero Data[] bytes
    assert len(built) == 5


def test_build_get_reader_information_command():
    built = build_get_reader_information_command(address=0x00)
    assert built[0] == 0x04
    assert built[2] == CMD_GET_READER_INFORMATION


def test_build_command_uses_broadcast_address():
    built = build_command(CMD_INVENTORY, address=0xFF)
    assert built[1] == 0xFF


# ---------------------------------------------------------------------------
# extract_epcs_from_inventory_response()
# ---------------------------------------------------------------------------


def _make_inventory_response(status, data):
    """Build a *response* frame by hand (not via build_command, which
    only builds commands) so these tests exercise parsing logic that's
    completely independent from the building logic above."""
    payload = bytes([0x00, CMD_INVENTORY, status]) + data
    length_byte = len(payload) + 2
    frame_wo_crc = bytes([length_byte]) + payload
    crc = crc16(frame_wo_crc)
    return frame_wo_crc + bytes([crc & 0xFF, (crc >> 8) & 0xFF])


def test_extract_epcs_no_tag_in_field_returns_empty_list_not_error():
    """The constant, normal state of an idle exit scanner - this must
    never be treated as a failure."""
    frame = _make_inventory_response(STATUS_NO_TAG, data=b"")
    parsed = parse_frame(frame)
    assert extract_epcs_from_inventory_response(parsed) == []


def test_extract_epcs_single_tag():
    # One tag, EPC length = 12 BYTES - a standard 96-bit EPC, matching
    # this app's tag format (24 hex chars, base.py's TAG_ID_HEX_LENGTH).
    epc_bytes = bytes.fromhex("E20000170014026616706B48")  # 12 bytes
    data = bytes([1, 12]) + epc_bytes  # Num=1, EPC-Len=12 bytes, then EPC bytes
    frame = _make_inventory_response(0x01, data)
    parsed = parse_frame(frame)

    epcs = extract_epcs_from_inventory_response(parsed)

    assert epcs == ["E20000170014026616706B48"]


def test_extract_epcs_length_byte_is_a_byte_count_not_a_word_count():
    """
    REGRESSION GUARD. The manual only says "EPC (TID) Len is one byte"
    - the field's size, not its unit - while almost every other EPC
    length in the protocol is in WORDS ("ENum: EPC length, in word
    units"). Reading it as words was an actual bug here once: it made
    the parser look for 24 bytes of EPC when only 12 were present.

    The vendor's own C# demo (Form1.cs in the MS9 package) reads
    EPClen*2 hex chars (= EPClen bytes) and advances by EPClen+1, and
    the arithmetic only works out this way: a standard 96-bit EPC is
    12 bytes, which must produce exactly TAG_ID_HEX_LENGTH (24) hex
    characters for the rest of the app to recognise it as a tag ID.
    """
    epc_bytes = bytes.fromhex("E20000170014026616706B48")  # 96-bit EPC = 12 bytes
    assert len(epc_bytes) == 12

    data = bytes([1, len(epc_bytes)]) + epc_bytes  # length byte = 12, the BYTE count
    parsed = parse_frame(_make_inventory_response(0x01, data))

    (tag_id,) = extract_epcs_from_inventory_response(parsed)

    # Ties this directly to what the rest of the app expects a tag ID
    # to look like - if the unit interpretation ever flips back, this
    # is the assertion that catches it.
    assert len(tag_id) == TAG_ID_HEX_LENGTH == 24
    assert tag_id == "E20000170014026616706B48"


def test_extract_epcs_multiple_tags_in_one_response():
    """A real exit gate can see more than one tag at once (e.g. a
    stack of towels) - the Inventory response format supports this via
    its Num field, and this must not silently drop any of them."""
    epc_a = bytes.fromhex("AAAAAAAAAAAAAAAAAAAAAAAA")  # 12 bytes
    epc_b = bytes.fromhex("BBBBBBBBBBBBBBBBBBBBBBBB")
    data = bytes([2, 12]) + epc_a + bytes([12]) + epc_b
    frame = _make_inventory_response(0x01, data)
    parsed = parse_frame(frame)

    epcs = extract_epcs_from_inventory_response(parsed)

    assert epcs == ["AAAAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBBBB"]


def test_extract_epcs_scan_time_overflow_still_returns_partial_data():
    """Status 0x02 (scan-time overflow) is not a failure - the manual
    says it still returns whatever tags it found before timing out."""
    epc = bytes.fromhex("CCCCCCCCCCCCCCCCCCCCCCCC")
    data = bytes([1, 12]) + epc
    frame = _make_inventory_response(0x02, data)
    parsed = parse_frame(frame)

    assert extract_epcs_from_inventory_response(parsed) == ["CCCCCCCCCCCCCCCCCCCCCCCC"]


def test_extract_epcs_raises_on_genuine_error_status():
    """0xFE = illegal command/CRC error - almost always means wrong
    baud rate, wrong address, or a non-UHFReader18 device answering.
    This must surface loudly, not be swallowed as "no tags"."""
    frame = _make_inventory_response(0xFE, data=b"")
    parsed = parse_frame(frame)
    with pytest.raises(ProtocolError, match="0xFE"):
        extract_epcs_from_inventory_response(parsed)


def test_extract_epcs_rejects_wrong_recmd():
    """Guards against accidentally feeding a Get Reader Information
    response (or any other command's response) into the Inventory
    parser."""
    parsed = ParsedFrame(address=0x00, re_cmd=0x21, status=0x00, data=b"")
    with pytest.raises(ProtocolError, match="Not an Inventory response"):
        extract_epcs_from_inventory_response(parsed)


def test_extract_epcs_truncated_tag_list_raises():
    # Claims 2 tags but only provides one - must not crash with an
    # IndexError or, worse, silently return partial garbage.
    epc = bytes.fromhex("DDDDDDDDDDDDDDDDDDDDDDDD")
    data = bytes([2, 12]) + epc  # says 2 tags, only 1 present
    frame = _make_inventory_response(0x01, data)
    parsed = parse_frame(frame)
    with pytest.raises(ProtocolError, match="truncated"):
        extract_epcs_from_inventory_response(parsed)


# ---------------------------------------------------------------------------
# parse_reader_information() - the connect()-time handshake/self-test
# ---------------------------------------------------------------------------


def test_parse_reader_information():
    # Version 2.36, Type 0x09 (UHFREADER18 per the manual), Tr_Type
    # 0b11 (supports both 6B and 6C), DMaxFre/DMinFre arbitrary, Power
    # 30 dBm, Scntm 0x0A (10 * 100ms = 1s, the documented default).
    data = bytes([2, 36, 0x09, 0b11, 0x00, 0x00, 30, 0x0A])
    payload = bytes([0x00, CMD_GET_READER_INFORMATION, 0x00]) + data
    length_byte = len(payload) + 2
    frame_wo_crc = bytes([length_byte]) + payload
    crc = crc16(frame_wo_crc)
    frame = frame_wo_crc + bytes([crc & 0xFF, (crc >> 8) & 0xFF])

    info = parse_reader_information(parse_frame(frame))

    assert info["version"] == "2.36"
    assert info["reader_type"] == 0x09
    assert info["supports_18000_6c"] is True
    assert info["supports_18000_6b"] is True
    assert info["power_dbm"] == 30
    assert info["inventory_scan_time_ms"] == 1000


def test_parse_reader_information_unknown_power():
    data = bytes([2, 36, 0x09, 0b10, 0x00, 0x00, 0xFF, 0x0A])
    payload = bytes([0x00, CMD_GET_READER_INFORMATION, 0x00]) + data
    length_byte = len(payload) + 2
    frame_wo_crc = bytes([length_byte]) + payload
    crc = crc16(frame_wo_crc)
    frame = frame_wo_crc + bytes([crc & 0xFF, (crc >> 8) & 0xFF])

    info = parse_reader_information(parse_frame(frame))

    assert info["power_dbm"] is None
