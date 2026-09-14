import { Check, Database, Link2, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/trimly-shell';
import { useTrimly } from '@/hooks/use-trimly';
import { currencyOptions, type Currency } from '@/lib/trimly';

export default function Settings() {
  const { preferences, updatePreferences, resetData, subscriptions } = useTrimly();
  const [connectionState, setConnectionState] = useState<'not-connected' | 'waitlisted'>('not-connected');
  const [toast, setToast] = useState('');
  const feedback = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };
  const reset = () => {
    if (window.confirm('Reset your Trimly data back to the starter demo? This removes manual entries.')) { resetData(); feedback('Starter view restored'); }
  };
  const changeCurrency = (currency: Currency) => {
    updatePreferences({ currency });
    const selected = currencyOptions.find((option) => option.code === currency);
    feedback(`${selected?.name ?? currency} selected`);
  };
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Keep it comfortable" title={<>Your <em>settings.</em></>} subtitle="Trimly is a local-first notebook. Nothing leaves this browser in this build." />
      <div className="settings-grid">
        <section className="panel">
          <div className="setting-block">
            <h2 className="setting-title">Reminder preferences</h2>
            <p className="setting-copy">Choose how Trimly should help you notice a charge before it rolls around. These are preferences for the future reminder experience; no emails or push messages are sent in this build.</p>
            <div className="setting-row"><div><h4>Reminders on</h4><p>Keep the nudge system ready.</p></div><button className="switch" data-on={preferences.email} onClick={() => updatePreferences({ email: !preferences.email })} aria-label="Toggle reminders" data-testid="switch-reminders" /></div>
            <div className="setting-row"><div><h4>One week before</h4><p>A little breathing room for bigger renewals.</p></div><button className="switch" data-on={preferences.sevenDays} onClick={() => updatePreferences({ sevenDays: !preferences.sevenDays })} aria-label="Toggle seven day reminders" data-testid="switch-seven-days" /></div>
            <div className="setting-row"><div><h4>One day before</h4><p>The last kind nudge.</p></div><button className="switch" data-on={preferences.oneDay} onClick={() => updatePreferences({ oneDay: !preferences.oneDay })} aria-label="Toggle one day reminders" data-testid="switch-one-day" /></div>
            <div className="setting-row"><div><h4>When something is flagged</h4><p>Remember that you meant to cancel it.</p></div><button className="switch" data-on={preferences.cancelling} onClick={() => updatePreferences({ cancelling: !preferences.cancelling })} aria-label="Toggle cancelling reminders" data-testid="switch-cancelling" /></div>
            <div className="setting-row currency-setting-row">
              <div><h4>Display currency</h4><p>Amounts update using reference exchange rates. Saved entries keep their original currency.</p></div>
              <select className="select-field setting-currency" value={preferences.currency} onChange={(event) => changeCurrency(event.target.value as Currency)} aria-label="Display currency" data-testid="select-currency">
                {currencyOptions.map((option) => <option key={option.code} value={option.code}>{option.name} ({option.code})</option>)}
              </select>
            </div>
          </div>
        </section>
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="panel">
            <div className="setting-block">
              <h2 className="setting-title">Bank connection</h2>
              <p className="setting-copy">Automatic import is on the way, but it is not connected here. Your manual list stays the source of truth.</p>
              <div className="connection-box">
                <div className="connection-symbol">P</div>
                <div><h4>Plaid connection</h4><p>{connectionState === 'waitlisted' ? 'You are on the waitlist. No account data was connected.' : 'Not connected in this build.'}</p></div>
                <button className="button button-secondary button-small" onClick={() => { setConnectionState('waitlisted'); feedback('Waitlist note saved locally'); }} disabled={connectionState === 'waitlisted'} data-testid="button-plaid-waitlist">{connectionState === 'waitlisted' ? <><Check size={12} /> Noted</> : <><Link2 size={12} /> Join waitlist</>}</button>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="setting-block">
              <h2 className="setting-title">Your local data</h2>
              <p className="setting-copy">Trimly stores {subscriptions.length} subscription records and your reminder choices in localStorage on this device.</p>
              <div className="connection-box"><div className="connection-symbol" style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--primary))' }}><Database size={16} /></div><div><h4>Private by default</h4><p>There is no account, sync, or external connection to revoke.</p></div><ShieldCheck size={18} color="hsl(var(--primary))" /></div>
            </div>
            <div className="setting-block danger-zone">
              <h2 className="setting-title">Reset data</h2>
              <p className="setting-copy">Remove your manual changes and return to the starter demo. This cannot be undone.</p>
              <button className="button button-secondary button-small" onClick={reset} data-testid="button-reset-data"><RotateCcw size={13} /> Reset to starter data</button>
            </div>
          </section>
        </div>
      </div>
      {toast && <div className="toast-note" role="status" data-testid="status-settings-toast"><Sparkles size={15} />{toast}</div>}
    </div>
  );
}