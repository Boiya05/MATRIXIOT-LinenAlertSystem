"""
hardware/vendor/dll_bridge.py

A small, dependency-free helper that talks to this specific reader
unit's vendor-supplied UHFReader18.dll and prints each tag EPC it
finds to stdout, one per line, flushed immediately.

Why this exists as a SEPARATE process instead of living inside
main.py directly: this reader unit (firmware v5.2, reported reader
type 0x86) rejects the Inventory command when driven by our own
from-scratch protocol implementation (hardware/uhfreader18_protocol.py)
AND by the vendor's own 64-bit UHFReader18.dll - both get refused with
status 0xFE ("illegal command"). Only the vendor's 32-bit DLL build
(bundled here as UHFReader18_x86.dll, copied from the working demo
install) actually succeeds - confirmed by direct testing, including
reading 100+ real tags correctly. A 32-bit DLL cannot be loaded via
ctypes into a 64-bit Python process, and the rest of this app's
dependencies (supabase, etc.) don't have working 32-bit Windows wheels
readily available - so rather than forcing the whole app to run under
32-bit Python, this one small script does, and hardware/dll_bridge_reader.py
(run by the normal 64-bit main.py process) launches it as a subprocess
and reads tag IDs from its stdout.

Run this directly for a quick check:
    <32-bit python> hardware/vendor/dll_bridge.py --port 5

Output protocol (stdout):
    One of:
        TAG <24-hex-char-EPC>       - a tag was found this poll
        READY <version> <type> <power>  - printed once, after the
            reader info handshake succeeds, so the parent process
            knows the connection is actually live (not just that this
            process launched).
        ERROR <message>             - something failed; the parent
            process should treat this reader as unavailable, same as
            a connect() failure in any other RFIDReader implementation.
    Anything unexpected on stdout should be treated as a protocol
    violation by the parent - this script is deliberately kept this
    simple so there's nothing else to parse.
"""

import argparse
import ctypes
import os
import sys
import time

DLL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "UHFReader18_x86.dll")

# Baud rate codes from the vendor's own DLL guide (section 3.1.1/3.1.2) -
# not a generic serial baud value, this is the DLL's own enum.
BAUD_CODES = {9600: 0, 19200: 1, 38400: 2, 57600: 5, 115200: 6}

# Inventory_G2 return values that mean "the call succeeded" (manual
# section 8.2.1's status table for command 0x01, which this DLL
# function mirrors) - 0xFB (STATUS_NO_TAG) is the normal idle state,
# not an error.
INVENTORY_OK_RESULTS = {0, 1, 2, 3, 4, 0xFB}


def _load_dll():
    if not os.path.exists(DLL_PATH):
        raise RuntimeError(f"Bundled DLL not found at {DLL_PATH}")
    dll = ctypes.WinDLL(DLL_PATH)

    dll.OpenComPort.argtypes = [
        ctypes.c_long,
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.c_ubyte,
        ctypes.POINTER(ctypes.c_long),
    ]
    dll.OpenComPort.restype = ctypes.c_long

    dll.GetReaderInformation.argtypes = [
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.POINTER(ctypes.c_ubyte * 2),
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.c_long,
    ]
    dll.GetReaderInformation.restype = ctypes.c_long

    dll.Inventory_G2.argtypes = [
        ctypes.POINTER(ctypes.c_ubyte),
        ctypes.c_ubyte,
        ctypes.c_ubyte,
        ctypes.c_ubyte,
        ctypes.POINTER(ctypes.c_ubyte * 5000),
        ctypes.POINTER(ctypes.c_long),
        ctypes.POINTER(ctypes.c_long),
        ctypes.c_long,
    ]
    dll.Inventory_G2.restype = ctypes.c_long

    dll.CloseComPort.restype = ctypes.c_long
    return dll


def _extract_epcs(buffer, total_len, card_num):
    """
    Pull `card_num` (length-byte, EPC-bytes) entries out of the DLL's
    output buffer. There is exactly one unexplained trailing byte at
    the very end of the whole buffer (confirmed empirically against
    real captured output, not per-tag) - harmless to ignore, since
    every tag's own length-prefixed EPC parses out cleanly without it.
    """
    data = bytes(buffer[:total_len])
    offset = 0
    epcs = []
    for _ in range(card_num):
        if offset >= len(data):
            break
        epc_len = data[offset]
        offset += 1
        epc = data[offset : offset + epc_len]
        offset += epc_len
        if len(epc) == epc_len:
            epcs.append(epc.hex().upper())
    return epcs


def main():
    ap = argparse.ArgumentParser(description="UHFReader18 DLL bridge")
    ap.add_argument("--port", type=int, required=True, help="COM port number, e.g. 5 for COM5")
    ap.add_argument("--baud", type=int, default=57600, choices=sorted(BAUD_CODES), help="baud rate")
    ap.add_argument("--address", type=lambda s: int(s, 0), default=0xFF, help="reader address (0xFF = broadcast)")
    ap.add_argument("--poll-interval", type=float, default=0.2, help="seconds between Inventory polls")
    args = ap.parse_args()

    def emit(line):
        print(line, flush=True)

    try:
        dll = _load_dll()
    except Exception as error:
        emit(f"ERROR Failed to load bridge DLL: {error}")
        sys.exit(1)

    com_adr = ctypes.c_ubyte(args.address)
    frm_handle = ctypes.c_long(0)
    baud_code = BAUD_CODES[args.baud]

    open_result = dll.OpenComPort(args.port, ctypes.byref(com_adr), baud_code, ctypes.byref(frm_handle))
    if open_result != 0:
        emit(f"ERROR OpenComPort(COM{args.port}) failed with code {open_result}")
        sys.exit(1)

    version = (ctypes.c_ubyte * 2)()
    reader_type = ctypes.c_ubyte()
    tr_type = ctypes.c_ubyte()
    dmaxfre = ctypes.c_ubyte()
    dminfre = ctypes.c_ubyte()
    power = ctypes.c_ubyte()
    scan_time = ctypes.c_ubyte()
    info_result = dll.GetReaderInformation(
        ctypes.byref(com_adr), ctypes.byref(version), ctypes.byref(reader_type),
        ctypes.byref(tr_type), ctypes.byref(dmaxfre), ctypes.byref(dminfre),
        ctypes.byref(power), ctypes.byref(scan_time), frm_handle,
    )
    if info_result != 0:
        emit(f"ERROR GetReaderInformation failed with code {info_result}")
        dll.CloseComPort()
        sys.exit(1)

    emit(f"READY {version[0]}.{version[1]} 0x{reader_type.value:02X} {power.value}")

    try:
        while True:
            epc_buffer = (ctypes.c_ubyte * 5000)()
            total_len = ctypes.c_long(0)
            card_num = ctypes.c_long(0)
            result = dll.Inventory_G2(
                ctypes.byref(com_adr), 0, 0, 0,
                ctypes.byref(epc_buffer), ctypes.byref(total_len), ctypes.byref(card_num), frm_handle,
            )
            if result not in INVENTORY_OK_RESULTS:
                emit(f"ERROR Inventory_G2 failed with status 0x{result:02X}")
            elif card_num.value > 0:
                for epc in _extract_epcs(epc_buffer, total_len.value, card_num.value):
                    emit(f"TAG {epc}")
            time.sleep(args.poll_interval)
    except KeyboardInterrupt:
        pass
    finally:
        dll.CloseComPort()


if __name__ == "__main__":
    main()
