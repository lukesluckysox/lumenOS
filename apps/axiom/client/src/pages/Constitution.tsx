import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Axiom, Tension, Revision } from "@shared/schema";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { SkeletonLine, SkeletonCard } from "@/components/Skeleton";

function Section({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/50">
          {label}
        </h2>
        <div className="flex-1 h-px bg-border/50" />
      </div>
      {note && (
        <p className="text-xs text-muted-foreground/40 leading-relaxed mb-5 italic">{note}</p>
      )}
      {children}
    </div>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (source === 'seeded') return (
    <span className="font-mono text-[9px] uppercase tracking-wider text-amber-500/50 border border-amber-500/20 px-1.5 py-0.5 rounded-sm">
      original
    </span>
  );
  if (source === 'lumen_push') return (
    <span className="font-mono text-[9px] uppercase tracking-wider text-blue-400/50 border border-blue-400/20 px-1.5 py-0.5 rounded-sm">
      from your reflections
    </span>
  );
  return null;
}

function GoverningPrinciple({ axiom, rank }: { axiom: Axiom; rank: number }) {
  const hasPrinciple = axiom.workingPrinciple && axiom.workingPrinciple.trim().length > 10;
  return (
    <Link href={`/axiom/${axiom.id}`}>
      <div className="group py-5 border-b border-border/40 last:border-0 cursor-pointer hover:bg-accent/10 transition-colors px-1 -mx-1 rounded-sm">
        <div className="flex items-start gap-4">
          <span className="font-mono text-xs text-muted-foreground/30 pt-0.5 tabular-nums flex-shrink-0">
            {String(rank).padStart(2, "0")}.
          </span>
          <div className="flex-1 min-w-0">
            {hasPrinciple ? (
              <>
                <p className="text-sm text-foreground/90 leading-relaxed mb-2 group-hover:text-foreground transition-colors">
                  {axiom.workingPrinciple}
                </p>
                <p className="text-xs text-muted-foreground/50 italic leading-relaxed">
                  Grounded in: &ldquo;{axiom.truthClaim}&rdquo;
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-base italic text-foreground/80 leading-snug mb-1 group-hover:text-foreground transition-colors">
                  &ldquo;{axiom.truthClaim}&rdquo;
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/30">
                  Directive pending — examine to derive →
                </p>
              </>
            )}
            <div className="flex items-center gap-3 mt-2">
              <ConfidenceBadge confidence={axiom.confidence} />
              <SourceBadge source={(axiom as any).source} />
              <a
                href="https://liminal-app.up.railway.app"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-mono tracking-wider text-primary/50 hover:text-primary transition-colors ml-auto"
              >
                Question this further →
              </a>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function TensionEntry({ tension }: { tension: Tension }) {
  return (
    <div className="py-4 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-xs tracking-widest-constitutional uppercase text-purple-500/70">
          {tension.poleA}
        </span>
        <span className="font-mono text-muted-foreground/30">↔</span>
        <span className="font-mono text-xs tracking-widest-constitutional uppercase text-blue-500/70">
          {tension.poleB}
        </span>
      </div>
      <p className="text-sm text-foreground/60 leading-relaxed">{tension.description}</p>
    </div>
  );
}

function ContradictionEntry({ axiom }: { axiom: Axiom }) {
  return (
    <Link href={`/axiom/${axiom.id}`}>
      <div className="group py-4 border-b border-border/40 last:border-0 cursor-pointer">
        <div className="flex items-start gap-4">
          <span className="font-mono text-[10px] text-muted-foreground/30 tabular-nums flex-shrink-0 pt-1">
            #{String(axiom.number).padStart(2, "0")}
          </span>
          <div>
            <p className="text-sm text-foreground/70 leading-relaxed mb-2 group-hover:text-foreground transition-colors">
              <em>{axiom.truthClaim}</em>
            </p>
            <p className="text-xs text-muted-foreground/50 leading-relaxed">{axiom.counterevidence}</p>
            <div className="mt-2 flex items-center gap-3">
              <ConfidenceBadge confidence={axiom.confidence} />
              <SourceBadge source={(axiom as any).source} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RevisionSummary({ revision }: { revision: Revision }) {
  return (
    <div className="py-4 border-b border-border/40 last:border-0">
      <div className="font-mono text-[10px] text-muted-foreground/40 mb-2">
        {new Date(revision.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </div>
      <p className="text-sm text-foreground/70 leading-relaxed">
        <span className="line-through decoration-muted-foreground/30">{revision.previousBelief}</span>
      </p>
      <p className="text-sm text-foreground/85 leading-relaxed mt-1 font-medium">
        → {revision.newBelief}
      </p>
    </div>
  );
}

function PreambleBlock() {
  const queryClient = useQueryClient();
  const { data: meta } = useQuery<{ preamble: string; updatedAt: string | null }>({
    queryKey: ["/api/constitution/meta"],
  });
  const { data: axioms = [] } = useQuery<Axiom[]>({
    queryKey: ["/api/axioms", "constitutional"],
    queryFn: () => fetch("/api/axioms?stage=constitutional").then(r => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/constitution/preamble", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/constitution/meta"] }),
  });

  const hasPreamble = meta?.preamble && meta.preamble.length > 10;

  // Check if preamble might be stale (axioms updated after preamble)
  const lastAxiomUpdate = axioms.length > 0
    ? Math.max(...axioms.map(a => new Date(a.updatedAt).getTime()))
    : 0;
  const preambleDate = meta?.updatedAt ? new Date(meta.updatedAt).getTime() : 0;
  const isStale = hasPreamble && lastAxiomUpdate > preambleDate;

  if (!hasPreamble) {
    return (
      <div className="mb-10 p-5 border border-border/40 rounded-sm bg-card/30">
        <div className="font-mono text-[10px] uppercase tracking-widest-constitutional text-muted-foreground/50 mb-3">
          Preamble
        </div>
        <p className="text-sm text-muted-foreground/40 italic mb-4 leading-relaxed">
          No preamble yet. A preamble synthesizes the spirit of the constitution — its core orientations, tensions, and conditions of formation.
        </p>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || axioms.length === 0}
          className="text-[11px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
        >
          {generateMutation.isPending ? "Composing…" : "Compose Preamble from Governing Principles"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="font-mono text-[10px] uppercase tracking-widest-constitutional text-muted-foreground/50">
          Preamble
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className={`text-[10px] font-mono uppercase tracking-wider transition-colors ${isStale ? 'text-amber-500/60 hover:text-amber-500' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
        >
          {generateMutation.isPending ? "Resynthesizing…" : isStale ? "↻ Stale — resynthesize" : "↻ Resynthesize Preamble"}
        </button>
      </div>
      <p className="text-sm text-foreground/75 leading-relaxed border-l-2 border-border/50 pl-4">
        {meta!.preamble}
      </p>
    </div>
  );
}

export default function Constitution() {
  const { toast } = useToast();
  const { data: axioms = [], isLoading: loadingAxioms } = useQuery<Axiom[]>({
    queryKey: ["/api/axioms", "constitutional"],
    queryFn: () => fetch("/api/axioms?stage=constitutional").then(r => r.json()),
  });
  const { data: tensions = [], isLoading: loadingTensions } = useQuery<Tension[]>({ queryKey: ["/api/tensions"] });
  const { data: revisions = [], isLoading: loadingRevisions } = useQuery<Revision[]>({ queryKey: ["/api/revisions"] });

  // Toast: once per session if an axiom was recently promoted (last 24h)
  useEffect(() => {
    if (axioms.length === 0) return;
    const sessionKey = 'axiom_constitution_toast_shown';
    if (sessionStorage.getItem(sessionKey)) return;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const hasRecent = axioms.some((a) => new Date(a.updatedAt).getTime() > oneDayAgo);
    if (hasRecent) {
      sessionStorage.setItem(sessionKey, '1');
      toast({ description: "A truth was recently promoted to your constitution." });
    }
  }, [axioms]);

  const isLoading = loadingAxioms || loadingTensions || loadingRevisions;

  const governingPrinciples = axioms
    .filter((a) => ["high", "medium-high"].includes(a.confidence))
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const contradictions = axioms.filter(
    (a) => a.counterevidence && a.counterevidence.length > 30
  );

  const workingPrinciples = axioms.filter((a) => a.workingPrinciple && a.workingPrinciple.trim().length > 10);

  const majorRevisions = revisions.filter((r) => r.significance === "major");

  const lastUpdated = [...axioms, ...tensions, ...revisions]
    .map((item) => new Date("updatedAt" in item ? item.updatedAt : item.createdAt))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 pt-10 pb-20">
      {/* Header */}
      <SkeletonLine className="w-24 mb-2" />
      <SkeletonLine className="h-8 w-64 mb-3" />
      <SkeletonLine className="w-48 mb-8" />
      {/* Preamble text block */}
      <SkeletonCard className="mb-10">
        <SkeletonLine className="w-20 mb-3" />
        <SkeletonLine className="h-4 w-full mb-2" />
        <SkeletonLine className="h-4 w-5/6 mb-2" />
        <SkeletonLine className="h-4 w-2/3" />
      </SkeletonCard>
      {/* Principle cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="py-5 border-b border-border/40">
          <div className="flex items-start gap-4">
            <SkeletonLine className="h-4 w-8 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="w-32" />
            </div>
          </div>
        </div>
      ))}
      {/* Tension cards */}
      <div className="mt-8">
        <SkeletonLine className="w-28 mb-4" />
        {[1, 2].map((i) => (
          <div key={i} className="py-4 border-b border-border/40">
            <div className="flex items-center gap-3 mb-2">
              <SkeletonLine className="h-4 w-20" />
              <SkeletonLine className="h-3 w-4" />
              <SkeletonLine className="h-4 w-20" />
            </div>
            <SkeletonLine className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );

  const isEmpty = axioms.length === 0 && tensions.length === 0;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 pt-10 pb-20">
      {/* Document Header */}
      <div className="mb-10">
        <h1 className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground mb-2">
          Constitution
        </h1>
        <div className="font-serif text-3xl text-foreground mb-3">
          The Current Operating Structure
        </div>
        <p className="text-xs text-muted-foreground/50 leading-relaxed mb-4">
          {axioms.length} governing principles · {tensions.length} active tensions · {revisions.length} amendments. A living document.
        </p>
        {lastUpdated && (
          <div className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-wider">
            Last updated {lastUpdated.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        )}
        <div className="h-px bg-border mt-6" />
      </div>

      {isEmpty ? (
        <div className="text-center py-12">
          <div className="font-serif text-xl text-muted-foreground/40 mb-4">My living constitution forms here as I examine and adopt principles.</div>
          <p className="text-sm text-muted-foreground/50 leading-relaxed mb-6 max-w-sm mx-auto">
            When I promote a proposal from the Proving Ground, it becomes a governing principle — a truth I’ve tested and chosen to live by. Tensions between principles are tracked as amendments.
          </p>
          <Link href="/">
            <button className="text-xs font-mono tracking-wider text-primary hover:text-primary/80 transition-colors">
              Review proposals →
            </button>
          </Link>
        </div>
      ) : (
        <>
          <PreambleBlock />

          {governingPrinciples.length > 0 && (
            <Section
              label="I. ARTICLES OF GOVERNANCE"
              note="Principles derived from examined evidence. Each governs how truth is applied to action."
            >
              {governingPrinciples.map((axiom, i) => (
                <GoverningPrinciple key={axiom.id} axiom={axiom} rank={i + 1} />
              ))}
            </Section>
          )}

          {workingPrinciples.length > 0 && (
            <Section
              label="II. Working Principles"
              note="These translate what is known into how to proceed — one sentence per principle."
            >
              <div className="space-y-3">
                {workingPrinciples.map((axiom) => (
                  <Link key={axiom.id} href={`/axiom/${axiom.id}`}>
                    <div className="group flex items-start gap-3 py-3 border-b border-border/30 last:border-0 cursor-pointer">
                      <span className="font-mono text-[10px] text-muted-foreground/25 tabular-nums flex-shrink-0 pt-0.5">
                        #{String(axiom.number).padStart(2, "0")}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-foreground/75 leading-relaxed group-hover:text-foreground transition-colors">
                          {axiom.workingPrinciple}
                        </p>
                        <p className="text-xs text-muted-foreground/40 italic mt-1">
                          &ldquo;{axiom.truthClaim.slice(0, 80)}{axiom.truthClaim.length > 80 ? '…' : ''}&rdquo;
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {tensions.length > 0 && (
            <Section
              label="III. ACTIVE TENSIONS"
              note="Principles in productive conflict. These are not contradictions to resolve but polarities to navigate."
            >
              {tensions.map((tension) => (
                <TensionEntry key={tension.id} tension={tension} />
              ))}
            </Section>
          )}

          {contradictions.length > 0 && (
            <Section
              label="IV. UNDER SCRUTINY"
              note="Principles with active counterevidence. Held provisionally — subject to revision."
            >
              {contradictions.map((axiom) => (
                <ContradictionEntry key={axiom.id} axiom={axiom} />
              ))}
            </Section>
          )}

          {majorRevisions.length > 0 && (
            <Section
              label="V. CONSTITUTIONAL AMENDMENTS"
              note="The record of what changed and why. A constitution that cannot revise itself is not alive."
            >
              {majorRevisions.map((revision) => (
                <RevisionSummary key={revision.id} revision={revision} />
              ))}
            </Section>
          )}

          <div className="pt-6 border-t border-border/30">
            <p className="text-xs text-muted-foreground/30 leading-relaxed font-mono">
              This constitution is a living document. Every principle here is provisional, traceable, and revisable by evidence.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
