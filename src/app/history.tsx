import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAllDosesForMedicine, useMedicines } from '../lib/queries';
import { formatDateHeader, formatTime, isoToYmd } from '../lib/time';
import type { DoseRecord } from '../lib/supabase';

export default function History() {
  const router = useRouter();
  const medicinesQ = useMedicines();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeId = selectedId ?? medicinesQ.data?.[0]?.id ?? null;
  const activeMed = medicinesQ.data?.find((m) => m.id === activeId) ?? null;
  const dosesQ = useAllDosesForMedicine(activeId);

  const grouped = useMemo(() => {
    const byDate: Record<string, DoseRecord[]> = {};
    for (const d of dosesQ.data ?? []) {
      const key = isoToYmd(d.taken_at);
      (byDate[key] ??= []).push(d);
    }
    const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
    return dates.map((date) => ({
      date,
      doses: byDate[date].sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1)),
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

      <ScrollView contentContainerStyle={styles.scroll}>
        {medicinesQ.isLoading || dosesQ.isLoading ? (
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
              <Text style={[styles.dayHeader, { color: accent }]}>
                {formatDateHeader(group.date)}
              </Text>
              <View style={styles.timeList}>
                {group.doses.map((d) => (
                  <View key={d.id} style={styles.timeRow}>
                    <View style={[styles.timeDot, { backgroundColor: accent }]} />
                    <Text style={styles.timeText}>{formatTime(d.taken_at)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
  dayHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
