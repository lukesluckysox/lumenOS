import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CONFIDENCE_OPTIONS = [
  { value: "low", label: "LOW", score: 15, description: "Weak signal. Contradictory or very limited evidence." },
  { value: "medium-low", label: "MEDIUM-LOW", score: 32, description: "Emerging pattern. Some evidence, significant uncertainty." },
  { value: "medium", label: "MEDIUM", score: 55, description: "Plausible. Multiple consistent signals with notable counterevidence." },
  { value: "medium-high", label: "MEDIUM-HIGH", score: 72, description: "Strong pattern. Well-supported across multiple sources." },
  { value: "high", label: "HIGH", score: 88, description: "Robust. Consistent across extensive evidence with minimal contradiction." },
];

const STEPS = [
  { id: 1, label: "SIGNAL", description: "Define the inputs that generated this synthesis." },
  { id: 2, label: "CONVERGENCE", description: "What pattern emerges across these sources?" },
  { id: 3, label: "INTERPRETATION", description: "What does this convergence mean?" },
  { id: 4, label: "PRINCIPLE", description: "State what is true and how to act on it." },
  { id: 5, label: "REVIEW", description: "Review and record the synthesis." },
];

interface FormData {
  liminalCount: number;
  parallaxCount: number;
  praxisCount: number;
  liminalDesc: string;
  parallaxDesc: string;
  praxisDesc: string;
  signal: string;
  convergence: string;
  interpretation: string;
  truthClaim: string;
  workingPrinciple: string;
  confidence: string;
  confidenceScore: number;
  counterevidence: string;
  revisionNote: string;
  title: string;
}

const INIT: FormData = {
  liminalCount: 0, parallaxCount: 0, praxisCount: 0,
  liminalDesc: "", parallaxDesc: "", praxisDesc: "",
  signal: "", convergence: "", interpretation: "",
  truthClaim: "", workingPrinciple: "",
  confidence: "medium", confidenceScore: 55,
  counterevidence: "", revisionNote: "", title: "",
};

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className={`flex items-center gap-2 ${i > 0 ? "ml-4" : ""}`}>
            <div className={`w-5 h-5 rounded-sm flex items-center justify-center font-mono text-[10px] transition-colors ${
              step.id < current
                ? "bg-primary/20 text-primary"
                : step.id === current
                ? "bg-primary text-primary-foreground"
                : "bg-border text-muted-foreground/40"
            }`}>
              {step.id < current ? "✓" : step.id}
            </div>
            <span className={`font-mono text-[10px] uppercase tracking-wider hidden sm:inline ${
              step.id === current ? "text-foreground" : "text-muted-foreground/40"
            }`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 ml-4 ${step.id < current ? "bg-primary/30" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({
  label, desc, children,
}: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <label className="block font-mono text-[10px] uppercase tracking-widest-constitutional text-muted-foreground/60 mb-1.5">
        {label}
      </label>
      {desc && <p className="text-xs text-muted-foreground/50 mb-2 leading-relaxed">{desc}</p>}
      {children}
    </div>
  );
}

function Textarea({
  value, onChange, placeholder, rows = 4, testId,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; testId?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      data-testid={testId}
      className="w-full bg-background border border-border rounded-sm px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
    />
  );
}

function NumInput({
  value, onChange, label, testId,
}: { value: number; onChange: (v: number) => void; label: string; testId?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-11 h-11 md:w-7 md:h-7 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors font-mono text-sm flex items-center justify-center"
      >
        −
      </button>
      <span className="font-mono text-sm w-6 text-center tabular-nums" data-testid={testId}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-11 h-11 md:w-7 md:h-7 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors font-mono text-sm flex items-center justify-center"
      >
        +
      </button>
      <span className="text-xs text-muted-foreground/50 font-mono uppercase">{label}</span>
    </div>
  );
}

export default function NewSynthesis() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INIT);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const set = (key: keyof FormData) => (val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/axioms", data),
    onSuccess: async (res) => {
      const axiom = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/axioms"] });
      toast({ description: `Axiom #${axiom.number} recorded.` });
      navigate(`/axiom/${axiom.id}`);
    },
    onError: () => {
      toast({ variant: "destructive", description: "Failed to record synthesis." });
    },
  });

  function submit() {
    const inputDescriptions = [
      form.liminalDesc && form.liminalCount > 0 ? `Liminal: ${form.liminalDesc}` : null,
      form.parallaxDesc && form.parallaxCount > 0 ? `Parallax: ${form.parallaxDesc}` : null,
      form.praxisDesc && form.praxisCount > 0 ? `Praxis: ${form.praxisDesc}` : null,
    ].filter(Boolean);

    createMutation.mutate({
      title: form.title || form.truthClaim.slice(0, 80),
      liminalCount: form.liminalCount,
      parallaxCount: form.parallaxCount,
      praxisCount: form.praxisCount,
      inputDescriptions: JSON.stringify(inputDescriptions),
      signal: form.signal,
      convergence: form.convergence,
      interpretation: form.interpretation,
      truthClaim: form.truthClaim,
      workingPrinciple: form.workingPrinciple,
      confidence: form.confidence,
      confidenceScore: form.confidenceScore,
      counterevidence: form.counterevidence,
      revisionNote: form.revisionNote,
      revisionHistory: "[]",
    });
  }

  const canProceed: Record<number, boolean> = {
    1: form.liminalCount + form.parallaxCount + form.praxisCount > 0,
    2: form.convergence.length > 20,
    3: form.interpretation.length > 20,
    4: form.truthClaim.length > 10,
    5: true,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 pt-10 pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-mono text-xs tracking-widest-constitutional uppercase text-muted-foreground mb-3">
          Submit Proposal
        </h1>
        <p className="text-sm text-muted-foreground/60 leading-relaxed">
          {STEPS[step - 1].description}
        </p>
      </div>

      <StepBar current={step} />

      {/* Step 1: Signal */}
      {step === 1 && (
        <div>
          <div className="font-serif text-xl text-foreground mb-6">
            Where does this synthesis come from?
          </div>

          <Field label="Liminal Dilemmas">
            <div className="mb-3">
              <NumInput value={form.liminalCount} onChange={set("liminalCount") as any} label="inputs" testId="input-liminal-count" />
            </div>
            {form.liminalCount > 0 && (
              <Textarea
                value={form.liminalDesc}
                onChange={set("liminalDesc") as any}
                placeholder="Describe which beliefs were destabilized, which contradictions surfaced, or which dilemmas remained unresolved…"
                rows={3}
                testId="input-liminal-desc"
              />
            )}
          </Field>

          <Field label="Parallax Inputs">
            <div className="mb-3">
              <NumInput value={form.parallaxCount} onChange={set("parallaxCount") as any} label="inputs" testId="input-parallax-count" />
            </div>
            {form.parallaxCount > 0 && (
              <Textarea
                value={form.parallaxDesc}
                onChange={set("parallaxDesc") as any}
                placeholder="Describe which archetypes, concealment patterns, or identity structures appeared…"
                rows={3}
                testId="input-parallax-desc"
              />
            )}
          </Field>

          <Field label="Praxis Experiments">
            <div className="mb-3">
              <NumInput value={form.praxisCount} onChange={set("praxisCount") as any} label="inputs" testId="input-praxis-count" />
            </div>
            {form.praxisCount > 0 && (
              <Textarea
                value={form.praxisDesc}
                onChange={set("praxisDesc") as any}
                placeholder="Describe which experiments ran, what was observed, and what was confirmed or refuted…"
                rows={3}
                testId="input-praxis-desc"
              />
            )}
          </Field>

          {form.signal && (
            <Field label="Signal — Optional Context" desc="Optionally, describe the combined signal before convergence.">
              <Textarea value={form.signal} onChange={set("signal") as any} placeholder="…" rows={3} testId="input-signal" />
            </Field>
          )}
          {!form.signal && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, signal: " " }))}
              className="text-[10px] font-mono text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors tracking-wider mb-6 block"
            >
              + Add signal context
            </button>
          )}
        </div>
      )}

      {/* Step 2: Convergence */}
      {step === 2 && (
        <div>
          <div className="font-serif text-xl text-foreground mb-6">
            What pattern emerges across these sources?
          </div>
          <Field
            label="Convergence"
            desc="Describe the common thread. What do Liminal, Parallax, and Praxis all point toward? What behavioral distortion, structural tendency, or recurring dynamic appears across all inputs?"
          >
            <Textarea
              value={form.convergence}
              onChange={set("convergence") as any}
              placeholder="Multiple sources converge on…"
              rows={6}
              testId="input-convergence"
            />
          </Field>
        </div>
      )}

      {/* Step 3: Interpretation */}
      {step === 3 && (
        <div>
          <div className="font-serif text-xl text-foreground mb-6">
            What does this convergence mean?
          </div>
          <Field
            label="Interpretation"
            desc="Move from observation to understanding. Why does this pattern exist? What does it reveal about how you function?"
          >
            <Textarea
              value={form.interpretation}
              onChange={set("interpretation") as any}
              placeholder="This pattern suggests…"
              rows={6}
              testId="input-interpretation"
            />
          </Field>
        </div>
      )}

      {/* Step 4: Principle */}
      {step === 4 && (
        <div>
          <div className="font-serif text-xl text-foreground mb-6">
            What is true, and how should you act on it?
          </div>

          <Field label="PROPOSED CLAIM" desc="State the principle as a direct, earned claim. Not a preference — a provisional truth.">
            <Textarea
              value={form.truthClaim}
              onChange={set("truthClaim") as any}
              placeholder="…is often… / …appears to… / …requires…"
              rows={3}
              testId="input-truth-claim"
            />
          </Field>

          <Field label="Working Principle — Optional" desc="The actionable form of this truth. What should you do differently?">
            <Textarea
              value={form.workingPrinciple}
              onChange={set("workingPrinciple") as any}
              placeholder="Act toward… / Protect… / When X, do Y…"
              rows={3}
              testId="input-working-principle"
            />
          </Field>

          <Field label="Confidence">
            <div className="space-y-2">
              {CONFIDENCE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => setForm((f) => ({ ...f, confidence: opt.value, confidenceScore: opt.score }))}
                  className={`flex items-start gap-3 px-4 py-3 rounded-sm border cursor-pointer transition-colors ${
                    form.confidence === opt.value
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-border/80 hover:bg-accent/30"
                  }`}
                  data-testid={`confidence-option-${opt.value}`}
                >
                  <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 border-2 transition-colors ${
                    form.confidence === opt.value ? "border-primary bg-primary" : "border-border"
                  }`} />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-foreground/70 mb-0.5">{opt.label}</div>
                    <div className="text-xs text-muted-foreground/60 leading-relaxed">{opt.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Counterevidence — Optional" desc="What contradicts or limits this principle?">
            <Textarea
              value={form.counterevidence}
              onChange={set("counterevidence") as any}
              placeholder="However, in cases where… / This does not hold when…"
              rows={3}
              testId="input-counterevidence"
            />
          </Field>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div>
          <div className="font-serif text-xl text-foreground mb-6">
            Review and record.
          </div>

          <Field label="Axiom Title" desc="A short, precise title for this principle. Defaults to the truth claim if left blank.">
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder={form.truthClaim.slice(0, 80) || "Title…"}
              className="w-full bg-background border border-border rounded-sm px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-title"
            />
          </Field>

          {/* Preview card */}
          <div className="bg-card border border-card-border rounded-sm p-5 mb-6">
            <div className="font-mono text-[10px] tracking-widest-constitutional uppercase text-muted-foreground/40 mb-1">Preview</div>
            <p className="font-serif text-lg italic text-foreground/90 mb-3">"{form.truthClaim}"</p>
            <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/50">
              <span className="uppercase tracking-wider">{form.confidence}</span>
              {form.liminalCount > 0 && <span className="text-purple-500/70">L·{form.liminalCount}</span>}
              {form.parallaxCount > 0 && <span className="text-blue-500/70">P·{form.parallaxCount}</span>}
              {form.praxisCount > 0 && <span className="text-emerald-600/70">Pr·{form.praxisCount}</span>}
            </div>
          </div>

          <Field label="Revision Note — Optional" desc="If this synthesizes a prior belief that has changed, describe the revision.">
            <Textarea
              value={form.revisionNote}
              onChange={set("revisionNote") as any}
              placeholder="Previously believed… / Now understood as…"
              rows={3}
              testId="input-revision-note"
            />
          </Field>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
        <button
          type="button"
          onClick={() => step > 1 ? setStep((s) => s - 1) : navigate("/")}
          className="text-xs font-mono uppercase tracking-widest-constitutional text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          ← {step > 1 ? "Back" : "Cancel"}
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed[step]}
            className={`text-xs font-mono uppercase tracking-widest-constitutional px-5 py-2.5 min-h-[44px] rounded-sm transition-colors ${
              canProceed[step]
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            }`}
            data-testid="button-next"
          >
            {STEPS[step].label} →
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canProceed[4] || createMutation.isPending}
            className={`text-xs font-mono uppercase tracking-widest-constitutional px-5 py-2.5 min-h-[44px] rounded-sm transition-colors ${
              canProceed[4]
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            }`}
            data-testid="button-submit"
          >
            {createMutation.isPending ? "Submitting…" : "Submit for Examination"}
          </button>
        )}
      </div>
    </div>
  );
}
