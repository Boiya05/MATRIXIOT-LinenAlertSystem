import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { getItemByTag, hasActiveAlert, logItemEvent, logTheftAlert, saveLinenItem, type LinenItem } from '@/data/linen-data';
import { useReader, type ReaderMode } from '@/hooks/use-reader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { checkTag } from '@/lib/detector';
import { sendTelegramAlert } from '@/lib/telegram-alert';

// The kinds of linen items this app tracks - mirrors the desktop
// app's ITEM_TYPES exactly. A real UHF tag only carries a Tag ID (its
// EPC), not a human-readable item type, so staff pick it from this
// list at scan time (see the pill selector in RegisterSection below)
// rather than it being guessed or looked up automatically.
const ITEM_TYPES = ['Bath Towel', 'Hand Towel', 'Washcloth', 'Bedsheet', 'Pillowcase', 'Blanket'];

// How long to ignore repeat reads of the same tag after processing it
// once, at either checkpoint below. A real UHF reader in continuous-
// inventory mode reports the same tag many times a second while it's
// in range - without this, one physical scan would re-check/re-log
// the same tag over and over (dozens of duplicate exit alerts, or
// repeated "already registered" lookups on the entry side) instead of
// being handled once per actual event.
const RESCAN_COOLDOWN_MS = 5000;

export default function ScanScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title">📡 Scan</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              Register items and run the exit-scanner check, right from your phone.
            </ThemedText>
          </View>

          <RegisterSection />
          <AssignToGuestSection />
          <ExitScannerSection />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          <ThemedText style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>{subtitle}</ThemedText>
        </View>
        {headerRight}
      </View>
      {children}
    </View>
  );
}

/** Small badge/button for switching a checkpoint between Simulated and USB reader mode. */
function ReaderModeSwitch({
  mode,
  connecting,
  usbSerialSupported,
  onConnectUsb,
  onDisconnectUsb,
}: {
  mode: ReaderMode;
  connecting: boolean;
  usbSerialSupported: boolean;
  onConnectUsb: () => void;
  onDisconnectUsb: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (mode === 'usb-serial') {
    return (
      <PressableScale onPress={onDisconnectUsb} style={styles.modeBadge}>
        <View style={[styles.modeBadge, { backgroundColor: `${colors.tint}18` }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.tint }]} />
          <ThemedText style={{ color: colors.tint, fontSize: 11, fontWeight: '700' }}>USB connected</ThemedText>
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={onConnectUsb} disabled={connecting || !usbSerialSupported}>
      <View style={[styles.modeBadgeOutline, { borderColor: colors.border, opacity: usbSerialSupported ? 1 : 0.5 }]}>
        <ThemedText style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
          {connecting ? 'Connecting…' : usbSerialSupported ? 'Connect USB reader' : 'USB needs Android'}
        </ThemedText>
      </View>
    </PressableScale>
  );
}

/**
 * Lets staff pick which kind of item is about to be scanned - a
 * horizontal row of pills rather than a native picker, since it's a
 * short fixed list and this matches the segmented-control style
 * already used elsewhere in this app (e.g. the theme picker in
 * Settings), without adding a new dependency.
 */
function ItemTypePicker({ value, onChange }: { value: string; onChange: (itemType: string) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemTypeRow}>
      {ITEM_TYPES.map((itemType) => {
        const selected = itemType === value;
        return (
          <PressableScale key={itemType} onPress={() => onChange(itemType)}>
            <View
              style={[
                styles.itemTypePill,
                { borderColor: colors.border, backgroundColor: selected ? colors.tint : 'transparent' },
              ]}>
              <ThemedText style={{ color: selected ? colors.background : colors.textSecondary, fontSize: 12.5 }}>
                {itemType}
              </ThemedText>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function RegisterSection() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [pending, setPending] = useState<{ tagId: string; itemType: string }[]>([]);
  const [selectedItemType, setSelectedItemType] = useState(ITEM_TYPES[0]);
  const [manualTagId, setManualTagId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  // Depends on selectedItemType and pending so a fresh closure
  // (carrying the currently-picked type and the current batch)
  // reaches useReader's poll loop every time either changes - see
  // hooks/use-reader.ts's onTagRef, which is refreshed every render
  // specifically so this works.
  const handleTag = useCallback(
    async (tagId: string) => {
      const now = Date.now();
      const lastSeen = lastSeenRef.current.get(tagId);
      if (lastSeen && now - lastSeen < RESCAN_COOLDOWN_MS) {
        return; // same tag, still within the cooldown window - ignore
      }
      lastSeenRef.current.set(tagId, now);

      if (pending.some((p) => p.tagId === tagId)) {
        setStatus(`${tagId} is already in the pending list - ignored repeat scan.`);
        return;
      }

      // A tag that's already registered would silently overwrite that
      // existing row (saveLinenItem is an upsert-on-tagId) if
      // registered again here - the same physical tag can't belong to
      // two different registrations at once. "Assign to guest" is the
      // right place to change an existing item's guest/room instead.
      try {
        const existing = await getItemByTag(tagId);
        if (existing) {
          setStatus(`${tagId} is already registered (${existing.status}) - use "Assign to guest" instead.`);
          return;
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Failed to check tag.');
        return;
      }

      setPending((current) => {
        if (current.some((p) => p.tagId === tagId)) return current; // lost the race with another read - ignore
        return [...current, { tagId, itemType: selectedItemType }];
      });
      setStatus(`Scanned ${tagId}. Added to pending list.`);
    },
    [selectedItemType, pending]
  );

  const reader = useReader('entry_reader', handleTag);

  // A real USB RFID reader (via an OTG cable) is a "keyboard wedge" -
  // Android sees it as a plain HID keyboard, so it types the tag ID
  // as keystrokes into whatever's focused, then sends Enter/submit,
  // no different from someone typing it by hand. Feeds into the same
  // queue useReader's poll loop drains either way, so handleTag above
  // (with its duplicate-scan check) is still the one processing path.
  function handleManualSubmit() {
    const tagId = manualTagId.trim().toUpperCase();
    if (!tagId) return;
    reader.simulateScan(tagId);
    setManualTagId('');
  }

  function removePending(tagId: string) {
    setPending((current) => current.filter((p) => p.tagId !== tagId));
  }

  async function handleSave() {
    if (pending.length === 0) {
      setStatus('Scan at least one item first.');
      return;
    }

    // Customer/room are optional - leave them blank to register tags
    // as unassigned stock, sorted into categories by Item Type alone
    // (status 'Storage', matching what that status already means:
    // "not currently with any customer"). Fill them in to assign a
    // guest right away instead. Either way, the Assign to Guest
    // section below can attach a guest to stock registered without
    // one, or move an item to a different guest later.
    const trimmedCustomer = customerName.trim();
    const trimmedRoom = roomNumber.trim();
    const assigningNow = trimmedCustomer !== '' || trimmedRoom !== '';

    setSaving(true);
    try {
      for (const item of pending) {
        const linenItem: LinenItem = {
          tagId: item.tagId,
          customerName: trimmedCustomer,
          roomNumber: trimmedRoom,
          itemType: item.itemType,
          status: assigningNow ? 'In Use' : 'Storage',
        };
        await saveLinenItem(linenItem);
        logItemEvent({
          tagId: linenItem.tagId,
          eventType: 'registered',
          newStatus: linenItem.status,
          customerName: linenItem.customerName || null,
          roomNumber: linenItem.roomNumber || null,
          detail: linenItem.itemType,
        }).catch((err) => console.warn('Failed to log audit event:', err));
      }
      setStatus(
        assigningNow
          ? `Registered and assigned ${pending.length} item(s) to ${trimmedCustomer}.`
          : `Registered ${pending.length} item(s) as unassigned stock.`
      );
      setPending([]);
      setCustomerName('');
      setRoomNumber('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save items.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Register items"
      subtitle='Scan tags into a category. Guest and room are optional - assign them now, or later in "Assign to guest".'
      headerRight={
        <ReaderModeSwitch
          mode={reader.mode}
          connecting={reader.connecting}
          usbSerialSupported={reader.usbSerialSupported}
          onConnectUsb={reader.connectUsbSerial}
          onDisconnectUsb={reader.disconnectUsbSerial}
        />
      }>
      {reader.error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{reader.error}</ThemedText>}

      <View>
        <ThemedText style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
          Item type - applies to the next tag scanned
        </ThemedText>
        <ItemTypePicker value={selectedItemType} onChange={setSelectedItemType} />
      </View>

      {reader.mode === 'simulated' ? (
        <View style={styles.exitRow}>
          <TextInput
            style={[
              styles.input,
              styles.exitInput,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Scan or type Tag ID"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            value={manualTagId}
            onChangeText={setManualTagId}
            onSubmitEditing={handleManualSubmit}
            returnKeyType="done"
          />
          <PressableScale
            onPress={handleManualSubmit}
            style={[styles.scanExitButton, { backgroundColor: colors.tint }]}>
            <ThemedText style={{ color: colors.background, fontWeight: '700' }}>Scan</ThemedText>
          </PressableScale>
        </View>
      ) : (
        <View style={[styles.scanButton, { borderColor: colors.tint }]}>
          <ThemedText style={{ color: colors.tint, fontWeight: '600' }}>
            Waiting for a tag - scans appear below automatically.
          </ThemedText>
        </View>
      )}

      <View style={[styles.pendingList, { borderColor: colors.border }]}>
        {pending.length === 0 ? (
          <ThemedText style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: 14 }}>
            No items scanned yet.
          </ThemedText>
        ) : (
          pending.map((item) => (
            <View key={item.tagId} style={[styles.pendingRow, { borderColor: colors.border }]}>
              <ThemedText style={{ fontSize: 13 }}>
                <ThemedText style={{ fontFamily: 'monospace', fontSize: 13 }}>{item.tagId}</ThemedText>
                {'  '}
                <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>{item.itemType}</ThemedText>
              </ThemedText>
              <PressableScale onPress={() => removePending(item.tagId)}>
                <ThemedText style={{ color: colors.danger, fontSize: 12 }}>Remove</ThemedText>
              </PressableScale>
            </View>
          ))
        )}
      </View>

      <TextInput
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
        placeholder="Customer name (optional)"
        placeholderTextColor={colors.textSecondary}
        value={customerName}
        onChangeText={setCustomerName}
      />
      <TextInput
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
        placeholder="Room number (optional)"
        placeholderTextColor={colors.textSecondary}
        value={roomNumber}
        onChangeText={setRoomNumber}
      />

      <PressableScale
        onPress={handleSave}
        disabled={saving}
        style={[styles.primaryButton, { backgroundColor: colors.tint, opacity: saving ? 0.6 : 1 }]}>
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <ThemedText style={{ color: colors.background, fontWeight: '700' }}>
            {pending.length > 0 && (customerName.trim() || roomNumber.trim()) ? 'Save & assign' : 'Save'}
          </ThemedText>
        )}
      </PressableScale>

      {status && <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>{status}</ThemedText>}
    </SectionCard>
  );
}

/**
 * The other half of Register items' optional-guest flow: scan any
 * number of already-registered tags (whether left unassigned on
 * purpose, or being handed to a different guest than before), then
 * attach one Customer Name + Room Number to all of them at once -
 * same batch pattern as Register items' pending list. Doesn't touch
 * Item Type - that was already decided at registration.
 */
function AssignToGuestSection() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [manualTagId, setManualTagId] = useState('');
  const [looking, setLooking] = useState(false);
  const [pending, setPending] = useState<LinenItem[]>([]);
  const [notFoundTagId, setNotFoundTagId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleLookup() {
    const tagId = manualTagId.trim().toUpperCase();
    if (!tagId) return;

    setManualTagId('');
    if (pending.some((item) => item.tagId === tagId)) {
      setStatus(`${tagId} is already in the list.`);
      return; // already queued - don't re-fetch or add it twice
    }

    setLooking(true);
    setStatus(null);
    setNotFoundTagId(null);
    try {
      const item = await getItemByTag(tagId);
      if (!item) {
        setNotFoundTagId(tagId);
      } else {
        setPending((current) => [...current, item]);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to look up tag.');
    } finally {
      setLooking(false);
    }
  }

  function removePending(tagId: string) {
    setPending((current) => current.filter((item) => item.tagId !== tagId));
  }

  async function handleAssign() {
    if (pending.length === 0) return;
    const trimmedCustomer = customerName.trim();
    const trimmedRoom = roomNumber.trim();
    if (!trimmedCustomer || !trimmedRoom) {
      setStatus('Fill in Customer Name and Room Number.');
      return;
    }

    setSaving(true);
    try {
      for (const item of pending) {
        const updated: LinenItem = {
          ...item,
          customerName: trimmedCustomer,
          roomNumber: trimmedRoom,
          status: 'In Use',
        };
        await saveLinenItem(updated);
        logItemEvent({
          tagId: updated.tagId,
          eventType: 'status_changed',
          oldStatus: item.status,
          newStatus: 'In Use',
          customerName: trimmedCustomer,
          roomNumber: trimmedRoom,
          detail: updated.itemType,
        }).catch((err) => console.warn('Failed to log audit event:', err));
      }
      setStatus(`Assigned ${pending.length} item(s) to ${trimmedCustomer}.`);
      setPending([]);
      setCustomerName('');
      setRoomNumber('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to assign items.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="🙋 Assign to guest"
      subtitle="Scan already-registered tags, then assign them all to one guest and room at once.">
      <View style={styles.exitRow}>
        <TextInput
          style={[
            styles.input,
            styles.exitInput,
            { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
          ]}
          placeholder="Scan or type Tag ID"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          value={manualTagId}
          onChangeText={setManualTagId}
          onSubmitEditing={handleLookup}
          returnKeyType="done"
        />
        <PressableScale
          onPress={handleLookup}
          disabled={looking}
          style={[styles.scanExitButton, { backgroundColor: colors.text, opacity: looking ? 0.6 : 1 }]}>
          <ThemedText style={{ color: colors.background, fontWeight: '700' }}>
            {looking ? 'Looking…' : 'Add'}
          </ThemedText>
        </PressableScale>
      </View>

      {notFoundTagId && (
        <ThemedText style={{ color: colors.danger, fontSize: 13 }}>
          {notFoundTagId} isn&apos;t registered yet - register it above first.
        </ThemedText>
      )}

      <View style={[styles.pendingList, { borderColor: colors.border }]}>
        {pending.length === 0 ? (
          <ThemedText style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: 14 }}>
            No items scanned yet.
          </ThemedText>
        ) : (
          pending.map((item) => (
            <View key={item.tagId} style={[styles.pendingRow, { borderColor: colors.border }]}>
              <ThemedText style={{ fontSize: 13 }}>
                <ThemedText style={{ fontFamily: 'monospace', fontSize: 13 }}>{item.tagId}</ThemedText>
                {'  '}
                <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {item.itemType} · {item.status}
                  {item.customerName ? ` · ${item.customerName}` : ''}
                </ThemedText>
              </ThemedText>
              <PressableScale onPress={() => removePending(item.tagId)}>
                <ThemedText style={{ color: colors.danger, fontSize: 12 }}>Remove</ThemedText>
              </PressableScale>
            </View>
          ))
        )}
      </View>

      <TextInput
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
        placeholder="Customer name"
        placeholderTextColor={colors.textSecondary}
        value={customerName}
        onChangeText={setCustomerName}
      />
      <TextInput
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
        placeholder="Room number"
        placeholderTextColor={colors.textSecondary}
        value={roomNumber}
        onChangeText={setRoomNumber}
      />

      <PressableScale
        onPress={handleAssign}
        disabled={saving}
        style={[styles.primaryButton, { backgroundColor: colors.tint, opacity: saving ? 0.6 : 1 }]}>
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <ThemedText style={{ color: colors.background, fontWeight: '700' }}>
            {pending.length > 1 ? `Assign ${pending.length} items` : 'Assign'}
          </ThemedText>
        )}
      </PressableScale>

      {status && <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>{status}</ThemedText>}
    </SectionCard>
  );
}

type ScanResult = { tagId: string; flagged: boolean; item: LinenItem | null };

function ExitScannerSection() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [manualTagId, setManualTagId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  const handleTag = useCallback(async (tagId: string) => {
    const now = Date.now();
    const lastSeen = lastSeenRef.current.get(tagId);
    if (lastSeen && now - lastSeen < RESCAN_COOLDOWN_MS) {
      return;
    }
    lastSeenRef.current.set(tagId, now);

    setProcessing(true);
    setError(null);
    try {
      const item = await getItemByTag(tagId);
      const flagged = checkTag(item);

      // checkTag() only ever returns true for a registered item (see
      // its own comment for why unregistered tags aren't flagged at
      // all) - `item` is guaranteed non-null here, `&& item` is just
      // to satisfy the type checker.
      if (flagged && item) {
        // Don't raise a second alert for a tag that already has one
        // open - a tag sitting near the reader (or scanned again
        // before anyone's dealt with the first alert) would otherwise
        // spam a new theft_alerts row and a new notification every
        // time it's read. The scan result below still shows this as
        // flagged either way; only the alert itself is skipped.
        // Dismissing the existing alert (from any of the three apps)
        // is what allows the next flagged scan to raise a new one.
        const alreadyAlerted = await hasActiveAlert(tagId);
        if (!alreadyAlerted) {
          const message = `${item.itemType} (${tagId}) was detected at the exit scanner while marked ${item.status}.`;
          await logTheftAlert(tagId, item, message);
          logItemEvent({
            tagId,
            eventType: 'alert_triggered',
            oldStatus: item.status,
            customerName: item.customerName,
            roomNumber: item.roomNumber,
            detail: item.itemType,
          }).catch((err) => console.warn('Failed to log audit event:', err));
          // Best-effort, like every other notification/audit call here -
          // a failed Telegram send shouldn't block the alert itself,
          // which is already recorded above regardless of this outcome.
          sendTelegramAlert(tagId, item).catch((err) => console.warn('Failed to send Telegram alert:', err));
        }
      }

      setLastResult({ tagId, flagged, item });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process scan.');
    } finally {
      setProcessing(false);
    }
  }, []);

  const reader = useReader('exit_reader', handleTag);

  function handleManualSubmit() {
    const tagId = manualTagId.trim().toUpperCase();
    if (!tagId) return;
    reader.simulateScan(tagId);
    setManualTagId('');
  }

  return (
    <SectionCard
      title="Exit scanner"
      subtitle="Any tag detected here is treated as leaving."
      headerRight={
        <ReaderModeSwitch
          mode={reader.mode}
          connecting={reader.connecting}
          usbSerialSupported={reader.usbSerialSupported}
          onConnectUsb={reader.connectUsbSerial}
          onDisconnectUsb={reader.disconnectUsbSerial}
        />
      }>
      {reader.error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{reader.error}</ThemedText>}
      {error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}

      {reader.mode === 'simulated' ? (
        <View style={styles.exitRow}>
          <TextInput
            style={[
              styles.input,
              styles.exitInput,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Tag ID"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            value={manualTagId}
            onChangeText={setManualTagId}
            onSubmitEditing={handleManualSubmit}
            returnKeyType="done"
          />
          <PressableScale
            onPress={handleManualSubmit}
            disabled={processing}
            style={[styles.scanExitButton, { backgroundColor: colors.text, opacity: processing ? 0.6 : 1 }]}>
            <ThemedText style={{ color: colors.background, fontWeight: '700' }}>Scan</ThemedText>
          </PressableScale>
        </View>
      ) : (
        <View style={[styles.pendingList, { borderColor: colors.border, padding: 14 }]}>
          <ThemedText style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
            Waiting for a tag - the exit check runs automatically.
          </ThemedText>
        </View>
      )}

      {lastResult ? (
        <View
          style={[
            styles.resultBanner,
            {
              backgroundColor: lastResult.flagged ? colors.dangerBackground : `${colors.statusInUse}18`,
              borderColor: lastResult.flagged ? colors.danger : colors.statusInUse,
            },
          ]}>
          <ThemedText style={{ color: lastResult.flagged ? colors.danger : colors.statusInUse, fontWeight: '700' }}>
            {lastResult.flagged ? '⚠ Theft alert' : '✓ Cleared'}
          </ThemedText>
          <ThemedText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
            Tag {lastResult.tagId}
            {lastResult.item
              ? ` · ${lastResult.item.itemType} · Room ${lastResult.item.roomNumber} · ${lastResult.item.customerName} · ${lastResult.item.status}`
              : ' · not registered'}
          </ThemedText>
        </View>
      ) : (
        <ThemedText style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', padding: 14 }}>
          No scans yet.
        </ThemedText>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, gap: 20 },
  header: { gap: 4, marginBottom: 4 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  modeBadgeOutline: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemTypeRow: {
    flexDirection: 'row',
  },
  itemTypePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
  },
  scanButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pendingList: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exitInput: {
    flex: 1,
    fontFamily: 'monospace',
  },
  scanExitButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  resultBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
});
