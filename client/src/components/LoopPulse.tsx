import { useQuery } from "@tanstack/react-query";

interface PulseDay {
  date: string;
  count: number;
  tools: {
    liminal: number;
    parallax: number;
    praxis: number;
    axiom: number;
  };
}

interface PulseData {
  days: PulseDay[];
  toolBreakdown: {
    liminal: number;
    parallax: number;
    praxis: number;
    axiom: number;
  };
}

interface LoopPulseProps {
  data?: PulseData;
}

const TOOL_COLORS: Record<string, string> = {
  liminal: "#9c8654",
  parallax: "#4d8c9e",
  praxis: "#c4943e",
  axiom: "#3d7bba",
};

function formatDayLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short" }).charAt(0);
  } catch {
    return "·";
  }
}

function isToday(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  } catch {
    return false;
  }
}

export default function LoopPulse({ data: propData }: LoopPulseProps) {
  const { data: fetchedData, isLoading } = useQuery<PulseData>({
    queryKey: ["/api/loop/pulse"],
    queryFn: async () => {
      const res = await fetch("/api/loop/pulse", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to fetch pulse");
      return res.json();
    },
    enabled: !propData,
  });

  const data = propData ?? fetchedData;
  const totalReflections = data ? Object.values(data.toolBreakdown).reduce((a, b) => a + b, 0) : 0;

  return (
    <section className="pulse-band up" aria-label="Loop activity pulse">
      <div className="wrap">
        <div className="pulse-inner">
          <div className="pulse-meta">
            <span className="pulse-eye">Loop Pulse</span>
            <h2 className="pulse-title">Last 7 Days</h2>
            {isLoading ? (
              <p className="pulse-empty">Loading…</p>
            ) : data ? (
              <>
                <p className="pulse-total"><strong>{totalReflections}</strong> total reflections</p>
                <div className="pulse-badges">
                  {(["liminal", "parallax", "praxis", "axiom"] as const).map((tool) => (
                    <span key={tool} className="pulse-badge">
                      <span className={`pulse-badge__dot pulse-badge__dot--${tool}`} />
                      {tool} {data.toolBreakdown[tool]}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="pulse-empty">No data yet.</p>
            )}
          </div>

          {data && (
            <div className="pulse-chart">
              <div className="pulse-dots" aria-label="Seven-day activity sparkline">
                {data.days.map((day, i) => {
                  const active = day.count > 0;
                  const size = active ? Math.max(6, Math.min(14, day.count * 3 + 4)) : 6;
                  return (
                    <div key={i} className={`pulse-day ${isToday(day.date) ? "pulse-day--today" : ""}`}>
                      <span
                        className={`pulse-day__dot ${!active ? "pulse-day__dot--zero" : ""}`}
                        style={{ width: size, height: size }}
                        title={active ? `${day.count} reflections` : "No activity"}
                      />
                      <span className="pulse-day__label">{formatDayLabel(day.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
