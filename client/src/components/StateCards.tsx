import { useEffect, useState } from "react";
import { ssoNavigate } from "@/lib/sso";

const CARDS = [
  { key: "axiom", label: "Constitutional Principles", sub: "Proposals I examine and promote in Axiom become governing principles here", color: "gold", href: "https://axiomtool-production.up.railway.app/#/constitution", stateId: "state-axiom" },
  { key: "tension", label: "Active Tensions", sub: "Competing truths I surface in Axiom show up here as live tensions", color: "red", href: "https://axiomtool-production.up.railway.app/#/tensions", stateId: "state-tension" },
  { key: "experiment", label: "Live Experiments", sub: "Experiments I design in Praxis to test my beliefs appear here", color: "amber", href: "https://praxis-app.up.railway.app/#/experiments", stateId: "state-experiment" },
  { key: "pending", label: "Pending Inquiries", sub: "Open inquiries from my Liminal sessions collect here for follow-up", color: "brass", href: "https://liminal-app.up.railway.app/archive", stateId: "state-pending" },
];

export default function StateCards() {
  const [counts, setCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/loop/state", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setCounts(d);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="state-band" id="cockpit-state" aria-label="Current state">
      <div className="wrap">
        <div className="state-header">
          <span className="state-eye">Current State</span>
          <h2 className="state-title">Where things stand.</h2>
        </div>
        <div className="state-grid" role="list" id="state-grid">
          {CARDS.map((c) => (
            <a
              key={c.key}
              className={`state-card state-card--${c.color}`}
              role="listitem"
              href={c.href}
              onClick={(e) => { e.preventDefault(); ssoNavigate(c.href); }}
              aria-label={`View ${c.label}`}
            >
              <svg className="state-card__arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
              <span className="state-card__label">{c.label}</span>
              <span className="state-card__count">{counts[c.key] ?? "—"}</span>
              <span className="state-card__sub">{c.sub}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
