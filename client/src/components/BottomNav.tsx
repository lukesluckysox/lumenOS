import { ssoNavigate } from "@/lib/sso";

const APPS = [
  {
    label: "Liminal",
    href: "https://liminal-app.up.railway.app/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z"/>
      </svg>
    ),
  },
  {
    label: "Parallax",
    href: "https://parallaxapp.up.railway.app/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    label: "Praxis",
    href: "https://praxis-app.up.railway.app/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    label: "Axiom",
    href: "https://axiomtool-production.up.railway.app/#/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  return (
    <nav className="lumen-bottom-nav" aria-label="Quick app navigation">
      <div className="lumen-bottom-nav__inner">
        {APPS.map(({ label, href, icon }) => (
          <button
            key={label}
            onClick={() => ssoNavigate(href)}
            className="lumen-bottom-nav__item"
          >
            {icon}
            <span>{label.toLowerCase()}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
