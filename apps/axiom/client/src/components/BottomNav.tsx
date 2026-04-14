import { Link, useLocation } from "wouter";
import { FileText, Zap, RotateCcw, Shield, Plus, CircleDot } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: FileText, label: "Proposals" },
  { href: "/tensions", icon: Zap, label: "Tensions" },
  { href: "/new", icon: Plus, label: "New" },
  { href: "/revisions", icon: RotateCcw, label: "Revisions" },
  { href: "/constitution", icon: Shield, label: "Constitution" },
];

const LUMEN_HUB_URL = "https://lumen-os.up.railway.app";

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      data-testid="nav-bottom"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar/90 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2">
        <a
          href={LUMEN_HUB_URL}
          data-testid="nav-bottom-lumen"
          className="relative flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg transition-all min-h-[44px] min-w-[44px] text-sidebar-foreground/30 hover:text-sidebar-foreground/60"
        >
          <CircleDot className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/25">lumen</span>
        </a>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/"
            ? (location === "/" || location === "")
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
