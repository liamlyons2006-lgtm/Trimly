import { ArrowDownRight, BarChart3, Scissors, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/trimly-shell';
import { useTrimly } from '@/hooks/use-trimly';
import { formatMoney, monthlyAmountInCurrency } from '@/lib/trimly';

export default function Insights() {
  const { subscriptions, preferences, loading } = useTrimly();
  const active = useMemo(() => subscriptions.filter((item) => item.status !== 'cancelled'), [subscriptions]);
   const monthly = useMemo(() => active.reduce((sum, item) => sum + monthlyAmountInCurrency(item, preferences.currency), 0), [active, preferences.currency]);
   const cancelling = useMemo(() => active.filter((item) => item.status === 'cancelling').reduce((sum, item) => sum + monthlyAmountInCurrency(item, preferences.currency), 0), [active, preferences.currency]);
  const categories = useMemo(() => {
    const map = new Map<string, number>();
     active.forEach((item) => map.set(item.category, (map.get(item.category) ?? 0) + monthlyAmountInCurrency(item, preferences.currency)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
   }, [active, preferences.currency]);
  const chartValues = [0.81, 0.86, 0.93, 0.89, 1.04, 1];
  if (loading) return <div className="page-wrap"><div className="loading-skeleton" /></div>;
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="A little perspective" title={<>Where the money <em>settles.</em></>} subtitle="A gentle read on the recurring spending you have chosen to keep around.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'hsl(var(--muted-foreground))', fontSize: 11 }}><BarChart3 size={16} /> {active.length} active repeats</div>
      </PageHeader>
      <div className="insights-layout">
        <section className="panel panel-pad">
          <div className="section-heading"><h2>Monthly recurring spend</h2><span>last 6 months</span></div>
           <div className="insight-number" data-testid="text-insights-monthly">{formatMoney(monthly, 2, preferences.currency)}<small> / month</small></div>
           <span className="delta" data-testid="status-insights-delta"><ArrowDownRight size={12} /> {cancelling > 0 ? `${formatMoney(cancelling, 0, preferences.currency)} in the maybe pile` : 'steady, for now'}</span>
          <div className="spend-chart" style={{ height: 230, paddingLeft: 0, paddingRight: 0, marginTop: 25, borderTop: '1px solid hsl(var(--border) / .65)' }} data-testid="chart-insights-trend">
             {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((month, index) => <div className="bar-wrap" key={month}><div className={`bar ${index === 5 ? 'current' : ''}`} style={{ height: `${Math.max(12, chartValues[index] * 76)}%` }}><span className="bar-amount">{formatMoney(monthly * chartValues[index], 0, preferences.currency)}</span></div><span className="bar-label">{month}</span></div>)}
          </div>
        </section>
        <section className="panel panel-pad">
          <div className="section-heading"><h2>By category</h2><span>per month</span></div>
           {categories.length === 0 ? <div className="empty-state" style={{ padding: '30px 10px', marginTop: 18 }}><Sparkles size={18} /><p>No categories yet. Add a subscription to see the shape.</p></div> : <div className="breakdown">{categories.map(([category, amount], index) => <div className="breakdown-item" key={category} data-testid={`row-category-${category.toLowerCase().replace(/\s+/g, '-')}`}><span className="dot" style={{ background: ['hsl(var(--primary))', 'hsl(var(--accent))', '#b7c3ef', '#e9a2a7', '#a7d8cf'][index % 5] }} /><span>{category}</span><strong>{formatMoney(amount, 0, preferences.currency)}</strong><div className="breakdown-track"><div className="breakdown-fill" style={{ width: `${Math.max(8, amount / monthly * 100)}%`, background: index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / .46)' }} /></div></div>)}</div>}
        </section>
      </div>
      <section className="insight-callout" style={{ marginTop: 18 }} data-testid="card-insights-oh-wow">
        <h3><Scissors size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} />The useful bit</h3>
         <p>{cancelling > 0 ? <>You have already marked <strong>{formatMoney(cancelling, 0, preferences.currency)} per month</strong> as worth a second look. If those charges go, that is <strong>{formatMoney(cancelling * 12, 0, preferences.currency)} back over a year</strong> — without touching anything you love.</> : <>Not every recurring payment needs trimming. The win is knowing the total, then making one small decision at a time.</>}</p>
      </section>
    </div>
  );
}