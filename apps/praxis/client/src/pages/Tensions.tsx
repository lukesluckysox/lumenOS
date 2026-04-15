import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GitFork, ExternalLink, Plus, FlaskConical, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TensionCardSkeleton } from "@/components/Skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ErrorCard";

interface TensionFeedItem {
  id: number;
  poleA: string;
  poleB: string;
  description: string;
  evidence: string;
  relatedAxiomIds: string;
  status: string;
  signalCount: number;
  firstSurfacedAt: string;
  lastSignalAt: string;
  salience: number;
  resolutionDirection: string;
  nominatedAt: string;
  sourceApps: string;
  nominated: boolean;
  createdAt: string;
}

const AXIOM_URL = "https://axiomtool-production.up.railway.app";

const STATUS_COLORS: Record<string, string> = {
  surfaced: "bg-blue-500/10 text-blue-400",
  accumulating: "bg-amber-500/10 text-amber-400",
  threshold: "bg-yellow-500/10 text-yellow-300",
  resolved: "bg-green-500/10 text-green-400",
  persistent: "bg-purple-500/10 text-purple-400",
};

const APP_COLORS: Record<string, string> = {
  axiom: "text-blue-400",
  praxis: "text-amber-400",
  parallax: "text-emerald-400",
  liminal: "text-purple-400",
};

export default function Tensions() {
  const { data: tensions, isLoading, isError } = useQuery<TensionFeedItem[]>({
    queryKey: ["/api/tension-feed"],
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-1">
            Tension Feed
          </h2>
          <p className="text-sm text-muted-foreground">
            Active tensions ranked by salience. Threshold tensions are ready for action.
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
        <ErrorCard message="Could not load tension feed." onRetry={() => window.location.reload()} />
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
            As signals accumulate across apps, productive contradictions will surface here.
            Tensions are mapped in Axiom and surfaced here as testing targets.
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

function TensionCard({ tension }: { tension: TensionFeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const [showSignalForm, setShowSignalForm] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const { toast } = useToast();

  const sourceApps: string[] = (() => {
    try { return JSON.parse(tension.sourceApps || "[]"); }
    catch { return []; }
  })();

  const isThreshold = tension.status === "threshold";
  const saliencePercent = Math.min(100, Math.round((tension.salience || 0) * 100));

  const durationText = (() => {
    if (!tension.firstSurfacedAt) return "";
    const days = Math.floor((Date.now() - new Date(tension.firstSurfacedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "today";
    if (days === 1) return "1 day";
    return `${days} days`;
  })();

  const createExperimentMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tension-feed/${tension.id}/experiment`, {
      poleA: tension.poleA,
      poleB: tension.poleB,
      description: tension.description,
    }),
    onSuccess: () => {
      toast({ title: "Experiment created from tension" });
      queryClient.invalidateQueries({ queryKey: ["/api/tension-feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });
    },
  });

  return (
    <div
      data-testid={`card-tension-${tension.id}`}
      className={cn(
        "bg-card border rounded-md group transition-colors",
        isThreshold ? "border-yellow-500/50" : "border-border"
      )}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-5 hover:bg-accent/20 transition-colors"
      >
        {/* Header row: poles + badges */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-display text-base font-medium text-foreground truncate">
              {tension.poleA}
            </span>
            <span className="text-primary text-sm font-light flex-shrink-0">&harr;</span>
            <span className="font-display text-base font-medium text-foreground truncate">
              {tension.poleB}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Signal count badge */}
            {tension.signalCount > 0 && (
              <span className="text-[10px] font-medium bg-muted/50 px-1.5 py-0.5 rounded-full text-muted-foreground">
                {tension.signalCount} signal{tension.signalCount !== 1 ? "s" : ""}
              </span>
            )}
            {/* Source app indicators */}
            {sourceApps.length > 0 && (
              <div className="flex items-center gap-0.5">
                {sourceApps.map(app => (
                  <span
                    key={app}
                    className={cn("text-[9px] font-bold uppercase", APP_COLORS[app] || "text-muted-foreground")}
                    title={app}
                  >
                    {app[0]}
                  </span>
                ))}
              </div>
            )}
            {/* Status badge */}
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize",
              STATUS_COLORS[tension.status] || "bg-muted/50 text-muted-foreground"
            )}>
              {tension.status}
            </span>
          </div>
        </div>

        {/* Description */}
        {tension.description && (
          <p className={cn(
            "text-sm text-muted-foreground leading-relaxed mb-2",
            !expanded && "line-clamp-2"
          )}>
            {tension.description}
          </p>
        )}

        {/* Salience bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isThreshold ? "bg-yellow-500" : "bg-primary/40"
              )}
              style={{ width: `${saliencePercent}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
            {saliencePercent}%
          </span>
          {durationText && (
            <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">
              {durationText}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Action buttons for threshold tensions */}
          {(isThreshold || tension.status === "accumulating") && tension.status !== "resolved" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => setShowSignalForm(s => !s)}
              >
                <Plus size={12} /> Add Signal
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                onClick={() => createExperimentMut.mutate()}
                disabled={createExperimentMut.isPending}
              >
                <FlaskConical size={12} /> Create Experiment
              </Button>
              {isThreshold && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={async () => {
                      await apiRequest("POST", `/api/tension-feed/${tension.id}/persist`);
                      toast({ title: "Tension marked as persistent" });
                      queryClient.invalidateQueries({ queryKey: ["/api/tension-feed"] });
                    }}
                  >
                    <Lock size={12} /> Mark Persistent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={() => setShowResolve(r => !r)}
                  >
                    <CheckCircle size={12} /> Resolve
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Signal form */}
          {showSignalForm && <AddSignalForm tensionId={tension.id} onDone={() => setShowSignalForm(false)} />}

          {/* Resolve direction picker */}
          {showResolve && <ResolveForm tensionId={tension.id} tension={tension} onDone={() => setShowResolve(false)} />}

          {/* Resolution info */}
          {tension.status === "resolved" && tension.resolutionDirection && (
            <div className="text-xs text-green-400/70 flex items-center gap-1.5">
              <CheckCircle size={11} /> Resolved toward: {tension.resolutionDirection}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground/40">
              {tension.firstSurfacedAt ? new Date(tension.firstSurfacedAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              }) : ""}
            </p>
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
      )}
    </div>
  );
}

function AddSignalForm({ tensionId, onDone }: { tensionId: number; onDone: () => void }) {
  const [content, setContent] = useState("");
  const [signalType, setSignalType] = useState("observation");
  const { toast } = useToast();

  const addSignalMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tension-feed/${tensionId}/signal`, {
      sourceApp: "praxis",
      signalType,
      content,
      confidence: 0.5,
    }),
    onSuccess: () => {
      toast({ title: "Signal added" });
      queryClient.invalidateQueries({ queryKey: ["/api/tension-feed"] });
      setContent("");
      onDone();
    },
  });

  return (
    <div className="space-y-2 border border-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">
        Add Signal
      </div>
      <select
        value={signalType}
        onChange={e => setSignalType(e.target.value)}
        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs"
      >
        <option value="observation">Observation</option>
        <option value="reflection">Reflection</option>
        <option value="contradiction">Contradiction</option>
        <option value="corroboration">Corroboration</option>
        <option value="experiment_result">Experiment Result</option>
      </select>
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What did you notice about this tension?"
        className="text-sm min-h-[60px]"
      />
      <div className="flex gap-2">
        <Button size="sm" className="text-xs" onClick={() => addSignalMut.mutate()} disabled={!content.trim() || addSignalMut.isPending}>
          Submit
        </Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ResolveForm({ tensionId, tension, onDone }: { tensionId: number; tension: TensionFeedItem; onDone: () => void }) {
  const [direction, setDirection] = useState("");
  const { toast } = useToast();

  return (
    <div className="space-y-2 border border-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">
        Resolution Direction
      </div>
      <p className="text-xs text-muted-foreground/60">
        Which pole won, or how was the tension resolved?
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={direction === tension.poleA ? "default" : "outline"}
          className="text-xs"
          onClick={() => setDirection(tension.poleA)}
        >
          {tension.poleA}
        </Button>
        <Button
          size="sm"
          variant={direction === tension.poleB ? "default" : "outline"}
          className="text-xs"
          onClick={() => setDirection(tension.poleB)}
        >
          {tension.poleB}
        </Button>
        <Button
          size="sm"
          variant={direction === "synthesis" ? "default" : "outline"}
          className="text-xs"
          onClick={() => setDirection("synthesis")}
        >
          Synthesis
        </Button>
      </div>
      <Input
        value={direction}
        onChange={e => setDirection(e.target.value)}
        placeholder="Or type a custom resolution..."
        className="text-xs"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="text-xs"
          disabled={!direction.trim()}
          onClick={async () => {
            await apiRequest("POST", `/api/tension-feed/${tensionId}/resolve`, { direction });
            toast({ title: `Tension resolved: ${direction}` });
            queryClient.invalidateQueries({ queryKey: ["/api/tension-feed"] });
            onDone();
          }}
        >
          Resolve
        </Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
