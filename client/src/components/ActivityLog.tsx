import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface FeedEvent {
  sourceApp: string;
  eventType: string;
  summary?: string;
  createdAt: string;
}

const EVENT_VERBS: Record<string, string> = {
  belief_candidate: "surfaced a belief worth examining",
  tension_candidate: "revealed an unresolved tension",
  pattern_candidate: "detected a behavioral pattern",
  hypothesis_candidate: "proposed a hypothesis for testing",
  constitutional_promotion: "promoted a truth to constitutional status",
  truth_revision: "revised a foundational belief",
  experiment_completed: "completed a lived experiment",
  doctrine_crystallized: "crystallized a working doctrine",
};

function relativeTime(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ActivityLog() {
  const [open, setOpen] = useState(false);
  const { data: events } = useQuery<FeedEvent[]>({
    queryKey: ["/api/loop/feed"],
    queryFn: async () => {
      const r = await fetch("/api/loop/feed", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const shown = (events || []).slice(0, 10);

  return (
    <section className={`feed-band up ${open ? "feed-band--open" : ""}`} aria-label="Activity feed">
      <div className="feed-header">
        <div>
          <span className="feed-header__eye">Activity Log</span>
          <h2 className="feed-header__title">Event History</h2>
        </div>
        <button className="feed-toggle" onClick={() => setOpen(!open)}>
          <span>{open ? "Hide activity log" : "View activity log"}</span>
          <svg className="feed-toggle__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </div>

      <div className="feed-list">
        {shown.length === 0 ? (
          <div className="feed-empty">
            <p className="feed-empty__text">Nothing here yet. As I reflect in Liminal, run experiments in Praxis, and check in through Parallax, my activity will stream into this feed.</p>
          </div>
        ) : (
          shown.map((ev, i) => (
            <article key={i} className="feed-item">
              <span className={`feed-item__dot feed-item__dot--${ev.sourceApp}`} />
              <div className="feed-item__body">
                <div className="feed-item__meta">
                  <span className="feed-item__app">{ev.sourceApp?.charAt(0).toUpperCase() + ev.sourceApp?.slice(1)}</span>
                  <span className="feed-item__sep">·</span>
                  <span className="feed-item__verb">{EVENT_VERBS[ev.eventType] || "left a mark"}</span>
                  <span className="feed-item__sep">·</span>
                  <time className="feed-item__time">{relativeTime(ev.createdAt)}</time>
                </div>
                {ev.summary && <p className="feed-item__summary">{ev.summary}</p>}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
