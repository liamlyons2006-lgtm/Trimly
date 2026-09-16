import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { setAuthToken } from '@/lib/auth-token';

// Entry point for the server access token (APP_AUTH_TOKEN). Shown in place of
// the bank connection panel until a token is stored; a rejected token clears
// itself (see App.tsx's 401 handling) and this form reappears.
export function AuthTokenForm() {
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    setAuthToken(value);
    setValue('');
  };

  return (
    <form className="connection-box" onSubmit={handleSubmit} data-testid="form-auth-token">
      <div className="connection-symbol"><KeyRound size={16} /></div>
      <div style={{ flex: 1 }}>
        <h4>Server access token</h4>
        <p>Enter the access token configured on the server to manage the bank connection.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="password"
            className="select-field"
            style={{ flex: 1 }}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Access token"
            aria-label="Server access token"
            data-testid="input-auth-token"
          />
          <button type="submit" className="button button-primary button-small" data-testid="button-save-auth-token">
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
