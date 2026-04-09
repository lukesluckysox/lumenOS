import { useState, useEffect } from 'react';
import BottomNav from "./BottomNav";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { Sun, Moon, FlaskConical, BookOpen, GitFork, LayoutDashboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "The Laboratory", icon: LayoutDashboard },
  { href: "/experiments", label: "Active Experiments", icon: FlaskConical },
  { href: "/doctrines", label: "Emerging Doctrines", icon: BookOpen },
  { href: "/tensions", label: "Core Tensions", icon: GitFork },
];

function PraxisLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-label="Praxis"
      className="flex-shrink-0"
    >
      {/* Flask silhouette — laboratory of the self */}
      <path
        d="M10 4h8M10 4v8L5 20a2 2 0 001.8 2.8h14.4A2 2 0 0023 20l-5-8V4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Liquid level */}
      <path
        d="M7 18h14"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

type SensitivityLevel = 'low' | 'medium' | 'high';

function SensitivityControl() {
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('medium');

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
    setSensitivity(val);
    try {
      await fetch('/api/settings/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitivity: val }),
      });
    } catch {}
  };

  const pills: { val: SensitivityLevel; label: string }[] = [
    { val: 'low', label: 'LOW' },
    { val: 'medium', label: 'MED' },
    { val: 'high', label: 'HIGH' },
  ];

  return (
    <div className="px-4 pb-3">
      <p className="text-[9px] text-muted-foreground/40 font-mono uppercase tracking-wider mb-2">
        Loop Sensitivity
      </p>
      <div className="flex gap-1">
        {pills.map(({ val, label }) => (
          <button
            key={val}
            onClick={() => update(val)}
            className={cn(
              'flex-1 text-[9px] font-mono uppercase tracking-wider py-1.5 rounded border transition-all duration-150',
              sensitivity === val
                ? 'border-[#FFD166] text-[#FFD166] bg-[#FFD166]/8'
                : 'border-border text-muted-foreground/30 hover:text-muted-foreground/60 hover:border-muted-foreground/30'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-border">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-border">
          <a
            href="https://lumen-os.up.railway.app"
            className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors text-[10px] font-mono tracking-wider uppercase mb-2 block"
          >
            ◁ Lumen
          </a>
          <div className="flex items-center gap-3">
            <PraxisLogo />
            <div>
              <h1 className="font-display text-lg font-semibold text-foreground leading-none tracking-tight">
                Praxis
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 leading-none">
                Laboratory of the Self
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/"
              ? location === "/" || location === ""
              : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer select-none transition-colors",
                    isActive
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  )}
                >
                  <Icon
                    size={15}
                    className={isActive ? "text-primary" : ""}
                  />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* New Experiment CTA */}
        <div className="px-3 pb-3">
          <Link href="/experiments/new">
            <Button
              data-testid="button-new-experiment"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 font-medium"
            >
              <Plus size={14} />
              New Experiment
            </Button>
          </Link>
        </div>

        {/* Sensitivity */}
        <SensitivityControl />

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground/60 font-mono tracking-wider">
            PRAXIS / v1
          </span>
          <button
            data-testid="button-theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-24 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
