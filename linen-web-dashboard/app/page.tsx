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
        <div className="mb-7 animate-fade-in-up">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Overview
          </h1>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            Live inventory status and theft alerts.
          </p>
        </div>
        <StatsRow />
        <ActiveAlerts />
      </main>
    </Protected>
  );
}

const STAT_CARDS = [
  {
    key: 'total' as const,
    label: 'Total items',
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    bar: 'from-slate-300 to-slate-400',
    icon: (
      <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    ),
  },
  {
    key: 'inUse' as const,
    label: 'In use',
    dot: 'bg-teal-500',
    chip: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
    bar: 'from-teal-400 to-teal-600',
    icon: (
      <>
        <rect x="6" y="4" width="9" height="16" rx="1.3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      </>
    ),
  },
  {
    key: 'laundry' as const,
    label: 'Laundry',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    bar: 'from-amber-400 to-amber-500',
    icon: (
      <path
        d="M12 3c-3 4-6 7.2-6 10.5A6 6 0 0 0 12 20a6 6 0 0 0 6-6.5C18 10.2 15 7 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: 'storage' as const,
    label: 'Storage',
    dot: 'bg-slate-300',
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    bar: 'from-slate-300 to-slate-400',
    icon: (
      <>
        <path d="M4 7.5h16v3.2H4V7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M5 10.7v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 14.3h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
];

function StatsRow() {
  const { items, loading } = useLinenItems();
  const stats = getStats(items);

  return (
    <div className="mb-9 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
      {STAT_CARDS.map((card, i) => (
        <div
          key={card.key}
          style={{ animationDelay: `${i * 60}ms` }}
          className="group relative animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 dark:hover:shadow-black/40"
        >
          <span
            aria-hidden
            className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${card.bar} opacity-70 transition-opacity group-hover:opacity-100`}
          />
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {card.label}
                </p>
              </div>
              <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-100">
                {loading ? (
                  <span className="inline-block h-7 w-10 animate-shimmer rounded-md align-middle" />
                ) : (
                  stats[card.key]
                )}
              </p>
            </div>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.chip}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                {card.icon}
              </svg>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActiveAlerts() {
  const { alerts, loading, error, dismiss } = useTheftAlerts();

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Active theft alerts
        </h2>
        {alerts.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-sm shadow-red-900/5 dark:bg-red-500/10 dark:text-red-400 dark:shadow-none">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            {alerts.length} active
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-[68px] animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-500/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                className="text-teal-700 dark:text-teal-400"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">No active alerts. All clear. ✅</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {alerts.map((alert, i) => (
            <li
              key={alert.id}
              style={{ animationDelay: `${i * 45}ms` }}
              className="group flex animate-fade-in-up items-start justify-between gap-4 rounded-xl border border-red-200/70 bg-red-50/60 px-5 py-4 shadow-sm shadow-red-900/5 transition-all hover:border-red-300 hover:shadow-md hover:shadow-red-900/10 dark:border-red-500/20 dark:bg-red-500/[0.07] dark:shadow-none dark:hover:border-red-500/40"
            >
              <div>
                <p className="font-semibold text-red-900 dark:text-red-300">
                  🚨 {alert.message}
                </p>
                <p className="mt-1 text-sm text-red-700/90 dark:text-red-400/90">
                  Tag <span className="font-mono">{alert.tagId}</span> · {alert.itemType} · Room{' '}
                  {alert.roomNumber} · {alert.customerName}
                </p>
                <p className="mt-1 text-xs text-red-500/80 dark:text-red-400/70">{alert.timestamp}</p>
              </div>
              <button
                onClick={() => dismiss(alert.id)}
                className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition-all hover:bg-red-100 active:scale-[0.97] dark:border-red-500/30 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10"
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
