/**
 * hooks/use-theft-alerts.ts
 *
 * Loads active theft alerts and keeps them live via Supabase
 * Realtime, so a new alert from the desktop app's exit scanner (or a
 * dismissal from another device, including the mobile app) shows up
 * here within seconds. Mirrors the mobile app's hook of the same
 * name, minus the on-device notification wiring - a browser
 * Notification API integration is a reasonable future addition, but
 * isn't part of this first pass.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import { dismissAlert, getActiveAlerts, logItemEvent, type AlertEvent } from '@/data/linen-data';
import { supabase } from '@/lib/supabase';

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
      .catch((err) => {
        console.warn('Failed to load alerts:', err);
        setError("Couldn't load alerts. Refresh to try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('theft_alerts_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'theft_alerts' }, () => {
        // Any insert/update to theft_alerts (new alert, or a dismissal
        // from another device) just reloads the active list - simpler
        // and less error-prone than patching local state per event
        // type, and the table is small enough that this is cheap.
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const dismiss = useCallback(
    async (alertId: number) => {
      // Grab the alert's details before it's filtered out of local
      // state below - needed for the audit-trail write after the
      // dismiss succeeds.
      const dismissedAlert = alerts.find((alert) => alert.id === alertId);

      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      try {
        await dismissAlert(alertId);
        if (dismissedAlert) {
          logItemEvent({
            tagId: dismissedAlert.tagId,
            eventType: 'alert_dismissed',
            customerName: dismissedAlert.customerName,
            roomNumber: dismissedAlert.roomNumber,
            detail: dismissedAlert.itemType,
          }).catch((err) => console.warn('Failed to log audit event:', err));
        }
      } catch (err) {
        console.warn('Failed to dismiss alert:', err);
        setError("Couldn't dismiss that alert. Refresh to try again.");
        load();
      }
    },
    [load, alerts]
  );

  return { alerts, loading, error, dismiss };
}
