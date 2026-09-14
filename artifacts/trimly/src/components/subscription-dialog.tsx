import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTrimly } from '@/hooks/use-trimly';
import { currencyOptions, type Currency, type Subscription, type BillingCycle } from '@/lib/trimly';

type FormState = {
  name: string;
  merchant: string;
  amount: string;
  amountCurrency: Currency;
  billingCycle: BillingCycle;
  nextChargeDate: string;
  category: string;
  color: string;
};

type FieldErrors = Partial<Record<'name' | 'amount' | 'nextChargeDate', string>>;

const colors = ['#efb36c', '#c7db78', '#b7c3ef', '#e9a2a7', '#a7d8cf', '#d7b7ed', '#f3bbbd'];

const emptyForm = (currency: Currency): FormState => ({
  name: '', merchant: '', amount: '', amountCurrency: currency, billingCycle: 'monthly', nextChargeDate: '', category: 'Other', color: colors[0],
});

// Validation is centralised so the same rules drive both the inline messages
// and the submit guard. Returns a map of field -> message; empty means valid.
const validate = (form: FormState): FieldErrors => {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = 'Give this charge a name.';

  const amount = Number(form.amount);
  if (form.amount.trim() === '') errors.amount = 'Enter an amount.';
  else if (!Number.isFinite(amount)) errors.amount = 'Enter a valid number.';
  else if (amount <= 0) errors.amount = 'Amount must be greater than zero.';

  if (!form.nextChargeDate) errors.nextChargeDate = 'Pick the next charge date.';
  else if (Number.isNaN(new Date(`${form.nextChargeDate}T12:00:00`).getTime())) errors.nextChargeDate = 'That date is not valid.';

  return errors;
};

export function SubscriptionDialog({ open, initial, onClose, onSave }: { open: boolean; initial?: Subscription | null; onClose: () => void; onSave: (data: FormState) => void }) {
  const { preferences } = useTrimly();
  const [form, setForm] = useState<FormState>(() => emptyForm(preferences.currency));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setShowErrors(false);
    setErrors({});
    if (initial) {
      // Keep the amount in the entry's own currency so opening and saving an
      // edit never rewrites a stored amount through a reference FX rate.
      setForm({
        name: initial.name,
        merchant: initial.merchant,
        amount: initial.amount.toFixed(initial.amountCurrency === 'JPY' ? 0 : 2),
        amountCurrency: initial.amountCurrency,
        billingCycle: initial.billingCycle,
        nextChargeDate: initial.nextChargeDate,
        category: initial.category,
        color: initial.color,
      });
    } else {
      setForm(emptyForm(preferences.currency));
    }
  }, [initial, open, preferences.currency]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const update = (key: keyof FormState, value: string) => setForm((current) => {
    const next = { ...current, [key]: value } as FormState;
    if (showErrors) setErrors(validate(next));
    return next;
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setShowErrors(true);
      return;
    }
    onSave({ ...form, name: form.name.trim(), merchant: form.merchant.trim() || form.name.trim(), amount: form.amount });
  };

  const errorFor = (field: keyof FieldErrors) => (showErrors ? errors[field] : undefined);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-dialog-title">
        <div className="dialog-header">
          <div>
            <h2 id="subscription-dialog-title">{initial ? 'Edit subscription' : 'Add a subscription'}</h2>
            <p>{initial ? 'Keep the details current so your monthly picture stays honest.' : 'One charge at a time. Add the ones you want Trimly to remember.'}</p>
          </div>
          <button className="button button-quiet button-icon" onClick={onClose} aria-label="Close dialog" data-testid="button-close-subscription-dialog"><X size={17} /></button>
        </div>
        <form className="dialog-form" onSubmit={submit} noValidate>
          <div className="form-grid">
            <label className="form-label">Name
              <input className="field" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Morning Journal" data-testid="input-subscription-name" aria-invalid={Boolean(errorFor('name'))} />
              {errorFor('name') && <span className="field-error" data-testid="error-subscription-name">{errorFor('name')}</span>}
            </label>
            <label className="form-label">Merchant<input className="field" value={form.merchant} onChange={(event) => update('merchant', event.target.value)} placeholder="e.g. Journal Co." data-testid="input-subscription-merchant" /></label>
          </div>
          <div className="form-grid">
            <label className="form-label">Amount
              <input className="field" value={form.amount} onChange={(event) => update('amount', event.target.value)} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="12.00" data-testid="input-subscription-amount" aria-invalid={Boolean(errorFor('amount'))} />
              {errorFor('amount') && <span className="field-error" data-testid="error-subscription-amount">{errorFor('amount')}</span>}
            </label>
            <label className="form-label">Currency
              <select className="select-field" value={form.amountCurrency} onChange={(event) => update('amountCurrency', event.target.value)} data-testid="select-subscription-currency">
                {currencyOptions.map((option) => <option key={option.code} value={option.code}>{option.code} — {option.name}</option>)}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label className="form-label">Billing cycle<select className="select-field" value={form.billingCycle} onChange={(event) => update('billingCycle', event.target.value)} data-testid="select-subscription-cycle"><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="weekly">Weekly</option></select></label>
            <label className="form-label">Next charge
              <input className="field" value={form.nextChargeDate} onChange={(event) => update('nextChargeDate', event.target.value)} type="date" data-testid="input-subscription-date" aria-invalid={Boolean(errorFor('nextChargeDate'))} />
              {errorFor('nextChargeDate') && <span className="field-error" data-testid="error-subscription-date">{errorFor('nextChargeDate')}</span>}
            </label>
          </div>
          <label className="form-label">Category<input className="field" value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Entertainment" data-testid="input-subscription-category" /></label>
          <div className="form-label">Accent
            <div style={{ display: 'flex', gap: 8, paddingTop: 3 }}>
              {colors.map((color) => <button type="button" key={color} aria-label={`Choose color ${color}`} aria-pressed={form.color === color} onClick={() => update('color', color)} data-testid={`button-color-${color.slice(1)}`} style={{ width: 24, height: 24, borderRadius: 8, border: form.color === color ? '3px solid hsl(163 46% 32%)' : '2px solid transparent', background: color, cursor: 'pointer' }} />)}
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" className="button button-secondary" onClick={onClose} data-testid="button-cancel-subscription">Not now</button>
            <button type="submit" className="button button-primary" data-testid="button-save-subscription">{initial ? 'Save changes' : 'Add subscription'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
