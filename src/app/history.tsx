import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useAddDose,
  useAllDosesForMedicine,
  useDeleteDose,
  useMedicines,
  useUpdateDose,
} from '../lib/queries';
import {
  formatDateHeader,
  formatTime,
  hhmmToIso,
  isoToHHmm,
  isoToYmd,
  nowIsoUtc,
  todayInTZ,
} from '../lib/time';
import type { DoseRecord, MedicineRecord } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const GRID_GAP = 12;
const GRID_H_PAD = 16;

function columnCountFor(width: number): number {
  if (width < 600) return 1;
  if (width < 900) return 3;
  if (width < 1200) return 4;
  return 5;
}

type AddingContext = { medicineId: string; date: string };

function HistoryColumn({
  medicine,
  width,
  onEdit,
  onAdd,
}: {
  medicine: MedicineRecord;
  width: number;
  onEdit: (d: DoseRecord) => void;
  onAdd: (medicineId: string, date: string) => void;
}) {
  const dosesQ = useAllDosesForMedicine(medicine.id);
  const grouped = useMemo(() => {
    const byDate: Record<string, DoseRecord[]> = {};
    for (const d of dosesQ.data ?? []) {
      const key = isoToYmd(d.taken_at);
      (byDate[key] ??= []).push(d);
    }
    const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
    return dates.map((date) => ({
      date,
      doses: byDate[date].sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1)),
    }));
  }, [dosesQ.data]);

  const accent = medicine.color || '#0ea5e9';

  return (
    <View style={[styles.column, { width }]}>
      <View style={[styles.columnHeader, { backgroundColor: `${accent}22` }]}>
        <Text style={[styles.columnTitle, { color: accent }]} numberOfLines={1}>
          {medicine.name}
        </Text>
      </View>
      <Pressable
        onPress={() => onAdd(medicine.id, todayInTZ())}
        style={({ pressed }) => [
          styles.columnAddBtn,
          { backgroundColor: accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.columnAddBtnText}>+ Add dose</Text>
      </Pressable>
      <View style={styles.columnBody}>
        {dosesQ.isLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : grouped.length === 0 ? (
          <Text style={styles.columnEmpty}>No doses</Text>
        ) : (
          grouped.map((group) => (
            <View key={group.date} style={styles.columnDayBlock}>
              <View style={styles.dayHeaderRow}>
                <Text
                  style={[styles.dayHeader, { color: accent }]}
                  numberOfLines={1}
                >
                  {formatDateHeader(group.date)}
                </Text>
                <Pressable
                  onPress={() => onAdd(medicine.id, group.date)}
                  style={({ pressed }) => [
                    styles.addDayBtn,
                    { borderColor: accent },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.addDayBtnText, { color: accent }]}>+</Text>
                </Pressable>
              </View>
              <View style={styles.timeList}>
                {group.doses.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => onEdit(d)}
                    style={({ pressed }) => [
                      styles.timeRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.timeDot, { backgroundColor: accent }]} />
                    <Text style={styles.timeText}>{formatTime(d.taken_at)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default function History() {
  const router = useRouter();
  const { userId } = useAuth();
  const { width } = useWindowDimensions();
  const medicinesQ = useMedicines();
  const [view, setView] = useState<'single' | 'all'>('single');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<DoseRecord | null>(null);
  const [addingContext, setAddingContext] = useState<AddingContext | null>(null);
  const [addDateValue, setAddDateValue] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const activeId = selectedId ?? medicinesQ.data?.[0]?.id ?? null;
  const activeMed = medicinesQ.data?.find((m) => m.id === activeId) ?? null;
  const dosesQ = useAllDosesForMedicine(view === 'single' ? activeId : null);

  const operationDate = editing
    ? isoToYmd(editing.taken_at)
    : addingContext?.date ?? todayInTZ();
  const addDose = useAddDose(operationDate);
  const updateDose = useUpdateDose(operationDate);
  const deleteDose = useDeleteDose(operationDate);

  const openEdit = (d: DoseRecord) => {
    setAddingContext(null);
    setEditing(d);
    setModalValue(isoToHHmm(d.taken_at));
    setModalError(null);
  };

  const openAdd = (medicineId: string, dateStr: string) => {
    setEditing(null);
    setAddingContext({ medicineId, date: dateStr });
    setAddDateValue(dateStr);
    setModalValue(isoToHHmm(nowIsoUtc()));
    setModalError(null);
  };

  const closeModal = () => {
    setEditing(null);
    setAddingContext(null);
    setModalError(null);
  };

  const handleSave = () => {
    if (editing) {
      const iso = hhmmToIso(isoToYmd(editing.taken_at), modalValue);
      if (!iso) {
        setModalError('Use 24-hour HH:MM (e.g. 14:30)');
        return;
      }
      updateDose.mutate(
        { id: editing.id, taken_at: iso },
        { onSuccess: closeModal }
      );
      return;
    }
    if (addingContext && userId) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(addDateValue.trim())) {
        setModalError('Use date format YYYY-MM-DD');
        return;
      }
      const iso = hhmmToIso(addDateValue.trim(), modalValue);
      if (!iso) {
        setModalError('Use 24-hour HH:MM (e.g. 14:30)');
        return;
      }
      addDose.mutate(
        { medicineId: addingContext.medicineId, userId, takenAt: iso },
        { onSuccess: closeModal }
      );
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    deleteDose.mutate(editing.id);
    closeModal();
  };

  const grouped = useMemo(() => {
    const byDate: Record<string, DoseRecord[]> = {};
    for (const d of dosesQ.data ?? []) {
      const key = isoToYmd(d.taken_at);
      (byDate[key] ??= []).push(d);
    }
    const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
    return dates.map((date) => ({
      date,
      doses: byDate[date].sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1)),
    }));
  }, [dosesQ.data]);

  const accent = activeMed?.color || '#0ea5e9';

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>Medicine History</Text>
        <View style={styles.topRightSpacer} />
      </View>

      <View style={styles.viewToggleRow}>
        <Pressable
          onPress={() => setView('single')}
          style={({ pressed }) => [
            styles.toggleBtn,
            view === 'single' && styles.toggleBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              view === 'single' && styles.toggleBtnTextActive,
            ]}
          >
            Single
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setView('all')}
          style={({ pressed }) => [
            styles.toggleBtn,
            view === 'all' && styles.toggleBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              view === 'all' && styles.toggleBtnTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>
      </View>

      {view === 'single' && (
        <View style={styles.dropdownRow}>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [
              styles.dropdown,
              { borderColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dropdownLabel, { color: accent }]} numberOfLines={1}>
              {activeMed?.name ?? 'Select medicine'}
            </Text>
            <Text style={[styles.dropdownCaret, { color: accent }]}>▾</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {view === 'all' ? (
          medicinesQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.mutedText}>Loading…</Text>
            </View>
          ) : !medicinesQ.data || medicinesQ.data.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.mutedText}>No medicines yet</Text>
            </View>
          ) : (
            (() => {
              const cols = columnCountFor(width);
              const available = width - GRID_H_PAD * 2;
              const columnWidth = Math.floor(
                (available - GRID_GAP * (cols - 1)) / cols
              );
              return (
                <View style={[styles.grid, { gap: GRID_GAP }]}>
                  {medicinesQ.data.map((m) => (
                    <HistoryColumn
                      key={m.id}
                      medicine={m}
                      width={columnWidth}
                      onEdit={openEdit}
                      onAdd={openAdd}
                    />
                  ))}
                </View>
              );
            })()
          )
        ) : medicinesQ.isLoading || dosesQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.mutedText}>Loading…</Text>
          </View>
        ) : !activeMed ? (
          <View style={styles.center}>
            <Text style={styles.mutedText}>No medicines yet</Text>
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.mutedText}>No doses recorded for {activeMed.name}</Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.date} style={styles.dayBlock}>
              <View style={styles.dayHeaderRow}>
                <Text style={[styles.dayHeader, { color: accent }]}>
                  {formatDateHeader(group.date)}
                </Text>
                <Pressable
                  onPress={() => activeId && openAdd(activeId, group.date)}
                  style={({ pressed }) => [
                    styles.addDayBtn,
                    { borderColor: accent },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.addDayBtnText, { color: accent }]}>+ add</Text>
                </Pressable>
              </View>
              <View style={styles.timeList}>
                {group.doses.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => openEdit(d)}
                    style={({ pressed }) => [styles.timeRow, pressed && styles.pressed]}
                  >
                    <View style={[styles.timeDot, { backgroundColor: accent }]} />
                    <Text style={styles.timeText}>{formatTime(d.taken_at)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
        {view === 'single' && activeMed && activeId && (
          <Pressable
            onPress={() => openAdd(activeId, todayInTZ())}
            style={({ pressed }) => [
              styles.addTodayBtn,
              { backgroundColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.addTodayBtnText}>+ Add dose</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal
        visible={editing !== null || addingContext !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit dose time' : 'Add dose'}
            </Text>
            {editing ? (
              <Text style={styles.modalHint}>
                {`24-hour format (HH:MM) — ${formatDateHeader(isoToYmd(editing.taken_at))}`}
              </Text>
            ) : (
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
            )}
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
              onSubmitEditing={handleSave}
            />
            {modalError && <Text style={styles.modalError}>{modalError}</Text>}
            <View style={styles.modalActions}>
              {editing && (
                <Pressable
                  onPress={handleDelete}
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
                onPress={closeModal}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalCancelBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
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

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select medicine</Text>
            <ScrollView style={styles.modalList}>
              {medicinesQ.data?.map((m) => {
                const isActive = m.id === activeId;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      setSelectedId(m.id);
                      setPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalItem,
                      isActive && styles.modalItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: m.color || '#0ea5e9' },
                      ]}
                    />
                    <Text style={styles.modalItemText}>{m.name}</Text>
                    {isActive && <Text style={styles.modalCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafaf9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    backgroundColor: '#fff',
    gap: 12,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f4',
  },
  backText: { fontSize: 12, color: '#44403c', fontWeight: '600' },
  brand: { fontSize: 15, fontWeight: '700', color: '#1c1917', flexShrink: 1 },
  topRightSpacer: { width: 60 },
  pressed: { opacity: 0.6 },
  viewToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#f5f5f4',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: { backgroundColor: '#fff', shadowOpacity: 0.1, shadowRadius: 2 },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: '#78716c' },
  toggleBtnTextActive: { color: '#1c1917' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  column: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    overflow: 'hidden',
    minHeight: 220,
  },
  columnHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  columnTitle: { fontSize: 14, fontWeight: '700' },
  columnAddBtn: {
    margin: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  columnAddBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  columnBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 10,
  },
  columnEmpty: {
    fontSize: 12,
    color: '#a8a29e',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  columnDayBlock: {
    backgroundColor: '#fafaf9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 8,
  },
  dropdownRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  dropdownLabel: { fontSize: 15, fontWeight: '700', flex: 1 },
  dropdownCaret: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  mutedText: { fontSize: 13, color: '#78716c' },
  dayBlock: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 12,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  addDayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  addDayBtnText: { fontSize: 11, fontWeight: '700' },
  addTodayBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addTodayBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  timeList: { gap: 6 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  timeDot: { width: 8, height: 8, borderRadius: 4 },
  timeText: { fontSize: 14, color: '#1c1917', fontVariant: ['tabular-nums'] },
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
  modalList: { maxHeight: 400 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  modalItemActive: { backgroundColor: '#f5f5f4' },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  modalItemText: { fontSize: 14, color: '#1c1917', flex: 1 },
  modalCheck: { fontSize: 14, color: '#16a34a', fontWeight: '700' },
});
