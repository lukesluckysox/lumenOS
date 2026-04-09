import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Revision } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const SIGNIFICANCE = {
  major: { label: "MAJOR", class: "text-amber-600/80 dark:text-amber-500/70" },
  moderate: { label: "MODERATE", class: "text-blue-500/70 dark:text-blue-400/60" },
  minor: { label: "MINOR", class: "text-muted-foreground/50" },
};

function RevisionEntry({ revision, onDelete }: { revision: Revision; onDelete: () => void }) {
  const sig = SIGNIFICANCE[revision.significance as keyof typeof SIGNIFICANCE] ?? SIGNIFICANCE.moderate;

  return (
    <div
      className="px-4 md:px-8 py-6 border-b border-border/50 last:border-0 group"
      data-testid={`revision-entry-${revision.id}`}
    >
      {/* Date + Significance */}
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-xs text-muted-foreground/40">
          {new Date(revision.date).toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric",
          })}
        </span>
        <span className="text-muted-foreground/20 font-mono text-xs">—</span>
        <span className={`font-mono text-[10px] uppercase tracking-widest-constitutional ${sig.class}`}>
          {sig.label} REVISION
        </span>
      </div>

      {/* The revision */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-1">
              Previous
            </div>
            <p className="text-sm text-foreground/60 leading-relaxed line-through decoration-muted-foreground/30">
              {revision.previousBelief}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-1">
              Revised
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed font-medium">
              {revision.newBelief}
            </p>
          </div>
        </div>
      </div>

      {revision.triggeringEvidence && (
        <div className="mt-4 pl-5 border-l border-border/50">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-1">
            Triggering Evidence
          </div>
          <p className="text-xs text-muted-foreground/60 leading-relaxed">{revision.triggeringEvidence}</p>
        </div>
      )}

      {!revision.triggeringEvidence && (
        <p className="mt-4 text-[10px] font-mono text-muted-foreground/25 italic">
          No triggering evidence recorded — manually entered.
        </p>
      )}

      {/* Delete */}
      <div className="mt-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="text-[10px] font-mono uppercase tracking-widest-constitutional text-destructive/40 hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function NewRevisionForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    previousBelief: "",
    newBelief: "",
    triggeringEvidence: "",
    significance: "moderate",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/revisions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revisions"] });
      toast({ description: "Revision recorded." });
      onClose();
    },
  });

  function submit() {
    createMutation.mutate(form);
  }

  const inputClass = "w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed";

  return (
    <div className="px-4 md:px-8 py-6 border-b border-border bg-card/50">
      <div className="font-mono text-[10px] uppercase tracking-widest-constitutional text-muted-foreground/50 mb-4">
        New Revision
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 block mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            data-testid="input-revision-date"
          />
        </div>
        <div>
          <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 block mb-1">Significance</label>
          <select
            value={form.significance}
            onChange={(e) => setForm((f) => ({ ...f, significance: e.target.value }))}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            data-testid="input-revision-significance"
          >
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="major">Major</option>
          </select>
        </div>
      </div>

      <textarea
        value={form.previousBelief}
        onChange={(e) => setForm((f) => ({ ...f, previousBelief: e.target.value }))}
        placeholder="Previous belief — what you held before this revision…"
        rows={2}
        className={`${inputClass} mb-3`}
        data-testid="input-previous-belief"
      />

      <textarea
        value={form.newBelief}
        onChange={(e) => setForm((f) => ({ ...f, newBelief: e.target.value }))}
        placeholder="New belief — what you now hold instead…"
        rows={2}
        className={`${inputClass} mb-3`}
        data-testid="input-new-belief"
      />

      <textarea
        value={form.triggeringEvidence}
        onChange={(e) => setForm((f) => ({ ...f, triggeringEvidence: e.target.value }))}
        placeholder="Triggering evidence — what caused this revision (optional)…"
        rows={2}
        className={`${inputClass} mb-4`}
        data-testid="input-triggering-evidence"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!form.previousBelief || !form.newBelief || createMutation.isPending}
          className="text-xs font-mono uppercase tracking-widest-constitutional px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          data-testid="button-save-revision"
        >
          {createMutation.isPending ? "Recording…" : "Record Revision"}
        </button>
        <button onClick={onClose} className="text-xs font-mono uppercase tracking-widest-constitutional text-muted-foreground/50 hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Revisions() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: revisions, isLoading, isError, refetch } = useQuery<Revision[]>({
    queryKey: ["/api/revisions"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/revisions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revisions"] });
      toast({ description: "Revision removed." });
    },
  });

  const majorCount = (revisions ?? []).filter((r) => r.significance === "major").length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 md:px-8 pt-10 pb-6 border-b border-border">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-xs tracking-widest-constitutional uppercase text-muted-foreground mb-2">
              Revisions
            </h1>
            <div className="font-serif text-3xl text-foreground">
              {isLoading ? "—" : (revisions?.length ?? 0)} worldview changes
            </div>
            {!isLoading && majorCount > 0 && (
              <div className="mt-1.5 text-xs text-muted-foreground/60 font-mono">
                {majorCount} major revision{majorCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-[11px] font-mono tracking-widest-constitutional uppercase px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors rounded-sm flex-shrink-0"
            data-testid="button-new-revision"
          >
            {showForm ? "Cancel" : "+ New Revision"}
          </button>
        </div>
      </div>

      {/* New Revision Form */}
      {showForm && <NewRevisionForm onClose={() => setShowForm(false)} />}

      {/* Revisions List */}
      {isLoading ? (
        <div className="px-4 md:px-8 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-6 border-b border-border/50">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-6" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="px-4 md:px-8 py-16 text-center">
          <div className="max-w-sm mx-auto border border-border/50 rounded-sm p-6 bg-card/30">
            <div className="font-mono text-xs uppercase tracking-widest-constitutional text-destructive/70 mb-3">
              Unable to load revisions
            </div>
            <p className="text-sm text-muted-foreground/50 leading-relaxed mb-4">
              Something went wrong while fetching your revisions. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (revisions?.length ?? 0) === 0 ? (
        <div className="px-4 md:px-8 py-16 text-center">
          <div className="font-serif text-xl text-muted-foreground/40 mb-3">
            The evolution of your principles will be recorded here.
          </div>
          <p className="text-sm text-muted-foreground/40 leading-relaxed mb-4 max-w-sm mx-auto">
            When beliefs change and principles shift, record the revision to track how your understanding evolves over time.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-mono tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            Record a revision →
          </button>
        </div>
      ) : (
        <div>
          {revisions?.map((revision) => (
            <RevisionEntry
              key={revision.id}
              revision={revision}
              onDelete={() => {
                if (confirm("Remove this revision from the record?")) deleteMutation.mutate(revision.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
