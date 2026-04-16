import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAddMedicine } from '../lib/queries';

const COLORS = ['#0ea5e9', '#f97316', '#10b981', '#ef4444', '#a855f7', '#f59e0b'];

export function AddMedicineCard({ width }: { width: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [interval, setInterval] = useState('');
  const addMedicine = useAddMedicine();

  const reset = () => {
    setName('');
    setColor(COLORS[0]);
    setInterval('');
    setOpen(false);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let dose_interval_hours: number | null = null;
    const rawInterval = interval.trim();
    if (rawInterval !== '') {
      const parsed = Number.parseFloat(rawInterval);
      if (Number.isFinite(parsed) && parsed > 0) dose_interval_hours = parsed;
    }
    addMedicine.mutate(
      { name: trimmed, color, dose_interval_hours },
      { onSuccess: reset }
    );
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.card,
          styles.emptyCard,
          { width },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.plus}>+</Text>
        <Text style={styles.plusLabel}>add medicine</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, styles.formCard, { width }]}>
      <Text style={styles.formTitle}>New medicine</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Tylenol"
        placeholderTextColor="#a8a29e"
        style={styles.input}
        autoFocus
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <View style={styles.colorRow}>
        {COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              color === c && styles.colorDotSelected,
            ]}
          />
        ))}
      </View>
      <View style={styles.intervalRow}>
        <Text style={styles.intervalLabel}>Every</Text>
        <TextInput
          value={interval}
          onChangeText={setInterval}
          placeholder="—"
          placeholderTextColor="#a8a29e"
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={styles.intervalInput}
        />
        <Text style={styles.intervalLabel}>hrs (optional)</Text>
      </View>
      <View style={styles.formActions}>
        <Pressable
          onPress={reset}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
        >
          <Text style={styles.btnGhostText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={!name.trim() || addMedicine.isPending}
          style={({ pressed }) => [
            styles.btnPrimary,
            pressed && styles.pressed,
            (!name.trim() || addMedicine.isPending) && styles.btnDisabled,
          ]}
        >
          <Text style={styles.btnPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 220,
    borderRadius: 12,
  },
  emptyCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d6d3d1',
    backgroundColor: '#fafaf9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pressed: { opacity: 0.7 },
  plus: { fontSize: 32, color: '#a8a29e', fontWeight: '300' },
  plusLabel: { fontSize: 12, color: '#78716c' },
  formCard: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    backgroundColor: '#fff',
    padding: 12,
    gap: 10,
  },
  formTitle: { fontSize: 13, fontWeight: '700', color: '#1c1917' },
  input: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1c1917',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  intervalLabel: { fontSize: 12, color: '#78716c' },
  intervalInput: {
    width: 60,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fafaf9',
    fontSize: 13,
    color: '#1c1917',
    fontVariant: ['tabular-nums'],
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: '#1c1917' },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f5f5f4',
  },
  btnGhostText: { fontSize: 13, color: '#44403c', fontWeight: '600' },
  btnPrimary: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
  },
  btnPrimaryText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
