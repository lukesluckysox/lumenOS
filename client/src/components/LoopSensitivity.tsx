import { useState, useEffect } from "react";

const LEVELS = ["low", "medium", "high"] as const;
type Level = typeof LEVELS[number];

const DESCRIPTIONS: Record<Level, string> = {
  low: "The loop is casting a wide net — more signals will be promoted sooner.",
  medium: "Balanced sensitivity — patterns need moderate repetition to advance.",
  high: "The loop is conservative — only well-evidenced patterns will advance.",
};

const DETAIL_DL = [
  { dt: "Low", dd: "Surfaces more possibilities sooner. Good for exploration." },
  { dt: "Medium", dd: "Balanced. Waits for modest repetition before promoting." },
  { dt: "High", dd: "Waits for strong repetition and evidence. Promotes less, but with more conviction." },
];

interface Props { userId?: number }

export default function LoopSensitivity({ userId }: Props) {
  const [value, setValue] = useState<Level>("medium");
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/epistemic/sensitivity/${userId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.sensitivity) setValue(d.sensitivity); })
      .catch(() => {});
  }, [userId]);

  async function set(v: Level) {
    setValue(v);
    try {
      await fetch(`/api/epistemic/sensitivity/${userId || 1}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sensitivity: v }),
      });
    } catch {}
  }

  return (
    <div>
      {/* Main sensitivity row — matches original inline styles from lines 3652-3662 */}
      <div style={{ border: "1px solid rgba(141,153,174,0.15)", borderRadius: "6px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: "10px", letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase" as const, marginBottom: "0.25rem" }}>Loop Sensitivity</div>
          <div style={{ fontSize: "12px", color: "var(--muted)", opacity: 0.6 }}>Controls how readily the loop promotes signals to candidates</div>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
          {LEVELS.map((l) => (
            <button key={l} onClick={() => set(l)}
              className={`sens-pill ${value === l ? "sens-pill--active" : ""}`}
              data-val={l}
              style={{ fontFamily: "monospace", fontSize: "10px", letterSpacing: "0.1em", padding: "0.35rem 0.75rem", borderRadius: "4px", border: value === l ? "1px solid var(--gold)" : "1px solid rgba(141,153,174,0.25)", background: value === l ? "var(--gold-dim, rgba(255,209,102,0.08))" : "transparent", color: value === l ? "var(--gold)" : "var(--muted)", cursor: "pointer", transition: "all 0.15s", textTransform: "uppercase" as const }}>
              {l === "medium" ? "MED" : l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation section — matches original .sens-explain structure */}
      <div className="sens-explain">
        <p className="sens-explain__current">{DESCRIPTIONS[value]}</p>
        <button className="sens-explain__more" onClick={() => setShowDetail(!showDetail)} aria-expanded={showDetail}>
          {showDetail ? "Hide details" : "What does this control?"}
        </button>
        {showDetail && (
          <div className="sens-explain__detail">
            <p>Sensitivity determines how quickly the loop promotes recurring material into candidates, prompts, and downstream actions.</p>
            <dl>
              {DETAIL_DL.map((d) => (
                <span key={d.dt}><dt>{d.dt}</dt><dd>{d.dd}</dd></span>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
