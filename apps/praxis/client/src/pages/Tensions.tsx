import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Star, GitFork, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ErrorCard } from "@/components/ErrorCard";

const schema = z.object({
  poleA: z.string().min(2, "Name the first pole"),
  poleB: z.string().min(2, "Name the second pole"),
  insight: z.string().default(""),
  description: z.string().default(""),
  isPrimary: z.boolean().default(false),
  strength: z.number().min(1).max(10).default(5),
});

type FormValues = z.infer<typeof schema>;

export default function Tensions() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: tensions, isLoading, isError } = useQuery<Tension[]>({
    queryKey: ["/api/tensions"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      poleA: "",
      poleB: "",
      insight: "",
      description: "",
      isPrimary: false,
      strength: 5,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/tensions", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tensions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      form.reset();
      setOpen(false);
      toast({ title: "Tension mapped." });
    },
    onError: () => toast({ title: "Failed to save.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Tension> }) => {
      const res = await apiRequest("PATCH", `/api/tensions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tensions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tensions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tensions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
    },
  });

  const togglePrimary = (tension: Tension) => {
    updateMutation.mutate({ id: tension.id, data: { isPrimary: !tension.isPrimary } });
  };

  const primaryTension = tensions?.find(t => t.isPrimary);
  const otherTensions = tensions?.filter(t => !t.isPrimary) ?? [];

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-1">
            Core Tensions
          </h2>
          <p className="text-sm text-muted-foreground">
            The gravitational poles shaping how you navigate your life.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-new-tension"
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} /> Map Tension
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-medium">
                Map a Life Axis
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="poleA"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                          Pole A
                        </FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-pole-a"
                            placeholder="e.g. Autonomy"
                            {...field}
                            className="bg-muted/40 border-border focus:border-primary/40"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="poleB"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                          Pole B
                        </FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-pole-b"
                            placeholder="e.g. Recognition"
                            {...field}
                            className="bg-muted/40 border-border focus:border-primary/40"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="strength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                        Strength <span className="normal-case tracking-normal text-muted-foreground ml-1">{field.value}/10</span>
                      </FormLabel>
                      <FormControl>
                        <Slider
                          data-testid="slider-strength"
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value]}
                          onValueChange={([v]) => field.onChange(v)}
                          className="mt-2"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                        Key Insight <span className="normal-case text-muted-foreground/50 tracking-normal ml-1">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="textarea-insight"
                          placeholder="e.g. Many dilemmas involve balancing intellectual independence with the desire for external validation."
                          {...field}
                          className="bg-muted/40 border-border resize-none min-h-[80px] focus:border-primary/40"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isPrimary"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          data-testid="switch-primary"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <Label className="text-sm text-muted-foreground cursor-pointer">
                        Mark as primary tension
                      </Label>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    data-testid="button-submit-tension"
                    type="submit"
                    size="sm"
                    disabled={createMutation.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Map Axis
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isError ? (
        <ErrorCard message="Could not load tensions." onRetry={() => window.location.reload()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-md" />)}
        </div>
      ) : tensions?.length === 0 ? (
        <div className="border border-dashed border-border rounded-md py-16 text-center">
          <GitFork size={24} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-1">No tensions mapped yet.</p>
          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
            Points of productive contradiction will surface as your experiments reveal
            the gravitational poles shaping your decisions.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {primaryTension && (
            <section>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium mb-3">
                Primary Axis
              </h3>
              <TensionCard
                tension={primaryTension}
                onTogglePrimary={() => togglePrimary(primaryTension)}
                onDelete={() => deleteMutation.mutate(primaryTension.id)}
              />
            </section>
          )}
          {otherTensions.length > 0 && (
            <section>
              {primaryTension && (
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium mb-3">
                  Additional Axes
                </h3>
              )}
              <div className="space-y-2">
                {otherTensions.map(t => (
                  <TensionCard
                    key={t.id}
                    tension={t}
                    onTogglePrimary={() => togglePrimary(t)}
                    onDelete={() => deleteMutation.mutate(t.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TensionCard({
  tension,
  onTogglePrimary,
  onDelete,
}: {
  tension: Tension;
  onTogglePrimary: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid={`card-tension-${tension.id}`}
      className={cn(
        "bg-card border rounded-md p-6 group transition-colors",
        tension.isPrimary ? "border-primary/30" : "border-border"
      )}
    >
      {/* Axis */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-display text-lg font-medium text-foreground">
            {tension.poleA}
          </span>
          <span className="text-primary text-lg font-light">↔</span>
          <span className="font-display text-lg font-medium text-foreground">
            {tension.poleB}
          </span>
          {tension.isPrimary && (
            <Star size={12} className="text-primary fill-primary ml-1" />
          )}
        </div>
        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            data-testid={`button-toggle-primary-${tension.id}`}
            onClick={onTogglePrimary}
            title={tension.isPrimary ? "Remove primary" : "Set as primary"}
            className="text-muted-foreground/50 hover:text-primary p-2 min-h-[44px] min-w-[44px] md:p-1 md:min-h-0 md:min-w-0 flex items-center justify-center rounded transition-colors"
          >
            <Star size={13} className={tension.isPrimary ? "fill-primary text-primary" : ""} />
          </button>
          <button
            data-testid={`button-delete-tension-${tension.id}`}
            onClick={onDelete}
            className="text-muted-foreground/50 hover:text-destructive p-2 min-h-[44px] min-w-[44px] md:p-1 md:min-h-0 md:min-w-0 flex items-center justify-center rounded transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Strength bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground/60">Strength</span>
          <span className="text-xs text-muted-foreground/60">{tension.strength}/10</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(tension.strength / 10) * 100}%` }}
          />
        </div>
      </div>

      {tension.insight && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tension.insight}
        </p>
      )}

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-muted-foreground/40">
          Identified {formatDate(tension.createdAt)}
        </p>
        <a
          href="https://liminal-app.up.railway.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          Explore this tension deeper <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
