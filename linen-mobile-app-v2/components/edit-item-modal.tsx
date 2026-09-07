/**
 * components/edit-item-modal.tsx
 *
 * Fix a mistake on an already-registered item's details (guest, room,
 * item type) - admin only. Shared by app/room/[roomNumber].tsx and
 * app/category.tsx, the two screens that list individual items, the
 * same way this is one shared component on the web dashboard's
 * Inventory page. See data/linen-data.ts's updateLinenItemDetails()
 * for why this goes through a dedicated RPC (checked server-side by
 * is_admin()) rather than a plain table update - see "Editing a
 * registered item (admin only)" in this app's README.
 *
 * Tag ID and status aren't editable here, matching the desktop app's
 * Edit dialog - status has its own dedicated controls elsewhere, and
 * the tag ID is the item's permanent identity.
 */

import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { logItemEvent, updateLinenItemDetails, type LinenItem } from '@/data/linen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export function EditItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: LinenItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const border = useThemeColor({}, 'border');

  const [customerName, setCustomerName] = useState(item.customerName);
  const [roomNumber, setRoomNumber] = useState(item.roomNumber);
  const [itemType, setItemType] = useState(item.itemType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedCustomer = customerName.trim();
    const trimmedRoom = roomNumber.trim();
    const trimmedType = itemType.trim();
    if (!trimmedCustomer || !trimmedRoom || !trimmedType) {
      setError('Please fill in guest, room, and item type.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await updateLinenItemDetails(item.tagId, {
        customerName: trimmedCustomer,
        roomNumber: trimmedRoom,
        itemType: trimmedType,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }

      // Note what actually changed, so the audit trail says something
      // more useful than just "edited" - mirrors the desktop app's
      // _on_edit_selected() and the web dashboard's copy of this modal.
      const changes: string[] = [];
      if (trimmedCustomer !== item.customerName) changes.push(`guest "${item.customerName}" -> "${trimmedCustomer}"`);
      if (trimmedRoom !== item.roomNumber) changes.push(`room "${item.roomNumber}" -> "${trimmedRoom}"`);
      if (trimmedType !== item.itemType) changes.push(`item type "${item.itemType}" -> "${trimmedType}"`);

      logItemEvent({
        tagId: item.tagId,
        eventType: 'edited',
        newStatus: item.status,
        customerName: trimmedCustomer,
        roomNumber: trimmedRoom,
        detail: changes.length > 0 ? changes.join('; ') : null,
      }).catch((err) => console.warn('Failed to log audit event:', err));

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={saving ? undefined : onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: border }]}
          onPress={(e) => e.stopPropagation()}>
          <ThemedText type="defaultSemiBold">Edit item</ThemedText>
          <ThemedText style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            {item.tagId} (fixed)
          </ThemedText>

          <View style={styles.form}>
            <FormField
              label="Guest"
              value={customerName}
              onChangeText={setCustomerName}
              colors={colors}
              border={border}
            />
            <FormField
              label="Room"
              value={roomNumber}
              onChangeText={setRoomNumber}
              colors={colors}
              border={border}
            />
            <FormField
              label="Item type"
              value={itemType}
              onChangeText={setItemType}
              colors={colors}
              border={border}
            />
          </View>

          {error && (
            <ThemedText style={{ color: colors.danger, fontSize: 12.5, marginTop: 8 }}>{error}</ThemedText>
          )}

          <View style={styles.buttonRow}>
            <PressableScale onPress={onClose} disabled={saving} style={styles.cancelButton}>
              <ThemedText style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</ThemedText>
            </PressableScale>
            <PressableScale
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: colors.tint, opacity: saving ? 0.6 : 1 }]}>
              {saving ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <ThemedText style={{ color: colors.background, fontWeight: '700' }}>Save</ThemedText>
              )}
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  colors,
  border,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  colors: (typeof Colors)['light'];
  border: string;
}) {
  return (
    <View style={styles.field}>
      <ThemedText style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, { backgroundColor: colors.background, borderColor: border, color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  form: {
    marginTop: 14,
    gap: 10,
  },
  field: {
    gap: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
});
