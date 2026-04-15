import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { isValid, login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isValid) return <Redirect href="/" />;

  const onPress = async () => {
    setPending(true);
    setError(null);
    try {
      await login();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Post-Partum Med Tracker</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        <Pressable
          onPress={onPress}
          disabled={pending}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            pending && styles.buttonDisabled,
          ]}
        >
          {pending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue with Discord</Text>
          )}
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 28,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#78716c',
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#5865F2',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
  },
});
