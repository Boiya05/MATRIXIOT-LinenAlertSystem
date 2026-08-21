'use client';

import { useMemo, useState } from 'react';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import type { LinenStatus } from '@/data/linen-data';
import { useLinenItems } from '@/hooks/use-linen-items';

const STATUS_FILTERS: (LinenStatus | 'All')[] = ['All', 'In Use', 'Laundry', 'Storage'];

const STATUS_STYLES: Record<LinenStatus, string> = {
  'In Use': 'bg-teal-50 text-teal-700',
  Laundry: 'bg-amber-50 text-amber-700',
  Storage: 'bg-slate-100 text-slate-600',
};

const STATUS_DOTS: Record<LinenStatus, string> = {
  'In Use': 'bg-teal-500',
  Laundry: 'bg-amber-500',
  Storage: 'bg-slate-400',
};

export default function InventoryPage() {
  const { items, loading, error } = useLinenItems();
  const [statusFilter, setStatusFilter] = useState<LinenStatus | 'All'>('All');
  const [search, setSearch] = useState('');

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

  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">
        <div className="mb-6 flex animate-fade-in-up flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Inventory</h1>
            <p className="mt-0.5 text-sm text-slate-400">Every linen item currently on record.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
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
                className="w-60 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm shadow-slate-200/40">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div
          className="animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50"
          style={{ animationDelay: '80ms' }}
        >
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50/90 text-left text-xs uppercase tracking-wide text-slate-400 backdrop-blur-sm">
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
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3.5" colSpan={5}>
                        <span className="block h-4 w-full animate-shimmer rounded-md" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                      No items match.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, i) => (
                    <tr
                      key={item.tagId}
                      className={`border-b border-slate-100 transition-colors last:border-0 hover:bg-teal-50/40 ${
                        i % 2 === 1 ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-700">{item.tagId}</td>
                      <td className="px-5 py-3 text-slate-700">{item.customerName}</td>
                      <td className="px-5 py-3 text-slate-700">{item.roomNumber}</td>
                      <td className="px-5 py-3 text-slate-700">{item.itemType}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[item.status]}`} />
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {loading ? '' : `${filtered.length} of ${items.length} item(s)`}
        </p>
      </main>
    </Protected>
  );
}
