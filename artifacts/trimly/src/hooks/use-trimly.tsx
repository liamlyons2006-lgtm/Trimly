import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  defaultPreferences,
  seedSubscriptions,
  HISTORY_KEY,
  loadPreferences,
  loadSpendHistory,
  monthlyAmountInCurrency,
  PREFS_KEY,
  recordSpendSnapshot,
  resetPreferences,
  rollForwardChargeDate,
  safeRead,
  STORAGE_KEY,
  type ReminderPreferences,
  type SpendSnapshot,
  type Subscription,
  type Currency,
  normalizeSubscription,
} from '@/lib/trimly';

type TrimlyContextValue = {
  subscriptions: Subscription[];
  preferences: ReminderPreferences;
  loading: boolean;
  addSubscription: (subscription: Omit<Subscription, 'id' | 'source' | 'amountCurrency'> & { source?: Subscription['source']; amountCurrency?: Currency }) => void;
  updateSubscription: (id: string, updates: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  resetData: () => void;
  updatePreferences: (updates: Partial<ReminderPreferences>) => void;
  spendHistory: SpendSnapshot[];
};

const TrimlyContext = createContext<TrimlyContextValue | null>(null);

export function TrimlyProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [preferences, setPreferences] = useState<ReminderPreferences>(defaultPreferences);
  const [spendHistory, setSpendHistory] = useState<SpendSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = safeRead<Subscription[] | null>(STORAGE_KEY, null);
    const initial = (stored?.map(normalizeSubscription) ?? seedSubscriptions).map((item) =>
      rollForwardChargeDate(item),
    );
    setSubscriptions(initial);
    setPreferences(loadPreferences());
    setSpendHistory(loadSpendHistory());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
  }, [subscriptions, loading]);

  // Record this month's recurring total (in the base currency) whenever the
  // subscription set changes, so the charts reflect genuinely observed months
  // rather than a projection of today's number.
  useEffect(() => {
    if (loading) return;
    const monthlyUSD = subscriptions
      .filter((item) => item.status !== 'cancelled')
      .reduce((sum, item) => sum + monthlyAmountInCurrency(item, 'USD'), 0);
    setSpendHistory((current) => {
      const next = recordSpendSnapshot(current, monthlyUSD);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [subscriptions, loading]);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }, [preferences, loading]);

  const addSubscription = useCallback((subscription: Omit<Subscription, 'id' | 'source' | 'amountCurrency'> & { source?: Subscription['source']; amountCurrency?: Currency }) => {
    setSubscriptions((current) => [{ ...subscription, id: `manual-${Date.now()}`, amountCurrency: subscription.amountCurrency ?? preferences.currency, source: subscription.source ?? 'manual' }, ...current]);
  }, [preferences.currency]);

  const updateSubscription = useCallback((id: string, updates: Partial<Subscription>) => {
    setSubscriptions((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const deleteSubscription = useCallback((id: string) => {
    setSubscriptions((current) => current.filter((item) => item.id !== id));
  }, []);

  const resetData = useCallback(() => {
    setSubscriptions(seedSubscriptions.map((item) => rollForwardChargeDate(item)));
    setPreferences(resetPreferences());
    setSpendHistory([]);
    window.localStorage.removeItem(HISTORY_KEY);
  }, []);

  const updatePreferences = useCallback((updates: Partial<ReminderPreferences>) => {
    setPreferences((current) => ({ ...current, ...updates }));
  }, []);

  const value = useMemo(() => ({ subscriptions, preferences, loading, addSubscription, updateSubscription, deleteSubscription, resetData, updatePreferences, spendHistory }), [subscriptions, preferences, loading, addSubscription, updateSubscription, deleteSubscription, resetData, updatePreferences, spendHistory]);
  return <TrimlyContext.Provider value={value}>{children}</TrimlyContext.Provider>;
}

export function useTrimly() {
  const context = useContext(TrimlyContext);
  if (!context) throw new Error('useTrimly must be used within TrimlyProvider');
  return context;
}