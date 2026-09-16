import { useSyncExternalStore } from 'react';
import { getAuthToken, subscribeAuthToken } from '@/lib/auth-token';

export function useAuthToken(): string | null {
  return useSyncExternalStore(subscribeAuthToken, getAuthToken);
}
