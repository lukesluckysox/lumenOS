import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Axiom } from "@shared/schema";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import SourceTags, { SourceLegend } from "@/components/SourceTags";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const CONFIDENCE_ORDER = ["high", "medium-high", "medium", "medium-low", "low"];

function investigationPrompt(axiom: Axiom): string {
  if (axiom.parallaxCount > 0 && axiom.liminalCount > 0) {
    return "Convergence detected — examine cross-tool agreement";
  }
  if (axiom.parallaxCount > 0 && axiom.liminalCount === 0) {
    return "Pattern-derived — investigate behavioral consistency";
  }
  if (axiom.liminalCount > 0 && axiom.parallaxCount === 0) {
    return "Belief-surfaced — question whether this holds under scrutiny";
  }
  if (axiom.praxisCount > 0) {
    return "Experimentally informed — review the evidence";
  }
  return "Awaiting examination";
}

// Pill badge showing where an axiom came from
function SourceOriginBadge({ source }: { source?: string }) {
  if (!source || source === 'manual') {
    return (
      <span
        className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{ color: 'rgba(156,163,175,0.5)', border: '1px solid rgba(156,163,175,0.15)', background: 'rgba(156,163,175,0.04)' }}
      >
        Your submission
      </span>
    );
  }
  if (source === 'lumen_push') {
    return (
      <span
        className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{ color: '#4d8c9e', border: '1px solid rgba(77,140,158,0.25)', background: 'rgba(77,140,158,0.06)' }}
      >
        From your reflections
      </span>
    );
  }
  if (source === 'seeded') {
    return (
      <span
        className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{ color: 'rgba(196,148,62,0.5)', border: '1px solid rgba(196,148,62,0.15)', background: 'rgba(196,148,62,0.04)' }}
      >
        Foundational
      </span>
    );
  }
  // fallback for any other recognized values
  if (source === 'liminal') {
    return (
      <span
        className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{ color: '#9c8654', border: '1px solid rgba(156,134,84,0.25)', background: 'rgba(156,134,84,0.06)' }}
      >
        From Liminal
      </span>
    );
  }
  if (source === 'praxis') {
    return (
      <span
        className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{ color: '#c4943e', border: '1px solid rgba(196,148,62,0.25)', background: 'rgba(196,148,62,0.06)' }}
      >
        From experiments
      </span>
    );
  }
  return null;
}

// ── Loop Onboarding Card for Axiom ──────────────────────────────────────────
function LoopDeliveryOnboarding({ axioms }: { axioms: Axiom[] }) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("axiom_loop_onboarding_shown");
  });

  const hasLumenPush = axioms.some((a) => (a as any).source === "lumen_push");

  if (!visible || !hasLumenPush) return null;

  function dismiss() {
    localStorage.setItem("axiom_loop_onboarding_shown", "1");
    setVisible(false);
  }

  return (
    <div
      className="mx-4 md:mx-8 my-6 rounded-sm border border-border/50 bg-card/20 overflow-hidden"
      style={{ borderLeft: "2px solid #FFD166" }}
      data-testid="card-loop-onboarding-axiom"
    >
      <div className="px-5 py-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p
            className="font-mono text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#FFD166" }}
          >
            The Loop has delivered its first proposition.
          </p>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="font-mono text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex-shrink-0 leading-none mt-0.5"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          Truth claims arrive here from your Liminal sessions, Parallax patterns, and Praxis experiments.
          They sit in the Proving Ground until you examine them. Nothing becomes constitutional without your deliberation.
        </p>
      </div>
    </div>
  );
}

function AxiomRow({ axiom }: { axiom: Axiom }) {
  const prompt = investigationPrompt(axiom);
  return (
    <Link href={`/axiom/${axiom.id}`}>
      <div
        className="group flex items-start gap-5 px-4 md:px-8 py-5 border-b border-border/50 hover:bg-accent/30 transition-colors duration-150 cursor-pointer"
        data-testid={`axiom-row-${axiom.id}`}
      >
        {/* Number */}
        <div className="flex-shrink-0 pt-0.5">
          <span className="font-mono text-xs text-muted-foreground/50 tabular-nums">
            #{String(axiom.number).padStart(2, "0")}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top meta row */}
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40">
                PROPOSED
              </span>
              <span className="font-mono text-[9px] text-muted-foreground/30">·</span>
              <span className="font-mono text-[9px] text-muted-foreground/30">
                {new Date(axiom.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex-shrink-0">
              <ConfidenceBadge confidence={axiom.confidence} />
            </div>
          </div>

          {/* Title */}
          <h3 className="font-serif text-base leading-snug text-foreground group-hover:text-foreground/90 transition-colors mb-1.5">
            {axiom.title}
          </h3>

          {/* Quoted truth claim */}
          <p className="text-sm text-muted-foreground/60 leading-relaxed italic mb-2.5 line-clamp-2">
            &ldquo;{axiom.truthClaim}&rdquo;
          </p>

          {/* Source tags + provenance badge */}
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <SourceTags
              liminal={axiom.liminalCount}
              parallax={axiom.parallaxCount}
              praxis={axiom.praxisCount}
            />
            <SourceOriginBadge source={(axiom as any).source} />
          </div>

          {/* Investigation prompt */}
          <p className="text-[10px] font-mono text-muted-foreground/30 leading-relaxed">
            {prompt}
          </p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 pt-1 opacity-40 md:opacity-0 md:group-hover:opacity-40 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 7h10M8 3l4 4-4 4"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function TruthClaims() {
  const [filter, setFilter] = useState<string>("all");
  const { toast } = useToast();
  const { data: axioms, isLoading, isError, refetch } = useQuery<Axiom[]>({
    queryKey: ["/api/axioms", "proving_ground"],
    queryFn: () => fetch("/api/axioms?stage=proving_ground").then(r => r.json()),
  });

  // Toast: once per session if lumen_push axioms are present
  useEffect(() => {
    if (!axioms || axioms.length === 0) return;
    const sessionKey = 'axiom_loop_toast_shown';
    if (sessionStorage.getItem(sessionKey)) return;
    const lumenCount = axioms.filter((a) => (a as any).source === 'lumen_push').length;
    if (lumenCount > 0) {
      sessionStorage.setItem(sessionKey, '1');
      toast({
        description: `The Loop has delivered ${lumenCount} new proposition${lumenCount !== 1 ? 's' : ''} for examination.`,
      });
    }
  }, [axioms]);

  const sorted = (axioms ?? []).slice().sort((a, b) => {
    const ai = CONFIDENCE_ORDER.indexOf(a.confidence);
    const bi = CONFIDENCE_ORDER.indexOf(b.confidence);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const filtered = filter === "all"
    ? sorted
    : sorted.filter((a) => a.confidence === filter);

  const highCount = (axioms ?? []).filter((a) => a.confidence === "high").length;
  const mhCount = (axioms ?? []).filter((a) => a.confidence === "medium-high").length;
  const contradictions = (axioms ?? []).filter((a) => a.counterevidence && a.counterevidence.length > 30).length;

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="px-4 md:px-8 pt-10 pb-6 border-b border-border">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-xs tracking-widest-constitutional uppercase text-muted-foreground mb-2">
              Proposed Axioms
            </h1>
            <div className="font-serif text-3xl text-foreground">
              {isLoading ? "—" : (axioms?.length ?? 0)} proposals under examination
            </div>
            <p className="mt-1 text-xs text-muted-foreground/50 leading-relaxed italic">
              Principles emerging from observation. Each requires examination before it can govern.
            </p>
            <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground/60 font-mono">
              <span>{highCount + mhCount} with strong evidence</span>
              <span className="text-muted-foreground/30">·</span>
              <span>{contradictions} contested</span>
            </div>
          </div>
          <Link href="/new">
            <button
              className="text-[11px] font-mono tracking-widest-constitutional uppercase px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors rounded-sm flex-shrink-0"
              data-testid="button-new-synthesis"
            >
              + Submit Proposal
            </button>
          </Link>
        </div>

        {/* Filters */}
        <div className="mt-5 flex items-center gap-1 overflow-x-auto pb-1 -mb-1 flex-wrap md:flex-nowrap">
          {["all", "high", "medium-high", "medium", "medium-low", "low"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-sm transition-colors flex-shrink-0 ${
                filter === f
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50"
              }`}
              data-testid={`filter-${f}`}
            >
              {f === "all" ? "All proposals" : f.toUpperCase()}
            </button>
          ))}
          <div className="ml-auto hidden md:block">
            <SourceLegend />
          </div>
        </div>
      </div>

      {/* Axiom List */}
      {!isLoading && axioms && axioms.length > 0 && (
        <LoopDeliveryOnboarding axioms={axioms} />
      )}
      {isLoading ? (
        <div className="px-4 md:px-8 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-5 py-5 border-b border-border/50">
              <Skeleton className="h-4 w-8 flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="px-4 md:px-8 py-16 text-center">
          <div className="max-w-sm mx-auto border border-border/50 rounded-sm p-6 bg-card/30">
            <div className="font-mono text-xs uppercase tracking-widest-constitutional text-destructive/70 mb-3">
              Unable to load proposals
            </div>
            <p className="text-sm text-muted-foreground/50 leading-relaxed mb-4">
              Something went wrong while fetching your proposals. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 md:px-8 py-16 text-center">
          <div className="font-serif text-xl text-muted-foreground/40 mb-3">
            {filter === "all" ? "Proposals will appear here as patterns crystallize across your reflections." : `No ${filter} confidence proposals.`}
          </div>
          {filter === "all" && (
            <p className="text-sm text-muted-foreground/40 leading-relaxed mb-4 max-w-sm mx-auto">
              As you explore beliefs in Liminal, track patterns in Parallax, and run experiments in Praxis, proposals will surface here for your examination.
            </p>
          )}
        </div>
      ) : (
        <div>
          {filtered.map((axiom) => (
            <AxiomRow key={axiom.id} axiom={axiom} />
          ))}
        </div>
      )}
    </div>
  );
}
