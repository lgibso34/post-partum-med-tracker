import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DoseRecord, MedicineRecord } from '../lib/supabase';
import { formatTime, hhmmToIso, isoToHHmm } from '../lib/time';
import {
  useAddDose,
  useArchiveMedicine,
  useDeleteDose,
  useRenameMedicine,
  useUpdateDose,
  useUpdateMedicineNotes,
} from '../lib/queries';
import { useAuth } from '../lib/auth';

type Props = {
  medicine: MedicineRecord;
  doses: DoseRecord[];
  date: string;
  width: number;
};

function confirm(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof window !== 'undefined' ? window.confirm(message) : false
    );
  }
  return new Promise((resolve) => {
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function prompt(message: string, defaultValue: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.prompt(message, defaultValue);
  }
  return null;
}

export function MedicineColumn({ medicine, doses, date, width }: Props) {
  const { userId } = useAuth();
  const addDose = useAddDose(date);
  const deleteDose = useDeleteDose(date);
  const updateDose = useUpdateDose(date);
  const archiveMed = useArchiveMedicine();
  const renameMed = useRenameMedicine();
  const updateNotes = useUpdateMedicineNotes();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(medicine.notes ?? '');

  useEffect(() => {
    setNotesDraft(medicine.notes ?? '');
  }, [medicine.id, medicine.notes]);

  const handleNotesBlur = () => {
    const next = notesDraft.trim();
    const current = (medicine.notes ?? '').trim();
    if (next === current) return;
    updateNotes.mutate({ id: medicine.id, notes: next });
  };
  const [editing, setEditing] = useState<DoseRecord | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!userId) return;
    addDose.mutate({ medicineId: medicine.id, userId });
  };

  const openEdit = (d: DoseRecord) => {
    setEditing(d);
    setEditValue(isoToHHmm(d.taken_at));
    setEditError(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setEditError(null);
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    const iso = hhmmToIso(date, editValue);
    if (!iso) {
      setEditError('Use 24-hour HH:MM (e.g. 14:30)');
      return;
    }
    updateDose.mutate(
      { id: editing.id, taken_at: iso },
      { onSuccess: closeEdit }
    );
  };

  const handleDeleteFromEdit = async () => {
    if (!editing) return;
    if (await confirm(`Delete dose at ${formatTime(editing.taken_at)}?`)) {
      deleteDose.mutate(editing.id);
      closeEdit();
    }
  };

  const handleRename = async () => {
    setMenuOpen(false);
    const name = prompt('Rename medicine', medicine.name);
    if (name && name.trim() && name.trim() !== medicine.name) {
      renameMed.mutate({ id: medicine.id, name: name.trim() });
    }
  };

  const handleArchive = async () => {
    setMenuOpen(false);
    if (await confirm(`Archive "${medicine.name}"?`)) {
      archiveMed.mutate(medicine.id);
    }
  };

  const accent = medicine.color || '#0ea5e9';

  return (
    <View style={[styles.card, { width }]}>
      <View style={[styles.header, { backgroundColor: `${accent}22` }]}>
        <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
          {medicine.name}
        </Text>
        <Pressable
          onPress={() => setMenuOpen((s) => !s)}
          style={({ pressed }) => [styles.kebab, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Text style={styles.kebabText}>⋯</Text>
        </Pressable>
      </View>

      {menuOpen && (
        <View style={styles.menu}>
          <Pressable onPress={handleRename} style={styles.menuItem}>
            <Text style={styles.menuItemText}>Rename</Text>
          </Pressable>
          <Pressable onPress={handleArchive} style={styles.menuItem}>
            <Text style={[styles.menuItemText, { color: '#dc2626' }]}>Archive</Text>
          </Pressable>
        </View>
      )}

      <TextInput
        value={notesDraft}
        onChangeText={setNotesDraft}
        onBlur={handleNotesBlur}
        placeholder="Add notes…"
        placeholderTextColor="#a8a29e"
        multiline
        style={styles.notesInput}
      />

      <View style={styles.doseList}>
        {doses.length === 0 ? (
          <Text style={styles.empty}>No doses yet</Text>
        ) : (
          doses.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => openEdit(d)}
              style={({ pressed }) => [styles.doseRow, pressed && styles.pressed]}
            >
              <Text style={styles.doseTime}>{formatTime(d.taken_at)}</Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={styles.count}>
        {doses.length} {doses.length === 1 ? 'dose' : 'doses'}
      </Text>

      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.addBtn,
          { backgroundColor: accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.addBtnText}>+ dose</Text>
      </Pressable>

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeEdit}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit dose time</Text>
            <Text style={styles.modalHint}>24-hour format (HH:MM)</Text>
            <TextInput
              value={editValue}
              onChangeText={(v) => {
                setEditValue(v);
                setEditError(null);
              }}
              placeholder="14:30"
              placeholderTextColor="#a8a29e"
              keyboardType="numbers-and-punctuation"
              autoFocus
              style={styles.modalInput}
              onSubmitEditing={handleSaveEdit}
            />
            {editError && <Text style={styles.modalError}>{editError}</Text>}
            <View style={styles.modalActions}>
              <Pressable
                onPress={handleDeleteFromEdit}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalDeleteBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </Pressable>
              <View style={styles.modalSpacer} />
              <Pressable
                onPress={closeEdit}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalCancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEdit}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    overflow: 'hidden',
    minHeight: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { fontSize: 14, fontWeight: '700', flex: 1 },
  kebab: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kebabText: { fontSize: 18, color: '#57534e', lineHeight: 18 },
  pressed: { opacity: 0.6 },
  menu: {
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    backgroundColor: '#fafaf9',
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10 },
  menuItemText: { fontSize: 13, color: '#1c1917' },
  notesInput: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 8,
    backgroundColor: '#fafaf9',
    fontSize: 12,
    color: '#1c1917',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  doseList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 4,
    flex: 1,
  },
  empty: { fontSize: 12, color: '#a8a29e', fontStyle: 'italic' },
  doseRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f4',
  },
  doseTime: { fontSize: 13, color: '#1c1917', fontVariant: ['tabular-nums'] },
  count: {
    fontSize: 11,
    color: '#78716c',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },
  addBtn: {
    margin: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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
    padding: 20,
    width: '100%',
    maxWidth: 360,
    gap: 6,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1c1917' },
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
