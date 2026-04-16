import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { MedicineHistoryGrid } from '../components/MedicineHistoryGrid';
import { UpcomingDosesModal } from '../components/UpcomingDosesModal';

export default function Home() {
  const { ready, isValid, userName, logout } = useAuth();
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  if (!ready) return null;
  if (!isValid) return <Redirect href="/login" />;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Post-Partum Med Tracker</Text>
        <View style={styles.topBarRight}>
          <Pressable
            onPress={() => setUpcomingOpen(true)}
            style={({ pressed }) => [styles.upcoming, pressed && styles.pressed]}
          >
            <Text style={styles.upcomingText}>Upcoming</Text>
          </Pressable>
          {userName && (
            <Text style={styles.userName} numberOfLines={1}>
              {userName}
            </Text>
          )}
          <Pressable
            onPress={logout}
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <MedicineHistoryGrid />
      <UpcomingDosesModal
        visible={upcomingOpen}
        onClose={() => setUpcomingOpen(false)}
      />
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
  upcoming: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0ea5e9',
  },
  upcomingText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  logout: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f4',
  },
  logoutText: { fontSize: 12, color: '#44403c', fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
