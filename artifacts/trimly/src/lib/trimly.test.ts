import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatMoney,
  loadPreferences,
  normalizePreferences,
  PREFS_KEY,
  resetPreferences,
  type Currency,
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
    { currency: 'EUR' as const, summary: '1.235 €', detail: '1.234,56 €' },
    { currency: 'JPY' as const, summary: '￥1,235', detail: '￥1,235' },
  ];

  for (const { currency, summary, detail } of expected) {
    assert.equal(formatMoney(1234.56, 0, currency), summary, `${currency} summary`);
    assert.equal(formatMoney(1234.56, 2, currency), detail, `${currency} detail`);
  }
});