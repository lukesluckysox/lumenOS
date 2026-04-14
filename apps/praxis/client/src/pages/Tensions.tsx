import { useQuery } from "@tanstack/react-query";
import { GitFork, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/ErrorCard";

interface AxiomTension {
  id: number;
  poleA: string;
  poleB: string;
  description: string;
  evidence: string; // JSON: string[]
  relatedAxiomIds: string; // JSON: number[]
  createdAt: string;
}

const AXIOM_APP_URL = "https://axiomtool-production.up.railway.app";

export default function Tensions() {
  const { data: tensions, isLoading, isError } = useQuery<AxiomTension[]>({
    queryKey: ["/api/axiom-tensions"],
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="font-display text-xl font-semibold text-foreground mb-1">
          Core Tensions
        </h2>
        <p className="text-sm text-muted-foreground">
          Tensions mapped in Axiom, surfaced here as testing targets.
        </p>
      </div>

      {isError ? (
        <ErrorCard message="Could not load tensions from Axiom." onRetry={() => window.location.reload()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-md" />)}
        </div>
      ) : tensions?.length === 0 ? (
        <div className="border border-dashed border-border rounded-md py-16 text-center">
          <GitFork size={24} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-1">No tensions yet.</p>
          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
            Tensions are mapped in Axiom and surfaced here as testing targets.
            When you're ready, design an experiment around one.
          </p>
          <a
            href={`${AXIOM_APP_URL}/#/tensions`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Map tensions in Axiom <ExternalLink size={10} />
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {tensions?.map(t => (
            <TensionCard key={t.id} tension={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TensionCard({ tension }: { tension: AxiomTension }) {
  const evidence: string[] = (() => {
    try { return JSON.parse(tension.evidence || "[]"); } catch { return []; }
  })();

  return (
    <div
      data-testid={`card-tension-${tension.id}`}
      className="bg-card border border-border rounded-md p-6"
    >
      {/* Pole pair */}
      <div className="flex items-center gap-3 mb-3">
        <span className="font-display text-lg font-medium text-foreground">
          {tension.poleA}
        </span>
        <span className="text-primary text-lg font-light">↔</span>
        <span className="font-display text-lg font-medium text-foreground">
          {tension.poleB}
        </span>
      </div>

      {tension.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {tension.description}
        </p>
      )}

      {evidence.length > 0 && (
        <div className="mb-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-1.5">
            Evidence
          </div>
          <div className="space-y-1.5">
            {evidence.map((e, i) => (
              <p key={i} className="text-sm text-muted-foreground/70 leading-relaxed pl-3 border-l border-border">
                {e}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-muted-foreground/40">
          {new Date(tension.createdAt).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </p>
        <a
          href={`${AXIOM_APP_URL}/#/tensions`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View in Axiom <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
