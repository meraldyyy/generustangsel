import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAdminActive: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; hasSession: boolean }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdminActive, setIsAdminActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const getAdminStatus = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('is_active')
      .eq('id', userId)
      .maybeSingle();

    return { isActive: data?.is_active === true, error };
  }, []);

  const loadAdminStatus = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    if (!nextSession) {
      setIsAdminActive(false);
      setLoading(false);
      return;
    }

    const { isActive } = await getAdminStatus(nextSession.user.id);
    setIsAdminActive(isActive);
    setLoading(false);
  }, [getAdminStatus]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => loadAdminStatus(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void loadAdminStatus(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadAdminStatus]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session) {
      const { isActive, error: profileError } = await getAdminStatus(data.session.user.id);
      if (profileError) {
        await supabase.auth.signOut();
        if (profileError.code === '42P01') {
          return { error: 'Database belum dikonfigurasi. Jalankan migration admin_profiles di Supabase.', hasSession: false };
        }
        return { error: `Validasi admin gagal: ${profileError.message}`, hasSession: false };
      }
      if (!isActive) {
        await supabase.auth.signOut();
        return { error: 'Akun ini belum terdaftar sebagai admin aktif.', hasSession: false };
      }
    }
    return { error: error?.message ?? null, hasSession: Boolean(data.session) };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdminActive, loading, signIn, resetPassword, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
