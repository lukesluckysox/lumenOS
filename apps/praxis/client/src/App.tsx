import React from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Experiments from "@/pages/Experiments";
import ExperimentDetail from "@/pages/ExperimentDetail";
import NewExperiment from "@/pages/NewExperiment";
import Doctrines from "@/pages/Doctrines";
import Tensions from "@/pages/Tensions";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/experiments" component={Experiments} />
        <Route path="/experiments/new" component={NewExperiment} />
        <Route path="/experiments/:id" component={ExperimentDetail} />
        <Route path="/doctrines" component={Doctrines} />
        <Route path="/tensions" component={Tensions} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<'loading' | 'authed' | 'unauthed'>('loading');

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (r.ok) setStatus('authed');
        else setStatus('unauthed');
      })
      .catch(() => setStatus('unauthed'));
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#191b2a', color: '#8D99AE', fontFamily: 'sans-serif' }}>
        Loading…
      </div>
    );
  }

  if (status === 'unauthed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#191b2a', color: '#F4F5F8', fontFamily: 'sans-serif', padding: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2.5rem 2rem', border: '1px solid rgba(255,209,102,0.1)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
          <p style={{ color: '#c4943e', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>Praxis</p>
          <p style={{ color: '#C8CCD5', fontSize: '1rem' }}>The laboratory opens from within Lumen.</p>
          <p style={{ color: '#8D99AE', fontSize: '0.8rem', maxWidth: '28ch', textAlign: 'center', lineHeight: 1.5 }}>Where your reflections become testable experiments.</p>
          <a href="https://lumen-os.up.railway.app" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#FFD166', textDecoration: 'none', letterSpacing: '0.05em', border: '1px solid rgba(255,209,102,0.3)', padding: '0.75rem 1.5rem', borderRadius: '6px', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
            Go to Lumen →
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthGate>
          <Router hook={useHashLocation}>
            <AppRoutes />
          </Router>
          <Toaster />
        </AuthGate>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
