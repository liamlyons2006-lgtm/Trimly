import { Bell, BellOff, Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Subscription } from '@/lib/trimly';
import { formatCycle, formatDate, formatMoney } from '@/lib/trimly';

export function SubscriptionRow({ subscription, onEdit, onDelete, onReminder, onStatus }: { subscription: Subscription; onEdit: () => void; onDelete: () => void; onReminder: () => void; onStatus: () => void }) {
  const initials = subscription.merchant.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const isCancelled = subscription.status === 'cancelled';
  return (
    <article className="subscription-row" data-testid={`row-subscription-${subscription.id}`}>
      <div className="merchant-avatar" style={{ background: subscription.color }} aria-hidden="true">{initials}</div>
      <div className="subscription-main">
        <div className="subscription-name-line">
          <h3 className="subscription-name" data-testid={`text-subscription-name-${subscription.id}`}>{subscription.name}</h3>
          {subscription.source === 'demo' && <span className="badge badge-demo">demo</span>}
          <span className={`badge badge-${subscription.status}`}>{subscription.status === 'cancelling' ? 'cancelling' : subscription.status}</span>
        </div>
        <p className="subscription-meta">{subscription.merchant} · {subscription.category} · next {formatDate(subscription.nextChargeDate)}</p>
      </div>
      <div className="subscription-right">
        <div className="subscription-price" data-testid={`text-subscription-amount-${subscription.id}`}>{formatMoney(subscription.amount)}</div>
        <div className="subscription-cycle">{formatCycle(subscription.billingCycle)}</div>
      </div>
      <div className="row-actions">
        <button className="button button-quiet button-icon reminder-button" data-enabled={subscription.reminderEnabled} onClick={onReminder} aria-label={`${subscription.reminderEnabled ? 'Disable' : 'Enable'} reminder for ${subscription.name}`} data-testid={`button-reminder-${subscription.id}`}>
          {subscription.reminderEnabled ? <Bell size={15} /> : <BellOff size={15} />}
        </button>
        <button className="button button-quiet button-icon" onClick={onEdit} aria-label={`Edit ${subscription.name}`} data-testid={`button-edit-${subscription.id}`}><Pencil size={14} /></button>
        <button className="button button-quiet button-icon" onClick={onDelete} aria-label={`Delete ${subscription.name}`} data-testid={`button-delete-${subscription.id}`}><Trash2 size={14} /></button>
        <button className="button button-small button-secondary" onClick={onStatus} disabled={subscription.status === 'cancelled'} data-testid={`button-status-${subscription.id}`}>
          {subscription.status === 'cancelling' ? <><Check size={13} /> Mark cancelled</> : <><MoreHorizontal size={13} /> Trim</>}
        </button>
      </div>
      {isCancelled && <span className="badge badge-cancelled" style={{ marginLeft: 'auto' }}>drops next cycle</span>}
    </article>
  );
}