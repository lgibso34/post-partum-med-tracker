import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthState = {
  isValid: boolean;
  isUnauthorized: boolean;
  userId: string | null;
  userName: string | null;
  discordId: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const ALLOWED_DISCORD_ID = '177936701082173440';

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
    await supabase.auth.signOut();
  };

  const discordId = extractDiscordId(session);
  const hasSession = ready && !!session;
  const isAllowed = discordId === ALLOWED_DISCORD_ID;
  const isValid = hasSession && isAllowed;
  const isUnauthorized = hasSession && !isAllowed;
  const userId = session?.user?.id ?? null;
  const userName = extractName(session);

  return (
    <AuthContext.Provider
      value={{ isValid, isUnauthorized, userId, userName, discordId, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
