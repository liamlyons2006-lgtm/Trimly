import type { TransactionStream } from "plaid";

// Pure mapping helpers that turn Plaid recurring transaction streams into
// Trimly subscription suggestions. Kept free of Express/DB/Plaid-client
// concerns so the logic is unit-testable in isolation (Phase 7).

export type BillingCycle = "weekly" | "monthly" | "annual";

export type SubscriptionSuggestion = {
  plaidStreamId: string;
  name: string;
  merchant: string;
  amount: number;
  amountCurrency: string;
  billingCycle: BillingCycle;
  nextChargeDate: string; // YYYY-MM-DD
  category: string;
};

// Plaid frequency → Trimly billing cycle. BIWEEKLY and SEMI_MONTHLY have no
// exact Trimly equivalent; monthly is the closest useful bucket. UNKNOWN yields
// null so the stream is skipped rather than guessed.
export function mapFrequency(frequency: string): BillingCycle | null {
  switch (frequency) {
    case "WEEKLY":
      return "weekly";
    case "ANNUALLY":
      return "annual";
    case "MONTHLY":
    case "BIWEEKLY":
    case "SEMI_MONTHLY":
      return "monthly";
    default:
      return null;
  }
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function advance(date: Date, cycle: BillingCycle): Date {
  const next = new Date(date);
  if (cycle === "weekly") next.setDate(next.getDate() + 7);
  else if (cycle === "annual") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Estimates the next charge date. Prefers Plaid's predicted_next_date; otherwise
// rolls last_date forward by the billing cycle until it lands today or later.
export function estimateNextChargeDate(
  stream: Pick<TransactionStream, "predicted_next_date" | "last_date">,
  cycle: BillingCycle,
  now: Date = new Date(),
): string {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);

  const predicted = parseDate(stream.predicted_next_date);
  if (predicted && predicted >= today) return toIsoDate(predicted);

  const last = parseDate(stream.last_date) ?? today;
  let next = last;
  let guard = 0;
  while (next < today && guard < 5000) {
    next = advance(next, cycle);
    guard += 1;
  }
  return toIsoDate(next);
}

function pickAmount(stream: TransactionStream): number | null {
  const value =
    stream.average_amount?.amount ?? stream.last_amount?.amount ?? null;
  if (value === null || value === undefined) return null;
  // Outflow amounts can be reported as positive or negative depending on the
  // stream; Trimly stores a positive charge amount.
  const abs = Math.abs(value);
  return abs > 0 ? Math.round(abs * 100) / 100 : null;
}

function pickCurrency(stream: TransactionStream): string {
  return (
    stream.average_amount?.iso_currency_code ??
    stream.last_amount?.iso_currency_code ??
    "USD"
  );
}

function pickCategory(stream: TransactionStream): string {
  const pfc = stream.personal_finance_category?.primary;
  if (pfc) {
    // "FOOD_AND_DRINK" → "Food And Drink"
    return pfc
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return "Other";
}

function pickName(stream: TransactionStream): string {
  return (
    stream.merchant_name?.trim() ||
    stream.description?.trim() ||
    "Recurring charge"
  );
}

// Converts a single outflow stream into a suggestion. Returns null when the
// stream is inactive, has an unmappable frequency, or lacks a usable amount —
// callers filter these out.
export function streamToSuggestion(
  stream: TransactionStream,
  now: Date = new Date(),
): SubscriptionSuggestion | null {
  if (stream.is_active === false) return null;

  const cycle = mapFrequency(stream.frequency as unknown as string);
  if (!cycle) return null;

  const amount = pickAmount(stream);
  if (amount === null) return null;

  const name = pickName(stream);
  return {
    plaidStreamId: stream.stream_id,
    name,
    merchant: name,
    amount,
    amountCurrency: pickCurrency(stream),
    billingCycle: cycle,
    nextChargeDate: estimateNextChargeDate(stream, cycle, now),
    category: pickCategory(stream),
  };
}

// Maps a list of outflow streams into suggestions, dropping unmappable ones and
// de-duplicating by plaidStreamId.
export function streamsToSuggestions(
  streams: TransactionStream[],
  now: Date = new Date(),
): SubscriptionSuggestion[] {
  const seen = new Set<string>();
  const out: SubscriptionSuggestion[] = [];
  for (const stream of streams) {
    const suggestion = streamToSuggestion(stream, now);
    if (!suggestion) continue;
    if (seen.has(suggestion.plaidStreamId)) continue;
    seen.add(suggestion.plaidStreamId);
    out.push(suggestion);
  }
  return out;
}
