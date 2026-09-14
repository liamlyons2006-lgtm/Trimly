import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSpendSeries,
  formatMoney,
  loadPreferences,
  monthlyAmount,
  normalizePreferences,
  PREFS_KEY,
  recordSpendSnapshot,
  resetPreferences,
  rollForwardChargeDate,
  type Currency,
  type Subscription,
} from './trimly';

type LocalStorageStub = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const createLocalStorage = (initial: Record<string, string> = {}): LocalStorageStub => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

const withLocalStorage = (localStorage: LocalStorageStub, callback: () => void) => {
  const previousWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
  (globalThis as typeof globalThis & { window: { localStorage: LocalStorageStub } }).window = { localStorage };
  try {
    callback();
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as typeof globalThis & { window?: unknown }).window;
    } else {
      (globalThis as typeof globalThis & { window?: unknown }).window = previousWindow;
    }
  }
};

test('missing stored currency falls back to USD', () => {
  withLocalStorage(createLocalStorage(), () => {
    assert.equal(loadPreferences().currency, 'USD');
  });
});

test('invalid stored currency falls back to USD', () => {
  withLocalStorage(createLocalStorage({
    [PREFS_KEY]: JSON.stringify({ currency: 'CHF' }),
  }), () => {
    assert.equal(loadPreferences().currency, 'USD');
    assert.equal(normalizePreferences({ currency: 'not-a-currency' as Currency }).currency, 'USD');
  });
});

test('saved currency is restored from localStorage', () => {
  withLocalStorage(createLocalStorage({
    [PREFS_KEY]: JSON.stringify({ currency: 'EUR', email: false }),
  }), () => {
    const preferences = loadPreferences();
    assert.equal(preferences.currency, 'EUR');
    assert.equal(preferences.email, false);
  });
});

test('resetting preferences returns the display currency to USD', () => {
  assert.equal(resetPreferences().currency, 'USD');
});

test('summary and detail amounts use the expected currency precision', () => {
  const expected = [
    { currency: 'USD' as const, summary: '$1,235', detail: '$1,234.56' },
    { currency: 'EUR' as const, summary: '€1,235', detail: '€1,234.56' },
    { currency: 'JPY' as const, summary: '￥1,235', detail: '￥1,235' },
  ];

  for (const { currency, summary, detail } of expected) {
    assert.equal(formatMoney(1234.56, 0, currency), summary, `${currency} summary`);
    assert.equal(formatMoney(1234.56, 2, currency), detail, `${currency} detail`);
  }
});

const baseSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'test',
  name: 'Test',
  merchant: 'Test',
  amount: 10,
  amountCurrency: 'USD',
  billingCycle: 'monthly',
  nextChargeDate: '2026-01-15',
  category: 'Other',
  status: 'active',
  reminderEnabled: false,
  source: 'manual',
  color: '#000000',
  ...overrides,
});

test('monthly amount normalizes billing cycles', () => {
  assert.equal(monthlyAmount(baseSubscription({ amount: 12, billingCycle: 'monthly' })), 12);
  assert.equal(monthlyAmount(baseSubscription({ amount: 120, billingCycle: 'annual' })), 10);
  assert.equal(monthlyAmount(baseSubscription({ amount: 10, billingCycle: 'weekly' })), 10 * 52 / 12);
  assert.equal(monthlyAmount(baseSubscription({ amount: 99, status: 'cancelled' })), 0);
});

test('rollForwardChargeDate advances a past monthly date into the future', () => {
  const now = new Date('2026-03-10T12:00:00');
  const rolled = rollForwardChargeDate(baseSubscription({ nextChargeDate: '2026-01-15' }), now);
  assert.equal(rolled.nextChargeDate, '2026-03-15');
});

test('rollForwardChargeDate leaves a future date untouched', () => {
  const now = new Date('2026-03-10T12:00:00');
  const rolled = rollForwardChargeDate(baseSubscription({ nextChargeDate: '2026-04-01' }), now);
  assert.equal(rolled.nextChargeDate, '2026-04-01');
});

test('rollForwardChargeDate does not touch cancelled subscriptions', () => {
  const now = new Date('2026-03-10T12:00:00');
  const sub = baseSubscription({ nextChargeDate: '2025-01-01', status: 'cancelled' });
  assert.equal(rollForwardChargeDate(sub, now).nextChargeDate, '2025-01-01');
});

test('recordSpendSnapshot replaces the current month and caps at 12 entries', () => {
  const now = new Date('2026-03-10T12:00:00');
  const once = recordSpendSnapshot([], 100, now);
  assert.deepEqual(once, [{ month: '2026-03', amountUSD: 100 }]);
  const twice = recordSpendSnapshot(once, 150, now);
  assert.deepEqual(twice, [{ month: '2026-03', amountUSD: 150 }]);

  let history = twice;
  for (let i = 0; i < 20; i += 1) {
    history = recordSpendSnapshot(history, i, new Date(2024, i, 1));
  }
  assert.equal(history.length, 12);
});

test('buildSpendSeries returns count months using recorded values with fallback', () => {
  const now = new Date('2026-03-10T12:00:00');
  const history = [{ month: '2026-02', amountUSD: 90 }];
  const series = buildSpendSeries(history, 100, 3, now);
  assert.deepEqual(series.map((point) => point.month), ['2026-01', '2026-02', '2026-03']);
  assert.equal(series[0].amountUSD, 100); // no record -> fallback to current
  assert.equal(series[1].amountUSD, 90); // recorded value used
  assert.equal(series[2].amountUSD, 100); // current month fallback
});
