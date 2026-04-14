import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Star, GitFork, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { TensionCardSkeleton } from "@/components/Skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Tension } from "@shared/schema";
import { formatDate, getTensionLabel } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { GitFork, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/ErrorCard";
import { cn } from "@/lib/utils";

// Axiom tension shape (different from Praxis local schema)
interface AxiomTension {
  id: number;
  poleA: string;
  poleB: string;
  description: string;
  evidence: string; // JSON string[]
  relatedAxiomIds: string; // JSON number[]
  createdAt: string; // ISO date string
}

const AXIOM_URL = "https://axiomtool-production.up.railway.app";

export default function Tensions() {
  const { data: tensions, isLoading, isError } = useQuery<AxiomTension[]>({
    queryKey: ["/api/axiom-tensions"],
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-1">
            Core Tensions
          </h2>
          <p className="text-sm text-muted-foreground">
            Tensions mapped in Axiom, surfaced here as testing targets.
          </p>
        </div>
        <a
          href={`${AXIOM_URL}/#/tensions`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors flex-shrink-0 mt-1"
        >
          Manage in Axiom <ExternalLink size={11} />
        </a>
      </div>

      {isError ? (
        <ErrorCard message="Could not load tensions." onRetry={() => window.location.reload()} />
      ) : isLoading ? (
        <div className="space-y-3">
          <TensionCardSkeleton />
          <TensionCardSkeleton />
          <TensionCardSkeleton />
        </div>
      ) : tensions?.length === 0 ? (
        <div className="border border-dashed border-border rounded-md py-16 text-center">
          <GitFork size={24} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-1">No tensions mapped yet.</p>
          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
            As my experiments reveal competing truths, productive contradictions will surface here — the gravitational poles shaping my decisions.
            Tensions are mapped in Axiom and surfaced here as testing targets.
            When you're ready, design an experiment around one.
          </p>
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
  const [expanded, setExpanded] = useState(false);
  const evidence: string[] = (() => {
    try { return JSON.parse(tension.evidence || "[]"); }
    catch { return []; }
  })();

  return (
    <div
      data-testid={`card-tension-${tension.id}`}
      className="bg-card border border-border rounded-md group transition-colors"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-6 hover:bg-accent/20 transition-colors"
      >
        {/* Poles */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-3 flex-1">
            <span className="font-display text-lg font-medium text-foreground">
              {tension.poleA}
            </span>
            <span className="text-primary text-lg font-light">&harr;</span>
            <span className="font-display text-lg font-medium text-foreground">
              {tension.poleB}
            </span>
          </div>
          <span className="text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors text-xs">
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>

        {/* Description preview */}
        {tension.description && (
          <p className={cn(
            "text-sm text-muted-foreground leading-relaxed",
            !expanded && "line-clamp-2"
          )}>
            {tension.description}
          </p>
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {/* Evidence */}
          {evidence.length > 0 && (
            <div className="mt-1 mb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium mb-2">
                Evidence
              </div>
              <div className="space-y-2">
                {evidence.map((e, i) => (
                  <p key={i} className="text-sm text-muted-foreground/70 leading-relaxed pl-3 border-l border-border">
                    {e}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Footer with links */}
          <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
            <p className="text-xs text-muted-foreground/40">
              {new Date(tension.createdAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              })}
            </p>
            <div className="flex items-center gap-4">
              <a
                href={`/#/experiments/new`}
                className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
              >
                Design experiment &rarr;
              </a>
              <a
                href={`${AXIOM_URL}/#/tensions`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                View in Axiom <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
