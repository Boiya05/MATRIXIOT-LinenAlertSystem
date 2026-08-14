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
import { useReader } from '@/hooks/use-reader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { checkTag } from '@/lib/detector';

// The kinds of linen items a simulated scan can produce - mirrors the
// desktop app's ITEM_TYPES exactly, for the same reason (see
// resolveItemType() below).
const ITEM_TYPES = ['Bath Towel', 'Hand Towel', 'Washcloth', 'Bedsheet', 'Pillowcase', 'Blanket'];

/**
 * Decide what kind of item a scanned tag represents.
 *
 * PLACEHOLDER: a real UHF tag typically only carries a Tag ID (its
 * EPC) - not a human-readable item type - so this needs a real answer
 * once hardware is chosen: either staff pick the type at registration
 * time, or item type is looked up from a separate mapping maintained
 * elsewhere. Until that's decided, this guesses randomly - same
 * placeholder as the desktop app's and web dashboard's equivalents.
 */
function resolveItemType(): string {
  return ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
}

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

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>{subtitle}</ThemedText>
      {children}
    </View>
  );
}

function RegisterSection() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [pending, setPending] = useState<{ tagId: string; itemType: string }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTag = useCallback((tagId: string) => {
    setPending((current) => {
      if (current.some((p) => p.tagId === tagId)) return current;
      return [...current, { tagId, itemType: resolveItemType() }];
    });
    setStatus(`Scanned ${tagId}. Added to pending list.`);
  }, []);

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
    <SectionCard title="Register items" subtitle="Scan a tag, then assign a guest and room.">
      <PressableScale
        onPress={handleScan}
        disabled={scanning}
        style={[styles.scanButton, { borderColor: colors.tint, opacity: scanning ? 0.6 : 1 }]}>
        <ThemedText style={{ color: colors.tint, fontWeight: '600' }}>
          {scanning ? 'Scanning…' : '+ Scan (simulated)'}
        </ThemedText>
      </PressableScale>

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
    <SectionCard title="Exit scanner" subtitle="Any tag detected here is treated as leaving.">
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

      {error && <ThemedText style={{ color: colors.danger, fontSize: 13 }}>{error}</ThemedText>}

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
