import { Link, useLocation } from "wouter";
import { LayoutDashboard, FlaskConical, BookOpen, GitFork, Gem } from "lucide-react";
import { LayoutDashboard, FlaskConical, BookOpen, GitFork, Plus, Scale } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Lab" },
  { href: "/experiments", icon: FlaskConical, label: "Experiments" },
  { href: "/refractions", icon: Gem, label: "Refractions" },
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
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          let isActive: boolean;
          if (href === "/") {
            isActive = location === href || location === "";
          } else if (href === "/experiments") {
            isActive = location === href || location.startsWith("/experiments/");
          } else {
            isActive = location === href || location.startsWith(href + "/");
          }
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase()}`}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[10px] font-mono leading-tight ${
                isActive ? "text-primary" : "text-muted-foreground/30"
              }`}>
                {label.toLowerCase()}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
