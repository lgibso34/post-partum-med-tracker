import type React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../stores/appStore';
import { formatDateHeader, shiftDay, todayInTZ } from '../lib/time';

export function DateBar() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const goToToday = useAppStore((s) => s.goToToday);
  const isToday = selectedDate === todayInTZ();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setSelectedDate(shiftDay(selectedDate, -1))}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Text style={styles.arrowText}>◀</Text>
      </Pressable>

      {Platform.OS === 'web' ? (
        <View style={styles.dateDisplay}>
          {WebDateInput({ value: selectedDate, onChange: setSelectedDate })}
          <Text style={styles.dateLabel}>{formatDateHeader(selectedDate)}</Text>
        </View>
      ) : (
        <View style={styles.dateDisplay}>
          <Text style={styles.dateLabel}>{formatDateHeader(selectedDate)}</Text>
        </View>
      )}

      <Pressable
        onPress={() => setSelectedDate(shiftDay(selectedDate, 1))}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Text style={styles.arrowText}>▶</Text>
      </Pressable>

      <Pressable
        onPress={goToToday}
        disabled={isToday}
        style={({ pressed }) => [
          styles.todayBtn,
          pressed && styles.pressed,
          isToday && styles.todayBtnDisabled,
        ]}
      >
        <Text style={[styles.todayText, isToday && styles.todayTextDisabled]}>Today</Text>
      </Pressable>
    </View>
  );
}

function WebDateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const props = {
    type: 'date',
    value,
    onChange: (e: { target: { value: string } }) =>
      e.target.value && onChange(e.target.value),
    style: {
      position: 'absolute',
      inset: 0,
      opacity: 0,
      cursor: 'pointer',
      border: 0,
      padding: 0,
      margin: 0,
    },
  };
  // Render a raw DOM <input> on web only.
  const Tag = 'input' as unknown as React.ComponentType<typeof props>;
  return <Tag {...props} />;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f4',
  },
  arrowText: { fontSize: 14, color: '#44403c' },
  pressed: { opacity: 0.6 },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'relative',
    minHeight: 36,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1917',
  },
  todayBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnDisabled: { backgroundColor: '#e7e5e4' },
  todayText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  todayTextDisabled: { color: '#a8a29e' },
});
