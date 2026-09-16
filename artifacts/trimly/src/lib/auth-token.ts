// Holds the shared server access token (see APP_AUTH_TOKEN on the API) in
// memory + localStorage, and notifies subscribers when it changes so the UI
// can react to it being set or cleared (e.g. after a 401).

const STORAGE_KEY = 'trimly-auth-token';

type Listener = () => void;
const listeners = new Set<Listener>();

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let token = readStoredToken();

export function getAuthToken(): string | null {
  return token;
}

export function setAuthToken(next: string | null): void {
  token = next && next.trim() ? next.trim() : null;
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the token still works for this session.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeAuthToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
