import { useState, useEffect } from 'react';
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import type { Axiom, Tension, Revision } from "@shared/schema";

const AxiomLogo = () => (
  <svg aria-label="Axiom" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="26" height="26" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 21L14 7L22 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.5 16.5H19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const navItems = [
  {
    href: "/",
    label: "Proposed Axioms",
    shortLabel: "PROPOSALS",
    queryKey: "/api/axioms?stage=proving_ground",
  },
  {
    href: "/tensions",
    label: "Core Tensions",
    shortLabel: "TENSIONS",
    queryKey: "/api/tensions",
  },
  {
    href: "/revisions",
    label: "Revisions",
    shortLabel: "REVISIONS",
    queryKey: "/api/revisions",
  },
  {
    href: "/constitution",
    label: "Constitution",
    shortLabel: "CONSTITUTION",
    queryKey: "/api/axioms?stage=constitutional",
  },
];

function NavCount({ queryKey }: { queryKey: string | null }) {
  const { data } = useQuery<any[]>({
    queryKey: [queryKey],
    queryFn: queryKey ? () => fetch(queryKey).then(r => r.json()) : undefined,
    enabled: !!queryKey,
  });
  if (!queryKey || !data) return null;
  return (
    <span className="font-mono text-xs text-sidebar-foreground/40 tabular-nums">
      {data.length}
    </span>
  );
}

type SensitivityLevel = 'low' | 'medium' | 'high';

function SensitivityControl() {
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('medium');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/sensitivity')
      .then(r => r.json())
      .then((d: { sensitivity?: string }) => {
        if (d.sensitivity === 'low' || d.sensitivity === 'medium' || d.sensitivity === 'high') {
          setSensitivity(d.sensitivity);
        }
      })
      .catch(() => {});
  }, []);

  const update = async (val: SensitivityLevel) => {
    if (saving) return;
    setSensitivity(val);
    setSaving(true);
    try {
      await fetch('/api/settings/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitivity: val }),
      });
    } finally {
      setSaving(false);
    }
  };

  const pills: { val: SensitivityLevel; label: string }[] = [
    { val: 'low', label: 'LOW' },
    { val: 'medium', label: 'MED' },
    { val: 'high', label: 'HIGH' },
  ];

  return (
    <div className="px-5 pb-4">
      <div className="text-[9px] text-sidebar-foreground/25 font-mono uppercase tracking-wider mb-2">
        Loop Sensitivity
      </div>
      <div className="flex gap-1">
        {pills.map(({ val, label }) => (
          <button
            key={val}
            onClick={() => update(val)}
            className={`flex-1 text-[9px] font-mono uppercase tracking-wider py-1.5 rounded-sm border transition-all duration-150 ${
              sensitivity === val
                ? 'border-[#FFD166] text-[#FFD166] bg-[#FFD166]/8'
                : 'border-sidebar-border text-sidebar-foreground/25 hover:text-sidebar-foreground/50 hover:border-sidebar-foreground/30'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="px-5 pb-4">
      <div className="text-[9px] text-sidebar-foreground/25 font-mono uppercase tracking-wider mb-2">
        Theme
      </div>
      <div className="flex gap-1">
        {[
          { val: 'light', label: '☀' },
          { val: 'dark', label: '☾' },
          { val: 'system', label: 'SYS' },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setTheme(val)}
            className={`flex-1 text-[9px] font-mono uppercase tracking-wider py-1.5 rounded-sm border transition-all duration-150 ${
              theme === val
                ? 'border-[#FFD166] text-[#FFD166] bg-[#FFD166]/8'
                : 'border-sidebar-border text-sidebar-foreground/25 hover:text-sidebar-foreground/50 hover:border-sidebar-foreground/30'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const [location] = useLocation();
  const [username, setUsername] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.username) setUsername(d.username); })
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "";
    return location.startsWith(href);
  };

  return (
    <aside
      className="flex flex-col h-full bg-sidebar border-r border-sidebar-border"
      style={{ width: 220, minWidth: 220 }}
      data-testid="app-sidebar"
    >
      {/* Logo / Brand */}
      <div className="px-5 pt-7 pb-6">
        <a
          href="https://lumen-os.up.railway.app"
          className="text-sidebar-foreground/25 hover:text-sidebar-foreground/50 transition-colors text-[9px] font-mono tracking-wider uppercase mb-3 block"
        >
          ◁ Lumen
        </a>
        <div className="flex items-center gap-3">
          <span className="text-sidebar-foreground/60">
            <AxiomLogo />
          </span>
          <div>
            <div
              className="text-sidebar-foreground font-mono text-sm font-medium tracking-widest-constitutional uppercase"
            >
              AXIOM
            </div>
            <div className="text-sidebar-foreground/35 text-[10px] tracking-wider font-mono uppercase mt-0.5">
              Synthesis Layer
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-sidebar-border mb-4" />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={`flex items-center justify-between px-3 py-2.5 rounded-sm cursor-pointer transition-colors duration-150 group ${
                isActive(item.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
              data-testid={`nav-${item.href.replace("/", "") || "home"}`}
            >
              <span className={`text-xs tracking-widest-constitutional font-mono uppercase ${
                isActive(item.href) ? "text-sidebar-foreground" : ""
              }`}>
                {item.shortLabel}
              </span>
              <NavCount queryKey={item.queryKey} />
            </div>
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-5 h-px bg-sidebar-border mt-4 mb-4" />

      {/* New Synthesis CTA */}
      <div className="px-3">
        <Link href="/new">
          <div
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-sm cursor-pointer transition-colors duration-150 ${
              isActive("/new")
                ? "bg-sidebar-primary/20 text-sidebar-primary"
                : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30"
            }`}
            data-testid="nav-new"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M7 1v12M1 7h12"/>
            </svg>
            <span className="text-xs tracking-widest-constitutional font-mono uppercase">
              New Synthesis
            </span>
          </div>
        </Link>
      </div>

      {/* Sensitivity + Theme */}
      <div className="mt-auto">
        <SensitivityControl />
        <ThemeToggle />
      </div>

      {/* Footer */}
      <div className="px-5 pb-6">
        {username ? (
          <Link href="/profile">
            <div className="text-[10px] text-sidebar-foreground/35 hover:text-sidebar-foreground/60 transition-colors font-mono uppercase tracking-wider cursor-pointer">
              {username}
            </div>
          </Link>
        ) : (
          <div className="text-[10px] text-sidebar-foreground/25 font-mono uppercase tracking-wider leading-relaxed">
            AXIOM
          </div>
        )}
      </div>
    </aside>
  );
}
