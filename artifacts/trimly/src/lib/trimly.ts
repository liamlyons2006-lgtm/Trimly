export type BillingCycle = 'monthly' | 'annual' | 'weekly';
export type SubscriptionStatus = 'active' | 'cancelling' | 'cancelled';
export type SubscriptionSource = 'demo' | 'manual' | 'bank';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';

export type CurrencyOption = {
  code: Currency;
  name: string;
  locale: string;
};

export const currencyOptions: CurrencyOption[] = [
  { code: 'USD', name: 'US dollars', locale: 'en-US' },
  { code: 'EUR', name: 'Euros', locale: 'de-DE' },
  { code: 'GBP', name: 'Pounds sterling', locale: 'en-GB' },
  { code: 'CAD', name: 'Canadian dollars', locale: 'en-CA' },
  { code: 'AUD', name: 'Australian dollars', locale: 'en-AU' },
  { code: 'JPY', name: 'Japanese yen', locale: 'ja-JP' },
];

export type Subscription = {
  id: string;
  name: string;
  merchant: string;
  amount: number;
  billingCycle: BillingCycle;
  nextChargeDate: string;
  category: string;
  status: SubscriptionStatus;
  reminderEnabled: boolean;
  source: SubscriptionSource;
  color: string;
};

export type ReminderPreferences = {
  email: boolean;
  sevenDays: boolean;
  oneDay: boolean;
  cancelling: boolean;
  currency: Currency;
};

export const STORAGE_KEY = 'trimly-subscriptions-v1';
export const PREFS_KEY = 'trimly-preferences-v1';

const day = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const demoSubscriptions: Subscription[] = [
  { id: 'demo-arc', name: 'Arcade Pass', merchant: 'Arcade Pass', amount: 8.99, billingCycle: 'monthly', nextChargeDate: day(2), category: 'Entertainment', status: 'active', reminderEnabled: true, source: 'demo', color: '#efb36c' },
  { id: 'demo-skill', name: 'Skillshare', merchant: 'Skillshare', amount: 32, billingCycle: 'monthly', nextChargeDate: day(6), category: 'Learning', status: 'active', reminderEnabled: true, source: 'demo', color: '#c7db78' },
  { id: 'demo-figma', name: 'Figma Professional', merchant: 'Figma', amount: 15, billingCycle: 'monthly', nextChargeDate: day(11), category: 'Work', status: 'active', reminderEnabled: false, source: 'demo', color: '#b7c3ef' },
  { id: 'demo-nyt', name: 'The Daily Edit', merchant: 'The Daily Edit', amount: 5, billingCycle: 'weekly', nextChargeDate: day(14), category: 'News', status: 'active', reminderEnabled: true, source: 'demo', color: '#e9a2a7' },
  { id: 'demo-headspace', name: 'Headspace', merchant: 'Headspace', amount: 69.99, billingCycle: 'annual', nextChargeDate: day(21), category: 'Wellbeing', status: 'active', reminderEnabled: true, source: 'demo', color: '#a7d8cf' },
  { id: 'demo-cloud', name: 'Cloud Harbor', merchant: 'Cloud Harbor', amount: 9.99, billingCycle: 'monthly', nextChargeDate: day(29), category: 'Utilities', status: 'cancelling', reminderEnabled: true, source: 'demo', color: '#d7b7ed' },
  { id: 'demo-music', name: 'Mellow Music', merchant: 'Mellow Music', amount: 10.99, billingCycle: 'monthly', nextChargeDate: day(39), category: 'Entertainment', status: 'active', reminderEnabled: true, source: 'demo', color: '#f3bbbd' },
];

export const defaultPreferences: ReminderPreferences = {
  email: true,
  sevenDays: true,
  oneDay: true,
  cancelling: true,
  currency: 'USD',
};

export const isCurrency = (value: unknown): value is Currency =>
  typeof value === 'string' && currencyOptions.some((option) => option.code === value);

export const normalizeCurrency = (value: unknown): Currency =>
  isCurrency(value) ? value : defaultPreferences.currency;

export const normalizePreferences = (value: Partial<ReminderPreferences> | null | undefined): ReminderPreferences => ({
  ...defaultPreferences,
  ...(value ?? {}),
  currency: normalizeCurrency(value?.currency),
});

export const monthlyAmount = (subscription: Subscription) => {
  if (subscription.status === 'cancelled') return 0;
  if (subscription.billingCycle === 'annual') return subscription.amount / 12;
  if (subscription.billingCycle === 'weekly') return subscription.amount * 52 / 12;
  return subscription.amount;
};

export const annualAmount = (subscription: Subscription) => monthlyAmount(subscription) * 12;

export const formatMoney = (value: number, digits = 2, currency: Currency = defaultPreferences.currency) => {
  const option = currencyOptions.find((item) => item.code === normalizeCurrency(currency)) ?? currencyOptions[0];
  const fractionDigits = option.code === 'JPY' ? 0 : digits;
  return new Intl.NumberFormat(option.locale, {
    style: 'currency',
    currency: option.code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));

export const formatCycle = (cycle: BillingCycle) =>
  cycle === 'monthly' ? 'per month' : cycle === 'annual' ? 'per year' : 'per week';

export const safeRead = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

export const loadPreferences = (): ReminderPreferences =>
  normalizePreferences(safeRead<Partial<ReminderPreferences> | null>(PREFS_KEY, null));

export const resetPreferences = (): ReminderPreferences => ({ ...defaultPreferences });
