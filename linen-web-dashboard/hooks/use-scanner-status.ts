/**
 * hooks/use-scanner-status.ts
 *
 * Loads the desktop app's current Scanner Mode (Register / Assign to
 * Guest / Exit Scanner) and keeps it live via Supabase Realtime, so a
 * mode switch on the desktop app shows up here within seconds. Mirrors
 * hooks/use-theft-alerts.ts's load-then-subscribe pattern.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import { getScannerStatus, type ScannerStatus } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

export function useScannerStatus() {
  const [status, setStatus] = useState<ScannerStatus>({ mode: null, updatedAt: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getScannerStatus()
      .then((data) => setStatus(data))
      // The scanner_status table not existing yet (migration not run)
      // shouldn't be a loud error here - just leave the badge showing
      // "no mode selected", the same as a fresh install would.
      .catch((err) => console.warn('Failed to load scanner status:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('scanner_status_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scanner_status' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { status, loading };
}
