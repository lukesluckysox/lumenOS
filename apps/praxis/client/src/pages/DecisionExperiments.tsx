import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Check, X, Minus, ArrowRight, Clock, ChevronDown, Trash2,
} from "lucide-react";
import type { Decision } from "@shared/schema";

const DIMENSIONS = ["focus", "calm", "agency", "vitality", "social", "creativity", "exploration", "drive"] as const;

const DIMENSION_LABELS: Record<string, string> = {
  focus: "Focus", calm: "Calm", agency: "Agency", vitality: "Vitality",
  social: "Social", creativity: "Creativity", exploration: "Exploration", drive: "Drive",
};

const ARCHETYPES: Record<string, { name: string; color: string; emoji: string }> = {
  observer: { name: "Observer", color: "#6b9080", emoji: "👁" },
  builder:  { name: "Builder",  color: "#b8976a", emoji: "🏗" },
  explorer: { name: "Explorer", color: "#7c8ba0", emoji: "🧭" },
  dissenter:{ name: "Dissenter",color: "#c4543e", emoji: "⚡" },
  seeker:   { name: "Seeker",   color: "#9c8654", emoji: "🔮" },
};

// ── Decision History ──────────────────────────────────────────────────────

function DecisionHistory() {
  const { data: decisions = [], isLoading } = useQuery<Decision[]>({
    queryKey: ["/api/decisions"],
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/decisions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions"] });
    },
  });

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this decision?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Clock size={14} className="text-muted-foreground" />
          Decision History
        </h3>
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-muted rounded-md" />
          <div className="h-12 bg-muted rounded-md" />
        </div>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Clock size={14} className="text-muted-foreground" />
          Decision History
        </h3>
        <div className="p-4 rounded-md border border-dashed border-border bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground">
            No decisions evaluated yet. Use the engine above to test your first decision.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Clock size={14} className="text-muted-foreground" />
        Decision History
        <span className="text-xs text-muted-foreground font-normal">({decisions.length})</span>
      </h3>
      <div className="space-y-2">
        {decisions.map((d) => {
          const arch = d.targetArchetype ? ARCHETYPES[d.targetArchetype] : null;
          const ts = new Date(d.timestamp);
          const dateStr = ts.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const timeStr = ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const isExpanded = expandedId === d.id;

          return (
            <div
              key={d.id}
              className="rounded-md border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : d.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
              >
                <div className="flex-shrink-0">
                  {d.verdict === "do" && <Check size={16} className="text-green-600" />}
                  {d.verdict === "skip" && <X size={16} className="text-red-500" />}
                  {d.verdict === "neutral" && <Minus size={16} className="text-muted-foreground" />}
                  {!d.verdict && <Minus size={16} className="text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.decisionText}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {arch && (
                      <span className="text-[10px] font-medium" style={{ color: arch.color }}>
                        {arch.emoji} {arch.name}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{dateStr} {timeStr}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                    className="p-1 rounded text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border/50 space-y-2 pt-2">
                  {d.verdict && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Verdict:</span>
                      <span className={`text-xs font-medium ${
                        d.verdict === "do" ? "text-green-600" :
                        d.verdict === "skip" ? "text-red-500" :
                        "text-muted-foreground"
                      }`}>
                        {d.verdict === "do" ? "Do it" : d.verdict === "skip" ? "Skip it" : "Neutral"}
                      </span>
                    </div>
                  )}
                  {d.targetArchetype && arch && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Target archetype:</span>
                      <span className="text-xs font-medium" style={{ color: arch.color }}>
                        {arch.emoji} {arch.name}
                      </span>
                    </div>
                  )}
                  {d.alignmentBefore != null && d.alignmentAfter != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Alignment shift:</span>
                      <span className="text-xs tabular-nums">{d.alignmentBefore}% → {d.alignmentAfter}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Decision Engine ───────────────────────────────────────────────────────

function DecisionEngine() {
  const { toast } = useToast();
  const [decisionText, setDecisionText] = useState("");
  const [impacts, setImpacts] = useState<Record<string, number>>({});
  const [reasoning, setReasoning] = useState("");
  const [quickTake, setQuickTake] = useState("");
  const [verdict, setVerdict] = useState<"do" | "skip" | "neutral" | null>(null);
  const [evaluated, setEvaluated] = useState(false);
  const [predictedShift, setPredictedShift] = useState<{ from: string; to: string; confidence: number } | null>(null);
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [potentialGains, setPotentialGains] = useState<string[]>([]);
  const [narrative, setNarrative] = useState("");
  const [hasLLMAnalysis, setHasLLMAnalysis] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async (decision: string) => {
      const res = await apiRequest("POST", "/api/analyze-decision", { decision });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.impacts) setImpacts(data.impacts);
      if (data.reasoning) setReasoning(data.reasoning);
      if (data.quick_take) setQuickTake(data.quick_take);
      if (data.predicted_shift) setPredictedShift(data.predicted_shift);
      if (data.risk_factors) setRiskFactors(data.risk_factors);
      if (data.potential_gains) setPotentialGains(data.potential_gains);
      if (data.narrative) setNarrative(data.narrative);
      setHasLLMAnalysis(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not analyze decision", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: {
      decision_text: string;
      impact_vec: string;
      target_archetype: string | null;
      verdict: string;
      alignment_before: number;
      alignment_after: number;
      timestamp: string;
    }) => {
      const res = await apiRequest("POST", "/api/decisions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions"] });
      toast({ title: "Saved", description: "Decision recorded" });
    },
  });

  const handleEvaluate = () => {
    const impactVec: Record<string, number> = {};
    for (const dim of DIMENSIONS) {
      impactVec[dim] = impacts[dim] || 0;
    }

    const totalImpact = Object.values(impacts).reduce((sum, v) => sum + v, 0);
    let v: "do" | "skip" | "neutral";
    if (totalImpact > 10) v = "do";
    else if (totalImpact < -10) v = "skip";
    else v = "neutral";
    setVerdict(v);
    setEvaluated(true);

    if (decisionText.trim()) {
      saveMutation.mutate({
        decision_text: decisionText,
        impact_vec: JSON.stringify(impactVec),
        target_archetype: null,
        verdict: v,
        alignment_before: 50,
        alignment_after: 50,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleImpactChange = (dim: string, val: number) => {
    setImpacts(prev => ({ ...prev, [dim]: val }));
    setEvaluated(false);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={decisionText}
          onChange={(e) => { setDecisionText(e.target.value); setEvaluated(false); }}
          placeholder="Should I..."
          className="w-full px-3 py-2.5 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => analyzeMutation.mutate(decisionText)}
          disabled={analyzeMutation.isPending || !decisionText.trim()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-xs font-medium hover:bg-accent/50 transition-colors disabled:opacity-40"
        >
          <Zap size={12} />
          {analyzeMutation.isPending ? "Analyzing..." : "Analyze"}
        </button>
        <button
          onClick={handleEvaluate}
          disabled={!decisionText.trim()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all disabled:opacity-40"
        >
          Evaluate
        </button>
      </div>

      {(reasoning || quickTake) && (
        <div className="p-3 rounded-md border border-primary/20 bg-primary/5 text-xs text-muted-foreground space-y-1">
          {quickTake && <p className="font-medium text-foreground text-sm">{quickTake}</p>}
          {reasoning && <p>{reasoning}</p>}
        </div>
      )}

      {/* Impact sliders */}
      <div className="space-y-2">
        {DIMENSIONS.map(dim => (
          <div key={dim} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">{DIMENSION_LABELS[dim]}</label>
              <span className={`text-xs tabular-nums font-medium ${(impacts[dim] || 0) > 0 ? "text-green-600" : (impacts[dim] || 0) < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                {(impacts[dim] || 0) > 0 ? "+" : ""}{impacts[dim] || 0}
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={impacts[dim] || 0}
              onChange={(e) => handleImpactChange(dim, parseInt(e.target.value, 10))}
              className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-sm"
            />
          </div>
        ))}
      </div>

      {/* Verdict */}
      {evaluated && verdict && (
        <div className="space-y-3">
          <div
            className={`p-3 rounded-md border text-center ${
              verdict === "do"
                ? "border-green-500/30 bg-green-500/5"
                : verdict === "skip"
                ? "border-red-500/30 bg-red-500/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              {verdict === "do" && <Check size={16} className="text-green-600" />}
              {verdict === "skip" && <X size={16} className="text-red-500" />}
              {verdict === "neutral" && <Minus size={16} className="text-muted-foreground" />}
              <span className="text-sm font-bold">
                {verdict === "do" && "Do it"}
                {verdict === "skip" && "Skip it"}
                {verdict === "neutral" && "Neutral"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Decision Simulator — only shows after LLM analysis */}
      {hasLLMAnalysis && (predictedShift || riskFactors.length > 0 || potentialGains.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Decision Simulator</h3>

          {/* Predicted Archetype Shift */}
          {predictedShift && predictedShift.from && predictedShift.to && (
            <div className="p-3 rounded-md border border-border bg-card">
              <p className="text-xs text-muted-foreground mb-2">Predicted archetype shift</p>
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg" style={{ color: ARCHETYPES[predictedShift.from]?.color }}>{ARCHETYPES[predictedShift.from]?.emoji || ""}</span>
                  <span className="text-sm font-medium" style={{ color: ARCHETYPES[predictedShift.from]?.color }}>
                    {ARCHETYPES[predictedShift.from]?.name || predictedShift.from}
                  </span>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
                <div className="flex items-center gap-1.5">
                  <span className="text-lg" style={{ color: ARCHETYPES[predictedShift.to]?.color }}>{ARCHETYPES[predictedShift.to]?.emoji || ""}</span>
                  <span className="text-sm font-medium" style={{ color: ARCHETYPES[predictedShift.to]?.color }}>
                    {ARCHETYPES[predictedShift.to]?.name || predictedShift.to}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Confidence</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {Math.round(predictedShift.confidence * 100)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all"
                    style={{ width: `${Math.round(predictedShift.confidence * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Risk Factors & Potential Gains */}
          <div className="flex flex-wrap gap-1.5">
            {riskFactors.map((risk, i) => (
              <span
                key={`risk-${i}`}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              >
                {risk}
              </span>
            ))}
            {potentialGains.map((gain, i) => (
              <span
                key={`gain-${i}`}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
              >
                {gain}
              </span>
            ))}
          </div>

          {/* Narrative */}
          {narrative && (
            <p className="text-sm italic text-muted-foreground leading-relaxed px-1">
              {narrative}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DecisionExperiments() {
  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-8">
        <h2 className="font-display text-xl font-semibold text-foreground mb-1">
          Decision Experiments
        </h2>
        <p className="text-sm text-muted-foreground">
          Test a decision against what you know about yourself.
        </p>
      </div>

      <div className="space-y-8">
        <DecisionEngine />
        <DecisionHistory />
      </div>
    </div>
  );
}
