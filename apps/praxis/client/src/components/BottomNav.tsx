import { Link, useLocation } from "wouter";
import { Home, FlaskConical, BookOpen, GitFork, Scale, CircleDot } from "lucide-react";

const LUMEN_HUB_URL = "https://lumen-os.up.railway.app";

const NAV_ITEMS = [
  { href: "/experiments", icon: FlaskConical, label: "Experiments" },
  { href: "/doctrines", icon: BookOpen, label: "Doctrines" },
  { href: "/tensions", icon: GitFork, label: "Tensions" },
  { href: "/decision-experiments", icon: Scale, label: "Decisions" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      data-testid="nav-bottom"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Top row: Lumen Home + App Home */}
      <div className="flex border-b border-border/30">
        <a
          href={LUMEN_HUB_URL}
          data-testid="nav-lumen"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <CircleDot className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[10px] font-mono">lumen</span>
        </a>
        <div className="w-px bg-border/30" />
        <Link
          href="/"
          data-testid="nav-app-home"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <Home className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="text-[10px] font-mono">praxis</span>
        </Link>
      </div>

      {/* Bottom row: 4 internal pages */}
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/"
            ? location === "/" || location === ""
            : location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase()}`}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-2 py-2 rounded-lg transition-all ${
                isActive
                  ? "text-[#d4a03a]"
                  : "text-muted-foreground/40 hover:text-muted-foreground"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[10px] font-mono leading-tight ${isActive ? "text-[#d4a03a]/80" : "text-muted-foreground/30"}`}>
                {label.toLowerCase()}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
