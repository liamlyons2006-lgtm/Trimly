import { Building2, Check, Link2, Loader2, RefreshCw, ShieldOff } from 'lucide-react';
import { usePlaidConnection } from '@/hooks/use-plaid';
import { SuggestionsReview } from '@/components/suggestions-review';

// Bank connection panel for Settings. Renders an honest state machine driven by
// the server: not_configured (no keys), not_connected (ready to link), connected
// (a bank is linked), error (needs re-auth). Nothing here implies imported data
// unless the server actually reports a connection.
export function BankConnection() {
  const plaid = usePlaidConnection();

  if (plaid.state === 'unknown') {
    return (
      <div className="connection-box" data-testid="bank-connection-loading">
        <div className="connection-symbol"><Loader2 className="spin" size={16} /></div>
        <div><h4>Checking connection…</h4><p>Reading the current bank connection state.</p></div>
      </div>
    );
  }

  if (!plaid.isConfigured) {
    return (
      <div className="connection-box" data-testid="bank-connection-not-configured">
        <div className="connection-symbol"><ShieldOff size={16} /></div>
        <div>
          <h4>Not available yet</h4>
          <p>Bank connection needs Plaid credentials on the server. Manual entry keeps working in the meantime.</p>
        </div>
      </div>
    );
  }

  if (!plaid.isConnected) {
    return (
      <>
        <div className="connection-box" data-testid="bank-connection-not-connected">
          <div className="connection-symbol">P</div>
          <div>
            <h4>Connect a bank</h4>
            <p>Link through Plaid to detect recurring charges. No charges are added without your say-so.</p>
          </div>
          <button
            className="button button-secondary button-small"
            onClick={plaid.connect}
            disabled={plaid.connecting}
            data-testid="button-connect-bank"
          >
            {plaid.connecting ? <><Loader2 className="spin" size={12} /> Connecting…</> : <><Link2 size={12} /> Connect bank</>}
          </button>
        </div>
        {plaid.error && <p className="setting-copy" role="alert" style={{ color: 'hsl(var(--destructive))' }}>{plaid.error}</p>}
      </>
    );
  }

  // Connected (or in an error state that still has a stored item).
  return (
    <>
      <div className="connection-box" data-testid="bank-connection-connected">
        <div className="connection-symbol" style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--primary))' }}>
          <Building2 size={16} />
        </div>
        <div>
          <h4>{plaid.institution ?? 'Bank connected'}</h4>
          <p>
            {plaid.state === 'error'
              ? 'This connection needs attention — try syncing again or reconnect.'
              : 'Connected. Sync to detect recurring charges.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="button button-primary button-small"
            onClick={plaid.sync}
            disabled={plaid.syncing}
            data-testid="button-sync-bank"
          >
            {plaid.syncing ? <><Loader2 className="spin" size={12} /> Syncing…</> : <><RefreshCw size={12} /> Sync</>}
          </button>
          <button
            className="button button-secondary button-small"
            onClick={plaid.disconnect}
            disabled={plaid.disconnecting}
            data-testid="button-disconnect-bank"
          >
            {plaid.disconnecting ? 'Removing…' : 'Disconnect'}
          </button>
        </div>
      </div>
      {plaid.error && <p className="setting-copy" role="alert" style={{ color: 'hsl(var(--destructive))' }}>{plaid.error}</p>}
      {plaid.suggestions.length === 0 && !plaid.syncing && (
        <p className="setting-copy" data-testid="bank-connection-hint">
          <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Sync pulls recurring charges from your bank as suggestions to review — nothing is added until you confirm.
        </p>
      )}
      <SuggestionsReview
        suggestions={plaid.suggestions}
        onClear={plaid.clearSuggestions}
      />
    </>
  );
}
