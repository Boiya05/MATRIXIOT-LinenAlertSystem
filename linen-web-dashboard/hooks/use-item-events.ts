/**
 * hooks/use-item-events.ts
 *
 * Loads the most recent linen_item_events rows (the audit trail - see
 * data/linen-data.ts's logItemEvent) and keeps them live via Supabase
 * Realtime, same pattern as use-alert-history.ts. Backs the Activity
 * page.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import { getRecentItemEvents, type ItemEvent } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

export function useItemEvents() {
  const [events, setEvents] = useState<ItemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getRecentItemEvents()
      .then((data) => {
        setEvents(data);
        setError(null);
      })
      .catch((err) => {
        console.warn('Failed to load item events:', err);
        setError("Couldn't load the activity log. Refresh to try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('linen_item_events_activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'linen_item_events' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { events, loading, error };
}
