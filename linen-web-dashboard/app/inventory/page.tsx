'use client';

import { useMemo, useState } from 'react';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import { useAuth } from '@/contexts/auth-context';
import { deleteLinenItem, logItemEvent, type LinenItem, type LinenStatus } from '@/data/linen-data';
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
  const { isStaff } = useAuth();
  const { items, loading, error, reload } = useLinenItems();
  const [statusFilter, setStatusFilter] = useState<LinenStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-5 py-3.5" colSpan={6}>
                        <span className="block h-4 w-full animate-shimmer rounded-md" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
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
    </Protected>
  );
}
