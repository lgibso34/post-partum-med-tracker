import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAllDosesForMedicine } from '../lib/queries';
import { formatDateHeader, formatTime, isoToYmd, todayInTZ } from '../lib/time';
import type { DoseRecord, MedicineRecord } from '../lib/supabase';

export const GRID_GAP = 12;
export const GRID_H_PAD = 16;

export function columnCountFor(width: number): number {
  if (width < 600) return 1;
  if (width < 900) return 3;
  if (width < 1200) return 4;
  return 5;
}

export type AddingContext = { medicineId: string; date: string };

export function HistoryColumn({
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

const styles = StyleSheet.create({
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
  timeList: { gap: 6 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  timeDot: { width: 8, height: 8, borderRadius: 4 },
  timeText: { fontSize: 14, color: '#1c1917', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.6 },
});
