import { useCallback, useEffect, useState } from 'react';

import { getAllItems, type LinenItem } from '@/data/linen-data';

/**
 * Fetches every linen item from Supabase and keeps track of loading /
 * error state. Every screen that needs the live item list uses this
 * same hook, so there's one place handling the network request.
 */
export function useLinenItems() {
  const [items, setItems] = useState<LinenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    getAllItems()
      .then((data) => {
        if (isMounted) {
          setItems(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // Log the real error for debugging; show a generic message in
          // the UI so raw backend error text never reaches the screen.
          console.warn('Failed to load linen items:', err);
          setError("Couldn't load linen items. Pull to refresh to try again.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  return { items, loading, error, refresh };
}