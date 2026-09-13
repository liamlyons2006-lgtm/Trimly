import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTrimly } from '@/hooks/use-trimly';
import type { Subscription, BillingCycle } from '@/lib/trimly';

type FormState = {
  name: string;
  merchant: string;
  amount: string;
  billingCycle: BillingCycle;
  nextChargeDate: string;
  category: string;
  color: string;
};

const colors = ['#efb36c', '#c7db78', '#b7c3ef', '#e9a2a7', '#a7d8cf', '#d7b7ed', '#f3bbbd'];

export function SubscriptionDialog({ open, initial, onClose, onSave }: { open: boolean; initial?: Subscription | null; onClose: () => void; onSave: (data: FormState) => void }) {
  const { preferences } = useTrimly();
  const [form, setForm] = useState<FormState>({
    name: '', merchant: '', amount: '', billingCycle: 'monthly', nextChargeDate: '', category: 'Other', color: colors[0],
  });

  useEffect(() => {
    if (initial) {
      setForm({ name: initial.name, merchant: initial.merchant, amount: String(initial.amount), billingCycle: initial.billingCycle, nextChargeDate: initial.nextChargeDate, category: initial.category, color: initial.color });
    } else {
      setForm({ name: '', merchant: '', amount: '', billingCycle: 'monthly', nextChargeDate: '', category: 'Other', color: colors[0] });
    }
  }, [initial, open]);

  if (!open) return null;
  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.amount || !form.nextChargeDate) return;
    onSave({ ...form, name: form.name.trim(), merchant: form.merchant.trim() || form.name.trim(), amount: form.amount });
  };

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
        <form className="dialog-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="form-label">Name<input className="field" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Morning Journal" data-testid="input-subscription-name" required /></label>
            <label className="form-label">Merchant<input className="field" value={form.merchant} onChange={(event) => update('merchant', event.target.value)} placeholder="e.g. Journal Co." data-testid="input-subscription-merchant" /></label>
          </div>
          <div className="form-grid">
            <label className="form-label">Amount (<span data-testid="text-subscription-amount-currency">{preferences.currency}</span>)<input className="field" value={form.amount} onChange={(event) => update('amount', event.target.value)} type="number" min="0.01" step="0.01" placeholder="12.00" data-testid="input-subscription-amount" required /></label>
            <label className="form-label">Billing cycle<select className="select-field" value={form.billingCycle} onChange={(event) => update('billingCycle', event.target.value)} data-testid="select-subscription-cycle"><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="weekly">Weekly</option></select></label>
          </div>
          <div className="form-grid">
            <label className="form-label">Next charge<input className="field" value={form.nextChargeDate} onChange={(event) => update('nextChargeDate', event.target.value)} type="date" data-testid="input-subscription-date" required /></label>
            <label className="form-label">Category<input className="field" value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Entertainment" data-testid="input-subscription-category" /></label>
          </div>
          <div className="form-label">Accent
            <div style={{ display: 'flex', gap: 8, paddingTop: 3 }}>
              {colors.map((color) => <button type="button" key={color} aria-label={`Choose color ${color}`} onClick={() => update('color', color)} data-testid={`button-color-${color.slice(1)}`} style={{ width: 24, height: 24, borderRadius: 8, border: form.color === color ? '3px solid hsl(163 46% 32%)' : '2px solid transparent', background: color, cursor: 'pointer' }} />)}
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