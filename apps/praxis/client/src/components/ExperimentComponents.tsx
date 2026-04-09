import { cn } from "@/lib/utils";

// ── Status Badge ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  proposed: { label: "Proposed", color: "bg-amber-500/10 text-amber-400 dark:text-amber-300" },
  active: { label: "Active", color: "bg-blue-500/10 text-blue-400 dark:text-blue-300" },
  observing: { label: "Observing", color: "bg-primary/10 text-primary" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground" },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground/60" },
  dismissed: { label: "Dismissed", color: "bg-muted text-muted-foreground/50" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    label: status,
    color: "bg-muted text-muted-foreground",
  };
  return (
    <span
      data-testid={`badge-status-${status}`}
      className={cn(
        "inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium",
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}

// ── Phase Dot ─────────────────────────────────────────────────────────────

const PHASE_DOT_COLOR = {
  proposed: "bg-amber-400",
  active: "bg-blue-400",
  observing: "bg-primary",
  completed: "bg-muted-foreground/40",
  archived: "bg-muted-foreground/20",
  dismissed: "bg-muted-foreground/15",
};

export function PhaseDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0",
        PHASE_DOT_COLOR[status as keyof typeof PHASE_DOT_COLOR] ?? "bg-muted-foreground"
      )}
    />
  );
}

// ── Source Tag ────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  liminal: { label: "From inquiry", color: "text-purple-400 dark:text-purple-300" },
  parallax: { label: "From patterns", color: "text-teal-500 dark:text-teal-400" },
  lumen_push: { label: "From reflections", color: "text-yellow-400 dark:text-yellow-300" },
  manual: { label: "Your experiment", color: "text-muted-foreground" },
};

export function SourceTag({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG] ?? {
    label: source,
    color: "text-muted-foreground",
  };
  return (
    <span className={cn("text-xs font-medium uppercase tracking-wider", config.color)}>
      {config.label}
    </span>
  );
}

// ── Phase Label ───────────────────────────────────────────────────────────

const PHASES = ["hypothesis", "design", "observation", "meaning"] as const;

export function PhaseProgress({ experiment }: { experiment: { status: string; observation: string; meaningExtraction: string } }) {
  const getPhase = () => {
    if (experiment.status === "completed") return 4;
    if (experiment.meaningExtraction) return 4;
    if (experiment.observation) return 3;
    if (experiment.status === "observing") return 2;
    return 1;
  };
  const currentPhase = getPhase();

  return (
    <div className="flex items-center gap-1">
      {["Hypothesis", "Design", "Observation", "Meaning"].map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={cn(
              "h-1 w-8 rounded-full transition-colors",
              i < currentPhase ? "bg-primary" : "bg-border"
            )}
          />
          {i < 3 && <div className="w-0.5" />}
        </div>
      ))}
    </div>
  );
}
