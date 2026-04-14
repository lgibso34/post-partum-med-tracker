import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useAppStore } from '../stores/appStore';
import { useDosesForDate, useMedicines } from '../lib/queries';
import { DateBar } from '../components/DateBar';
import { MedicineColumn } from '../components/MedicineColumn';
import { AddMedicineCard } from '../components/AddMedicineCard';

const GAP = 12;
const H_PAD = 16;

function columnCountFor(width: number): number {
  if (width < 600) return 1;
  if (width < 900) return 3;
  if (width < 1200) return 4;
  return 5;
}

export default function Tracker() {
  const { userName, logout } = useAuth();
  const router = useRouter();
  const selectedDate = useAppStore((s) => s.selectedDate);
  const { width } = useWindowDimensions();
  const medicinesQ = useMedicines();
  const dosesQ = useDosesForDate(selectedDate);

  const cols = columnCountFor(width);
  const available = width - H_PAD * 2;
  const columnWidth = Math.floor((available - GAP * (cols - 1)) / cols);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Post-Partum Med Tracker</Text>
        <View style={styles.topBarRight}>
          {userName && <Text style={styles.userName} numberOfLines={1}>{userName}</Text>}
          <Pressable
            onPress={() => router.push('/history')}
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
          >
            <Text style={styles.navBtnText}>History</Text>
          </Pressable>
          <Pressable
            onPress={logout}
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <DateBar />

      <ScrollView contentContainerStyle={styles.scroll}>
        {medicinesQ.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading medicines…</Text>
          </View>
        ) : medicinesQ.isError ? (
          <View style={styles.loading}>
            <Text style={styles.error}>Failed to load medicines</Text>
            <Text style={styles.errorHint}>{(medicinesQ.error as Error).message}</Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap: GAP }]}>
            {medicinesQ.data?.map((m) => (
              <MedicineColumn
                key={m.id}
                medicine={m}
                doses={dosesQ.data?.byMedicine[m.id] ?? []}
                date={selectedDate}
                width={columnWidth}
              />
            ))}
            <AddMedicineCard width={columnWidth} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  brand: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1917',
    flexShrink: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userName: {
    fontSize: 12,
    color: '#78716c',
    maxWidth: 120,
  },
  logout: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f4',
  },
  logoutText: { fontSize: 12, color: '#44403c', fontWeight: '600' },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
  },
  navBtnText: { fontSize: 12, color: '#0369a1', fontWeight: '600' },
  pressed: { opacity: 0.6 },
  scroll: {
    padding: H_PAD,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  loadingText: { fontSize: 13, color: '#78716c' },
  error: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  errorHint: { fontSize: 12, color: '#78716c' },
});
