"""
main.py

Entry point for the Linen RFID Detection System.

This version uses a graphical window (built with Python's built-in
"tkinter" library) instead of a terminal.

Two RFID checkpoints feed this app: an entry reader (registering new
items into the pending list) and an exit reader (theft detection).
Both are built on the same generic reader abstraction in hardware/ -
by default (hardware_config.json missing or unconfigured) both are
SimulatedReader instances, driven by the "Scan / type Tag ID" field and
the exit scanner's manual Tag ID field. A real USB "keyboard wedge"
RFID reader - the kind that just types the tag ID and presses Enter,
no COM port involved - works today through either of those text
fields, no configuration needed; see their comments in
_build_widgets(). hardware_config.json is only for a reader that talks
over a real serial port instead - see hardware/serial_reader.py for
what's still a placeholder there.
"""

import time
import tkinter as tk
from tkinter import messagebox, ttk

import alarm
import database
import detector
from hardware import create_reader
from hardware.simulated_reader import SimulatedReader
from models import STATUS_IN_USE, STATUS_LAUNDRY, STATUS_STORAGE, LinenItem

# The kinds of linen items this app tracks. A real UHF tag only
# carries a Tag ID (its EPC), not a human-readable item type, so staff
# pick the type from this list at scan time - see the Item Type
# dropdown and _handle_entry_scan() below.
ITEM_TYPES = ["Bath Towel", "Hand Towel", "Washcloth", "Bedsheet", "Pillowcase", "Blanket"]

# How long to ignore repeat reads of the same tag, at either
# checkpoint, after processing one. A real UHF reader reports a tag
# many times a second for as long as it's in range, not once - without
# this, one physical tag would pop the exit-scanner alarm (or spam the
# "already registered"/"already pending" message on the entry side)
# over and over for the same event instead of just once. Mirrors
# RESCAN_COOLDOWN_MS in the mobile app's and web dashboard's scan pages
# (same 5 seconds).
RESCAN_COOLDOWN_SECONDS = 5.0


class LinenApp:
    """The main application window for the Linen RFID Detection System."""

    def __init__(self, root):
        self.root = root
        self.root.title("Linen RFID Detection System")

        # The window used to default to a hardcoded 700x920 - taller
        # than the usable screen area on a smaller/laptop display (or
        # one that's scaled up), which pushed the bottom of the window
        # - including the Saved Items table and its scrollbar - off
        # screen entirely, with no way to reach it. Cap the window to
        # whatever actually fits on screen instead, and center it, so
        # it always opens fully visible regardless of display size.
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        window_width = min(700, screen_width - 40)
        window_height = min(920, screen_height - 80)  # leaves room for the taskbar
        x = max(0, (screen_width - window_width) // 2)
        y = max(0, (screen_height - window_height) // 2)
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        self.root.minsize(min(600, window_width), min(500, window_height))

        # Items that have been scanned but not yet assigned to a
        # customer/room. Each entry is a (tag_id, item_type) tuple.
        self.pending_items = []

        # Already-registered items queued in the Assign to Guest
        # section, waiting for one customer/room to be applied to all
        # of them at once. Each entry is a full LinenItem (fetched
        # from the database, not just a tag/type pair).
        self.assign_pending_items = []

        # tag_id -> time.monotonic() of the last time it was processed
        # at each checkpoint - see _handle_exit_scan()'s and
        # _handle_entry_scan()'s cooldown checks, and
        # RESCAN_COOLDOWN_SECONDS above. Separate dicts because the two
        # checkpoints are independent - the same tag passing through
        # both should still be handled at each.
        self._exit_last_seen = {}
        self._entry_last_seen = {}

        # tag_id -> status, for every currently-registered item -
        # rebuilt by _refresh_item_table() every time it runs (startup,
        # and after every save/assign/edit/delete), so it's never more
        # stale than the on-screen table already is. _handle_entry_scan()
        # reads this instead of calling database.get_item_by_tag() on
        # every single scan - with a real reader flooding reads during a
        # batch registration, a network round-trip per scan was the
        # actual bottleneck on how fast you could move through a stack
        # of items; a local lookup is instant.
        self._registered_items = {}

        # RFID hardware - see hardware/ for the abstraction layer.
        # Each role defaults to a SimulatedReader unless
        # hardware_config.json configures a real serial port for it
        # (see hardware_config.example.json).
        self.entry_reader = create_reader("entry_reader")
        self.exit_reader = create_reader("exit_reader")
        self._connect_reader(self.entry_reader)
        self._connect_reader(self.exit_reader)

        self._build_widgets()
        self._refresh_item_table()

        # Disconnect hardware cleanly on close instead of leaving a
        # serial port open until the process fully dies.
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        # Start the poll loop that drains both readers' queues. This
        # is the only place tag reads (simulated or real) actually
        # reach the GUI - see _poll_readers()'s docstring.
        self._poll_readers()

    def _build_widgets(self):
        """Create and arrange all the widgets in the window."""

        # --- Operator: who's using this terminal right now ---
        # This app has no login screen (see database.py's module
        # docstring - it authenticates as service_role, not as a
        # specific person), so there's no automatic "who" the way the
        # mobile/web apps get from a signed-in session. Typing a name
        # here is optional but, if filled in, gets attached to every
        # action taken from this window in the linen_item_events audit
        # trail (see _log_event() below) - left blank, those events
        # just record no actor rather than a guess.
        operator_frame = ttk.Frame(self.root, padding=(10, 8, 10, 0))
        operator_frame.pack(fill="x")
        ttk.Label(operator_frame, text="Operator Name (for the audit trail):").pack(side="left")
        self.operator_entry = ttk.Entry(operator_frame, width=25)
        self.operator_entry.pack(side="left", padx=(6, 0))

        # --- Scan section: real RFID reader input ---
        scan_frame = ttk.Frame(self.root, padding=10)
        scan_frame.pack(fill="x")

        # A real UHF tag only carries a Tag ID - it doesn't say what
        # the item actually is. Staff pick that here before scanning;
        # whatever's selected applies to the next tag read (see
        # _handle_entry_scan()). Stays on the last-picked value after
        # each scan, so scanning several of the same item type in a
        # row doesn't need reselecting every time.
        ttk.Label(scan_frame, text="Item Type:").pack(side="left")
        self.item_type_combo = ttk.Combobox(scan_frame, values=ITEM_TYPES, state="readonly", width=14)
        self.item_type_combo.current(0)
        self.item_type_combo.pack(side="left")

        # --- Real scanner input: for the actual USB RFID reader ---
        # This reader (and every "USB scanner"/"keyboard wedge" reader
        # like it) doesn't talk over a COM port - to the OS it's just a
        # keyboard. It types the tag ID as keystrokes into whatever
        # field currently has focus, then sends Enter. So instead of
        # hardware/serial_reader.py's approach (open a port, parse raw
        # bytes), all this needs is a plain Entry field to be focused
        # when a tag is scanned - <Return> below is what actually reads
        # the scan, whether it was typed by a person or a real reader.
        # Goes through entry_reader.simulate_scan(), so
        # _handle_entry_scan() is the single processing path for every
        # tag - see its docstring for the duplicate-scan check this
        # needed once a real reader was in the picture (a tag sitting
        # in range gets read - and would get re-added - many times a
        # second otherwise).
        scan_frame2 = ttk.Frame(self.root, padding=(10, 0, 10, 10))
        scan_frame2.pack(fill="x")
        ttk.Label(scan_frame2, text="Scan / type Tag ID:").pack(side="left")
        self.entry_tag_entry = ttk.Entry(scan_frame2, width=28)
        self.entry_tag_entry.pack(side="left", padx=(6, 0))
        self.entry_tag_entry.bind("<Return>", lambda event: self._on_entry_scan())
        self.entry_tag_entry.focus_set()

        # --- Pending scans: items scanned but not yet assigned ---
        # A live count rather than a static heading - with a real
        # reader flooding scans during a batch registration, seeing
        # the number climb is the main feedback that scanning is
        # actually being captured (see _update_pending_count()).
        self.pending_count_label = ttk.Label(self.root, text="Pending Items: 0 scanned")
        self.pending_count_label.pack(anchor="w", padx=10)
        pending_columns = ("tag_id", "item_type")
        self.pending_tree = ttk.Treeview(
            self.root, columns=pending_columns, show="headings", height=5, selectmode="browse"
        )
        self.pending_tree.heading("tag_id", text="Tag ID")
        self.pending_tree.heading("item_type", text="Item Type")
        self.pending_tree.pack(fill="x", padx=10, pady=(0, 5))

        remove_pending_button = ttk.Button(
            self.root, text="Remove Selected Pending Item", command=self._on_remove_pending
        )
        remove_pending_button.pack(anchor="e", padx=10, pady=(0, 10))

        # --- Save section: apply one customer/room to all pending items ---
        # Customer Name and Room Number are both optional - leave them
        # blank to register the pending tags as unassigned stock (see
        # _on_assign()'s docstring), or fill them in to also assign a
        # guest in this same step.
        assign_frame = ttk.Frame(self.root, padding=10)
        assign_frame.pack(fill="x")

        ttk.Label(assign_frame, text="Customer Name (optional):").grid(
            row=0, column=0, sticky="w", pady=2
        )
        self.customer_entry = ttk.Entry(assign_frame, width=25)
        self.customer_entry.grid(row=0, column=1, padx=5, pady=2)

        ttk.Label(assign_frame, text="Room Number (optional):").grid(
            row=1, column=0, sticky="w", pady=2
        )
        self.room_entry = ttk.Entry(assign_frame, width=25)
        self.room_entry.grid(row=1, column=1, padx=5, pady=2)

        assign_button = ttk.Button(assign_frame, text="Save", command=self._on_assign)
        assign_button.grid(row=2, column=0, columnspan=2, pady=8)

        # --- Assign to Guest section: attach one customer/room to any
        #     number of already-registered tags at once (scanned above
        #     with the customer/room fields left blank, or being
        #     reassigned to a different guest than before) - same
        #     batch pattern as the Save section's pending list. ---
        assign_guest_frame = ttk.LabelFrame(
            self.root, text="Assign to Guest (already-registered tags)", padding=10
        )
        assign_guest_frame.pack(fill="x", padx=10, pady=(0, 10))

        assign_lookup_row = ttk.Frame(assign_guest_frame)
        assign_lookup_row.pack(fill="x")
        ttk.Label(assign_lookup_row, text="Tag ID:").pack(side="left")
        self.assign_tag_entry = ttk.Entry(assign_lookup_row, width=22)
        self.assign_tag_entry.pack(side="left", padx=(6, 0))
        self.assign_tag_entry.bind("<Return>", lambda event: self._on_assign_guest_lookup())
        assign_add_button = ttk.Button(
            assign_lookup_row, text="Add", command=self._on_assign_guest_lookup
        )
        assign_add_button.pack(side="left", padx=(6, 0))

        assign_pending_columns = ("tag_id", "item_type", "status")
        self.assign_pending_tree = ttk.Treeview(
            assign_guest_frame,
            columns=assign_pending_columns,
            show="headings",
            height=3,
            selectmode="browse",
        )
        self.assign_pending_tree.heading("tag_id", text="Tag ID")
        self.assign_pending_tree.heading("item_type", text="Item Type")
        self.assign_pending_tree.heading("status", text="Current Status")
        self.assign_pending_tree.pack(fill="x", pady=(8, 4))

        remove_assign_pending_button = ttk.Button(
            assign_guest_frame, text="Remove Selected", command=self._on_remove_assign_pending
        )
        remove_assign_pending_button.pack(anchor="e", pady=(0, 8))

        assign_fields_frame = ttk.Frame(assign_guest_frame)
        assign_fields_frame.pack(fill="x")
        ttk.Label(assign_fields_frame, text="Customer Name:").grid(row=0, column=0, sticky="w", pady=2)
        self.assign_customer_entry = ttk.Entry(assign_fields_frame, width=25)
        self.assign_customer_entry.grid(row=0, column=1, padx=5, pady=2)

        ttk.Label(assign_fields_frame, text="Room Number:").grid(row=1, column=0, sticky="w", pady=2)
        self.assign_room_entry = ttk.Entry(assign_fields_frame, width=25)
        self.assign_room_entry.grid(row=1, column=1, padx=5, pady=2)

        assign_to_guest_button = ttk.Button(
            assign_guest_frame, text="Assign to Guest", command=self._on_assign_to_guest
        )
        assign_to_guest_button.pack(pady=(8, 0))

        # --- Status line: shows the result of the last action ---
        self.status_label = ttk.Label(self.root, text="", foreground="green")
        self.status_label.pack(pady=(0, 5))

        ttk.Separator(self.root, orient="horizontal").pack(fill="x", padx=10)

        # --- Exit scanner section: simulates the RFID reader placed at
        #     the exit. Any tag scanned here is treated as a theft. ---
        exit_frame = ttk.Frame(self.root, padding=10)
        exit_frame.pack(fill="x")

        ttk.Label(exit_frame, text="Exit Scanner (simulated):").grid(
            row=0, column=0, sticky="w"
        )
        self.exit_tag_entry = ttk.Entry(exit_frame, width=25)
        self.exit_tag_entry.grid(row=0, column=1, padx=5)
        # Pressing Enter here simulates a tag passing the exit reader.
        self.exit_tag_entry.bind("<Return>", lambda event: self._on_exit_scan())

        exit_button = ttk.Button(exit_frame, text="Simulate Exit Scan", command=self._on_exit_scan)
        exit_button.grid(row=0, column=2, padx=5)

        # --- Table of every linen item saved so far ---
        saved_header_frame = ttk.Frame(self.root)
        saved_header_frame.pack(fill="x", padx=10)

        ttk.Label(saved_header_frame, text="Saved Items:").pack(side="left")

        ttk.Label(saved_header_frame, text="Sort by:").pack(side="left", padx=(15, 5))
        self.sort_by_combo = ttk.Combobox(
            saved_header_frame,
            values=["Tag ID", "Customer Name", "Item Type"],
            state="readonly",
            width=15,
        )
        self.sort_by_combo.current(0)
        self.sort_by_combo.pack(side="left")
        # Reload the table (in the new order) whenever the sort choice changes.
        self.sort_by_combo.bind("<<ComboboxSelected>>", lambda event: self._refresh_item_table())

        # A plain Treeview has no way to scroll to rows that don't fit
        # in the visible window - with enough saved items (or a small
        # enough window) there was no way to reach the rest at all.
        # Wrapping it with a Frame + Scrollbar fixes that.
        tree_frame = ttk.Frame(self.root)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=(10, 0))

        columns = ("tag_id", "customer_name", "room_number", "item_type", "status")
        self.tree = ttk.Treeview(tree_frame, columns=columns, show="headings", selectmode="browse")
        self.tree.heading("tag_id", text="Tag ID")
        self.tree.heading("customer_name", text="Customer")
        self.tree.heading("room_number", text="Room")
        self.tree.heading("item_type", text="Item Type")
        self.tree.heading("status", text="Status")

        tree_scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        tree_scrollbar.pack(side="right", fill="y")

        # --- Buttons that act on whichever row is selected above ---
        actions_frame = ttk.Frame(self.root, padding=10)
        actions_frame.pack(anchor="e")

        mark_in_use_button = ttk.Button(
            actions_frame,
            text="Mark In Use",
            command=lambda: self._on_mark_status(STATUS_IN_USE),
        )
        mark_in_use_button.pack(side="left", padx=5)

        mark_laundry_button = ttk.Button(
            actions_frame,
            text="Mark Laundry",
            command=lambda: self._on_mark_status(STATUS_LAUNDRY),
        )
        mark_laundry_button.pack(side="left", padx=5)

        mark_storage_button = ttk.Button(
            actions_frame,
            text="Mark Storage",
            command=lambda: self._on_mark_status(STATUS_STORAGE),
        )
        mark_storage_button.pack(side="left", padx=5)

        edit_button = ttk.Button(
            actions_frame, text="Edit Selected", command=self._on_edit_selected
        )
        edit_button.pack(side="left", padx=5)

        delete_button = ttk.Button(
            actions_frame, text="Delete Selected", command=self._on_delete_selected
        )
        delete_button.pack(side="left", padx=5)

    def _get_operator_label(self):
        """The typed Operator Name, or None if left blank - see the Operator field's comment in _build_widgets()."""
        name = self.operator_entry.get().strip()
        return name or None

    def _log_event(self, tag_id, event_type, **kwargs):
        """
        Best-effort audit-trail write - see database.log_item_event().
        Never blocks or raises past this point: a failure here just
        means this one action won't show up in the audit trail, not
        that the action itself (which already happened) should fail.
        """
        try:
            database.log_item_event(tag_id, event_type, actor_label=self._get_operator_label(), **kwargs)
        except Exception as error:
            print(f"Failed to log audit event: {error}")

    def _connect_reader(self, reader):
        """
        Connect and start a reader, showing a warning instead of
        crashing the whole app if it fails - e.g. hardware_config.json
        points at a COM port that isn't plugged in. The app stays
        usable either way; that particular reader just won't produce
        any tag reads until it's fixed and the app is restarted.
        """
        try:
            reader.connect()
            reader.start()
        except Exception as error:
            messagebox.showwarning(
                f"{reader.role.replace('_', ' ').title()} unavailable",
                f"Could not start the {reader.role.replace('_', ' ')}:\n\n{error}\n\n"
                "Continuing without it - check hardware_config.json.",
            )

    def _on_close(self):
        """Disconnect both readers cleanly (closing any open serial port) before exiting."""
        self.entry_reader.disconnect()
        self.exit_reader.disconnect()
        self.root.destroy()

    def _poll_readers(self):
        """
        Runs on a repeating timer (tkinter's root.after) to drain any
        tag reads that have arrived since the last poll - from a
        background thread for a real serial reader, or from a button
        click / typed Tag ID for a simulated one. This is the only
        safe way to get reader data into the GUI: tkinter widgets can
        only be touched from the main thread, and this method always
        runs on it.
        """
        for tag_id in self.entry_reader.poll():
            self._handle_entry_scan(tag_id)
        for tag_id in self.exit_reader.poll():
            self._handle_exit_scan(tag_id)
        self.root.after(150, self._poll_readers)

    def _on_entry_scan(self):
        """
        Called when Enter is pressed in the "Scan / type Tag ID" field
        - either a person typed it, or (the actual point of this
        field) a real USB RFID reader "typed" it and sent Enter on its
        own. Pushes it through entry_reader.simulate_scan(), the same
        queue a real reader would use, so _handle_entry_scan() below
        is the single processing path either way. See the field's
        comment in _build_widgets() for why a keyboard-wedge reader
        needs a focused text field instead of the serial/COM-port
        handling hardware/serial_reader.py has.
        """
        tag_id = self.entry_tag_entry.get().strip().upper()

        self.entry_tag_entry.delete(0, tk.END)
        self.entry_tag_entry.focus_set()

        if not tag_id:
            return

        self.entry_reader.simulate_scan(tag_id)

    def _handle_entry_scan(self, tag_id):
        """
        Called for every tag read from the entry reader - whether it
        came from a real reader running in serial mode, or the "Scan /
        type Tag ID" field (a real keyboard-wedge reader, or someone
        typing by hand). Adds the tag to the pending list (with
        whatever Item Type is currently selected in the dropdown),
        waiting to be assigned to a customer and room - unless it's
        already registered, or already sitting in this pending list.

        A real reader keeps reading the same tag over and over for as
        long as it's in range (many times a second) rather than
        reading it once - the cooldown check below stops that from
        spamming a database lookup (and, if rejected, the status
        message) once per read instead of once per actual scan event.
        """
        now = time.monotonic()
        last_seen = self._entry_last_seen.get(tag_id)
        if last_seen is not None and now - last_seen < RESCAN_COOLDOWN_SECONDS:
            return  # same tag, still within the cooldown window - ignore
        self._entry_last_seen[tag_id] = now

        # Once the tag is assigned (or removed from pending), it's no
        # longer "already pending", so scanning it again later works
        # normally - this only blocks re-adding it while it's still
        # sitting in the current batch.
        already_pending = any(pending_tag == tag_id for pending_tag, _ in self.pending_items)
        if already_pending:
            self.status_label.config(text=f"{tag_id} is already in the pending list - ignored repeat scan.")
            return

        # A tag that's already registered in the database would
        # silently overwrite that existing row (upsert-on-tag_id) if
        # registered again here - the same physical tag can't belong
        # to two different registrations at once. "Assign to Guest"
        # (or "Edit Selected" on desktop) is the right place to change
        # an existing item's details instead.
        #
        # Checked against self._registered_items (see __init__) rather
        # than a fresh database.get_item_by_tag() call - a network
        # round-trip on every single scan was the real limit on how
        # fast a batch of tags could be registered. The cache is at
        # most as stale as the on-screen table, which is refreshed
        # after every write anyway.
        existing_status = self._registered_items.get(tag_id)
        if existing_status is not None:
            self.status_label.config(
                text=(
                    f"{tag_id} is already registered ({existing_status}) - "
                    "use Assign to Guest to change it instead of re-registering."
                )
            )
            return

        item_type = self.item_type_combo.get()

        self.pending_items.append((tag_id, item_type))
        self.pending_tree.insert("", tk.END, values=(tag_id, item_type))
        self._update_pending_count()

        self.status_label.config(text=f"Scanned {tag_id} ({item_type}). Added to pending list.")

    def _update_pending_count(self):
        """Keep the Pending Items heading's live count in sync with self.pending_items."""
        count = len(self.pending_items)
        noun = "item" if count == 1 else "items"
        self.pending_count_label.config(text=f"Pending Items: {count} {noun} scanned")

    def _on_remove_pending(self):
        """
        Called when the user clicks "Remove Selected Pending Item".

        Removes whichever row is selected in the Pending Items table -
        useful for undoing an accidental or mis-scanned tag before it
        gets assigned to a customer.
        """
        selected = self.pending_tree.selection()

        if not selected:
            messagebox.showwarning("No Item Selected", "Select a pending item first.")
            return

        tag_id = self.pending_tree.item(selected[0], "values")[0]
        self.pending_items = [
            (pending_tag, pending_type)
            for pending_tag, pending_type in self.pending_items
            if pending_tag != tag_id
        ]
        self.pending_tree.delete(selected[0])
        self._update_pending_count()

        self.status_label.config(text=f"Removed {tag_id} from pending list.")

    def _on_assign(self):
        """
        Called when the user clicks "Save".

        Applies whatever Customer Name / Room Number is entered - both
        optional - to every pending item at once and saves each one to
        the database, then clears the pending list.

        Leaving Customer Name and Room Number blank saves the tags as
        unassigned stock, sorted only by Item Type (status Storage -
        "not currently with any customer", which is exactly what this
        is). Use the "Assign to Guest" section below to attach a
        customer to them later. Filling both in here does registration
        and assignment in one step, same as this used to always
        require.
        """
        customer_name = self.customer_entry.get().strip()
        room_number = self.room_entry.get().strip()

        if not self.pending_items:
            messagebox.showwarning("Nothing to Save", "Scan at least one item first.")
            return

        # _handle_entry_scan() only ever checked self._registered_items -
        # a local cache, not a live lookup - so a tag registered by
        # another device (or another app) in the gap between that cache
        # last refreshing and this click could otherwise slip through
        # and get silently overwritten by the save_linen_item() upsert
        # below. One batched query here re-checks the whole pending list
        # at once, right before it actually matters, instead of paying a
        # network round-trip for every single scan on the way in.
        already_registered = {
            item.tag_id: item.status
            for item in database.get_items_by_tags([tag_id for tag_id, _ in self.pending_items])
        }
        to_save = [
            (tag_id, item_type)
            for tag_id, item_type in self.pending_items
            if tag_id not in already_registered
        ]
        skipped_count = len(self.pending_items) - len(to_save)

        assigning_now = bool(customer_name or room_number)
        status = STATUS_IN_USE if assigning_now else STATUS_STORAGE

        for tag_id, item_type in to_save:
            item = LinenItem(
                tag_id=tag_id,
                customer_name=customer_name,
                room_number=room_number,
                item_type=item_type,
                status=status,
            )
            database.save_linen_item(item)
            self._log_event(
                tag_id,
                "registered",
                new_status=status,
                customer_name=customer_name or None,
                room_number=room_number or None,
                detail=item_type,
            )

        saved_count = len(to_save)

        self.pending_items.clear()
        for row in self.pending_tree.get_children():
            self.pending_tree.delete(row)
        self._update_pending_count()

        self.customer_entry.delete(0, tk.END)
        self.room_entry.delete(0, tk.END)

        if assigning_now:
            message = f"Saved and assigned {saved_count} item(s) to {customer_name}."
        else:
            message = f"Saved {saved_count} item(s) as unassigned stock."
        if skipped_count:
            message += f" Skipped {skipped_count} already registered elsewhere - use Assign to Guest for those."
        self.status_label.config(text=message)
        self._refresh_item_table()

    def _on_assign_guest_lookup(self):
        """
        Called when clicking "Add" (or pressing Enter in the Tag ID
        field) in the Assign to Guest section. Looks up an already-
        registered tag and queues it in the list below, waiting for
        one Customer Name + Room Number to be applied to everything
        queued at once - mirrors the Save section's pending list,
        just for tags that already exist in the database instead of
        new ones.
        """
        tag_id = self.assign_tag_entry.get().strip().upper()
        self.assign_tag_entry.delete(0, tk.END)
        self.assign_tag_entry.focus_set()

        if not tag_id:
            return

        already_queued = any(existing.tag_id == tag_id for existing in self.assign_pending_items)
        if already_queued:
            self.status_label.config(text=f"{tag_id} is already in the list.")
            return

        item = database.get_item_by_tag(tag_id)
        if item is None:
            messagebox.showwarning(
                "Not Registered",
                f"{tag_id} isn't registered yet - register it above first.",
            )
            return

        self.assign_pending_items.append(item)
        self.assign_pending_tree.insert(
            "", tk.END, values=(item.tag_id, item.item_type, item.status)
        )
        self.status_label.config(text=f"Added {tag_id} to the assign list.")

    def _on_remove_assign_pending(self):
        """
        Called when the user clicks "Remove Selected" in the Assign to
        Guest section - removes whichever row is selected from that
        list, without touching the database (nothing's been saved yet
        at this point).
        """
        selected = self.assign_pending_tree.selection()

        if not selected:
            messagebox.showwarning("No Item Selected", "Select an item in the list first.")
            return

        tag_id = self.assign_pending_tree.item(selected[0], "values")[0]
        self.assign_pending_items = [
            item for item in self.assign_pending_items if item.tag_id != tag_id
        ]
        self.assign_pending_tree.delete(selected[0])

    def _on_assign_to_guest(self):
        """
        Called when the user clicks "Assign to Guest".

        Applies the entered Customer Name + Room Number to every tag
        queued in the list above at once, flipping each one's status
        to In Use - the other half of registering with those fields
        left blank in _on_assign() above, and also works to reassign
        items that are already with a different guest.
        """
        customer_name = self.assign_customer_entry.get().strip()
        room_number = self.assign_room_entry.get().strip()

        if not self.assign_pending_items:
            messagebox.showwarning("Nothing to Assign", "Add at least one tag first.")
            return

        if not customer_name or not room_number:
            messagebox.showwarning(
                "Missing Details", "Please fill in Customer Name and Room Number."
            )
            return

        for item in self.assign_pending_items:
            old_status = item.status
            updated_item = LinenItem(
                tag_id=item.tag_id,
                customer_name=customer_name,
                room_number=room_number,
                item_type=item.item_type,
                status=STATUS_IN_USE,
            )
            database.save_linen_item(updated_item)
            self._log_event(
                item.tag_id,
                "status_changed",
                old_status=old_status,
                new_status=STATUS_IN_USE,
                customer_name=customer_name,
                room_number=room_number,
                detail=item.item_type,
            )

        assigned_count = len(self.assign_pending_items)

        self.assign_pending_items.clear()
        for row in self.assign_pending_tree.get_children():
            self.assign_pending_tree.delete(row)

        self.assign_customer_entry.delete(0, tk.END)
        self.assign_room_entry.delete(0, tk.END)

        self.status_label.config(text=f"Assigned {assigned_count} item(s) to {customer_name}.")
        self._refresh_item_table()

    def _on_exit_scan(self):
        """
        Called when Enter is pressed or "Simulate Exit Scan" is
        clicked in the exit scanner field.

        Only does anything while the exit reader is running in
        simulated mode - pushes the typed Tag ID through the same
        queue a real reader would use, so _handle_exit_scan() below is
        the single code path either way.
        """
        if not isinstance(self.exit_reader, SimulatedReader):
            messagebox.showinfo(
                "Real reader active",
                "The exit reader is configured for real hardware in "
                "hardware_config.json - it scans automatically. This field "
                "only does something in simulated mode.",
            )
            return

        tag_id = self.exit_tag_entry.get().strip().upper()

        if not tag_id:
            messagebox.showwarning("Missing Tag ID", "Please enter a Tag ID.")
            return

        self.exit_reader.simulate_scan(tag_id)

        self.exit_tag_entry.delete(0, tk.END)
        self.exit_tag_entry.focus()

    def _handle_exit_scan(self, tag_id):
        """
        Called for every tag read from the exit reader - whether it
        came from a real scan or the manual exit scanner field. Any
        tag detected here is treated as leaving the building, so it's
        run through detector.py and, if flagged, alarm.py shows a
        pop-up warning.

        A real reader keeps reading the same tag many times a second
        for as long as it's in range, not just once - without a
        cooldown, one tag walking past the exit would trigger the
        alarm (pop-up, Telegram, WhatsApp, a theft_alerts row) once per
        read instead of once per actual event. See
        RESCAN_COOLDOWN_SECONDS above.

        Beyond that short cooldown, a tag that already has an
        undismissed alert waiting doesn't raise a second one either -
        re-scanning something that's already flagged (or a reader
        that keeps seeing it well past the cooldown) shouldn't spam
        more alerts for the same event. Dismissing the existing one
        (from any of the three apps - theft_alerts is shared) is what
        allows the next flagged scan to raise a new one.
        """
        now = time.monotonic()
        last_seen = self._exit_last_seen.get(tag_id)
        if last_seen is not None and now - last_seen < RESCAN_COOLDOWN_SECONDS:
            return  # same tag, still within the cooldown window - ignore
        self._exit_last_seen[tag_id] = now

        item = database.get_item_by_tag(tag_id)

        if detector.check_tag(tag_id, item) and not database.has_active_alert(tag_id):
            alarm.trigger_alarm(tag_id, item, actor_label=self._get_operator_label())

    def _on_delete_selected(self):
        """
        Called when the user clicks "Delete Selected".

        Deletes whichever row is selected in the Saved Items table
        from the database, after confirming with the user.
        """
        selected = self.tree.selection()

        if not selected:
            messagebox.showwarning("No Item Selected", "Select an item in the table first.")
            return

        # Only one row can be selected at a time (see selectmode="browse"
        # set on the tree), so there's exactly one item here.
        tag_id, customer_name, room_number, item_type, status = self.tree.item(
            selected[0], "values"
        )

        confirmed = messagebox.askyesno(
            "Delete Item",
            f"Delete this item?\n\nTag: {tag_id}\nCustomer: {customer_name}\n"
            f"Room: {room_number}\nItem: {item_type}\nStatus: {status}",
        )
        if not confirmed:
            return

        database.delete_linen_item(tag_id)
        self._log_event(
            tag_id,
            "deleted",
            old_status=status,
            customer_name=customer_name,
            room_number=room_number,
            detail=item_type,
        )
        self.status_label.config(text=f"Deleted {tag_id}.")
        self._refresh_item_table()

    def _on_mark_status(self, new_status):
        """
        Called when the user clicks "Mark In Use", "Mark Laundry", or
        "Mark Storage".

        Updates the status of whichever row is selected in the Saved
        Items table.
        """
        selected = self.tree.selection()

        if not selected:
            messagebox.showwarning("No Item Selected", "Select an item in the table first.")
            return

        tag_id, customer_name, room_number, item_type, old_status = self.tree.item(
            selected[0], "values"
        )
        database.update_item_status(tag_id, new_status)
        self._log_event(
            tag_id,
            "status_changed",
            old_status=old_status,
            new_status=new_status,
            customer_name=customer_name,
            room_number=room_number,
            detail=item_type,
        )
        self.status_label.config(text=f"{tag_id} marked as {new_status}.")
        self._refresh_item_table()

    def _on_edit_selected(self):
        """
        Called when the user clicks "Edit Selected".

        Opens a small pop-up window to fix a mistake on whichever row
        is selected in the Saved Items table - Customer Name, Room
        Number, and Item Type can all be changed. The Tag ID itself
        can't be edited here, since it's the item's permanent identity.
        """
        selected = self.tree.selection()

        if not selected:
            messagebox.showwarning("No Item Selected", "Select an item in the table first.")
            return

        tag_id, customer_name, room_number, item_type, status = self.tree.item(
            selected[0], "values"
        )

        edit_window = tk.Toplevel(self.root)
        edit_window.title(f"Edit {tag_id}")
        edit_window.resizable(False, False)
        # Keep this pop-up tied to and on top of the main window.
        edit_window.transient(self.root)
        edit_window.grab_set()

        form_frame = ttk.Frame(edit_window, padding=10)
        form_frame.pack(fill="both", expand=True)

        ttk.Label(form_frame, text=f"Tag ID: {tag_id} (fixed)").grid(
            row=0, column=0, columnspan=2, sticky="w", pady=(0, 8)
        )

        ttk.Label(form_frame, text="Customer Name:").grid(row=1, column=0, sticky="w", pady=2)
        customer_edit_entry = ttk.Entry(form_frame, width=25)
        customer_edit_entry.grid(row=1, column=1, padx=5, pady=2)
        customer_edit_entry.insert(0, customer_name)

        ttk.Label(form_frame, text="Room Number:").grid(row=2, column=0, sticky="w", pady=2)
        room_edit_entry = ttk.Entry(form_frame, width=25)
        room_edit_entry.grid(row=2, column=1, padx=5, pady=2)
        room_edit_entry.insert(0, room_number)

        ttk.Label(form_frame, text="Item Type:").grid(row=3, column=0, sticky="w", pady=2)
        item_type_edit_entry = ttk.Entry(form_frame, width=25)
        item_type_edit_entry.grid(row=3, column=1, padx=5, pady=2)
        item_type_edit_entry.insert(0, item_type)

        def save_changes():
            """Validate the edited fields and save them, closing the pop-up."""
            new_customer_name = customer_edit_entry.get().strip()
            new_room_number = room_edit_entry.get().strip()
            new_item_type = item_type_edit_entry.get().strip()

            if not new_customer_name or not new_room_number or not new_item_type:
                messagebox.showwarning(
                    "Missing Details",
                    "Please fill in Customer Name, Room Number, and Item Type.",
                    parent=edit_window,
                )
                return

            # Status isn't editable here - it keeps whatever it already
            # was (use the "Mark In Use"/"Mark Laundry"/"Mark Storage"
            # buttons for that).
            updated_item = LinenItem(
                tag_id=tag_id,
                customer_name=new_customer_name,
                room_number=new_room_number,
                item_type=new_item_type,
                status=status,
            )
            database.save_linen_item(updated_item)

            # Note what actually changed, so the audit trail says
            # something more useful than just "edited".
            changes = []
            if new_customer_name != customer_name:
                changes.append(f"customer {customer_name!r} -> {new_customer_name!r}")
            if new_room_number != room_number:
                changes.append(f"room {room_number!r} -> {new_room_number!r}")
            if new_item_type != item_type:
                changes.append(f"item type {item_type!r} -> {new_item_type!r}")

            self._log_event(
                tag_id,
                "edited",
                new_status=status,
                customer_name=new_customer_name,
                room_number=new_room_number,
                detail="; ".join(changes) if changes else None,
            )

            self.status_label.config(text=f"Updated {tag_id}.")
            self._refresh_item_table()
            edit_window.destroy()

        button_frame = ttk.Frame(form_frame)
        button_frame.grid(row=4, column=0, columnspan=2, pady=(10, 0))

        ttk.Button(button_frame, text="Save", command=save_changes).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Cancel", command=edit_window.destroy).pack(
            side="left", padx=5
        )

    def _refresh_item_table(self):
        """
        Reload the table so it matches what's in the database, and
        rebuild self._registered_items (tag_id -> status) from the
        same fetch - see that attribute's comment in __init__ for why.
        """
        for row in self.tree.get_children():
            self.tree.delete(row)

        sort_choice = self.sort_by_combo.get()
        if sort_choice == "Customer Name":
            sort_by = "customer_name"
        elif sort_choice == "Item Type":
            sort_by = "item_type"
        else:
            sort_by = "tag_id"

        items = database.get_all_items(sort_by=sort_by)
        self._registered_items = {item.tag_id: item.status for item in items}

        for item in items:
            self.tree.insert(
                "",
                tk.END,
                values=(
                    item.tag_id,
                    item.customer_name,
                    item.room_number,
                    item.item_type,
                    item.status,
                ),
            )


def main():
    """Confirm Supabase is reachable, then open the GUI window."""
    try:
        database.initialize_database()
    except Exception as error:
        # Unlike the old local SQLite file, Supabase needs a working
        # internet connection and correct credentials. Show a clear
        # pop-up instead of crashing with a raw traceback.
        root = tk.Tk()
        root.withdraw()  # hide the empty main window behind the error
        messagebox.showerror(
            "Can't Connect to Database",
            "Could not connect to Supabase.\n\n"
            f"{error}\n\n"
            "Check your internet connection and supabase_config.json, then try again.",
        )
        return

    root = tk.Tk()
    LinenApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
