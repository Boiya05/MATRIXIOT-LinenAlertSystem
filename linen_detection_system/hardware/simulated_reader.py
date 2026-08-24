"""
hardware/simulated_reader.py

Despite the name, this is also how a real USB "keyboard wedge" RFID
reader reaches the app today - see main.py's "Scan / type Tag ID" and
exit scanner fields. Nothing here talks to any hardware itself:
connect()/start()/stop() are no-ops, and a tag is only ever "read"
when simulate_scan() is called directly, by either of those text
fields (typed by hand, or "typed" by a real reader emulating a
keyboard). It's also just useful to keep around for testing without a
reader on hand.

This is also what main.py's exit scanner checks with isinstance() to
decide whether its manual field should do anything, or whether a real
serial reader is active and driving that role automatically instead
(the entry side's "Scan / type Tag ID" field always works, regardless
of mode, since a keyboard-wedge reader isn't something
hardware_config.json even has a way to describe).
"""

from .base import RFIDReader


class SimulatedReader(RFIDReader):
    """Stands in for a real reader until one is connected."""

    def connect(self):
        pass  # nothing to connect to

    def disconnect(self):
        pass  # nothing to close

    def start(self):
        pass  # nothing to start - simulate_scan() is called directly instead

    def stop(self):
        pass

    def simulate_scan(self, tag_id):
        """
        Push a fake tag read onto the queue, exactly as if a real
        reader had just picked it up. main.py's poll loop then
        handles it through the same code path a real scan would use -
        this method is the only thing that's actually "simulated";
        everything downstream of it is the real code.
        """
        self.tag_queue.put(tag_id)
