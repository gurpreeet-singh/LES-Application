import { toast } from '../components/shared/Toast';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('les_demo_session');
    return stored ? JSON.parse(stored)?.session?.access_token : null;
  } catch { return null; }
}

function isTokenExpiringSoon(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000;
    return expiry - Date.now() < 5 * 60 * 1000; // < 5 min remaining
  } catch { return false; }
}

async function refreshToken(): Promise<boolean> {
  try {
    const stored = localStorage.getItem('les_demo_session');
    const refreshToken = stored ? JSON.parse(stored)?.session?.refresh_token : null;
    if (!refreshToken) return false;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.session) {
      const current = JSON.parse(localStorage.getItem('les_demo_session') || '{}');
      current.session = data.session;
      localStorage.setItem('les_demo_session', JSON.stringify(current));
      return true;
    }
    return false;
  } catch { return false; }
}

function clearSessionAndRedirect(message?: string) {
  localStorage.removeItem('les_demo_session');
  const msg = message || 'Session expired. Please sign in again.';
  // Only redirect if not already on login page
  if (!window.location.pathname.includes('/login')) {
    window.location.href = `/login?message=${encodeURIComponent(msg)}`;
  }
}

async function request<T>(path: string, options?: RequestInit, retryCount = 0): Promise<T> {
  // Auto-refresh token if expiring soon
  if (isTokenExpiringSoon()) {
    await refreshToken();
  }

  const token = getToken();
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (res.status === 401) {
      // Try refreshing token once
      if (retryCount === 0) {
        const refreshed = await refreshToken();
        if (refreshed) {
          return request<T>(path, options, 1); // Retry with new token
        }
      }
      clearSessionAndRedirect();
      throw new Error('Session expired');
    }

    if (res.status === 403) {
      toast('You don\'t have permission to access this resource.', 'error');
      throw new Error('Access denied');
    }

    if (res.status === 429) {
      toast('Too many requests. Please wait a moment.', 'warning');
      throw new Error('Rate limited');
    }

    if (res.status >= 500) {
      // Retry once for server errors
      if (retryCount === 0) {
        await new Promise(r => setTimeout(r, 2000));
        return request<T>(path, options, 1);
      }
      toast('Server error. Please try again later.', 'error');
      const body = await res.json().catch(() => ({ error: 'Server error' }));
      throw new Error(body.error || 'Server error');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      // Network error
      toast('Connection lost. Please check your internet.', 'error');
      throw new Error('Network error');
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
