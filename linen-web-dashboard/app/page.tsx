'use client';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import { getStats } from '@/data/linen-data';
import { useLinenItems } from '@/hooks/use-linen-items';
import { useTheftAlerts } from '@/hooks/use-theft-alerts';

export default function DashboardPage() {
  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">
        <div className="mb-7">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Overview</h1>
          <p className="mt-0.5 text-sm text-slate-400">Live inventory status and theft alerts.</p>
        </div>
        <StatsRow />
        <ActiveAlerts />
      </main>
    </Protected>
  );
}

const STAT_CARDS = [
  { key: 'total' as const, label: 'Total items', dot: 'bg-slate-400' },
  { key: 'inUse' as const, label: 'In use', dot: 'bg-teal-500' },
  { key: 'laundry' as const, label: 'Laundry', dot: 'bg-amber-500' },
  { key: 'storage' as const, label: 'Storage', dot: 'bg-slate-300' },
];

function StatsRow() {
  const { items, loading } = useLinenItems();
  const stats = getStats(items);

  return (
    <div className="mb-9 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
      {STAT_CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 transition-shadow hover:shadow-md hover:shadow-slate-200/70"
        >
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {card.label}
            </p>
          </div>
          <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums text-slate-900">
            {loading ? <span className="text-slate-300">—</span> : stats[card.key]}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActiveAlerts() {
  const { alerts, loading, error, dismiss } = useTheftAlerts();

  return (
    <section>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Active theft alerts</h2>
        {alerts.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            {alerts.length} active
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 13l4 4L19 7" stroke="#0f766e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">No active alerts. All clear.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-red-200/70 bg-red-50/60 px-5 py-4"
            >
              <div>
                <p className="font-semibold text-red-900">{alert.message}</p>
                <p className="mt-1 text-sm text-red-700/90">
                  Tag <span className="font-mono">{alert.tagId}</span> · {alert.itemType} · Room{' '}
                  {alert.roomNumber} · {alert.customerName}
                </p>
                <p className="mt-1 text-xs text-red-500/80">{alert.timestamp}</p>
              </div>
              <button
                onClick={() => dismiss(alert.id)}
                className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
