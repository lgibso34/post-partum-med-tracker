import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { useMedicines } from '../lib/queries';
import { supabase, type DoseRecord } from '../lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import { TZ } from '../lib/time';

type UpcomingDosesModalProps = {
  visible: boolean;
  onClose: () => void;
};

function formatHm(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function UpcomingDosesModal({ visible, onClose }: UpcomingDosesModalProps) {
  const medicinesQ = useMedicines();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [visible]);

  const medicines = useMemo(
    () =>
      (medicinesQ.data ?? []).filter(
        (m) => m.dose_interval_hours != null && m.dose_interval_hours > 0
      ),
    [medicinesQ.data]
  );

  const dosesQs = useQueries({
    queries: medicines.map((m) => ({
      queryKey: ['doses', 'medicine', m.id],
      enabled: visible,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('doses')
          .select('*')
          .eq('medicine_id', m.id)
          .order('taken_at', { ascending: false });
        if (error) throw error;
        return data as DoseRecord[];
      },
    })),
  });

  const now = Date.now();
  const rows = medicines
    .map((medicine, i) => {
      const last = dosesQs[i].data?.[0] ?? null;
      const interval = medicine.dose_interval_hours!;
      const nextMs = last
        ? new Date(last.taken_at).getTime() + interval * 3_600_000
        : null;
      return { medicine, last, nextMs };
    })
    .sort((a, b) => {
      if (a.nextMs == null && b.nextMs == null) return 0;
      if (a.nextMs == null) return 1;
      if (b.nextMs == null) return -1;
      return a.nextMs - b.nextMs;
    });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Upcoming doses</Text>
          {rows.length === 0 ? (
            <Text style={styles.empty}>
              No medicines have a dose interval set yet. Add an "Every __ hrs" value on
              any card to see it here.
            </Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ gap: 10 }}>
              {rows.map(({ medicine, last, nextMs }) => {
                const accent = medicine.color || '#0ea5e9';
                let primary: string;
                let primaryColor = '#1c1917';
                let secondary: string | null = null;
                if (nextMs == null) {
                  primary = 'No doses yet';
                  secondary = 'Take any time';
                  primaryColor = '#78716c';
                } else {
                  const diff = nextMs - now;
                  const clock = formatInTimeZone(
                    new Date(nextMs).toISOString(),
                    TZ,
                    'h:mm a'
                  );
                  if (diff <= 0) {
                    primary = `Overdue by ${formatHm(-diff)}`;
                    primaryColor = '#dc2626';
                    secondary = `Was due ${clock}`;
                  } else {
                    primary = `Due ${clock}`;
                    secondary = `In ${formatHm(diff)}`;
                  }
                }
                return (
                  <View key={medicine.id} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: accent }]} />
                    <View style={styles.rowText}>
                      <Text style={[styles.medName, { color: accent }]} numberOfLines={1}>
                        {medicine.name}
                      </Text>
                      {last && (
                        <Text style={styles.lastDose}>
                          Last: {formatInTimeZone(last.taken_at, TZ, 'EEE h:mm a')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.primary, { color: primaryColor }]}>
                        {primary}
                      </Text>
                      {secondary && <Text style={styles.secondary}>{secondary}</Text>}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1c1917', marginBottom: 12 },
  empty: {
    fontSize: 13,
    color: '#78716c',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fafaf9',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1, minWidth: 0 },
  medName: { fontSize: 14, fontWeight: '700' },
  lastDose: { fontSize: 11, color: '#78716c', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  primary: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  secondary: { fontSize: 11, color: '#78716c', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f5f5f4',
  },
  closeText: { color: '#44403c', fontSize: 13, fontWeight: '600' },
});
