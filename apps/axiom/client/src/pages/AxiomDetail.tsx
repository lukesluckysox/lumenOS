import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Axiom } from "@shared/schema";
import ConfidenceBadge, { ConfidenceBar } from "@/components/ConfidenceBadge";
import SourceTags from "@/components/SourceTags";
import { useToast } from "@/hooks/use-toast";
import ConstitutionalMoment from "@/components/ConstitutionalMoment";
import { SkeletonLine, SkeletonCard } from "@/components/Skeleton";

function SynthesisSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-6 border-b border-border/50">
      <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/50 mb-3">
        {label}
      </div>
      {children}
    </div>
  );
}

function RevisionHistoryItem({ entry }: { entry: { date: string; change: string; previousConfidence: string } }) {
  return (
    <div className="py-3 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="font-mono text-[10px] text-muted-foreground/50">{entry.date}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600/70 dark:text-amber-500/60">
          {entry.previousConfidence} → revised
        </span>
      </div>
      <p className="text-sm text-foreground/70 leading-relaxed">{entry.change}</p>
    </div>
  );
}

const STRONG_VALUES = ['substantive', 'persistent', 'stress-tested', 'lived-validated', 'aligned', 'articulated', 'low risk'];

function GroundingSection({ axiomId }: { axiomId: number }) {
  const queryClient = useQueryClient();
  const [falsification, setFalsification] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: grounding, isLoading } = useQuery<{ verdict: string; axes: { axis: string; value: string }[] }>({
    queryKey: ["/api/axioms", axiomId, "grounding"],
    queryFn: () => fetch(`/api/axioms/${axiomId}/grounding`).then(r => r.json()),
  });

  const { data: axiomData } = useQuery<Axiom>({
    queryKey: ["/api/axioms", axiomId],
  });

  useEffect(() => {
    if (axiomData && (axiomData as any).falsificationConditions && !dirty) {
      setFalsification((axiomData as any).falsificationConditions);
    }
  }, [axiomData, dirty]);

  const groundMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/axioms/${axiomId}/ground`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/axioms", axiomId, "grounding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/axioms", axiomId] });
      queryClient.invalidateQueries({ queryKey: ["/api/axioms"] });
    },
  });

  const saveFalsification = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/axioms/${axiomId}`, { falsificationConditions: falsification }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/axioms", axiomId] });
    },
  });

  const formatAxis = (axis: string) => axis.replace(/_/g, ' ');

  return (
    <div className="bg-card border border-card-border rounded-sm px-6 py-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/50">
          Grounding Assessment
        </div>
        {grounding?.verdict && (
          <span
            className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
            style={{
              color: grounding.verdict === 'well-grounded' ? '#FFD166' : grounding.verdict === 'under-grounded' ? '#9ca3af' : '#c4943e',
              border: `1px solid ${grounding.verdict === 'well-grounded' ? 'rgba(255,209,102,0.3)' : grounding.verdict === 'under-grounded' ? 'rgba(156,163,175,0.3)' : 'rgba(196,148,62,0.3)'}`,
              background: grounding.verdict === 'well-grounded' ? 'rgba(255,209,102,0.06)' : grounding.verdict === 'under-grounded' ? 'rgba(156,163,175,0.06)' : 'rgba(196,148,62,0.06)',
            }}
          >
            {grounding.verdict}
          </span>
        )}
      </div>

      {/* Axis badges */}
      {grounding?.axes && grounding.axes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {grounding.axes.map((a) => {
            const isStrong = STRONG_VALUES.includes(a.value);
            return (
              <span
                key={a.axis}
                className="font-mono text-[9px] tracking-wider px-2 py-1 rounded-sm"
                style={{
                  color: isStrong ? '#FFD166' : '#6b6545',
                  background: isStrong ? 'rgba(255,209,102,0.08)' : 'rgba(58,53,32,0.4)',
                  border: `1px solid ${isStrong ? 'rgba(255,209,102,0.2)' : 'rgba(58,53,32,0.6)'}`,
                }}
              >
                {formatAxis(a.axis)}: {a.value}
              </span>
            );
          })}
        </div>
      )}

      {isLoading && (
        <p className="text-xs text-muted-foreground/40 mb-4">Loading grounding data...</p>
      )}

      {!isLoading && (!grounding?.axes || grounding.axes.length === 0) && (
        <p className="text-xs text-muted-foreground/40 mb-4">
          Not yet evaluated. Run a grounding assessment to calibrate this axiom.
        </p>
      )}

      {/* Falsification textarea */}
      <div className="mb-4">
        <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 block mb-2">
          What would falsify this?
        </label>
        <textarea
          value={falsification}
          onChange={e => { setFalsification(e.target.value); setDirty(true); }}
          placeholder="Describe what evidence or experience would disprove this axiom..."
          className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 resize-none leading-relaxed"
          rows={2}
        />
        {dirty && (
          <button
            onClick={() => saveFalsification.mutate()}
            disabled={saveFalsification.isPending}
            className="mt-1.5 text-[10px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            {saveFalsification.isPending ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {/* Re-evaluate button */}
      <button
        onClick={() => groundMutation.mutate()}
        disabled={groundMutation.isPending}
        className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 border border-primary/30 text-primary hover:bg-primary/10 rounded-sm transition-colors disabled:opacity-40"
      >
        {groundMutation.isPending ? 'Evaluating...' : 'Re-evaluate'}
      </button>
    </div>
  );
}

export default function AxiomDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promotePrinciple, setPromotePrinciple] = useState('');
  const [showCeremony, setShowCeremony] = useState(false);
  const [ceremonyAxiom, setCeremonyAxiom] = useState<{ truthClaim: string; workingPrinciple: string; confidence: string } | null>(null);

  const { data: axiom, isLoading, isError, refetch } = useQuery<Axiom>({
    queryKey: ["/api/axioms", id],
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/axioms/${id}/enrich`, {});
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/axioms", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/axioms"] });
      if (data?.promoted && data?.axiom) {
        setCeremonyAxiom({
          truthClaim: data.axiom.truthClaim,
          workingPrinciple: data.axiom.workingPrinciple,
          confidence: data.axiom.confidence,
        });
        setShowCeremony(true);
      } else {
        toast({ description: "Synthesized and enshrined as governing principle." });
      }
    },
    onError: (err: Error) => {
      // Extract the server error message from the "status: {json}" format
      let message = "Enrichment failed. Please try again.";
      try {
        const jsonMatch = err.message.match(/^\d+:\s*(.+)$/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.error) message = parsed.error;
        }
      } catch {
        // Fall back to raw message if parsing fails
        if (err.message && !err.message.includes('<!DOCTYPE')) message = err.message;
      }
      toast({ variant: "destructive", description: message });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (workingPrinciple: string) => apiRequest("POST", `/api/axioms/${id}/promote`, { workingPrinciple }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/axioms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/axioms", id] });
      setShowPromoteModal(false);
      if (data?.promoted && data?.axiom) {
        setCeremonyAxiom({
          truthClaim: data.axiom.truthClaim,
          workingPrinciple: data.axiom.workingPrinciple,
          confidence: data.axiom.confidence,
        });
        setShowCeremony(true);
      } else {
        toast({ description: "Promoted to Constitution." });
      }
    },
    onError: () => {
      toast({ variant: "destructive", description: "Promotion failed. Working principle is required." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/axioms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/axioms"] });
      toast({ description: "Axiom removed from the record." });
      navigate("/");
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-10 pb-16">
        {/* Back link */}
        <SkeletonLine className="w-16 mb-8" />
        {/* Title + meta */}
        <div className="mb-8">
          <SkeletonLine className="h-7 w-3/4 mb-4" />
          <div className="flex items-center gap-6 pl-8">
            <SkeletonLine className="h-4 w-20" />
            <SkeletonLine className="h-4 w-32" />
          </div>
          <div className="mt-3 pl-8">
            <SkeletonLine className="h-1 w-full" />
          </div>
        </div>
        {/* Truth claim block */}
        <SkeletonCard className="mb-6">
          <SkeletonLine className="w-24 mb-3" />
          <SkeletonLine className="h-6 w-full mb-2" />
          <SkeletonLine className="h-6 w-2/3" />
        </SkeletonCard>
        {/* Evidence cards */}
        <SkeletonCard className="mb-6">
          <SkeletonLine className="w-32 mb-3" />
          <SkeletonLine className="h-4 w-full mb-2" />
          <SkeletonLine className="h-4 w-5/6" />
        </SkeletonCard>
        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <SkeletonLine className="h-8 w-36 rounded-sm" />
          <SkeletonLine className="h-8 w-44 rounded-sm" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-10 pb-16 text-center">
        <div className="max-w-sm mx-auto border border-border/50 rounded-sm p-6 bg-card/30 mt-12">
          <div className="font-mono text-xs uppercase tracking-widest-constitutional text-destructive/70 mb-3">
            Unable to load axiom
          </div>
          <p className="text-sm text-muted-foreground/50 leading-relaxed mb-4">
            Something went wrong while loading this axiom. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!axiom) {
    return (
      <div className="px-4 md:px-10 py-12">
        <div className="font-serif text-xl text-muted-foreground/40 mb-3">Axiom not found.</div>
        <button onClick={() => window.history.back()} className="text-xs font-mono tracking-wider text-primary">← Go back</button>
      </div>
    );
  }

  const inputDescriptions: string[] = JSON.parse(axiom.inputDescriptions || "[]");
  const revisionHistory: { date: string; change: string; previousConfidence: string }[] =
    JSON.parse(axiom.revisionHistory || "[]");
  const totalInputs = axiom.liminalCount + axiom.parallaxCount + axiom.praxisCount;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 pt-10 pb-16">
      {/* Breadcrumb */}
      <div className="mb-8">
        <button
          onClick={() => window.history.back()}
          className="text-[10px] font-mono tracking-widest-constitutional uppercase text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-6 mb-4">
          <div className="flex-shrink-0 font-mono text-xs text-muted-foreground/40 pt-1.5">
            #{String(axiom.number).padStart(2, "0")}
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-2xl leading-tight text-foreground">
              {axiom.title}
            </h1>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-6 pl-8">
          <ConfidenceBadge confidence={axiom.confidence} size="md" />
          <SourceTags
            liminal={axiom.liminalCount}
            parallax={axiom.parallaxCount}
            praxis={axiom.praxisCount}
            size="md"
          />
          <span className="text-[10px] font-mono text-muted-foreground/30">
            {totalInputs} inputs
          </span>
        </div>

        {/* Confidence bar */}
        <div className="mt-3 pl-8">
          <ConfidenceBar score={axiom.confidenceScore} />
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[9px] text-muted-foreground/30">CONFIDENCE</span>
            <span className="font-mono text-[9px] text-muted-foreground/30">{axiom.confidenceScore}/100</span>
          </div>
        </div>
      </div>

      {/* Promotion actions — only for proving_ground axioms */}
      {(axiom as any).stage !== 'constitutional' && (
        <div className="mb-6 px-5 py-4 border border-border/40 rounded-sm bg-card/20">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-3">
            PROPOSAL STATUS
          </div>
          <p className="text-xs text-muted-foreground/50 leading-relaxed mb-4">
            This principle is proposed, not yet governing. Examine the evidence below, then choose: deepen it through synthesis, or promote it directly if the truth is self-evident.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
              className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 border border-primary/30 text-primary hover:bg-primary/10 rounded-sm transition-colors disabled:opacity-40"
            >
              {enrichMutation.isPending ? "Synthesizing…" : "Examine & Synthesize"}
            </button>
            <button
              onClick={() => setShowPromoteModal(true)}
              className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 border border-border text-muted-foreground/60 hover:text-foreground hover:border-foreground/30 rounded-sm transition-colors"
            >
              Promote as Self-Evident →
            </button>
          </div>
        </div>
      )}

      {/* Constitutional badge — for promoted axioms */}
      {(axiom as any).stage === 'constitutional' && (
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400/70 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
            GOVERNING PRINCIPLE
          </span>
          <a
            href="https://liminal-app.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono tracking-wider text-primary/50 hover:text-primary transition-colors"
          >
            Question this further →
          </a>
        </div>
      )}

      {/* Truth Claim — prominent */}
      <div className="bg-card border border-card-border rounded-sm px-6 py-5 mb-6">
        <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/50 mb-3">
          {(axiom as any).stage === 'constitutional' ? 'GOVERNING CLAIM' : 'PROPOSED CLAIM'}
        </div>
        <blockquote className="font-serif text-xl leading-relaxed text-foreground italic">
          "{axiom.truthClaim}"
        </blockquote>
        {axiom.workingPrinciple && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/40 mb-2">
              DIRECTIVE
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{axiom.workingPrinciple}</p>
            <p className="text-[10px] font-mono text-muted-foreground/30 mt-1">How this truth directs action.</p>
          </div>
        )}
      </div>

      {/* Grounding Assessment */}
      <GroundingSection axiomId={id} />

      {/* Synthesis Chain */}
      <div data-testid="synthesis-chain">
        {/* Layer 1: Source Evidence */}
        <SynthesisSection label="SOURCE EVIDENCE">
          <p className="text-[10px] font-mono text-muted-foreground/30 mb-3 leading-relaxed">
            What was observed. Raw data from the instruments.
          </p>
          <div className="space-y-2">
            {inputDescriptions.map((desc, i) => {
              const isLiminal = desc.startsWith("Liminal:");
              const isParallax = desc.startsWith("Parallax:");
              const isPraxis = desc.startsWith("Praxis:");
              const borderColor = isLiminal
                ? "border-purple-500/50"
                : isParallax
                ? "border-blue-500/50"
                : isPraxis
                ? "border-emerald-600/50"
                : "border-border";
              const labelColor = isLiminal
                ? "text-purple-500/70"
                : isParallax
                ? "text-blue-500/70"
                : isPraxis
                ? "text-emerald-600/70"
                : "text-muted-foreground/40";
              const prefix = isLiminal ? "Liminal" : isParallax ? "Parallax" : isPraxis ? "Praxis" : null;
              const body = prefix ? desc.slice(prefix.length + 1).trim() : desc;
              return (
                <div key={i} className={`pl-3 border-l-2 ${borderColor}`}>
                  {prefix && (
                    <span className={`font-mono text-[9px] uppercase tracking-wider ${labelColor} block mb-0.5`}>
                      {prefix}
                    </span>
                  )}
                  <p className="text-sm text-foreground/70 leading-relaxed">{body}</p>
                </div>
              );
            })}
            {inputDescriptions.length === 0 && (
              <p className="text-sm text-muted-foreground/50">No input descriptions recorded.</p>
            )}
          </div>
          {axiom.signal && (
            <p className="text-sm text-foreground/80 leading-relaxed mt-4">{axiom.signal}</p>
          )}
        </SynthesisSection>

        {/* Layer 2: Pattern Analysis */}
        {axiom.convergence && (
          <SynthesisSection label="PATTERN ANALYSIS">
            <p className="text-[10px] font-mono text-muted-foreground/30 mb-3 leading-relaxed">
              How the evidence aligns. Structural observations about recurrence and cross-tool agreement.
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">{axiom.convergence}</p>
          </SynthesisSection>
        )}

        {/* Layer 3: Interpretive Claim */}
        {axiom.interpretation && (
          <SynthesisSection label="INTERPRETIVE CLAIM">
            <p className="text-[10px] font-mono text-muted-foreground/30 mb-3 leading-relaxed">
              What this may mean. One level above the evidence — provisional until examined.
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">{axiom.interpretation}</p>
          </SynthesisSection>
        )}

        {/* The Proposal summary */}
        {axiom.interpretation && (
          <div className="py-5 border-b border-border/50">
            <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/40 mb-2">
              THE PROPOSAL
            </div>
            <p className="font-serif text-base italic text-foreground/70 leading-relaxed">
              &ldquo;{axiom.truthClaim}&rdquo;
            </p>
          </div>
        )}

        {axiom.counterevidence && (
          <SynthesisSection label="Counterevidence">
            <p className="text-sm text-foreground/70 leading-relaxed">{axiom.counterevidence}</p>
          </SynthesisSection>
        )}

        {axiom.revisionNote && (
          <SynthesisSection label="Revision Note">
            <p className="text-sm text-foreground/70 leading-relaxed italic">{axiom.revisionNote}</p>
          </SynthesisSection>
        )}

        {/* Revision History */}
        {revisionHistory.length > 0 && (
          <div className="py-6">
            <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/50 mb-3">
              Revision History
            </div>
            {revisionHistory.map((entry, i) => (
              <RevisionHistoryItem key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Provenance: How This Arrived */}
      <div className="mt-8 pt-6 border-t border-border/30">
        <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/40 mb-4">
          How This Arrived
        </div>

        {/* Source type label */}
        {(axiom as any).source === 'lumen_push' && (
          <div className="flex items-center gap-4 mb-4">
            <p className="text-xs text-muted-foreground/50 leading-relaxed italic">
              Emerged from your recent reflections.
            </p>
            <a
              href="https://parallaxapp.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono tracking-wider text-primary/50 hover:text-primary transition-colors flex-shrink-0"
            >
              See the full pattern →
            </a>
          </div>
        )}
        {(axiom as any).source === 'seeded' && (
          <p className="text-xs text-muted-foreground/50 leading-relaxed mb-4 italic">
            Pre-loaded example — not from your data.
          </p>
        )}
        {(axiom as any).source === 'praxis' && (
          <p className="text-xs text-muted-foreground/50 leading-relaxed mb-4 italic">
            Graduated from a Praxis experiment — a truth derived from lived experience.
          </p>
        )}

        {/* Source count badges */}
        {(axiom.liminalCount > 0 || axiom.parallaxCount > 0 || axiom.praxisCount > 0) && (
          <div className="flex items-center gap-2 mb-4">
            {axiom.liminalCount > 0 && (
              <span
                className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
                style={{ color: '#9c8654', border: '1px solid rgba(156,134,84,0.3)', background: 'rgba(156,134,84,0.06)' }}
              >
                Liminal: {axiom.liminalCount}
              </span>
            )}
            {axiom.parallaxCount > 0 && (
              <span
                className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
                style={{ color: '#4d8c9e', border: '1px solid rgba(77,140,158,0.3)', background: 'rgba(77,140,158,0.06)' }}
              >
                Parallax: {axiom.parallaxCount}
              </span>
            )}
            {axiom.praxisCount > 0 && (
              <span
                className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
                style={{ color: '#c4943e', border: '1px solid rgba(196,148,62,0.3)', background: 'rgba(196,148,62,0.06)' }}
              >
                Praxis: {axiom.praxisCount}
              </span>
            )}
          </div>
        )}

        {/* Individual source entries */}
        {inputDescriptions.length > 0 && (
          <div className="space-y-2">
            {inputDescriptions.map((desc, i) => {
              const isLiminal = desc.startsWith("Liminal:");
              const isParallax = desc.startsWith("Parallax:");
              const isPraxis = desc.startsWith("Praxis:");
              const dotColor = isLiminal ? '#9c8654' : isParallax ? '#4d8c9e' : isPraxis ? '#c4943e' : '#6b7280';
              const prefix = isLiminal ? "Liminal" : isParallax ? "Parallax" : isPraxis ? "Praxis" : null;
              const body = prefix ? desc.slice(prefix.length + 1).trim() : desc;
              return (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex-shrink-0 mt-1.5" style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor }} />
                  <p className="text-xs text-foreground/60 leading-relaxed">{body}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="flex items-center gap-6 mt-8 pt-6 border-t border-border/30">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/30 block">Created</span>
          <span className="font-mono text-[10px] text-muted-foreground/50">
            {new Date(axiom.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          </span>
        </div>
        <div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/30 block">Last revised</span>
          <span className="font-mono text-[10px] text-muted-foreground/50">
            {new Date(axiom.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          </span>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => {
              if (confirm("Remove this axiom from the record? This cannot be undone.")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="text-[10px] font-mono uppercase tracking-widest-constitutional text-destructive/50 hover:text-destructive transition-colors min-h-[44px] flex items-center"
            data-testid="button-delete-axiom"
          >
            {deleteMutation.isPending ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>

      {/* Constitutional Promotion Ceremony */}
      {showCeremony && ceremonyAxiom && (
        <ConstitutionalMoment
          axiom={ceremonyAxiom}
          onContinue={() => {
            setShowCeremony(false);
            navigate("/constitution");
          }}
        />
      )}

      {/* Manual Promote Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPromoteModal(false)}>
          <div className="bg-card border border-border rounded-sm p-6 max-w-lg w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="font-mono text-[10px] uppercase tracking-widest-constitutional text-muted-foreground/50 mb-4">
              Promote as Governing Principle
            </div>
            <p className="text-sm text-muted-foreground/70 leading-relaxed mb-4">
              You are endorsing this proposal as a principle worthy of governing. Write the directive — one sentence describing how this truth should direct future thought and action.
            </p>
            <div className="mb-2">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-2">
                PROPOSED CLAIM
              </div>
              <p className="text-sm text-foreground/70 italic leading-relaxed border-l-2 border-border/50 pl-3 mb-4">
                &ldquo;{axiom.truthClaim}&rdquo;
              </p>
            </div>
            <div className="mb-5">
              <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 block mb-2">
                GOVERNING DIRECTIVE
              </label>
              <textarea
                value={promotePrinciple}
                onChange={e => setPromotePrinciple(e.target.value)}
                placeholder='e.g. "When the pattern surfaces, treat it as signal rather than noise — and act accordingly."'
                className="w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 resize-none leading-relaxed"
                rows={3}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowPromoteModal(false)}
                className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={() => promoteMutation.mutate(promotePrinciple)}
                disabled={promoteMutation.isPending || promotePrinciple.trim().length < 5}
                className="text-[10px] font-mono uppercase tracking-wider px-4 py-1.5 border border-primary/30 text-primary hover:bg-primary/10 rounded-sm transition-colors disabled:opacity-40"
              >
                {promoteMutation.isPending ? "Enshrining…" : "Enshrine in Constitution →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
