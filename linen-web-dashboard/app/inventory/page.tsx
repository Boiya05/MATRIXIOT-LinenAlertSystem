'use client';

import { useMemo, useState } from 'react';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import { useAuth } from '@/contexts/auth-context';
import {
  deleteLinenItem,
  logItemEvent,
  updateLinenItemDetails,
  type LinenItem,
  type LinenStatus,
} from '@/data/linen-data';
import { useLinenItems } from '@/hooks/use-linen-items';

const STATUS_FILTERS: (LinenStatus | 'All')[] = ['All', 'In Use', 'Laundry', 'Storage'];

const STATUS_STYLES: Record<LinenStatus, string> = {
  'In Use': 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  Laundry: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  Storage: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_DOTS: Record<LinenStatus, string> = {
  'In Use': 'bg-teal-500',
  Laundry: 'bg-amber-500',
  Storage: 'bg-slate-400',
};

export default function InventoryPage() {
  const { isStaff, isAdmin } = useAuth();
  const { items, loading, error, reload } = useLinenItems();
  const [statusFilter, setStatusFilter] = useState<LinenStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LinenItem | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesSearch =
        query === '' ||
        item.tagId.toLowerCase().includes(query) ||
        item.customerName.toLowerCase().includes(query) ||
        item.roomNumber.toLowerCase().includes(query) ||
        item.itemType.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, search]);

  // Selection is keyed by tag_id and only ever holds tags currently
  // visible under the active filter/search - switching filters away
  // from a selected row silently drops it rather than deleting
  // something the person can no longer see and confirm.
  const visibleTagIds = useMemo(() => new Set(filtered.map((item) => item.tagId)), [filtered]);
  const visibleSelected = useMemo(
    () => [...selected].filter((tagId) => visibleTagIds.has(tagId)),
    [selected, visibleTagIds]
  );
  const allVisibleSelected = filtered.length > 0 && visibleSelected.length === filtered.length;

  function toggleOne(tagId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const tagId of visibleTagIds) next.delete(tagId);
      } else {
        for (const tagId of visibleTagIds) next.add(tagId);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (!isStaff || visibleSelected.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${visibleSelected.length} item(s)? This can't be undone - the tags themselves ` +
        `aren't affected, just their record here.`
    );
    if (!confirmed) return;

    const itemsByTag = new Map(items.map((item) => [item.tagId, item]));

    setDeleting(true);
    setDeleteError(null);
    try {
      for (const tagId of visibleSelected) {
        await deleteLinenItem(tagId);
        const item = itemsByTag.get(tagId);
        logItemEvent({
          tagId,
          eventType: 'deleted',
          oldStatus: item?.status ?? null,
          customerName: item?.customerName || null,
          roomNumber: item?.roomNumber || null,
          detail: item?.itemType ?? null,
        }).catch((err) => console.warn('Failed to log audit event:', err));
      }
      setSelected(new Set());
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete some items.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">
        <div className="mb-6 flex animate-fade-in-up flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Inventory
            </h1>
            <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
              Every linen item currently on record.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Search tag, guest, room, item…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/20"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                      : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        {deleteError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {deleteError}
          </p>
        )}

        {/* Bulk action bar - only takes up space once something's selected,
            so it doesn't clutter the common case of just browsing. */}
        {visibleSelected.length > 0 && (
          <div className="animate-fade-in-up mb-3 flex items-center justify-between rounded-xl border border-teal-200/70 bg-teal-50/60 px-4 py-2.5 dark:border-teal-500/20 dark:bg-teal-500/[0.07]">
            <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
              {visibleSelected.length} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs font-medium text-teal-700 underline-offset-2 transition-colors hover:underline dark:text-teal-400"
              >
                Clear
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting || !isStaff}
                title={!isStaff ? 'Staff access required' : undefined}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-red-600/30 transition-all hover:bg-red-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : `🗑️ Delete ${visibleSelected.length}`}
              </button>
            </div>
          </div>
        )}

        <div
          className="animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20"
          style={{ animationDelay: '80ms' }}
        >
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50/90 text-left text-xs uppercase tracking-wide text-slate-400 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-500">
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      disabled={!isStaff || filtered.length === 0}
                      aria-label="Select all visible items"
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">Tag ID</th>
                  <th className="px-5 py-3 font-medium">Guest</th>
                  <th className="px-5 py-3 font-medium">Room</th>
                  <th className="px-5 py-3 font-medium">Item type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  {isAdmin && <th className="w-10 px-5 py-3" />}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-5 py-3.5" colSpan={isAdmin ? 7 : 6}>
                        <span className="block h-4 w-full animate-shimmer rounded-md" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                      No items match.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item: LinenItem, i) => {
                    const isSelected = selected.has(item.tagId);
                    return (
                      <tr
                        key={item.tagId}
                        className={`border-b border-slate-100 transition-colors last:border-0 hover:bg-teal-50/40 dark:border-slate-800 dark:hover:bg-teal-500/[0.06] ${
                          isSelected
                            ? 'bg-teal-50/70 dark:bg-teal-500/[0.08]'
                            : i % 2 === 1
                              ? 'bg-slate-50/30 dark:bg-slate-800/20'
                              : ''
                        }`}
                      >
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(item.tagId)}
                            disabled={!isStaff}
                            aria-label={`Select ${item.tagId}`}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                          />
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {item.tagId}
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {item.customerName || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {item.roomNumber || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{item.itemType}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[item.status]}`} />
                            {item.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3">
                            <button
                              onClick={() => setEditingItem(item)}
                              aria-label={`Edit ${item.tagId}`}
                              title="Edit details"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path
                                  d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {loading ? '' : `${filtered.length} of ${items.length} item(s)`}
        </p>
      </main>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            reload();
          }}
        />
      )}
    </Protected>
  );
}

/**
 * Fix a mistake on an already-registered item - admin only (see
 * "Editing a registered item (admin only)" in the mobile app's README
 * for why this goes through a dedicated RPC rather than a plain
 * table update). Tag ID and status aren't editable here, matching the
 * desktop app's Edit dialog - status has its own dedicated controls
 * elsewhere, and the tag ID is the item's permanent identity.
 */
function EditItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: LinenItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerName, setCustomerName] = useState(item.customerName);
  const [roomNumber, setRoomNumber] = useState(item.roomNumber);
  const [itemType, setItemType] = useState(item.itemType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedCustomer = customerName.trim();
    const trimmedRoom = roomNumber.trim();
    const trimmedType = itemType.trim();
    if (!trimmedCustomer || !trimmedRoom || !trimmedType) {
      setError('Please fill in guest, room, and item type.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await updateLinenItemDetails(item.tagId, {
        customerName: trimmedCustomer,
        roomNumber: trimmedRoom,
        itemType: trimmedType,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }

      // Note what actually changed, so the audit trail says something
      // more useful than just "edited" - mirrors the desktop app's
      // _on_edit_selected().
      const changes: string[] = [];
      if (trimmedCustomer !== item.customerName) changes.push(`guest "${item.customerName}" -> "${trimmedCustomer}"`);
      if (trimmedRoom !== item.roomNumber) changes.push(`room "${item.roomNumber}" -> "${trimmedRoom}"`);
      if (trimmedType !== item.itemType) changes.push(`item type "${item.itemType}" -> "${trimmedType}"`);

      logItemEvent({
        tagId: item.tagId,
        eventType: 'edited',
        newStatus: item.status,
        customerName: trimmedCustomer,
        roomNumber: trimmedRoom,
        detail: changes.length > 0 ? changes.join('; ') : null,
      }).catch((err) => console.warn('Failed to log audit event:', err));

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Edit item</h2>
        <p className="mt-0.5 font-mono text-xs text-slate-400 dark:text-slate-500">{item.tagId} (fixed)</p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Guest
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Room
            <input
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Item type
            <input
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-teal-600/30 transition-all hover:bg-teal-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
