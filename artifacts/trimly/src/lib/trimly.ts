export type BillingCycle = 'monthly' | 'annual' | 'weekly';
export type SubscriptionStatus = 'active' | 'cancelling' | 'cancelled';
export type SubscriptionSource = 'manual' | 'bank';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';

export type CurrencyOption = {
  code: Currency;
  name: string;
  locale: string;
};

export const currencyOptions: CurrencyOption[] = [
  { code: 'USD', name: 'US dollars', locale: 'en-US' },
  { code: 'EUR', name: 'Euros', locale: 'en-US' },
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
  amountCurrency: Currency;
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
export const HISTORY_KEY = 'trimly-spend-history-v1';

const day = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const seedSubscriptions: Subscription[] = [
  { id: 'seed-arc', name: 'Arcade Pass', merchant: 'Arcade Pass', amount: 8.99, amountCurrency: 'USD', billingCycle: 'monthly', nextChargeDate: day(2), category: 'Entertainment', status: 'active', reminderEnabled: true, source: 'manual', color: '#efb36c' },
  { id: 'seed-skill', name: 'Skillshare', merchant: 'Skillshare', amount: 32, amountCurrency: 'USD', billingCycle: 'monthly', nextChargeDate: day(6), category: 'Learning', status: 'active', reminderEnabled: true, source: 'manual', color: '#c7db78' },
  { id: 'seed-figma', name: 'Figma Professional', merchant: 'Figma', amount: 15, amountCurrency: 'USD', billingCycle: 'monthly', nextChargeDate: day(11), category: 'Work', status: 'active', reminderEnabled: false, source: 'manual', color: '#b7c3ef' },
  { id: 'seed-nyt', name: 'The Daily Edit', merchant: 'The Daily Edit', amount: 5, amountCurrency: 'USD', billingCycle: 'weekly', nextChargeDate: day(14), category: 'News', status: 'active', reminderEnabled: true, source: 'manual', color: '#e9a2a7' },
  { id: 'seed-headspace', name: 'Headspace', merchant: 'Headspace', amount: 69.99, amountCurrency: 'USD', billingCycle: 'annual', nextChargeDate: day(21), category: 'Wellbeing', status: 'active', reminderEnabled: true, source: 'manual', color: '#a7d8cf' },
  { id: 'seed-cloud', name: 'Cloud Harbor', merchant: 'Cloud Harbor', amount: 9.99, amountCurrency: 'USD', billingCycle: 'monthly', nextChargeDate: day(29), category: 'Utilities', status: 'cancelling', reminderEnabled: true, source: 'manual', color: '#d7b7ed' },
  { id: 'seed-music', name: 'Mellow Music', merchant: 'Mellow Music', amount: 10.99, amountCurrency: 'USD', billingCycle: 'monthly', nextChargeDate: day(39), category: 'Entertainment', status: 'active', reminderEnabled: true, source: 'manual', color: '#f3bbbd' },
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

// Reference rates keep the local-first MVP useful without pretending to provide
// live FX data. Stored amounts retain their original currency.
const currencyRates: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 149,
};

export const normalizeSubscription = (value: Subscription): Subscription => ({
  ...value,
  amountCurrency: isCurrency((value as Subscription & { amountCurrency?: unknown }).amountCurrency)
    ? (value as Subscription).amountCurrency
    : 'USD',
});

export const convertAmount = (value: number, from: Currency, to: Currency) =>
  value * (currencyRates[normalizeCurrency(to)] / currencyRates[normalizeCurrency(from)]);

const startOfToday = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date;
};

const advanceByCycle = (date: Date, cycle: BillingCycle): Date => {
  const next = new Date(date);
  if (cycle === 'weekly') next.setDate(next.getDate() + 7);
  else if (cycle === 'annual') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
};

// Rolls a charge date that has slipped into the past forward by its billing
// cycle until it lands today or later, so "next charge" always reads as the
// genuine next occurrence. Cancelled subscriptions and unparseable dates are
// left untouched.
export const rollForwardChargeDate = (
  subscription: Subscription,
  now: Date = startOfToday(),
): Subscription => {
  if (subscription.status === 'cancelled') return subscription;
  const parsed = new Date(`${subscription.nextChargeDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return subscription;
  if (parsed >= now) return subscription;

  let next = parsed;
  // Guard against an unexpected loop; a monthly cycle can only be a few
  // hundred iterations behind at most for any realistic data.
  let guard = 0;
  while (next < now && guard < 5000) {
    next = advanceByCycle(next, subscription.billingCycle);
    guard += 1;
  }
  return { ...subscription, nextChargeDate: next.toISOString().slice(0, 10) };
};

export const monthlyAmount = (subscription: Subscription) => {
  if (subscription.status === 'cancelled') return 0;
  if (subscription.billingCycle === 'annual') return subscription.amount / 12;
  if (subscription.billingCycle === 'weekly') return subscription.amount * 52 / 12;
  return subscription.amount;
};

export const annualAmount = (subscription: Subscription) => monthlyAmount(subscription) * 12;

export const monthlyAmountInCurrency = (subscription: Subscription, currency: Currency) =>
  convertAmount(monthlyAmount(subscription), subscription.amountCurrency, currency);

export const annualAmountInCurrency = (subscription: Subscription, currency: Currency) =>
  convertAmount(annualAmount(subscription), subscription.amountCurrency, currency);

export const formatMoney = (
  value: number,
  digits = 2,
  currency: Currency = defaultPreferences.currency,
  fromCurrency: Currency = currency,
) => {
  const option = currencyOptions.find((item) => item.code === normalizeCurrency(currency)) ?? currencyOptions[0];
  const fractionDigits = option.code === 'JPY' ? 0 : digits;
  const formatter = new Intl.NumberFormat(option.locale, {
    style: 'currency',
    currency: option.code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return formatter.format(convertAmount(value, fromCurrency, option.code));
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

// A single observed month of recurring spend. Amounts are always stored in USD
// (the app's base currency) so the display currency can change freely without
// rewriting recorded history.
export type SpendSnapshot = {
  month: string; // YYYY-MM
  amountUSD: number;
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const loadSpendHistory = (): SpendSnapshot[] =>
  safeRead<SpendSnapshot[]>(HISTORY_KEY, []);

// Records the current monthly total for this calendar month, replacing an
// existing entry for the same month. Keeps at most the last 12 months.
export const recordSpendSnapshot = (
  history: SpendSnapshot[],
  monthlyTotalUSD: number,
  now: Date = new Date(),
): SpendSnapshot[] => {
  const key = monthKey(now);
  const withoutCurrent = history.filter((entry) => entry.month !== key);
  const next = [...withoutCurrent, { month: key, amountUSD: monthlyTotalUSD }];
  next.sort((a, b) => a.month.localeCompare(b.month));
  return next.slice(-12);
};

// Returns exactly `count` months ending with the current month. Months with no
// recorded snapshot fall back to the current total so a fresh install still has
// a readable chart, but real observed months are used wherever available.
export const buildSpendSeries = (
  history: SpendSnapshot[],
  currentMonthlyUSD: number,
  count = 6,
  now: Date = new Date(),
): SpendSnapshot[] => {
  const byMonth = new Map(history.map((entry) => [entry.month, entry.amountUSD]));
  const series: SpendSnapshot[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date);
    const recorded = byMonth.get(key);
    series.push({ month: key, amountUSD: recorded ?? currentMonthlyUSD });
  }
  return series;
};

export const formatMonthLabel = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(year, (m ?? 1) - 1, 1));
};
