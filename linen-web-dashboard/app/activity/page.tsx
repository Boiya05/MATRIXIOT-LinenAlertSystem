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
  registered: '📝 Registered',
  edited: '✏️ Edited',
  status_changed: '🔄 Status changed',
  deleted: '🗑️ Deleted',
  alert_triggered: '🚨 Theft alert triggered',
  alert_dismissed: '✅ Alert dismissed',
};

const EVENT_STYLES: Record<ItemEventType, string> = {
  registered: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  edited: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  status_changed: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  deleted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  alert_triggered: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  alert_dismissed: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

const SOURCE_LABELS: Record<ItemEvent['sourceApp'], string> = {
  desktop: '🖥️ Desktop',
  mobile: '📱 Mobile',
  web: '🌐 Web',
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
        <div className="mb-6 flex animate-fade-in-up flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Activity
            </h1>
            <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
              The audit trail - who registered, edited, moved, or deleted an item, and who
              triggered or cleared an alert. Most recent 200 events.
            </p>
          </div>
          <div className="relative w-72 max-w-full">
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tag, guest, room, or who did it"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-teal-500/20"
            />
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error} If this is the first time you&apos;re seeing this, the{' '}
            <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs dark:bg-red-500/20">
              linen_item_events
            </code>{' '}
            table may not exist in Supabase yet — see the mobile app&apos;s README, &quot;Audit
            trail (who did what, and when)&quot;.
          </p>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[64px] animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : error ? null : filtered.length === 0 ? (
          <div className="animate-fade-in-up rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {events.length === 0 ? 'No activity recorded yet.' : 'Nothing matches that search.'}
            </p>
          </div>
        ) : (
          <ul
            className="animate-fade-in-up divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20"
            style={{ animationDelay: '80ms' }}
          >
            {filtered.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EVENT_STYLES[event.eventType]}`}>
                      {EVENT_LABELS[event.eventType]}
                    </span>
                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{event.tagId}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{describe(event)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{event.timestamp}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
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
