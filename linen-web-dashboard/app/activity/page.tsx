'use client';

import { useMemo, useState } from 'react';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import type { ItemEvent, ItemEventType } from '@/data/linen-data';
import { useItemEvents } from '@/hooks/use-item-events';

// How each event_type reads in the log, and how it's colored - keeps
// the visual weight roughly matched to how significant the event is
// (a theft alert stands out more than a routine status change).
const EVENT_LABELS: Record<ItemEventType, string> = {
  registered: 'Registered',
  edited: 'Edited',
  status_changed: 'Status changed',
  deleted: 'Deleted',
  alert_triggered: 'Theft alert triggered',
  alert_dismissed: 'Alert dismissed',
};

const EVENT_STYLES: Record<ItemEventType, string> = {
  registered: 'bg-teal-50 text-teal-700',
  edited: 'bg-slate-100 text-slate-600',
  status_changed: 'bg-sky-50 text-sky-700',
  deleted: 'bg-slate-100 text-slate-600',
  alert_triggered: 'bg-red-50 text-red-700',
  alert_dismissed: 'bg-amber-50 text-amber-700',
};

const SOURCE_LABELS: Record<ItemEvent['sourceApp'], string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  web: 'Web',
};

function describe(event: ItemEvent): string {
  switch (event.eventType) {
    case 'registered':
      return `Assigned to ${event.customerName ?? 'unknown'} · Room ${event.roomNumber ?? 'unknown'}`;
    case 'status_changed':
      return `${event.oldStatus ?? '?'} → ${event.newStatus ?? '?'}`;
    case 'edited':
      return event.detail ?? 'Details updated';
    case 'deleted':
      return `Was ${event.oldStatus ?? 'unknown'} · ${event.customerName ?? 'unknown'} · Room ${event.roomNumber ?? 'unknown'}`;
    case 'alert_triggered':
      return `Marked ${event.oldStatus ?? 'unregistered'} at the exit scanner`;
    case 'alert_dismissed':
      return `Cleared by ${event.actorLabel ?? 'someone'}`;
    default:
      return '';
  }
}

export default function ActivityPage() {
  const { events, loading, error } = useItemEvents();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) =>
      [event.tagId, event.customerName, event.roomNumber, event.detail, event.actorLabel]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [events, query]);

  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Activity</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              The audit trail - who registered, edited, moved, or deleted an item, and who
              triggered or cleared an alert. Most recent 200 events.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tag, guest, room, or who did it"
            className="w-72 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25"
          />
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[64px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-sm text-slate-500">
              {events.length === 0 ? 'No activity recorded yet.' : 'Nothing matches that search.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
            {filtered.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50/60">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EVENT_STYLES[event.eventType]}`}>
                      {EVENT_LABELS[event.eventType]}
                    </span>
                    <span className="font-mono text-sm text-slate-700">{event.tagId}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{describe(event)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400">{event.timestamp}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {event.actorLabel ?? 'Unspecified'} · {SOURCE_LABELS[event.sourceApp]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </Protected>
  );
}
