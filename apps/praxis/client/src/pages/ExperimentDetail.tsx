import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Archive, Pencil, Save, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExperimentDetailTitleSkeleton, PhaseSectionSkeleton } from "@/components/Skeleton";
import { StatusBadge, SourceTag, PhaseProgress } from "@/components/ExperimentComponents";
import type { Experiment } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ErrorCard } from "@/components/ErrorCard";

// ── Provenance breadcrumb ─────────────────────────────────────────────────

const SOURCE_BORDER: Record<string, string> = {
  parallax: "#4d8c9e",
  liminal: "#9c8654",
  lumen_push: "#FFD166",
};

const SOURCE_LABEL: Record<string, string> = {
  parallax: "Behavioral pattern",
  liminal: "Reflective inquiry",
  lumen_push: "Your reflections",
};

function ProvenanceBreadcrumb({ experiment }: { experiment: Experiment }) {
  if (experiment.source === "manual") return null;
  const borderColor = SOURCE_BORDER[experiment.source] ?? "#888";
  const sourceLabel = SOURCE_LABEL[experiment.source] ?? experiment.source;
  return (
    <div
      className="mb-6 pl-4 py-3 pr-4 rounded-r-md bg-muted/30 border-l-2"
      style={{ borderLeftColor: borderColor }}
    >
      <p className="text-xs font-medium text-foreground/80 mb-0.5">
        Origin: {sourceLabel}
      </p>
      {experiment.sourceDescription && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {experiment.sourceDescription}
        </p>
      )}
      <p className="text-xs text-muted-foreground/50 italic mt-1.5">
        Proposed {formatDate(experiment.createdAt)}
        {experiment.status !== "proposed" && experiment.status !== "dismissed" && (
          <> · Accepted and moved to {experiment.status}</>
        )}
      </p>
    </div>
  );
}

interface Phase {
  key: "hypothesis" | "design" | "experimentConstraint" | "observation" | "meaningExtraction";
  label: string;
  sublabel: string;
  editable: boolean;
  alwaysShow: boolean;
}

const PHASES: Phase[] = [
  {
    key: "hypothesis",
    label: "Hypothesis",
    sublabel: "What you currently believe to be true.",
    editable: true,
    alwaysShow: true,
  },
  {
    key: "design",
    label: "Experiment",
    sublabel: "The specific action taken to test this belief.",
    editable: true,
    alwaysShow: true,
  },
  {
    key: "experimentConstraint",
    label: "Constraint",
    sublabel: "Conditions imposed to prevent self-deception.",
    editable: true,
    alwaysShow: false,
  },
  {
    key: "observation",
    label: "Observation",
    sublabel: "What actually happened — without interpretation.",
    editable: true,
    alwaysShow: false,
  },
  {
    key: "meaningExtraction",
    label: "Meaning Extraction",
    sublabel: "What this outcome reveals about how you operate.",
    editable: true,
    alwaysShow: false,
  },
];

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: experiment, isLoading, isError } = useQuery<Experiment>({
    queryKey: ["/api/experiments", id],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Experiment> & { completedAt?: number | null }) => {
      const res = await apiRequest("PATCH", `/api/experiments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/experiments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setEditingPhase(null);
    },
    onError: () => toast({ title: "Failed to save.", variant: "destructive" }),
  });

  const startEdit = (phase: Phase, current: string) => {
    setEditingPhase(phase.key);
    setEditValue(current);
  };

  const saveEdit = (key: string) => {
    updateMutation.mutate({ [key]: editValue });
  };

  const markObserving = () => {
    updateMutation.mutate({ status: "observing" });
    toast({ title: "Moved to Observation phase." });
  };

  const markCompleted = () => {
    updateMutation.mutate({ status: "completed", completedAt: Date.now() });
    toast({ title: "Experiment completed." });
  };

  const archiveExperiment = () => {
    updateMutation.mutate({ status: "archived" });
    setLocation("/experiments");
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="mb-6">
          <div className="animate-pulse bg-muted/30 rounded h-4 w-28" />
        </div>
        <ExperimentDetailTitleSkeleton />
        <div className="space-y-5">
          <PhaseSectionSkeleton />
          <PhaseSectionSkeleton />
          <PhaseSectionSkeleton />
          <PhaseSectionSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <ErrorCard message="Could not load this experiment." onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-muted-foreground">Experiment not found.</p>
        <Link href="/experiments">
          <Button variant="ghost" size="sm" className="mt-2 gap-1.5">
            <ArrowLeft size={13} /> Back to Experiments
          </Button>
        </Link>
      </div>
    );
  }

  const getFieldValue = (key: keyof Experiment) => String(experiment[key] ?? "");

  const visiblePhases = PHASES.filter(p =>
    p.alwaysShow ||
    getFieldValue(p.key) ||
    editingPhase === p.key ||
    p.key === "observation" ||
    p.key === "meaningExtraction"
  );

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      {/* Back */}
      <Link href="/experiments">
        <button
          data-testid="button-back"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft size={12} />
          All Experiments
        </button>
      </Link>

      {/* Provenance breadcrumb — shown for non-manual experiments */}
      <ProvenanceBreadcrumb experiment={experiment} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="trial-badge">Trial #{experiment.trialNumber}</span>
          <SourceTag source={experiment.source} />
          <StatusBadge status={experiment.status} className="ml-auto" />
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground leading-tight mb-1">
          {experiment.title}
        </h2>
        <p className="text-xs text-muted-foreground">
          Initiated {formatDate(experiment.createdAt)}
          {experiment.completedAt && ` · Completed ${formatDate(experiment.completedAt)}`}
        </p>
        <div className="mt-4">
          <PhaseProgress experiment={experiment} />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-5">
        {visiblePhases.map(phase => {
          const value = getFieldValue(phase.key);
          const isEditing = editingPhase === phase.key;
          const isEmpty = !value;

          return (
            <div
              key={phase.key}
              data-testid={`phase-${phase.key}`}
              className="bg-card border border-border rounded-md overflow-hidden"
            >
              <div className="px-5 pt-4 pb-2 flex items-start justify-between">
                <div>
                  <h3 className="text-xs uppercase tracking-widest font-medium text-muted-foreground/70">
                    {phase.label}
                  </h3>
                  <p className="text-xs text-muted-foreground/50 mt-0.5">{phase.sublabel}</p>
                </div>
                {!isEditing && phase.editable && experiment.status !== "archived" && (
                  <button
                    data-testid={`button-edit-${phase.key}`}
                    onClick={() => startEdit(phase, value)}
                    className="text-muted-foreground/40 hover:text-muted-foreground p-1 rounded transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>

              <div className="px-5 pb-4">
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      data-testid={`textarea-${phase.key}`}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="text-sm bg-muted/40 border-border resize-none min-h-[100px] focus:border-primary/40"
                      placeholder={`Enter ${phase.label.toLowerCase()}...`}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-save-${phase.key}`}
                        size="sm"
                        onClick={() => saveEdit(phase.key)}
                        disabled={updateMutation.isPending}
                        className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                      >
                        <Save size={11} /> Save
                      </Button>
                      <Button
                        data-testid={`button-cancel-${phase.key}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPhase(null)}
                        className="gap-1.5 text-xs"
                      >
                        <X size={11} /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : isEmpty ? (
                  <button
                    onClick={() => startEdit(phase, "")}
                    className="text-sm text-muted-foreground/40 hover:text-muted-foreground italic transition-colors w-full text-left py-1"
                  >
                    Not yet recorded.
                  </button>
                ) : (
                  <p className={cn(
                    "text-sm text-foreground leading-relaxed whitespace-pre-wrap",
                    phase.key === "meaningExtraction" && "font-display italic text-base"
                  )}>
                    {value}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {experiment.status !== "archived" && experiment.status !== "completed" && (
        <div className="mt-8 flex items-center gap-3 pt-6 border-t border-border">
          {experiment.status === "active" && (
            <Button
              data-testid="button-mark-observing"
              size="sm"
              variant="outline"
              onClick={markObserving}
              disabled={updateMutation.isPending}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              Begin Observation
            </Button>
          )}
          {experiment.status === "observing" && experiment.observation && (
            <Button
              data-testid="button-complete"
              size="sm"
              onClick={markCompleted}
              disabled={updateMutation.isPending}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 size={13} />
              Mark Completed
            </Button>
          )}
          <Button
            data-testid="button-archive"
            size="sm"
            variant="ghost"
            onClick={archiveExperiment}
            disabled={updateMutation.isPending}
            className="gap-1.5 text-muted-foreground ml-auto"
          >
            <Archive size={13} />
            Archive
          </Button>
        </div>
      )}

      {/* Inter-app navigation CTAs */}
      {experiment.status === "completed" && experiment.meaningExtraction && (
        <div className="mt-6 pt-4 border-t border-border/50 space-y-2">
          <a
            href="https://axiomtool-production.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            This could become a principle <ExternalLink size={11} /> <span className="text-muted-foreground/40">Axiom</span>
          </a>
        </div>
      )}
      {experiment.source === "parallax" && (
        <div className={`${experiment.status === "completed" && experiment.meaningExtraction ? "mt-2" : "mt-6 pt-4 border-t border-border/50"}`}>
          <a
            href="https://parallaxapp.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-teal-500 hover:text-teal-400 transition-colors"
          >
            See the full pattern <ExternalLink size={11} /> <span className="text-muted-foreground/40">Parallax</span>
          </a>
        </div>
      )}
    </div>
  );
}
