"""
main.py

Entry point for the Linen RFID Detection System.

This version uses a graphical window (built with Python's built-in
"tkinter" library) instead of a terminal. There is no real RFID
hardware yet, so scanning is simulated: clicking "Scan (Simulated)"
acts like an RFID reader picking up a tag, which is assumed to carry
both a Tag ID and an Item Type already encoded on it (tag numbers
don't have to be sequential, just like real RFID tags).

Scanned items wait in a "pending" list until you click "Assign", which
applies one Customer Name + Room Number to all of them at once - handy
for registering several items for the same guest in one go.
"""

import random
import tkinter as tk
from tkinter import messagebox, ttk

import alarm
import database
import detector
from models import STATUS_CHECKED_OUT, STATUS_IN_USE, LinenItem

# The kinds of linen items a simulated scan can produce. A real RFID
# tag would already have its item type encoded on it, so we just pick
# one at random here instead of asking the user to type it in.
ITEM_TYPES = ["Bath Towel", "Hand Towel", "Washcloth", "Bedsheet", "Pillowcase", "Blanket"]


class LinenApp:
    """The main application window for the Linen RFID Detection System."""

    def __init__(self, root):
        self.root = root
        self.root.title("Linen RFID Detection System")
        self.root.geometry("650x650")
        self.root.minsize(550, 550)

        # Items that have been scanned but not yet assigned to a
        # customer/room. Each entry is a (tag_id, item_type) tuple.
        self.pending_items = []

        self._build_widgets()
        self._refresh_item_table()

    def _build_widgets(self):
        """Create and arrange all the widgets in the window."""

        # --- Scan section: simulates an RFID reader detecting a tag ---
        scan_frame = ttk.Frame(self.root, padding=10)
        scan_frame.pack(fill="x")

        scan_button = ttk.Button(scan_frame, text="Scan (Simulated)", command=self._on_scan_simulated)
        scan_button.pack(side="left")

        ttk.Label(
            scan_frame,
            text="Each scan picks up a random Tag ID + Item Type, like a real RFID tag would.",
            wraplength=400,
        ).pack(side="left", padx=10)

        # --- Pending scans: items scanned but not yet assigned ---
        ttk.Label(self.root, text="Pending Items (scanned, not yet assigned):").pack(
            anchor="w", padx=10
        )
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

        # --- Assign section: apply one customer/room to all pending items ---
        assign_frame = ttk.Frame(self.root, padding=10)
        assign_frame.pack(fill="x")

        ttk.Label(assign_frame, text="Customer Name:").grid(row=0, column=0, sticky="w", pady=2)
        self.customer_entry = ttk.Entry(assign_frame, width=25)
        self.customer_entry.grid(row=0, column=1, padx=5, pady=2)

        ttk.Label(assign_frame, text="Room Number:").grid(row=1, column=0, sticky="w", pady=2)
        self.room_entry = ttk.Entry(assign_frame, width=25)
        self.room_entry.grid(row=1, column=1, padx=5, pady=2)

        assign_button = ttk.Button(assign_frame, text="Assign", command=self._on_assign)
        assign_button.grid(row=2, column=0, columnspan=2, pady=8)

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
            values=["Tag ID", "Customer Name"],
            state="readonly",
            width=15,
        )
        self.sort_by_combo.current(0)
        self.sort_by_combo.pack(side="left")
        # Reload the table (in the new order) whenever the sort choice changes.
        self.sort_by_combo.bind("<<ComboboxSelected>>", lambda event: self._refresh_item_table())

        columns = ("tag_id", "customer_name", "room_number", "item_type", "status")
        self.tree = ttk.Treeview(self.root, columns=columns, show="headings", selectmode="browse")
        self.tree.heading("tag_id", text="Tag ID")
        self.tree.heading("customer_name", text="Customer")
        self.tree.heading("room_number", text="Room")
        self.tree.heading("item_type", text="Item Type")
        self.tree.heading("status", text="Status")
        self.tree.pack(fill="both", expand=True, padx=10, pady=(10, 0))

        # --- Buttons that act on whichever row is selected above ---
        actions_frame = ttk.Frame(self.root, padding=10)
        actions_frame.pack(anchor="e")

        mark_checked_out_button = ttk.Button(
            actions_frame,
            text="Mark Checked Out",
            command=lambda: self._on_mark_status(STATUS_CHECKED_OUT),
        )
        mark_checked_out_button.pack(side="left", padx=5)

        mark_in_use_button = ttk.Button(
            actions_frame,
            text="Mark In Use",
            command=lambda: self._on_mark_status(STATUS_IN_USE),
        )
        mark_in_use_button.pack(side="left", padx=5)

        edit_button = ttk.Button(
            actions_frame, text="Edit Selected", command=self._on_edit_selected
        )
        edit_button.pack(side="left", padx=5)

        delete_button = ttk.Button(
            actions_frame, text="Delete Selected", command=self._on_delete_selected
        )
        delete_button.pack(side="left", padx=5)

    def _generate_tag_id(self):
        """
        Make up a Tag ID the way a simulated RFID scan would produce
        one: "TAG" followed by 3 digits that don't need to be in any
        particular order, as long as it isn't already in use.
        """
        while True:
            tag_id = f"TAG{random.randint(1, 999):03d}"
            already_pending = any(pending_tag == tag_id for pending_tag, _ in self.pending_items)
            already_saved = database.get_item_by_tag(tag_id) is not None
            if not already_pending and not already_saved:
                return tag_id

    def _on_scan_simulated(self):
        """
        Called when the user clicks "Scan (Simulated)".

        Acts like an RFID reader picking up a new tag: generates a
        Tag ID and Item Type (as if they were already encoded on the
        tag) and adds the item to the pending list, waiting to be
        assigned to a customer and room.
        """
        tag_id = self._generate_tag_id()
        item_type = random.choice(ITEM_TYPES)

        self.pending_items.append((tag_id, item_type))
        self.pending_tree.insert("", tk.END, values=(tag_id, item_type))

        self.status_label.config(text=f"Scanned {tag_id} ({item_type}). Added to pending list.")

    def _on_remove_pending(self):
        """
        Called when the user clicks "Remove Selected Pending Item".

        Removes whichever row is selected in the Pending Items table -
        useful for undoing an accidental "Scan (Simulated)" click
        before it gets assigned to a customer.
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

        self.status_label.config(text=f"Removed {tag_id} from pending list.")

    def _on_assign(self):
        """
        Called when the user clicks "Assign".

        Applies the entered Customer Name and Room Number to every
        pending item at once, saves each one to the database, and
        clears the pending list.
        """
        customer_name = self.customer_entry.get().strip()
        room_number = self.room_entry.get().strip()

        if not self.pending_items:
            messagebox.showwarning("Nothing to Assign", "Scan at least one item first.")
            return

        if not customer_name or not room_number:
            messagebox.showwarning(
                "Missing Details", "Please fill in Customer Name and Room Number."
            )
            return

        for tag_id, item_type in self.pending_items:
            item = LinenItem(
                tag_id=tag_id,
                customer_name=customer_name,
                room_number=room_number,
                item_type=item_type,
            )
            database.save_linen_item(item)

        assigned_count = len(self.pending_items)

        self.pending_items.clear()
        for row in self.pending_tree.get_children():
            self.pending_tree.delete(row)

        self.customer_entry.delete(0, tk.END)
        self.room_entry.delete(0, tk.END)

        self.status_label.config(text=f"Assigned {assigned_count} item(s) to {customer_name}.")
        self._refresh_item_table()

    def _on_exit_scan(self):
        """
        Called when a tag is scanned at the (simulated) exit reader.

        Any tag detected here is treated as leaving the building, so
        it's run through detector.py and, if flagged, alarm.py shows
        a pop-up warning.
        """
        tag_id = self.exit_tag_entry.get().strip().upper()

        if not tag_id:
            messagebox.showwarning("Missing Tag ID", "Please enter a Tag ID.")
            return

        item = database.get_item_by_tag(tag_id)

        if detector.check_tag(tag_id, item):
            alarm.trigger_alarm(tag_id, item)

        self.exit_tag_entry.delete(0, tk.END)
        self.exit_tag_entry.focus()

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
        self.status_label.config(text=f"Deleted {tag_id}.")
        self._refresh_item_table()

    def _on_mark_status(self, new_status):
        """
        Called when the user clicks "Mark Checked Out" or "Mark In Use".

        Updates the status of whichever row is selected in the Saved
        Items table.
        """
        selected = self.tree.selection()

        if not selected:
            messagebox.showwarning("No Item Selected", "Select an item in the table first.")
            return

        tag_id = self.tree.item(selected[0], "values")[0]
        database.update_item_status(tag_id, new_status)
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
            # was (use the "Mark Checked Out"/"Mark In Use" buttons for that).
            updated_item = LinenItem(
                tag_id=tag_id,
                customer_name=new_customer_name,
                room_number=new_room_number,
                item_type=new_item_type,
                status=status,
            )
            database.save_linen_item(updated_item)

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
        """Reload the table so it matches what's in the database."""
        for row in self.tree.get_children():
            self.tree.delete(row)

        sort_by = "customer_name" if self.sort_by_combo.get() == "Customer Name" else "tag_id"

        for item in database.get_all_items(sort_by=sort_by):
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
    """Make sure the database exists, then open the GUI window."""
    database.initialize_database()

    root = tk.Tk()
    LinenApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
