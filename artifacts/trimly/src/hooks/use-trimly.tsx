import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  defaultPreferences,
  demoSubscriptions,
  PREFS_KEY,
  normalizePreferences,
  safeRead,
  STORAGE_KEY,
  type ReminderPreferences,
  type Subscription,
} from '@/lib/trimly';

type TrimlyContextValue = {
  subscriptions: Subscription[];
  preferences: ReminderPreferences;
  loading: boolean;
  addSubscription: (subscription: Omit<Subscription, 'id' | 'source'> & { source?: Subscription['source'] }) => void;
  updateSubscription: (id: string, updates: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  resetData: () => void;
  updatePreferences: (updates: Partial<ReminderPreferences>) => void;
};

const TrimlyContext = createContext<TrimlyContextValue | null>(null);

export function TrimlyProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [preferences, setPreferences] = useState<ReminderPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = safeRead<Subscription[] | null>(STORAGE_KEY, null);
    const storedPrefs = safeRead<Partial<ReminderPreferences> | null>(PREFS_KEY, null);
    setSubscriptions(stored ?? demoSubscriptions);
    setPreferences(normalizePreferences(storedPrefs));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
  }, [subscriptions, loading]);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }, [preferences, loading]);

  const addSubscription = useCallback((subscription: Omit<Subscription, 'id' | 'source'> & { source?: Subscription['source'] }) => {
    setSubscriptions((current) => [{ ...subscription, id: `manual-${Date.now()}`, source: subscription.source ?? 'manual' }, ...current]);
  }, []);

  const updateSubscription = useCallback((id: string, updates: Partial<Subscription>) => {
    setSubscriptions((current) => current.map((item) => item.id === id ? { ...item, ...updates, source: item.source === 'demo' ? 'manual' : item.source } : item));
  }, []);

  const deleteSubscription = useCallback((id: string) => {
    setSubscriptions((current) => current.filter((item) => item.id !== id));
  }, []);

  const resetData = useCallback(() => {
    setSubscriptions(demoSubscriptions);
    setPreferences(defaultPreferences);
  }, []);

  const updatePreferences = useCallback((updates: Partial<ReminderPreferences>) => {
    setPreferences((current) => ({ ...current, ...updates }));
  }, []);

  const value = useMemo(() => ({ subscriptions, preferences, loading, addSubscription, updateSubscription, deleteSubscription, resetData, updatePreferences }), [subscriptions, preferences, loading, addSubscription, updateSubscription, deleteSubscription, resetData, updatePreferences]);
  return <TrimlyContext.Provider value={value}>{children}</TrimlyContext.Provider>;
}

export function useTrimly() {
  const context = useContext(TrimlyContext);
  if (!context) throw new Error('useTrimly must be used within TrimlyProvider');
  return context;
}