import { useState, useEffect } from 'react';
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppSidebar from "@/components/AppSidebar";
import BottomNav from "@/components/BottomNav";
import TruthClaims from "@/pages/TruthClaims";
import AxiomDetail from "@/pages/AxiomDetail";
import NewSynthesis from "@/pages/NewSynthesis";
import CoreTensions from "@/pages/CoreTensions";
import Revisions from "@/pages/Revisions";
import Constitution from "@/pages/Constitution";
import NotFound from "@/pages/not-found";

function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'unauth'>('loading');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (r.ok) setStatus('ok');
        else setStatus('unauth');
      })
      .catch(() => setStatus('unauth'));
  }, []);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1117', color: '#8D99AE', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.08em' }}>
        AXIOM
      </div>
    );
  }

  if (status === 'unauth') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f1117', color: '#8D99AE', fontFamily: 'monospace', textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2.5rem 2rem', border: '1px solid rgba(61,123,186,0.15)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3d7bba', fontWeight: 600, marginBottom: '0.5rem' }}>AXIOM</div>
          <div style={{ fontSize: '1rem', color: '#C8CCD5' }}>The constitution forms from within Lumen.</div>
          <div style={{ fontSize: '0.8rem', color: '#8D99AE', maxWidth: '28ch', textAlign: 'center', lineHeight: 1.5 }}>Where tested insights become governing principles.</div>
          <a href="https://lumen-os.up.railway.app" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#FFD166', textDecoration: 'none', letterSpacing: '0.08em', border: '1px solid rgba(255,209,102,0.3)', padding: '0.75rem 1.5rem', borderRadius: '6px', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
            Go to Lumen →
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthGate>
        <QueryClientProvider client={queryClient}>
          <Router hook={useHashLocation}>
            <div className="flex h-screen bg-background overflow-hidden">
              <div className="hidden md:block">
                <AppSidebar />
              </div>
              <main className="flex-1 overflow-y-auto pb-24 md:pb-0" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
                <Switch>
                  <Route path="/" component={TruthClaims} />
                  <Route path="/axiom/:id" component={AxiomDetail} />
                  <Route path="/new" component={NewSynthesis} />
                  <Route path="/tensions" component={CoreTensions} />
                  <Route path="/revisions" component={Revisions} />
                  <Route path="/constitution" component={Constitution} />
                  <Route component={NotFound} />
                </Switch>
              </main>
              <BottomNav />
            </div>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthGate>
    </ThemeProvider>
  );
}

export default App;
