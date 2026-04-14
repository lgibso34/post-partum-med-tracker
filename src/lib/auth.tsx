import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthState = {
  isValid: boolean;
  userId: string | null;
  userName: string | null;
  discordId: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const DEV_SKIP_LOGIN = false // __DEV__ && process.env.EXPO_PUBLIC_SKIP_LOGIN === '1';

function extractDiscordId(session: Session | null): string | null {
  if (!session?.user) return null;
  const ident = session.user.identities?.find((i) => i.provider === 'discord');
  return (ident?.identity_data?.provider_id as string | undefined) ?? null;
}

function extractName(session: Session | null): string | null {
  const u = session?.user;
  if (!u) return null;
  return (
    (u.user_metadata?.full_name as string | undefined) ??
    (u.user_metadata?.name as string | undefined) ??
    (u.user_metadata?.user_name as string | undefined) ??
    u.email ??
    null
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(DEV_SKIP_LOGIN);

  useEffect(() => {
    if (DEV_SKIP_LOGIN) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async () => {
    const redirectTo =
      typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo },
    });
    if (error) throw error;
  };

  const logout = async () => {
    if (DEV_SKIP_LOGIN) return;
    await supabase.auth.signOut();
  };

  const isValid = DEV_SKIP_LOGIN || (ready && !!session);
  const userId = DEV_SKIP_LOGIN ? 'dev-user' : session?.user?.id ?? null;
  const userName = DEV_SKIP_LOGIN ? 'Dev User' : extractName(session);
  const discordId = DEV_SKIP_LOGIN ? null : extractDiscordId(session);

  return (
    <AuthContext.Provider value={{ isValid, userId, userName, discordId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
