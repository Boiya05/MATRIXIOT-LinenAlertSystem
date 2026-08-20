"""
hardware/simulated_reader.py

A fake RFIDReader used until real hardware is connected (and worth
keeping afterwards too, for testing without the physical reader on
hand). Nothing here talks to any hardware: connect()/start()/stop()
are no-ops, and a tag is only ever "read" when simulate_scan() is
called directly - driven by the GUI's "Scan (Simulated)" button or the
exit scanner's manual Tag ID field.

This is also what main.py checks with isinstance() to decide whether
those manual controls should do anything, or whether a real reader is
active and driving that same role automatically instead.
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
