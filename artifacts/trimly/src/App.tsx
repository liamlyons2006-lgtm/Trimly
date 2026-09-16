import { useEffect, type ReactNode } from 'react';
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { ApiError, setAuthTokenGetter } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TrimlyProvider } from '@/hooks/use-trimly';
import { TrimlyShell } from '@/components/trimly-shell';
import Dashboard from '@/pages/dashboard';
import Insights from '@/pages/insights';
import Settings from '@/pages/settings';
import Subscriptions from '@/pages/subscriptions';
import NotFound from '@/pages/not-found';
import { getAuthToken, setAuthToken } from '@/lib/auth-token';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

// Attach the stored access token (if any) to every request the generated
// client makes. A missing/invalid token surfaces as a 401 the caller handles.
setAuthTokenGetter(() => getAuthToken());

// A 401 means the stored token was rejected (missing, wrong, or rotated on
// the server) — clear it so the UI falls back to asking for it again.
function handleAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) setAuthToken(null);
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthError }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
});

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <TrimlyShell>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/subscriptions" component={Subscriptions} />
          <Route path="/insights" component={Insights} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </TrimlyShell>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  useEffect(() => {
    document.title = 'Trimly — a clearer view of what repeats';
    const description = 'Trimly keeps every recurring charge visible, so small renewals stay your choice.';
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', description);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TrimlyProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TrimlyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
