"""
hardware/

The RFID hardware abstraction layer.

main.py only ever imports create_reader() from reader_factory - it
never talks to SimulatedReader or SerialRFIDReader directly, and never
needs to know which one it got. See base.py for the interface both
implement, and serial_reader.py for the part that's still a
placeholder until a real reader model is chosen.
"""

from .reader_factory import create_reader

__all__ = ["create_reader"]
