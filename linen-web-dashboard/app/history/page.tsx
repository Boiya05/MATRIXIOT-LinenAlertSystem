'use client';

import { Nav } from '@/components/nav';
import { Protected } from '@/components/protected';
import { useAlertHistory } from '@/hooks/use-alert-history';

export default function HistoryPage() {
  const { alerts, loading, error } = useAlertHistory();

  return (
    <Protected>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-9">
        <div className="mb-6 animate-fade-in-up">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Alert history
          </h1>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">
            Every alert that has already been dismissed.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[64px] animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="animate-fade-in-up rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm text-slate-500 dark:text-slate-400">No dismissed alerts yet. 🧺</p>
          </div>
        ) : (
          <ul className="animate-fade-in-up divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <p className="font-medium text-slate-800 dark:text-slate-200">{alert.message}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tag <span className="font-mono">{alert.tagId}</span> · {alert.itemType} · Room{' '}
                  {alert.roomNumber} · {alert.customerName}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{alert.timestamp}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </Protected>
  );
}
