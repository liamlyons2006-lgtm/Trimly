import assert from "node:assert/strict";
import test from "node:test";
import { RecurringTransactionFrequency, type TransactionStream } from "plaid";
import {
  mapFrequency,
  estimateNextChargeDate,
  streamToSuggestion,
  streamsToSuggestions,
} from "./plaid-mapping";

// Minimal stream fixture. The real Plaid TransactionStream has many fields the
// pure mapping logic never touches, so we cast a partial through unknown.
function makeStream(overrides: Partial<TransactionStream> = {}): TransactionStream {
  return {
    stream_id: "stream-1",
    merchant_name: "Netflix",
    description: "NETFLIX.COM",
    frequency: RecurringTransactionFrequency.Monthly,
    last_date: "2026-01-15",
    predicted_next_date: null,
    is_active: true,
    average_amount: { amount: 15.99, iso_currency_code: "USD" },
    last_amount: { amount: 15.99, iso_currency_code: "USD" },
    personal_finance_category: { primary: "ENTERTAINMENT", detailed: "" },
    ...overrides,
  } as unknown as TransactionStream;
}

test("mapFrequency maps Plaid frequencies to Trimly cycles", () => {
  assert.equal(mapFrequency("WEEKLY"), "weekly");
  assert.equal(mapFrequency("MONTHLY"), "monthly");
  assert.equal(mapFrequency("ANNUALLY"), "annual");
  // No exact Trimly cycle; monthly is the closest useful bucket.
  assert.equal(mapFrequency("BIWEEKLY"), "monthly");
  assert.equal(mapFrequency("SEMI_MONTHLY"), "monthly");
  // Unmappable frequencies are skipped, not guessed.
  assert.equal(mapFrequency("UNKNOWN"), null);
  assert.equal(mapFrequency("SOMETHING_ELSE"), null);
});

test("estimateNextChargeDate prefers a future predicted_next_date", () => {
  const now = new Date("2026-03-10T12:00:00");
  const stream = makeStream({ predicted_next_date: "2026-03-25", last_date: "2026-02-25" });
  assert.equal(estimateNextChargeDate(stream, "monthly", now), "2026-03-25");
});

test("estimateNextChargeDate rolls last_date forward when no usable prediction", () => {
  const now = new Date("2026-03-10T12:00:00");
  // Monthly charge last seen Jan 15 → next future occurrence is Mar 15.
  const stream = makeStream({ predicted_next_date: null, last_date: "2026-01-15" });
  assert.equal(estimateNextChargeDate(stream, "monthly", now), "2026-03-15");
});

test("estimateNextChargeDate ignores a past predicted date and rolls forward", () => {
  const now = new Date("2026-03-10T12:00:00");
  const stream = makeStream({ predicted_next_date: "2026-02-01", last_date: "2026-02-01" });
  assert.equal(estimateNextChargeDate(stream, "monthly", now), "2026-04-01");
});

test("streamToSuggestion produces a suggestion for an active mappable stream", () => {
  const now = new Date("2026-03-10T12:00:00");
  const suggestion = streamToSuggestion(makeStream(), now);
  assert.ok(suggestion);
  assert.equal(suggestion.plaidStreamId, "stream-1");
  assert.equal(suggestion.name, "Netflix");
  assert.equal(suggestion.merchant, "Netflix");
  assert.equal(suggestion.amount, 15.99);
  assert.equal(suggestion.amountCurrency, "USD");
  assert.equal(suggestion.billingCycle, "monthly");
  assert.equal(suggestion.category, "Entertainment");
  assert.equal(suggestion.nextChargeDate, "2026-03-15");
});

test("streamToSuggestion normalizes negative amounts to a positive charge", () => {
  const suggestion = streamToSuggestion(
    makeStream({ average_amount: { amount: -12.5, iso_currency_code: "EUR" } }),
  );
  assert.ok(suggestion);
  assert.equal(suggestion.amount, 12.5);
  assert.equal(suggestion.amountCurrency, "EUR");
});

test("streamToSuggestion falls back to description then a default name", () => {
  const noMerchant = streamToSuggestion(makeStream({ merchant_name: null }));
  assert.equal(noMerchant?.name, "NETFLIX.COM");
  const noName = streamToSuggestion(
    makeStream({ merchant_name: null, description: "" }),
  );
  assert.equal(noName?.name, "Recurring charge");
});

test("streamToSuggestion skips inactive, unmappable, and amount-less streams", () => {
  assert.equal(streamToSuggestion(makeStream({ is_active: false })), null);
  assert.equal(streamToSuggestion(makeStream({ frequency: "UNKNOWN" as never })), null);
  assert.equal(
    streamToSuggestion(
      makeStream({
        average_amount: { amount: undefined, iso_currency_code: "USD" },
        last_amount: { amount: undefined, iso_currency_code: "USD" },
      }),
    ),
    null,
  );
});

test("streamsToSuggestions filters unmappable streams and dedupes by stream_id", () => {
  const now = new Date("2026-03-10T12:00:00");
  const streams = [
    makeStream({ stream_id: "a" }),
    makeStream({ stream_id: "a" }), // duplicate id
    makeStream({ stream_id: "b", is_active: false }), // skipped
    makeStream({ stream_id: "c", frequency: RecurringTransactionFrequency.Weekly, last_date: "2026-03-01" }),
  ];
  const result = streamsToSuggestions(streams, now);
  assert.deepEqual(
    result.map((s) => s.plaidStreamId),
    ["a", "c"],
  );
});
