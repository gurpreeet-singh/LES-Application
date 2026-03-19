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

const DEMO_MODE = true; // Toggle this for Supabase vs demo

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
    if (DEMO_MODE) {
      // Check if we have a stored demo session
      const stored = localStorage.getItem('les_demo_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setSession(parsed.session);
        fetchProfile().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } else {
      // Supabase mode - would use supabase.auth.getSession()
      setLoading(false);
    }
  }, []);

  const signIn = async (_email: string, _password: string) => {
    if (DEMO_MODE) {
      const data = await api.post<{ user: { id: string }; session: { access_token: string } }>('/auth/login', { email: _email, password: _password });
      setUser(data.user);
      setSession(data.session);
      localStorage.setItem('les_demo_session', JSON.stringify(data));
      await fetchProfile();
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    if (DEMO_MODE) {
      const data = await api.post<{ user: { id: string }; session: { access_token: string } }>('/auth/signup', { email, password, full_name: fullName, role });
      setUser(data.user);
      setSession(data.session);
      localStorage.setItem('les_demo_session', JSON.stringify(data));
      await fetchProfile();
    }
  };

  const signOut = async () => {
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
