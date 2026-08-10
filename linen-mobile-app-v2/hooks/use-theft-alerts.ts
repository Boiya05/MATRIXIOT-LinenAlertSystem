import { useCallback, useEffect, useState } from 'react';

import { dismissAlert, getActiveAlerts, type AlertEvent } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

/**
 * Fetches active theft alerts and keeps them live-updated via
 * Supabase Realtime - a new alert from the desktop app (or a
 * dismissal from another device) appears automatically while this
 * screen is open, with no pull-to-refresh needed.
 */
export function useTheftAlerts() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getActiveAlerts()
      .then((data) => {
        setAlerts(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    // Any change on theft_alerts (a new alert inserted, or one
    // dismissed from another device) just reloads the active list -
    // simpler and more robust than patching individual rows into
    // local state by hand.
    const channel = supabase
      .channel('theft_alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'theft_alerts' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const dismiss = useCallback(
    async (alertId: number) => {
      // Remove it locally right away so pressing "OK" feels instant,
      // instead of waiting on the network round-trip.
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      try {
        await dismissAlert(alertId);
      } catch (err) {
        // The update failed - reload from the server so the alert
        // comes back rather than silently staying dismissed locally.
        setError(err instanceof Error ? err.message : String(err));
        load();
      }
    },
    [load]
  );

  return { alerts, loading, error, dismiss };
}