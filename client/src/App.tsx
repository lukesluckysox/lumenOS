import { useState, useCallback } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import AuthGate from "@/components/AuthGate";
import BottomNav from "@/components/BottomNav";
import PipelineHealth from "@/components/PipelineHealth";
import HomePage from "@/pages/HomePage";
import ProfilePanel from "@/components/ProfilePanel";
import AboutModal from "@/components/AboutModal";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import PwaBanner from "@/components/PwaBanner";

const PALETTES = [
  { id: "lumen",    color: "#FFD166", label: "Lumen" },
  { id: "liminal",  color: "#9c8654", label: "Liminal" },
  { id: "parallax", color: "#4d8c9e", label: "Parallax" },
  { id: "praxis",   color: "#c4943e", label: "Praxis" },
  { id: "axiom",    color: "#3d7bba", label: "Axiom" },
] as const;

/* Inline loop SVG used in nav brand + footer */
const LumenLoopSVG = () => (
  <svg className="lumen-loop-inline" width="18" height="18" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M32 4C47.46 4 60 16.54 60 32S47.46 60 32 60" stroke="#FFD166" strokeWidth="1.6" strokeLinecap="round" opacity=".6"/>
    <path d="M32 60C16.54 60 4 47.46 4 32S16.54 4 32 4" stroke="#FFD166" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 3" opacity=".25"/>
    <circle cx="32" cy="4" r="2.5" fill="#FFD166" opacity=".8"/>
    <line x1="32" y1="14" x2="32" y2="22" stroke="#FFD166" strokeWidth="1.4" strokeLinecap="round" opacity=".7"/>
    <line x1="50" y1="32" x2="42" y2="32" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" opacity=".2"/>
    <line x1="32" y1="50" x2="32" y2="42" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" opacity=".2"/>
    <line x1="14" y1="32" x2="22" y2="32" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" opacity=".2"/>
    <circle cx="32" cy="32" r="5" fill="#FFD166" opacity=".5"/>
    <circle cx="32" cy="32" r="3" fill="#FFD166" opacity=".8"/>
    <circle cx="32" cy="32" r="1.5" fill="#FFD166"/>
  </svg>
);

function Shell() {
  const { user, loading, logout } = useAuth();
  const { theme, palette, toggleTheme, setPalette } = useTheme();
  useScrollReveal();

  const [profileOpen, setProfileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleLogout = useCallback(() => {
    logout();
    window.location.reload();
  }, [logout]);

  const openProfile = useCallback(() => {
    setProfileOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  if (loading) {
    return (
      <div id="lumen-splash" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "#191b2a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" stroke="#FFD166" strokeWidth="2" strokeDasharray="0 0 145 145" strokeLinecap="round" opacity="0.5"/>
          <circle cx="50" cy="50" r="12" fill="#FFD166" opacity="0.9"/>
        </svg>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuth={() => window.location.reload()} />;
  }

  return (
    <>
      {/* ═══ NAV ═══ */}
      <header>
        <nav className="nav" id="nav" aria-label="Main navigation">
          <div className="wrap nav__row">

            <a href="#" className="nav__brand" aria-label="Lumen home">
              <span className="nav__name"><LumenLoopSVG />Lumen</span>
            </a>

            <ul className="nav__links" role="list">
              <li><a href="#tools" className="nav__link">Tools</a></li>
              <li><a href="#cockpit" className="nav__link">Overview</a></li>
              <li><button className="nav__link" onClick={(e) => { e.preventDefault(); setAboutOpen(true); }}>About</button></li>
            </ul>

            <div className="nav__right">
              <div className="palette-dots" role="group" aria-label="Color palette">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    className={`palette-dot${palette === p.id ? " active" : ""}`}
                    data-palette={p.id}
                    data-name={p.label}
                    style={{ background: p.color }}
                    aria-label={`${p.label} palette`}
                    onClick={() => setPalette(p.id as any)}
                  />
                ))}
              </div>

              <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
                {theme === "dark" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>

              <a href="#tools" className="btn-ghost">
                Enter
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>

              <PipelineHealth />

              <div className="nav__user" id="nav-user" aria-live="polite">
                {user.username && (
                  <button className="nav__username" type="button" aria-label="Open profile" onClick={openProfile}>
                    {user.username}
                  </button>
                )}
                <button className="nav__signout" onClick={handleLogout} aria-label="Sign out of Lumen">Sign out</button>
              </div>
            </div>

          </div>
        </nav>
      </header>

      {/* ═══ MAIN ═══ */}
      <HomePage userId={user.id} />

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="wrap footer__row" style={{ flexWrap: "wrap" }}>
          <span className="footer__brand"><LumenLoopSVG />Lumen</span>
          <span className="footer__tag">An operating system for the examined life.</span>
          <button className="footer__about" onClick={() => setAboutOpen(true)} style={{ fontFamily: "'Satoshi',sans-serif", fontSize: "var(--text-xs)", color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" as const, opacity: 0.7, background: "none", border: "none", cursor: "pointer" }}>About</button>
        </div>
      </footer>

      {/* ═══ Bottom Nav ═══ */}
      <BottomNav />

      {/* ═══ Overlays ═══ */}
      <ProfilePanel open={profileOpen} onClose={() => { setProfileOpen(false); document.body.style.overflow = ""; }} onLogout={handleLogout} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <OnboardingOverlay />
      <PwaBanner />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
