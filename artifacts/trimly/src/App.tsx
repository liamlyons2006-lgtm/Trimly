import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

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
