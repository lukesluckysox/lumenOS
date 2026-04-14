import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, CheckCircle2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPillsSkeleton, ExperimentCardSkeleton } from "@/components/Skeleton";
import { StatusBadge, PhaseDot, PhaseProgress, SourceTag } from "@/components/ExperimentComponents";
import type { Experiment } from "@shared/schema";
import { formatDateShort } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ErrorCard";

type Filter = "all" | "active" | "observing" | "completed" | "archived";

// Source dot colors for proposed cards
const SOURCE_DOT: Record<string, string> = {
  parallax: "#4d8c9e",
  liminal: "#9c8654",
  lumen_push: "#FFD166",
};

// ── Loop Onboarding Card for Praxis ──────────────────────────────────────────
function ProposedOnboarding({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("praxis_loop_onboarding_shown");
  });

  if (!visible || !show) return null;

  function dismiss() {
    localStorage.setItem("praxis_loop_onboarding_shown", "1");
    setVisible(false);
  }

  return (
    <div
      className="mb-4 rounded-md border border-border/50 bg-card/30 overflow-hidden"
      style={{ borderLeft: "2px solid #4d8c9e" }}
      data-testid="card-loop-onboarding-praxis"
    >
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold" style={{ color: "#4d8c9e" }}>
            This is a proposed experiment.
          </p>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors text-xs leading-none flex-shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          When patterns emerge from your reflections — a trend, an oscillation, a discrepancy — experiments are
          suggested that you can run in your actual life. You decide whether to accept, modify, or dismiss.
        </p>
      </div>
    </div>
  );
}

export default function Experiments() {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: experiments, isLoading, isError } = useQuery<Experiment[]>({
    queryKey: ["/api/experiments"],
  });

  // ── Loop toast: show once per session when recent inbound experiments exist ──
  useEffect(() => {
    const key = "praxis_loop_toast_shown";
    if (sessionStorage.getItem(key)) return;
    fetch("/api/loop/recent-inbound")
      .then(r => r.ok ? r.json() : null)
      .then((data: { events: { count: number }[] } | null) => {
        if (!data?.events?.length) return;
        const count = data.events[0].count;
        if (count <= 0) return;
        sessionStorage.setItem(key, "1");
        const msg = count === 1
          ? "A hypothesis arrived from the Loop for testing."
          : `${count} hypotheses arrived from the Loop for testing.`;
        toast({ title: msg, duration: 4000 });
      })
      .catch(() => {});
  }, [toast]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/experiments/${id}`, { status: "active" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      toast({ title: "Experiment accepted and moved to active." });
    },
    onError: () => toast({ title: "Failed to accept experiment.", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/experiments/${id}`, { status: "dismissed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
    },
    onError: () => toast({ title: "Failed to dismiss.", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/experiments/${id}`, { status: "archived" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
    },
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "observing", label: "Observing" },
    { key: "completed", label: "Completed" },
    { key: "archived", label: "Archived" },
  ];

  const proposed = experiments?.filter(e => e.status === "proposed") ?? [];

  const filtered = experiments?.filter(e => {
    if (e.status === "proposed") return false; // proposed always shown separately
    if (activeFilter === "all") return e.status !== "archived" && e.status !== "dismissed";
    return e.status === activeFilter;
  }) ?? [];

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-1">
            Experiments
          </h2>
          <p className="text-sm text-muted-foreground">
            Controlled trials designed to test what you think you believe.
          </p>
        </div>
        <Link href="/experiments/new">
          <Button
            data-testid="button-new-experiment-page"
            size="sm"
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={14} />
            New Experiment
          </Button>
        </Link>
      </div>

      {/* ── The Loop Proposes ─────────────────────────────────────────────── */}
      {!isLoading && proposed.length > 0 && (
        <section className="mb-8">
          {/* One-time onboarding note explaining proposed experiments */}
          <ProposedOnboarding show={proposed.length > 0} />
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">The Loop Proposes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              These experiments were suggested by your other tools.
            </p>
          </div>
          <div className="space-y-3">
            {proposed.map(exp => (
              <div
                key={exp.id}
                data-testid={`row-proposed-${exp.id}`}
                className="border border-dashed border-border/70 rounded-md p-4 bg-muted/20"
              >
                {/* Top row: source dot + source + title */}
                <div className="flex items-start gap-2.5 mb-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: SOURCE_DOT[exp.source] ?? "#888" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SourceTag source={exp.source} />
                    </div>
                    <h4 className="text-sm font-medium text-foreground leading-snug">
                      {exp.title}
                    </h4>
                  </div>
                </div>

                {/* Provenance / reason */}
                {exp.sourceDescription && (
                  <p className="text-xs text-muted-foreground leading-relaxed ml-4.5 mb-3 pl-0.5 italic">
                    {exp.sourceDescription}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => acceptMutation.mutate(exp.id)}
                    disabled={acceptMutation.isPending || dismissMutation.isPending}
                    className="gap-1.5 text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <CheckCircle2 size={11} />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLocation(`/experiments/new?from=${exp.id}`)}
                    className="gap-1.5 text-xs h-7 border-border text-foreground hover:bg-accent"
                  >
                    <Pencil size={11} />
                    Modify
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissMutation.mutate(exp.id)}
                    disabled={acceptMutation.isPending || dismissMutation.isPending}
                    className="gap-1.5 text-xs h-7 text-muted-foreground ml-auto hover:text-foreground"
                  >
                    <X size={11} />
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      {isLoading ? (
        <FilterPillsSkeleton />
      ) : (
        <div className="flex items-center gap-1 mb-6 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              data-testid={`filter-${f.key}`}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "px-3 py-1 text-xs rounded font-medium transition-colors",
                activeFilter === f.key
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
            >
              {f.label}
              {f.key !== "all" && experiments && (
                <span className="ml-1.5 text-muted-foreground/60">
                  {experiments.filter(e => e.status === f.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isError ? (
        <ErrorCard message="Could not load experiments." onRetry={() => window.location.reload()} />
      ) : isLoading ? (
        <div className="space-y-3">
          <ExperimentCardSkeleton />
          <ExperimentCardSkeleton />
          <ExperimentCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-md py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {activeFilter === "all"
              ? "No experiments yet. Design a test for a belief, observe what happens, and let the results inform what I hold true."
              : `No ${activeFilter} experiments.`}
          </p>
          {activeFilter === "all" && (
            <Link href="/experiments/new">
              <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                <Plus size={13} />
                Design my first experiment
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exp => (
            <Link key={exp.id} href={`/experiments/${exp.id}`}>
              <div
                data-testid={`row-experiment-${exp.id}`}
                className="bg-card border border-border rounded-md p-5 hover:border-primary/20 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <PhaseDot status={exp.status} />
                  <span className="trial-badge">Trial #{exp.trialNumber}</span>
                  <SourceTag source={exp.source} />
                  <StatusBadge status={exp.status} className="ml-auto" />
                  <span className="text-xs text-muted-foreground/60">{formatDateShort(exp.createdAt)}</span>
                </div>

                <h3 className="font-medium text-foreground text-sm leading-snug mb-2">
                  {exp.title}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                  <span className="text-muted-foreground/60">Hyp. </span>
                  {exp.hypothesis}
                </p>

                <PhaseProgress experiment={exp} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
