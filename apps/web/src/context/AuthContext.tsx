import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Profile } from '@les/shared';

interface AuthState {
  user: { id: string } | null;
  profile: Profile | null;
  session: { access_token: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Auto-detect: if API URL contains 'localhost', use demo mode
const API_URL = import.meta.env.VITE_API_URL || '';
const DEMO_MODE = API_URL.includes('localhost') || API_URL === '' || API_URL.includes('127.0.0.1');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile() {
    try {
      const data = await api.get<{ profile: Profile }>('/auth/me');
      setProfile(data.profile);
      return data.profile;
    } catch {
      setProfile(null);
      return null;
    }
  }

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
  }, []);

  const signIn = async (email: string, password: string) => {
    if (DEMO_MODE) {
      const data = await api.post<{ user: { id: string }; session: { access_token: string } }>('/auth/login', { email, password });
      setUser(data.user);
      setSession(data.session);
      localStorage.setItem('les_demo_session', JSON.stringify(data));
      await fetchProfile();
    } else {
      // Real Supabase auth
      const data = await api.post<{ user: { id: string }; session: { access_token: string } }>('/auth/login', { email, password });
      setUser(data.user);
      setSession(data.session);
      localStorage.setItem('les_demo_session', JSON.stringify(data));
      await fetchProfile();
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const data = await api.post<{ user: { id: string }; session: { access_token: string } }>('/auth/signup', { email, password, full_name: fullName, role });
    setUser(data.user);
    setSession(data.session);
    localStorage.setItem('les_demo_session', JSON.stringify(data));
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
