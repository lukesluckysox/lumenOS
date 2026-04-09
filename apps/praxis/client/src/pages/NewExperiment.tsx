import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { ArrowLeft, ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Experiment } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  source: z.enum(["liminal", "parallax", "manual"]).default("manual"),
  hypothesis: z.string().min(10, "State the hypothesis clearly"),
  design: z.string().min(10, "Describe the experiment design"),
  experimentConstraint: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

const STEPS = [
  {
    id: "origin",
    title: "Origin",
    description: "Where does this experiment come from?",
  },
  {
    id: "hypothesis",
    title: "Hypothesis",
    description: "What do you currently believe to be true?",
  },
  {
    id: "design",
    title: "Design",
    description: "What will you do to test this belief?",
  },
  {
    id: "constraint",
    title: "Constraint",
    description: "What condition prevents self-deception? (optional)",
  },
];

export default function NewExperiment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  // Parse ?from=<id> for Modify flow (pre-fill from a proposed experiment)
  // Hash router puts query params inside the hash fragment (e.g. /#/experiments/new?from=123)
  const fromId = typeof window !== "undefined"
    ? (() => {
        const hash = window.location.hash;
        const qIndex = hash.indexOf("?");
        if (qIndex !== -1) {
          return new URLSearchParams(hash.slice(qIndex)).get("from");
        }
        return new URLSearchParams(window.location.search).get("from");
      })()
    : null;

  const { data: nextTrial } = useQuery<{ trialNumber: number }>({
    queryKey: ["/api/experiments/next-trial"],
  });

  // Load the proposed experiment to pre-fill the form
  const { data: fromExperiment } = useQuery<Experiment>({
    queryKey: ["/api/experiments", fromId],
    enabled: !!fromId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      source: "manual",
      hypothesis: "",
      design: "",
      experimentConstraint: "",
    },
  });

  // Pre-fill form once proposed experiment data arrives
  useEffect(() => {
    if (!fromExperiment) return;
    form.reset({
      title: fromExperiment.title,
      source: (fromExperiment.source === "lumen_push" ? "manual" : fromExperiment.source) as "manual" | "liminal" | "parallax",
      hypothesis: fromExperiment.hypothesis,
      design: fromExperiment.design,
      experimentConstraint: fromExperiment.experimentConstraint ?? "",
    });
  }, [fromExperiment, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/experiments", {
        ...values,
        status: "active",
        trialNumber: nextTrial?.trialNumber ?? 1,
        tags: "[]",
      });
      return res.json() as Promise<Experiment>;
    },
    onSuccess: (exp) => {
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments/next-trial"] });
      toast({ title: `Trial #${exp.trialNumber} initiated.` });
      setLocation(`/experiments/${exp.id}`);
    },
    onError: () => toast({ title: "Failed to create experiment.", variant: "destructive" }),
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  const canProceed = () => {
    const errors = form.formState.errors;
    if (step === 0) return !errors.title && form.getValues("title").length >= 3;
    if (step === 1) return !errors.hypothesis && form.getValues("hypothesis").length >= 10;
    if (step === 2) return !errors.design && form.getValues("design").length >= 10;
    return true;
  };

  return (
    <div className="p-4 md:p-8 max-w-xl">
      {/* Back */}
      <Link href="/experiments">
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={12} />
          All Experiments
        </button>
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical size={16} className="text-primary" />
          <span className="trial-badge">
            {nextTrial ? `Trial #${nextTrial.trialNumber}` : "New Trial"}
          </span>
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-1">
          {fromExperiment ? "Modify Proposed Experiment" : "Design an Experiment"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {fromExperiment
            ? "Review and refine this Loop-generated experiment before initiating."
            : "Begin with a belief. Design a test. Enter the laboratory."}
        </p>
      </div>

      {/* Modify mode notice */}
      {fromExperiment && (
        <div className="mb-6 px-4 py-3 rounded-md bg-muted/30 border border-dashed border-border/60 text-xs text-muted-foreground">
          Pre-filled from a Loop-proposed experiment. Edit any fields before initiating.
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium transition-colors",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium transition-colors",
              i === step ? "text-foreground" : "text-muted-foreground"
            )}>
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px w-4 ml-1", i < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Step 0: Origin + Title */}
          {step === 0 && (
            <>
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                      Origin
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          data-testid="select-source"
                          className="bg-muted/40 border-border"
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Self-initiated</SelectItem>
                        <SelectItem value="liminal">From an unresolved belief</SelectItem>
                        <SelectItem value="parallax">From a behavioral pattern</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                      Trial Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-title"
                        placeholder="e.g. Controlled Exposure"
                        {...field}
                        className="bg-muted/40 border-border focus:border-primary/40"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Step 1: Hypothesis */}
          {step === 1 && (
            <FormField
              control={form.control}
              name="hypothesis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                    Hypothesis
                  </FormLabel>
                  <p className="text-xs text-muted-foreground/60 mb-2">
                    State the belief you are testing. Be specific.
                  </p>
                  <FormControl>
                    <Textarea
                      data-testid="textarea-hypothesis"
                      placeholder="e.g. The fear of criticism is exaggerated compared to actual reactions from others."
                      {...field}
                      className="bg-muted/40 border-border resize-none min-h-[120px] focus:border-primary/40"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Step 2: Design */}
          {step === 2 && (
            <FormField
              control={form.control}
              name="design"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                    Experiment Design
                  </FormLabel>
                  <p className="text-xs text-muted-foreground/60 mb-2">
                    What specific action will you take to test this belief?
                  </p>
                  <FormControl>
                    <Textarea
                      data-testid="textarea-design"
                      placeholder="e.g. Share one unfinished idea with a trusted person or small audience."
                      {...field}
                      className="bg-muted/40 border-border resize-none min-h-[120px] focus:border-primary/40"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Step 3: Constraint */}
          {step === 3 && (
            <FormField
              control={form.control}
              name="experimentConstraint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                    Constraint <span className="normal-case text-muted-foreground/50 tracking-normal ml-1">(optional)</span>
                  </FormLabel>
                  <p className="text-xs text-muted-foreground/60 mb-2">
                    What rule prevents you from avoiding or softening the test?
                  </p>
                  <FormControl>
                    <Textarea
                      data-testid="textarea-experimentConstraint"
                      placeholder="e.g. No editing after the initial draft is written."
                      {...field}
                      className="bg-muted/40 border-border resize-none min-h-[100px] focus:border-primary/40"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(s => s - 1)}
                className="gap-1.5 text-muted-foreground"
              >
                <ArrowLeft size={13} /> Back
              </Button>
            )}
            <div className="ml-auto" />
            {step < STEPS.length - 1 ? (
              <Button
                data-testid="button-next"
                type="button"
                size="sm"
                onClick={async () => {
                  const fields: (keyof FormValues)[] =
                    step === 0 ? ["title", "source"] :
                    step === 1 ? ["hypothesis"] :
                    step === 2 ? ["design"] : [];
                  const valid = await form.trigger(fields);
                  if (valid) setStep(s => s + 1);
                }}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue <ArrowRight size={13} />
              </Button>
            ) : (
              <Button
                data-testid="button-submit"
                type="submit"
                size="sm"
                disabled={mutation.isPending}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Initiate Trial <ArrowRight size={13} />
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
