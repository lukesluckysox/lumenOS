import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  StatSkeleton,
  ExperimentCardSkeleton,
  PrimaryTensionSkeleton,
  DoctrineDashboardSkeleton,
} from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";
import type { Experiment, Doctrine, Tension } from "@shared/schema";
import { StatusBadge, PhaseDot } from "@/components/ExperimentComponents";
import { ErrorCard } from "@/components/ErrorCard";
import { formatDate, getTensionLabel } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Summary {
  experiments: { total: number; active: number; observing: number; completed: number };
  doctrines: { total: number; emerging: number; established: number };
  tensions: { total: number; primary: Tension | null };
}

export default function Dashboard() {
  const { toast } = useToast();
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery<Summary>({
    queryKey: ["/api/summary"],
  });
  const { data: experiments, isLoading: expLoading, isError: expError } = useQuery<Experiment[]>({
    queryKey: ["/api/experiments"],
  });
  const { data: doctrines, isLoading: docLoading, isError: docError } = useQuery<Doctrine[]>({
    queryKey: ["/api/doctrines"],
  });
  const { data: tensions, isLoading: tensionLoading, isError: tensionError } = useQuery<Tension[]>({
    queryKey: ["/api/tensions"],
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

  if (summaryError && expError && docError && tensionError) {
    return (
      <div className="p-4 md:p-8 max-w-4xl">
        <ErrorCard onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const activeExperiments = experiments?.filter(e => e.status === "active" || e.status === "observing").slice(0, 3) ?? [];
  const recentDoctrines = doctrines?.slice(0, 3) ?? [];
  const primaryTension = tensions?.find(t => t.isPrimary);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-10">
        <h2 className="font-display text-xl font-semibold text-foreground mb-1">
          The Laboratory
        </h2>
        <p className="text-sm text-muted-foreground">
          Your ongoing record of hypotheses, experiments, and evidence.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {summaryLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : [
          {
            label: "Active Trials",
            value: (summary?.experiments.active ?? 0) + (summary?.experiments.observing ?? 0),
            sub: "in progress",
          },
          {
            label: "Working Doctrines",
            value: summary?.doctrines.total ?? 0,
            sub: "principles extracted",
          },
          {
            label: "Core Tensions",
            value: summary?.tensions.total ?? 0,
            sub: "life axes identified",
          },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-md p-5"
          >
            <p className="font-display text-xl font-semibold text-foreground tabular-nums">
              {stat.value}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Primary Tension */}
      {(primaryTension || tensionLoading) && (
        <div className="mb-10">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium mb-3">
            Primary Tension
          </h3>
          {tensionLoading ? (
            <PrimaryTensionSkeleton />
          ) : primaryTension ? (
            <Link href="/tensions">
              <div
                data-testid="card-primary-tension"
                className="bg-card border border-border rounded-md p-5 hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-display text-lg font-medium text-foreground">
                    {primaryTension.poleA}
                  </span>
                  <span className="text-primary font-light text-base">↔</span>
                  <span className="font-display text-lg font-medium text-foreground">
                    {primaryTension.poleB}
                  </span>
                  <ArrowRight size={14} className="ml-auto text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                {primaryTension.insight && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {primaryTension.insight}
                  </p>
                )}
              </div>
            </Link>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Active Experiments */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium">
              Active Experiments
            </h3>
            <Link href="/experiments">
              <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                View all
              </span>
            </Link>
          </div>

          {expLoading ? (
            <div className="space-y-2">
              <ExperimentCardSkeleton />
              <ExperimentCardSkeleton />
            </div>
          ) : activeExperiments.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">No active experiments. Start one to test a belief — results flow into Axiom as proposals for governing principles.</p>
              <Link href="/experiments/new">
                <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                  <Plus size={13} />
                  Begin an experiment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activeExperiments.map(exp => (
                <Link key={exp.id} href={`/experiments/${exp.id}`}>
                  <div
                    data-testid={`card-experiment-${exp.id}`}
                    className="bg-card border border-border rounded-md p-4 hover:border-primary/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <PhaseDot status={exp.status} />
                      <span className="trial-badge">Trial #{exp.trialNumber}</span>
                      <StatusBadge status={exp.status} className="ml-auto" />
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug mt-1.5 line-clamp-2">
                      {exp.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                      {exp.hypothesis}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Emerging Doctrines */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium">
              Working Doctrines
            </h3>
            <Link href="/doctrines">
              <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                View all
              </span>
            </Link>
          </div>

          {docLoading ? (
            <div className="space-y-2">
              <DoctrineDashboardSkeleton />
              <DoctrineDashboardSkeleton />
            </div>
          ) : recentDoctrines.length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Principles you've validated through experimentation will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDoctrines.map(doc => (
                <Link key={doc.id} href="/doctrines">
                  <div
                    data-testid={`card-doctrine-${doc.id}`}
                    className="bg-card border border-border rounded-md p-4 hover:border-primary/20 transition-colors cursor-pointer"
                  >
                    <p className="text-sm text-foreground leading-relaxed font-medium italic font-display">
                      "{doc.statement}"
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        doc.status === "established"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {doc.status === "established" ? "Established" : "Emerging"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
