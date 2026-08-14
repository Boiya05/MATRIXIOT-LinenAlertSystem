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
