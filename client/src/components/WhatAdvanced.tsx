import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface PromotedItem {
  candidateType: string;
  targetApp?: string;
  title: string;
  explanation?: string;
  updatedAt: string;
}

function relativeTime(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WhatAdvanced() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<{ promoted: PromotedItem[] }>({
    queryKey: ["/api/loop/promoted"],
    queryFn: async () => {
      const r = await fetch("/api/loop/promoted", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const items = data?.promoted?.slice(0, 3) || [];

  return (
    <section className={`advanced-band ${open ? "advanced-band--open" : ""}`} id="cockpit-advanced" aria-label="What advanced in the loop">
      <div className="wrap wrap--mid">
        <div className="advanced-header">
          <div>
            <span className="advanced-header__eye">The Loop</span>
            <h2 className="advanced-header__title">What Advanced</h2>
          </div>
          <button className="advanced-toggle" id="advanced-toggle" onClick={() => setOpen(!open)}
            aria-expanded={open} aria-controls="advanced-list">
            <span className="advanced-toggle__label">{open ? "Hide" : "Show recent"}</span>
            <svg className="advanced-toggle__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
        </div>

        <div id="advanced-list" className="advanced-list" role="list">
          {items.length === 0 ? (
            <div className="advanced-empty">
              <p className="advanced-empty__text">Nothing has advanced yet. As the loop processes reflections and patterns, meaningful progress will appear here.</p>
            </div>
          ) : (
            items.map((item, i) => (
              <article key={i} className="advanced-card" data-dest={item.targetApp}>
                <div className="advanced-card__header">
                  <span className="advanced-card__type">{item.candidateType.replace(/_/g, " ")}</span>
                  {item.targetApp && <span className="advanced-card__dest">→ {item.targetApp.charAt(0).toUpperCase() + item.targetApp.slice(1)}</span>}
                </div>
                <h3 className="advanced-card__title">{item.title}</h3>
                {item.explanation && <p className="advanced-card__why">{item.explanation}</p>}
                <time className="advanced-card__time">{relativeTime(item.updatedAt)}</time>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
