import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Tension } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function TensionCard({ tension, onDelete }: { tension: Tension; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const evidence: string[] = JSON.parse(tension.evidence || "[]");

  return (
    <div
      className="border-b border-border/50 last:border-0"
      data-testid={`tension-card-${tension.id}`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-4 md:px-8 py-6 hover:bg-accent/20 transition-colors group"
      >
        {/* Polarity Display */}
        <div className="flex items-center gap-4 mb-3">
          <span className="font-mono text-sm tracking-widest-constitutional uppercase text-purple-500/80 dark:text-purple-400/70">
            {tension.poleA}
          </span>
          <span className="font-mono text-muted-foreground/30 text-sm">↔</span>
          <span className="font-mono text-sm tracking-widest-constitutional uppercase text-blue-500/80 dark:text-blue-400/70">
            {tension.poleB}
          </span>
          <span className="ml-auto text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors font-mono text-xs">
            {expanded ? "▲" : "▼"}
          </span>
        </div>

        <p className="text-sm text-foreground/70 leading-relaxed line-clamp-2 text-left">
          {tension.description}
        </p>
      </button>

      {expanded && (
        <div className="px-4 md:px-8 pb-6">
          <p className="text-sm text-foreground/80 leading-relaxed mb-4">{tension.description}</p>

          {/* Provenance note for auto-created tensions from the Parallax pipeline */}
          {tension.description.startsWith('Parallax pattern contradicts proposed axiom') && (
            <div className="mt-3 mb-1 flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4d8c9e', marginTop: '5px' }} />
              <p className="text-[10px] font-mono text-muted-foreground/40 leading-relaxed italic">
                This tension was surfaced when a Parallax pattern contradicted a constitutional principle.
              </p>
            </div>
          )}

          {evidence.length > 0 && (
            <div className="mt-4">
              <div className="font-mono text-[10px] uppercase tracking-widest-constitutional text-muted-foreground/40 mb-2">
                Evidence
              </div>
              <div className="space-y-2">
                {evidence.map((e, i) => (
                  <p key={i} className="text-sm text-foreground/60 leading-relaxed pl-3 border-l border-border">
                    {e}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground/30">
              {new Date(tension.createdAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              })}
            </span>
            <div className="flex items-center gap-4">
              <a
                href="https://praxis-app.up.railway.app"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-mono tracking-wider text-primary/50 hover:text-primary transition-colors"
              >
                Design an experiment →
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(tension.id); }}
                className="text-[10px] font-mono uppercase tracking-widest-constitutional text-destructive/40 hover:text-destructive transition-colors min-h-[44px] flex items-center"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewTensionForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    poleA: "", poleB: "", description: "", evidence: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tensions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tensions"] });
      toast({ description: "Tension recorded." });
      onClose();
    },
  });

  function submit() {
    const evidence = form.evidence.trim()
      ? form.evidence.split("\n").filter((l) => l.trim()).map((l) => l.trim())
      : [];
    createMutation.mutate({
      poleA: form.poleA.toUpperCase(),
      poleB: form.poleB.toUpperCase(),
      description: form.description,
      evidence: JSON.stringify(evidence),
      relatedAxiomIds: "[]",
    });
  }

  return (
    <div className="px-4 md:px-8 py-6 border-b border-border bg-card/50">
      <div className="font-mono text-[10px] uppercase tracking-widest-constitutional text-muted-foreground/50 mb-4">
        New Tension
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={form.poleA}
          onChange={(e) => setForm((f) => ({ ...f, poleA: e.target.value }))}
          placeholder="POLE A"
          className="flex-1 bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono uppercase tracking-wider placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="input-pole-a"
        />
        <span className="font-mono text-muted-foreground/40">↔</span>
        <input
          type="text"
          value={form.poleB}
          onChange={(e) => setForm((f) => ({ ...f, poleB: e.target.value }))}
          placeholder="POLE B"
          className="flex-1 bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono uppercase tracking-wider placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="input-pole-b"
        />
      </div>

      <textarea
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="Describe the tension — why these poles are both necessary, and how they create friction…"
        rows={3}
        className="w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed mb-3"
        data-testid="input-tension-description"
      />

      <textarea
        value={form.evidence}
        onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))}
        placeholder="Evidence (one item per line, optional)…"
        rows={2}
        className="w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed mb-4"
        data-testid="input-tension-evidence"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!form.poleA || !form.poleB || !form.description || createMutation.isPending}
          className="text-xs font-mono uppercase tracking-widest-constitutional px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          data-testid="button-save-tension"
        >
          {createMutation.isPending ? "Recording…" : "Record Tension"}
        </button>
        <button
          onClick={onClose}
          className="text-xs font-mono uppercase tracking-widest-constitutional text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function CoreTensions() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tensions, isLoading, isError, refetch } = useQuery<Tension[]>({
    queryKey: ["/api/tensions"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tensions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tensions"] });
      toast({ description: "Tension removed." });
    },
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 md:px-8 pt-10 pb-6 border-b border-border">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-xs tracking-widest-constitutional uppercase text-muted-foreground mb-2">
              Core Tensions
            </h1>
            <div className="font-serif text-3xl text-foreground">
              {isLoading ? "—" : (tensions?.length ?? 0)} unresolved polarities
            </div>
            <p className="mt-2 text-sm text-muted-foreground/60 leading-relaxed max-w-lg">
              Recurring polarities that continue to organize your life. These are not problems to solve — they are tensions to understand.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-[11px] font-mono tracking-widest-constitutional uppercase px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors rounded-sm flex-shrink-0"
            data-testid="button-new-tension"
          >
            {showForm ? "Cancel" : "+ New Tension"}
          </button>
        </div>
      </div>

      {/* New Tension Form */}
      {showForm && <NewTensionForm onClose={() => setShowForm(false)} />}

      {/* Tensions List */}
      {isLoading ? (
        <div className="px-4 md:px-8 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-6 border-b border-border/50">
              <div className="flex items-center gap-4 mb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-6" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mt-2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="px-4 md:px-8 py-16 text-center">
          <div className="max-w-sm mx-auto border border-border/50 rounded-sm p-6 bg-card/30">
            <div className="font-mono text-xs uppercase tracking-widest-constitutional text-destructive/70 mb-3">
              Unable to load tensions
            </div>
            <p className="text-sm text-muted-foreground/50 leading-relaxed mb-4">
              Something went wrong while fetching your tensions. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (tensions?.length ?? 0) === 0 ? (
        <div className="px-4 md:px-8 py-16 text-center">
          <div className="font-serif text-xl text-muted-foreground/40 mb-3">
            Points of productive contradiction will surface as your principles evolve.
          </div>
          <p className="text-sm text-muted-foreground/40 leading-relaxed mb-4 max-w-sm mx-auto">
            As governing principles form and interact, tensions between them will emerge here for you to navigate.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-mono tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            Record a tension →
          </button>
        </div>
      ) : (
        <div>
          {tensions?.map((tension) => (
            <TensionCard
              key={tension.id}
              tension={tension}
              onDelete={(id) => {
                if (confirm("Remove this tension from the record?")) deleteMutation.mutate(id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
