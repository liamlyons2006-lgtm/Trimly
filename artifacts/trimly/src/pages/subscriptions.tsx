import { Check, Filter, Plus, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/trimly-shell';
import { SubscriptionDialog } from '@/components/subscription-dialog';
import { SubscriptionRow } from '@/components/subscription-row';
import { useTrimly } from '@/hooks/use-trimly';
import type { Subscription } from '@/lib/trimly';

type FormData = { name: string; merchant: string; amount: string; billingCycle: 'monthly' | 'annual' | 'weekly'; nextChargeDate: string; category: string; color: string };

export default function Subscriptions() {
  const { subscriptions, loading, addSubscription, updateSubscription, deleteSubscription } = useTrimly();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => subscriptions.filter((item) => {
    const query = search.toLowerCase();
    const matchesText = !query || `${item.name} ${item.merchant} ${item.category}`.toLowerCase().includes(query);
    return matchesText && (status === 'all' || item.status === status);
  }), [subscriptions, search, status]);

  const feedback = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };
  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (item: Subscription) => { setEditing(item); setDialogOpen(true); };
  const save = (data: FormData) => {
    if (editing) updateSubscription(editing.id, { ...data, amount: Number(data.amount), name: data.name, merchant: data.merchant || data.name });
    else addSubscription({ ...data, amount: Number(data.amount), status: 'active', reminderEnabled: true });
    setDialogOpen(false);
    feedback(editing ? 'Changes saved' : 'Subscription added');
  };
  const remove = (id: string) => {
    if (confirmDelete === id) { deleteSubscription(id); setConfirmDelete(null); feedback('Subscription removed'); }
    else { setConfirmDelete(id); window.setTimeout(() => setConfirmDelete((current) => current === id ? null : current), 3000); }
  };

  if (loading) return <div className="page-wrap"><div className="loading-skeleton" /></div>;
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Your repeats" title={<>The full <em>picture.</em></>} subtitle={`${subscriptions.length} recurring ${subscriptions.length === 1 ? 'charge' : 'charges'} currently in your orbit.`}>
        <button className="button button-primary" onClick={openAdd} data-testid="button-add-subscription"><Plus size={15} /><span>Add subscription</span></button>
      </PageHeader>
      <div className="list-toolbar">
        <div className="search-wrap"><Search size={15} /><input className="field" type="search" placeholder="Search subscriptions" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-subscriptions" /></div>
        <select className="select-field" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status" data-testid="select-status-filter"><option value="all">All statuses</option><option value="active">Active</option><option value="cancelling">Flagged to trim</option><option value="cancelled">Cancelled</option></select>
      </div>
      {subscriptions.some((item) => item.source === 'demo') && <div style={{ margin: '0 0 16px', color: 'hsl(var(--muted-foreground))', fontSize: 11, display: 'flex', alignItems: 'center', gap: 7 }}><Filter size={13} /> Demo entries are marked so you know what is yours.</div>}
      {filtered.length === 0 ? <div className="empty-state"><div className="empty-mark">{search || status !== 'all' ? <Search size={18} /> : <Sparkles size={18} />}</div><h3>{search || status !== 'all' ? 'No matches here' : 'Your list is ready when you are'}</h3><p>{search || status !== 'all' ? 'Try another search or clear the filter.' : 'Start with the charges you notice every month. No bank connection required.'}</p>{search || status !== 'all' ? <button className="button button-secondary button-small" onClick={() => { setSearch(''); setStatus('all'); }} data-testid="button-clear-filters"><Check size={13} /> Clear filters</button> : <button className="button button-primary button-small" onClick={openAdd} data-testid="button-add-first-subscription"><Plus size={13} /> Add first subscription</button>}</div> : <div className="subscription-list">{filtered.map((item) => <SubscriptionRow key={item.id} subscription={item} onEdit={() => openEdit(item)} onDelete={() => remove(item.id)} onReminder={() => { updateSubscription(item.id, { reminderEnabled: !item.reminderEnabled }); feedback(item.reminderEnabled ? 'Reminder muted' : 'Reminder switched on'); }} onStatus={() => { const next = item.status === 'active' ? 'cancelling' : 'cancelled'; updateSubscription(item.id, { status: next }); feedback(next === 'cancelling' ? 'Flagged — Trimly will not cancel it for you' : 'Marked cancelled; it drops off next cycle'); }} />)}</div>}
      {confirmDelete && <div className="toast-note" role="status" data-testid="status-delete-confirm"><TrashIcon />Tap delete again to remove this charge</div>}
      {toast && <div className="toast-note" role="status" data-testid="status-subscriptions-toast"><Sparkles size={15} />{toast}</div>}
      <SubscriptionDialog open={dialogOpen} initial={editing} onClose={() => setDialogOpen(false)} onSave={save} />
    </div>
  );
}

function TrashIcon() {
  return <span style={{ display: 'inline-grid', placeItems: 'center', width: 15, height: 15, borderRadius: 4, background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))', fontSize: 10 }}>!</span>;
}