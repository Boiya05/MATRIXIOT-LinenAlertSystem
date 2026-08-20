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
import { getAllItems, getItemByTag, logTheftAlert, saveLinenItem, type LinenItem } from '@/data/linen-data';
import { useReader, type ReaderMode } from '@/hooks/use-reader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { checkTag } from '@/lib/detector';

// The kinds of linen items this app tracks - mirrors the desktop
// app's ITEM_TYPES exactly. A real UHF tag only carries a Tag ID (its
// EPC), not a human-readable item type, so staff pick it from this
// list at scan time (see the pill selector in RegisterSection below)
// rather than it being guessed or looked up automatically.
const ITEM_TYPES = ['Bath Towel', 'Hand Towel', 'Washcloth', 'Bedsheet', 'Pillowcase', 'Blanket'];

async function generateTagId(pendingTagIds: string[]): Promise<string> {
  const allItems = await getAllItems();
  const takenTagIds = new Set([...pendingTagIds, ...allItems.map((item) => item.tagId)]);
  let tagId: string;
  do {
    tagId = `TAG${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
  } while (takenTagIds.has(tagId));
  return tagId;
}

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
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Depends on selectedItemType so a fresh closure (carrying the
  // currently-picked type) reaches useReader's poll loop every time
  // the selection changes - see hooks/use-reader.ts's onTagRef, which
  // is refreshed every render specifically so this works.
  const handleTag = useCallback(
    (tagId: string) => {
      setPending((current) => {
        if (current.some((p) => p.tagId === tagId)) return current;
        return [...current, { tagId, itemType: selectedItemType }];
      });
      setStatus(`Scanned ${tagId}. Added to pending list.`);
    },
    [selectedItemType]
  );

  const reader = useReader('entry_reader', handleTag);

  async function handleScan() {
    setScanning(true);
    try {
      const tagId = await generateTagId(pending.map((p) => p.tagId));
      reader.simulateScan(tagId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to generate a tag ID.');
    } finally {
      setScanning(false);
    }
  }

  function removePending(tagId: string) {
    setPending((current) => current.filter((p) => p.tagId !== tagId));
  }

  async function handleAssign() {
    if (pending.length === 0) {
      setStatus('Scan at least one item first.');
      return;
    }
    if (!customerName.trim() || !roomNumber.trim()) {
      setStatus('Fill in Customer Name and Room Number.');
      return;
    }

    setSaving(true);
    try {
      for (const item of pending) {
        const linenItem: LinenItem = {
          tagId: item.tagId,
          customerName: customerName.trim(),
          roomNumber: roomNumber.trim(),
          itemType: item.itemType,
          status: 'In Use',
        };
        await saveLinenItem(linenItem);
      }
      setStatus(`Assigned ${pending.length} item(s) to ${customerName.trim()}.`);
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
      subtitle="Scan a tag, then assign a guest and room."
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
        <PressableScale
          onPress={handleScan}
          disabled={scanning}
          style={[styles.scanButton, { borderColor: colors.tint, opacity: scanning ? 0.6 : 1 }]}>
          <ThemedText style={{ color: colors.tint, fontWeight: '600' }}>
            {scanning ? 'Scanning…' : '+ Scan (simulated)'}
          </ThemedText>
        </PressableScale>
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
          <ThemedText style={{ color: colors.background, fontWeight: '700' }}>Assign</ThemedText>
        )}
      </PressableScale>

      {status && <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>{status}</ThemedText>}
    </SectionCard>
  );
}

// How long to ignore repeat reads of the same tag after processing it
// once - see the equivalent constant in the web dashboard's scan page
// for why this matters once a real reader is involved.
const RESCAN_COOLDOWN_MS = 5000;

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

      if (flagged) {
        const message = item
          ? `${item.itemType} (${tagId}) was detected at the exit scanner while marked ${item.status}.`
          : `Unregistered tag (${tagId}) was detected at the exit scanner.`;
        await logTheftAlert(tagId, item, message);
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
