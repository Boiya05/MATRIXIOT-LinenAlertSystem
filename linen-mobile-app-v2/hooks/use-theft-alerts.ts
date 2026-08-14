import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { dismissAlert, getActiveAlerts, mapRowToAlertEvent, type AlertEvent } from '@/data/linen-data';
import { getUserSettings } from '@/data/user-settings';
import { ensureNotificationPermission, notifyTheftAlert } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

/**
 * Fetches active theft alerts and keeps them live-updated via
 * Supabase Realtime - a new alert from the desktop app (or a
 * dismissal from another device) appears automatically while this
 * screen is open, with no pull-to-refresh needed. Also fires a local
 * notification for genuinely new alerts (see lib/notifications.ts),
 * so a theft alert is noticeable even if the person isn't looking at
 * the Home screen right now.
 */
export function useTheftAlerts() {
  const { user } = useAuth();
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
        // Log the real error for debugging; show a generic message in
        // the UI so raw backend error text never reaches the screen.
        console.warn('Failed to load alerts:', err);
        setError("Couldn't load alerts. Pull to refresh to try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    // Catches up permission for anyone whose "Theft alerts" setting
    // was already saved as on before notifications existed - this
    // hook backs the Home screen, which is the one place every active
    // user is guaranteed to land on, unlike Settings (which has its
    // own copy of this same check, in case someone gets here before
    // Home mounts for whatever reason).
    if (user) {
      getUserSettings(user.id)
        .then((settings) => {
          if (settings.alertsEnabled) {
            ensureNotificationPermission();
          }
        })
        .catch((err) => {
          console.warn('Failed to check notification settings on load:', err);
        });
    }

    // Any change on theft_alerts (a new alert inserted, or one
    // dismissed from another device) reloads the active list - simpler
    // and more robust than patching individual rows into local state
    // by hand. INSERTs specifically also trigger a local notification,
    // since that's the one case that's an actual new theft event
    // rather than someone clearing an existing alert.
    const channel = supabase
      .channel('theft_alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'theft_alerts' }, (payload) => {
        load();

        if (payload.eventType === 'INSERT' && user) {
          const alert = mapRowToAlertEvent(
            payload.new as Parameters<typeof mapRowToAlertEvent>[0]
          );
          getUserSettings(user.id)
            .then((settings) => {
              if (settings.alertsEnabled) {
                notifyTheftAlert(alert, { sound: settings.soundEnabled });
              }
            })
            .catch((err) => {
              // Missing/unreadable settings shouldn't block the alert
              // from showing up in the in-app list above - just skip
              // the notification for this one event.
              console.warn('Failed to load notification preferences:', err);
            });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, user]);

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
        console.warn('Failed to dismiss alert:', err);
        setError("Couldn't dismiss that alert. Pull to refresh to try again.");
        load();
      }
    },
    [load]
  );

  return { alerts, loading, error, dismiss };
}
