"""
hardware/base.py

Defines the contract every RFID reader implementation follows -
whether it's SimulatedReader (button/typed-input driven, for testing
without hardware) or SerialRFIDReader (a real reader over a COM port).

The rest of the app (main.py) only ever talks to this interface. It
calls connect() / start() once, then poll() on a timer - it never
needs to know or care which subclass it actually has. That's the
whole point of this layer: swapping which class reader_factory.py
builds is the only thing that changes when real hardware arrives.

Why poll() instead of a callback: a real reader's I/O happens on a
background thread (see SerialRFIDReader), but tkinter widgets can only
be touched safely from the main thread. Rather than every reader
implementation having to know about tkinter, each one just pushes tag
IDs onto a thread-safe queue.Queue as it reads them. main.py drains
that queue on a timer (root.after) from the main thread, so no reader
implementation - simulated or real - ever needs to think about thread
safety beyond "queue.Queue is already thread-safe."
"""

import queue
from abc import ABC, abstractmethod

# A UHF EPC Gen2 tag ID is a fixed-length hex string - every real tag
# seen from this hardware has been exactly 24 hex characters (96-bit
# EPC, the standard length for ISO18000-6C tags). A keyboard-wedge
# reader in continuous-inventory mode can occasionally drop the Enter
# keystroke between two back-to-back reads - confirmed happening in
# practice, not just a theoretical risk - which lands here as one long
# string that's actually two (or more) tag IDs glued together with no
# separator. push() below recovers from that; see its docstring.
TAG_ID_HEX_LENGTH = 24


def _split_concatenated_reads(raw):
    """
    Recover from two or more tag reads landing as one string with no
    separator between them (see TAG_ID_HEX_LENGTH's comment above).

    Deliberately narrow: only splits a string that's *entirely* hex
    and an exact multiple of TAG_ID_HEX_LENGTH - a genuinely different
    tag format (a different reader, a barcode, a person typing
    something else into the field) never matches that pattern, so it's
    passed through unchanged rather than mangled.

    Returns:
        list[str]: one or more tag IDs. Always at least one element -
        the original string unchanged if it doesn't look like a
        concatenation of fixed-length hex reads.
    """
    cleaned = raw.strip().upper()
    is_hex = len(cleaned) > 0 and all(c in "0123456789ABCDEF" for c in cleaned)
    if is_hex and len(cleaned) > TAG_ID_HEX_LENGTH and len(cleaned) % TAG_ID_HEX_LENGTH == 0:
        return [
            cleaned[i : i + TAG_ID_HEX_LENGTH]
            for i in range(0, len(cleaned), TAG_ID_HEX_LENGTH)
        ]
    return [raw]


class RFIDReader(ABC):
    """Base class for anything that can produce a stream of tag reads."""

    def __init__(self, role):
        # "entry_reader" or "exit_reader" - which checkpoint this
        # instance represents. Used only for log/error messages, so
        # it's clear which reader a problem came from.
        self.role = role
        self.tag_queue = queue.Queue()

    @abstractmethod
    def connect(self):
        """Establish the connection to the reader. Raise on failure."""

    @abstractmethod
    def disconnect(self):
        """Close the connection cleanly. Safe to call even if never connected."""

    @abstractmethod
    def start(self):
        """Begin listening for tag reads (e.g. start a background thread)."""

    @abstractmethod
    def stop(self):
        """Stop listening. Safe to call even if never started."""

    def push(self, tag_id):
        """
        Enqueue one tag read - the single funnel point every reader
        implementation (simulated, keyboard-wedge, or a future real
        serial reader) should call instead of touching tag_queue
        directly, so the concatenated-read recovery in
        _split_concatenated_reads() always applies, no matter the
        source.
        """
        for single_id in _split_concatenated_reads(tag_id):
            self.tag_queue.put(single_id)

    def poll(self):
        """
        Drain every tag read that's arrived since the last poll.

        Returns:
            list[str]: Tag IDs read since the last call, oldest first.
            Empty if nothing new arrived.
        """
        tag_ids = []
        while True:
            try:
                tag_ids.append(self.tag_queue.get_nowait())
            except queue.Empty:
                break
        return tag_ids
