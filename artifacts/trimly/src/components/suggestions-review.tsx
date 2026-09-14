import { useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useTrimly } from '@/hooks/use-trimly';
import { formatCycle, formatMoney, normalizeCurrency } from '@/lib/trimly';
import type { SubscriptionSuggestion } from '@/hooks/use-plaid';

const colors = ['#efb36c', '#c7db78', '#b7c3ef', '#e9a2a7', '#a7d8cf', '#d7b7ed', '#f3bbbd'];

// A soft duplicate check: an existing subscription with the same (case-insensitive)
// name and a near-identical amount is treated as already tracked, so re-syncing or
// overlapping detections don't nudge the user to add the same charge twice.
function isLikelyDuplicate(
  suggestion: SubscriptionSuggestion,
  existing: { name: string; amount: number }[],
): boolean {
  const name = suggestion.name.trim().toLowerCase();
  return existing.some(
    (item) =>
      item.name.trim().toLowerCase() === name &&
      Math.abs(item.amount - suggestion.amount) < 0.01,
  );
}

// Lets the user review recurring charges Plaid detected and add the ones they
// want. Nothing is added automatically — each is an explicit choice, and added
// items are tagged source: 'bank'.
export function SuggestionsReview({
  suggestions,
  onClear,
}: {
  suggestions: SubscriptionSuggestion[];
  onClear: () => void;
}) {
  const { subscriptions, addSubscription, preferences } = useTrimly();
  // Track which suggestions have been added this session so the row can reflect it.
  const [added, setAdded] = useState<Set<string>>(new Set());

  const existing = useMemo(
    () => subscriptions.map((s) => ({ name: s.name, amount: s.amount })),
    [subscriptions],
  );

  if (suggestions.length === 0) return null;

  const addOne = (suggestion: SubscriptionSuggestion, index: number) => {
    addSubscription({
      name: suggestion.name,
      merchant: suggestion.merchant,
      amount: suggestion.amount,
      amountCurrency: normalizeCurrency(suggestion.amountCurrency),
      billingCycle: suggestion.billingCycle,
      nextChargeDate: suggestion.nextChargeDate,
      category: suggestion.category,
      status: 'active',
      reminderEnabled: true,
      source: 'bank',
      color: colors[index % colors.length],
    });
    setAdded((current) => new Set(current).add(suggestion.plaidStreamId));
  };

  const remaining = suggestions.filter(
    (s) => !added.has(s.plaidStreamId) && !isLikelyDuplicate(s, existing),
  );

  return (
    <div className="suggestions-panel" data-testid="suggestions-review">
      <div className="suggestions-head">
        <div>
          <h4>Detected recurring charges</h4>
          <p>
            {remaining.length > 0
              ? `${remaining.length} to review. Add the ones you want to track.`
              : 'All caught up — nothing new to add.'}
          </p>
        </div>
        <button
          className="button button-quiet button-small"
          onClick={onClear}
          data-testid="button-dismiss-suggestions"
        >
          <X size={12} /> Dismiss
        </button>
      </div>
      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => {
          const isAdded = added.has(suggestion.plaidStreamId);
          const dup = !isAdded && isLikelyDuplicate(suggestion, existing);
          return (
            <div
              className="suggestion-row"
              key={suggestion.plaidStreamId}
              data-testid={`suggestion-${suggestion.plaidStreamId}`}
            >
              <div
                className="merchant-avatar"
                style={{ background: colors[index % colors.length] }}
                aria-hidden="true"
              >
                {suggestion.merchant.slice(0, 1).toUpperCase()}
              </div>
              <div className="suggestion-main">
                <p className="suggestion-name">{suggestion.name}</p>
                <p className="suggestion-meta">
                  {suggestion.category} ·{' '}
                  {formatMoney(
                    suggestion.amount,
                    2,
                    preferences.currency,
                    normalizeCurrency(suggestion.amountCurrency),
                  )}{' '}
                  {formatCycle(suggestion.billingCycle)}
                </p>
              </div>
              {isAdded ? (
                <span className="suggestion-added" data-testid={`suggestion-added-${suggestion.plaidStreamId}`}>
                  <Check size={13} /> Added
                </span>
              ) : dup ? (
                <span className="suggestion-added" title="You already track a matching charge">
                  Already tracked
                </span>
              ) : (
                <button
                  className="button button-secondary button-small"
                  onClick={() => addOne(suggestion, index)}
                  data-testid={`button-add-suggestion-${suggestion.plaidStreamId}`}
                >
                  <Plus size={12} /> Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
