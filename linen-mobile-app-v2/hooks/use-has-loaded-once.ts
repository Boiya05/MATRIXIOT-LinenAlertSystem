import { useEffect, useRef, useState } from 'react';

/**
 * Tracks whether `loading` has ever gone true -> false, i.e. whether a
 * screen's first real load has finished. Used to gate skeleton
 * placeholders on a screen's genuine first load only.
 *
 * This is deliberately not the same as `loading && data.length === 0`:
 * that pattern re-shows the skeleton for any later loading spell that
 * happens to catch the list at zero items - notably, dismissing the
 * last active theft alert optimistically empties the list a moment
 * before the realtime-triggered refetch resolves, which would flash
 * the skeleton in place of the "all clear" empty state. Once the first
 * load has completed, this stays true for the lifetime of the
 * component, so a later background refresh never re-triggers it.
 */
export function useHasLoadedOnce(loading: boolean): boolean {
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const wasLoading = useRef(loading);

  useEffect(() => {
    if (wasLoading.current && !loading) {
      setHasLoadedOnce(true);
    }
    wasLoading.current = loading;
  }, [loading]);

  return hasLoadedOnce;
}
