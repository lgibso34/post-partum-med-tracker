import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatDateHeader, isoToYmd } from '../lib/time';
import type { DoseEditorModalProps } from './useDoseEditor';

export function DoseEditorModal({
  visible,
  editing,
  addingContext,
  addDateValue,
  setAddDateValue,
  modalValue,
  setModalValue,
  modalError,
  setModalError,
  accent,
  onClose,
  onSave,
  onDelete,
}: DoseEditorModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>
            {editing ? 'Edit dose time' : 'Add dose'}
          </Text>
          {editing ? (
            <Text style={styles.modalHint}>
              {`24-hour format (HH:MM) — ${formatDateHeader(isoToYmd(editing.taken_at))}`}
            </Text>
          ) : addingContext ? (
            <>
              <Text style={styles.modalHint}>Date (YYYY-MM-DD)</Text>
              <TextInput
                value={addDateValue}
                onChangeText={(v) => {
                  setAddDateValue(v);
                  setModalError(null);
                }}
                placeholder="2026-04-14"
                placeholderTextColor="#a8a29e"
                keyboardType="numbers-and-punctuation"
                style={styles.modalInput}
              />
              <Text style={[styles.modalHint, { marginTop: 8 }]}>Time (HH:MM)</Text>
            </>
          ) : null}
          <TextInput
            value={modalValue}
            onChangeText={(v) => {
              setModalValue(v);
              setModalError(null);
            }}
            placeholder="14:30"
            placeholderTextColor="#a8a29e"
            keyboardType="numbers-and-punctuation"
            autoFocus={editing !== null}
            style={styles.modalInput}
            onSubmitEditing={onSave}
          />
          {modalError && <Text style={styles.modalError}>{modalError}</Text>}
          <View style={styles.modalActions}>
            {editing && (
              <Pressable
                onPress={onDelete}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalDeleteBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
            )}
            <View style={styles.modalSpacer} />
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalCancelBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              style={({ pressed }) => [
                styles.modalBtn,
                { backgroundColor: accent },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1c1917', marginBottom: 8 },
  modalHint: { fontSize: 12, color: '#78716c', marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1c1917',
    fontVariant: ['tabular-nums'],
  },
  modalError: { fontSize: 12, color: '#dc2626' },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  modalSpacer: { flex: 1 },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteBtn: { backgroundColor: '#fee2e2' },
  modalDeleteText: { color: '#b91c1c', fontSize: 13, fontWeight: '600' },
  modalCancelBtn: { backgroundColor: '#f5f5f4' },
  modalCancelText: { color: '#44403c', fontSize: 13, fontWeight: '600' },
  modalSaveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
