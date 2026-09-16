import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePlaidLink } from 'react-plaid-link';
import {
  getPlaidStatusQueryKey,
  usePlaidStatus,
  usePlaidCreateLinkToken,
  usePlaidExchange,
  usePlaidSync,
  usePlaidDisconnect,
  type SubscriptionSuggestion,
  type PlaidConnectionState,
} from '@workspace/api-client-react';
import { useAuthToken } from '@/hooks/use-auth-token';

export type { SubscriptionSuggestion } from '@workspace/api-client-react';

// Connection state comes straight from the server; `unknown` covers the brief
// window before the first status query resolves (or if it errors). `locked`
// means no access token is stored yet, so the server hasn't been asked.
export type ConnectionState = PlaidConnectionState | 'unknown' | 'locked';

type UsePlaidConnection = {
  state: ConnectionState;
  institution: string | null;
  isConfigured: boolean;
  isConnected: boolean;
  // True while a link/exchange handshake is in flight.
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  disconnecting: boolean;
  sync: () => void;
  syncing: boolean;
  suggestions: SubscriptionSuggestion[];
  clearSuggestions: () => void;
  error: string | null;
};

// Owns the full Plaid connection lifecycle for the UI: reads status, drives the
// Plaid Link handshake, exchanges the public token, and exposes sync results.
export function usePlaidConnection(): UsePlaidConnection {
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SubscriptionSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = usePlaidStatus({
    query: {
      queryKey: getPlaidStatusQueryKey(),
      // not_configured / not_connected are normal states, not retry-worthy failures.
      retry: false,
      // No point asking the server before we have a token to send it.
      enabled: Boolean(token),
    },
  });

  const state: ConnectionState = !token ? 'locked' : statusQuery.data?.state ?? 'unknown';
  const institution = statusQuery.data?.institution ?? null;
  const isConfigured = state !== 'not_configured' && state !== 'unknown' && state !== 'locked';
  const isConnected = state === 'connected' || state === 'error';

  const refreshStatus = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getPlaidStatusQueryKey() });
  }, [queryClient]);

  const exchange = usePlaidExchange({
    mutation: {
      onSuccess: () => {
        setLinkToken(null);
        refreshStatus();
      },
      onError: () => {
        setLinkToken(null);
        setError('Could not finish connecting the bank.');
      },
    },
  });

  // Plaid Link opens once we have a link token; on success we hand the public
  // token to the server to exchange for a stored access token.
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => {
      if (!publicToken) {
        setLinkToken(null);
        return;
      }
      exchange.mutate({ data: { publicToken } });
    },
    onExit: () => {
      setLinkToken(null);
    },
  });

  const createLinkToken = usePlaidCreateLinkToken({
    mutation: {
      onSuccess: (data) => {
        setError(null);
        setLinkToken(data.linkToken);
      },
      onError: () => setError('Could not start bank linking.'),
    },
  });

  // When the link token is ready and Link is initialised, open the modal.
  useEffect(() => {
    if (linkToken && ready && !exchange.isPending) {
      open();
    }
  }, [linkToken, ready, exchange.isPending, open]);

  const connect = useCallback(() => {
    setError(null);
    createLinkToken.mutate();
  }, [createLinkToken]);

  const disconnectMutation = usePlaidDisconnect({
    mutation: {
      onSuccess: () => {
        setSuggestions([]);
        refreshStatus();
      },
    },
  });

  const disconnect = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  const syncMutation = usePlaidSync({
    mutation: {
      onSuccess: (data) => {
        setError(null);
        setSuggestions(data.suggestions);
      },
      onError: () => setError('Could not read transactions from your bank.'),
    },
  });

  const sync = useCallback(() => {
    setError(null);
    syncMutation.mutate();
  }, [syncMutation]);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  return {
    state,
    institution,
    isConfigured,
    isConnected,
    connecting: createLinkToken.isPending || Boolean(linkToken) || exchange.isPending,
    connect,
    disconnect,
    disconnecting: disconnectMutation.isPending,
    sync,
    syncing: syncMutation.isPending,
    suggestions,
    clearSuggestions,
    error,
  };
}
