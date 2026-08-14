/**
 * hooks/use-alert-history.ts
 *
 * Loads every already-dismissed theft alert, newest first, and keeps
 * it live via Supabase Realtime - so dismissing an alert (here or on
 * another device) moves it into this list within seconds.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import { getAlertHistory, type AlertEvent } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

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
      .catch((err) => {
        console.warn('Failed to load alert history:', err);
        setError("Couldn't load alert history. Refresh to try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('theft_alerts_history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'theft_alerts' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { alerts, loading, error };
}
