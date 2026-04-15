import { Link, useLocation } from "wouter";
import { Home, FileText, Zap, RotateCcw, Shield, CircleDot } from "lucide-react";

const LUMEN_HUB_URL = "https://lumen-os.up.railway.app";

const NAV_ITEMS = [
  { href: "/", icon: FileText, label: "Claims" },
  { href: "/tensions", icon: Zap, label: "Tensions" },
  { href: "/revisions", icon: RotateCcw, label: "Revisions" },
  { href: "/constitution", icon: Shield, label: "Constitution" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      data-testid="nav-bottom"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar/90 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Top row: Lumen Home + App Home */}
      <div className="flex border-b border-sidebar-border/30">
        <a
          href={LUMEN_HUB_URL}
          data-testid="nav-bottom-lumen"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
        >
          <CircleDot className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[10px] font-mono uppercase tracking-wider">lumen</span>
        </a>
        <div className="w-px bg-sidebar-border/30" />
        <Link
          href="/"
          data-testid="nav-bottom-app-home"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
        >
          <Home className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[10px] font-mono uppercase tracking-wider">axiom</span>
        </Link>
      </div>

      {/* Bottom row: 4 internal pages */}
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/"
            ? location === "/" || location === ""
            : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-bottom-${label.toLowerCase()}`}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg transition-all min-h-[44px] min-w-[44px] ${
                isActive
                  ? "text-[hsl(var(--sidebar-primary))]"
                  : "text-sidebar-foreground/30 hover:text-sidebar-foreground/60"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[10px] font-mono uppercase tracking-wider ${isActive ? "text-[hsl(var(--sidebar-primary))]/80" : "text-sidebar-foreground/25"}`}>
                {label.toLowerCase()}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
