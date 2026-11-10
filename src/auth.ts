import { useSyncExternalStore } from 'react';

// The DRF token from `POST /api/auth/token/`, sent as `Authorization: Token <key>`.
// It doesn't expire server-side; it stays here until logout or a 401.
const KEY = 'director.auth';

export interface Session {
  token: string;
  username: string;
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    return typeof s.token === 'string' && s.token ? { token: s.token, username: String(s.username ?? '') } : null;
  } catch {
    return null;
  }
}

let session: Session | null = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getToken(): string | null {
  return session?.token ?? null;
}

export function setSession(next: Session | null) {
  session = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): keep the session in memory only.
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Log out / in across tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      session = load();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, () => session);
}

/** Revokes the token on the server (best effort), then drops the local session. */
export async function logout(revoke: () => Promise<unknown>) {
  try {
    await revoke();
  } catch {
    // Already invalid (401) or backend down: still log out locally.
  }
  setSession(null);
}
