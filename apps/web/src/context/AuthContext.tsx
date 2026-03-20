import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Profile } from '@les/shared';

interface AuthState {
  user: { id: string } | null;
  profile: Profile | null;
  session: { access_token: string; refresh_token?: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<{ access_token: string; refresh_token?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<{ profile: Profile }>('/auth/me');
      setProfile(data.profile);
      return data.profile;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  const saveSession = useCallback((data: { user?: any; session?: any }) => {
    if (data.user) setUser(data.user);
    if (data.session) setSession(data.session);
    localStorage.setItem('les_demo_session', JSON.stringify(data));
  }, []);

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem('les_demo_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setSession(parsed.session);
        fetchProfile().finally(() => setLoading(false));
      } catch {
        localStorage.removeItem('les_demo_session');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [fetchProfile]);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!session?.access_token) return;

    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const refreshIn = expiresAt - Date.now() - 5 * 60 * 1000; // 5 min before expiry

      if (refreshIn <= 0) return; // Already expired or too close

      const timer = setTimeout(async () => {
        if (session.refresh_token) {
          try {
            const data = await api.post<{ session: any }>('/auth/refresh', { refresh_token: session.refresh_token });
            if (data.session) {
              saveSession({ user, session: data.session });
            }
          } catch {
            // Refresh failed — user will be prompted to login on next API call
          }
        }
      }, refreshIn);

      return () => clearTimeout(timer);
    } catch { /* invalid token format */ }
  }, [session, user, saveSession]);

  const signIn = async (email: string, password: string) => {
    const data = await api.post<{ user: { id: string }; session: { access_token: string; refresh_token?: string } }>('/auth/login', { email, password });
    saveSession(data);
    await fetchProfile();
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const data = await api.post<{ user: { id: string }; session: { access_token: string; refresh_token?: string } }>('/auth/signup', { email, password, full_name: fullName, role });
    saveSession(data);
    await fetchProfile();
  };

  const signOut = async () => {
    try { await api.post('/auth/logout'); } catch {}
    setUser(null);
    setProfile(null);
    setSession(null);
    localStorage.removeItem('les_demo_session');
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
