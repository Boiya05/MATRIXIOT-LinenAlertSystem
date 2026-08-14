/**
 * hooks/use-linen-items.ts
 *
 * Loads every linen item and keeps the list live via Supabase
 * Realtime, so a status change or new registration from the desktop
 * app shows up here without a manual refresh.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import { getAllItems, type LinenItem } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

export function useLinenItems() {
  const [items, setItems] = useState<LinenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAllItems()
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => {
        console.warn('Failed to load linen items:', err);
        setError("Couldn't load inventory. Refresh to try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('linen_items_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'linen_items' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { items, loading, error, reload: load };
}
