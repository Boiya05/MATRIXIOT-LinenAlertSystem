import { useCallback, useEffect, useState } from 'react';

import { getAlertHistory, type AlertEvent } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

/**
 * Fetches dismissed theft alerts (the resolved history), live via
 * Supabase Realtime - an alert dismissed just now, here or on another
 * device, appears in this list right away.
 */
export function useAlertHistory() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAlertHistory()
      .then((data) => {
        setAlerts(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    // Any change on theft_alerts - a new dismissal, in particular -
    // just reloads the history list.
    const channel = supabase
      .channel('theft_alerts_history_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'theft_alerts' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { alerts, loading, error, refresh: load };
}
