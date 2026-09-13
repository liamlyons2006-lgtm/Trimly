import { ArrowUpRight, CalendarDays, CircleDollarSign, Plus, Sparkles, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { SubscriptionDialog } from '@/components/subscription-dialog';
import { PageHeader } from '@/components/trimly-shell';
import { useTrimly } from '@/hooks/use-trimly';
import { annualAmount, formatDate, formatMoney, monthlyAmount } from '@/lib/trimly';

function DemoNote() {
  return <div style={{ marginBottom: 16, padding: '10px 13px', borderRadius: 10, background: 'hsl(var(--accent) / .13)', border: '1px solid hsl(var(--accent) / .27)', color: 'hsl(var(--foreground) / .72)', fontSize: 11 }} data-testid="status-demo-note"><strong style={{ color: 'hsl(var(--foreground))' }}>A little head start.</strong> These softly tagged entries are demo data. Edit or delete them to make Trimly yours.</div>;
}

export default function Dashboard() {
  const { subscriptions, loading, addSubscription } = useTrimly();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState('');
  const active = useMemo(() => subscriptions.filter((item) => item.status !== 'cancelled'), [subscriptions]);
  const monthly = useMemo(() => active.reduce((sum, item) => sum + monthlyAmount(item), 0), [active]);
  const annual = useMemo(() => active.reduce((sum, item) => sum + annualAmount(item), 0), [active]);
  const upcoming = useMemo(() => [...active].sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate)).slice(0, 4), [active]);

  const saveNew = (data: { name: string; merchant: string; amount: string; billingCycle: 'monthly' | 'annual' | 'weekly'; nextChargeDate: string; category: string; color: string }) => {
    addSubscription({ ...data, amount: Number(data.amount), status: 'active', reminderEnabled: true });
    setDialogOpen(false);
    setToast('Subscription added to your picture');
    window.setTimeout(() => setToast(''), 2600);
  };

  if (loading) return <div className="page-wrap"><div className="loading-skeleton" /></div>;

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Monday, money view" title={<>A clearer view of <em>what repeats.</em></>} subtitle="Trimly keeps the little charges visible, so they stay your choice.">
        <button className="button button-primary" onClick={() => setDialogOpen(true)} data-testid="button-add-dashboard"><Plus size={15} /><span>Add subscription</span></button>
      </PageHeader>
      {subscriptions.some((item) => item.source === 'demo') && <DemoNote />}
      <section className="hero-card" data-testid="card-monthly-total">
        <div className="hero-label">Monthly recurring spend</div>
        <div className="hero-amount"><span>$</span>{monthly.toFixed(2)}</div>
        <p className="hero-copy">That is <strong>{formatMoney(annual, 0)}</strong> a year if nothing changes.</p>
        <div className="hero-insight"><strong>{active.length} repeats</strong>One number for the charges that quietly come back.</div>
      </section>
      <section className="stat-grid" aria-label="Spending summary">
        <div className="stat-card" data-testid="card-annual-projection">
          <div className="stat-top"><span>Annual projection</span><WalletCards className="stat-icon" size={17} /></div>
          <div className="stat-value">{formatMoney(annual, 0)}</div>
          <div className="stat-meta">if every repeat stays put</div>
        </div>
        <div className="stat-card" data-testid="card-next-renewal">
          <div className="stat-top"><span>Next renewal</span><CalendarDays className="stat-icon" size={17} /></div>
          <div className="stat-value">{upcoming[0] ? formatDate(upcoming[0].nextChargeDate) : 'All clear'}</div>
          <div className="stat-meta">{upcoming[0] ? `${upcoming[0].name} · ${formatMoney(upcoming[0].amount)}` : 'Nothing waiting in line'}</div>
        </div>
        <div className="stat-card" data-testid="card-cancellable">
          <div className="stat-top"><span>In the maybe pile</span><CircleDollarSign className="stat-icon" size={17} /></div>
          <div className="stat-value">{formatMoney(active.filter((item) => item.status === 'cancelling').reduce((sum, item) => sum + monthlyAmount(item), 0), 0)}</div>
          <div className="stat-meta">monthly spend flagged to trim</div>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-pad section-heading"><h2>Coming up</h2><Link className="mini-link" href="/subscriptions" data-testid="link-view-all">View all <ArrowUpRight size={12} style={{ verticalAlign: 'middle' }} /></Link></div>
          {upcoming.length === 0 ? <div className="empty-state" style={{ margin: '0 20px 20px' }}><div className="empty-mark"><Sparkles size={18} /></div><h3>Nothing on the horizon</h3><p>Add a subscription and Trimly will keep the next charge close.</p><button className="button button-primary button-small" onClick={() => setDialogOpen(true)} data-testid="button-add-empty">Add one</button></div> : <div className="charge-list">{upcoming.map((item) => <div className="charge-row" key={item.id} data-testid={`row-upcoming-${item.id}`}><div className="merchant-avatar" style={{ background: item.color }}>{item.merchant.slice(0, 1).toUpperCase()}</div><div className="charge-details"><p className="charge-name">{item.name}</p><p className="charge-date">{formatDate(item.nextChargeDate)} {item.status === 'cancelling' ? '· flagged to cancel' : ''}</p></div><span className="charge-amount">{formatMoney(item.amount)}</span></div>)}</div>}
        </section>
        <section className="panel">
          <div className="panel-pad section-heading"><h2>Recent rhythm</h2><span>monthly view</span></div>
          <div className="spend-chart" aria-label="Six month recurring spend visualization" data-testid="chart-monthly-spend">
            {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((month, index) => {
              const variation = [0.83, 0.89, 0.96, 0.92, 1.03, 1][index];
              const value = monthly * variation;
              return <div className="bar-wrap" key={month}><div className={`bar ${index === 5 ? 'current' : ''}`} style={{ height: `${Math.max(10, Math.min(100, value / Math.max(monthly, 1) * 75))}%` }}><span className="bar-amount">{formatMoney(value, 0)}</span></div><span className="bar-label">{month}</span></div>;
            })}
          </div>
        </section>
      </div>
      <SubscriptionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSave={saveNew} />
      {toast && <div className="toast-note" role="status" data-testid="status-dashboard-toast"><Sparkles size={15} />{toast}</div>}
    </div>
  );
}