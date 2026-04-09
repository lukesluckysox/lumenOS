import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, BookOpen, Pencil, Trash2, Save, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Doctrine } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ErrorCard";

const schema = z.object({
  statement: z.string().min(5, "State the doctrine clearly"),
  status: z.enum(["emerging", "established", "superseded"]).default("emerging"),
  notes: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

const STATUS_STYLES = {
  emerging: "bg-muted text-muted-foreground",
  established: "bg-primary/10 text-primary",
  superseded: "bg-muted text-muted-foreground/40 line-through",
};

export default function Doctrines() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  const { data: doctrines, isLoading, isError } = useQuery<Doctrine[]>({
    queryKey: ["/api/doctrines"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { statement: "", status: "emerging", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/doctrines", {
        ...values,
        sourceExperimentIds: "[]",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctrines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      form.reset();
      setOpen(false);
      toast({ title: "Doctrine recorded." });
    },
    onError: () => toast({ title: "Failed to save.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Doctrine> }) => {
      const res = await apiRequest("PATCH", `/api/doctrines/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctrines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/doctrines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctrines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
    },
  });

  const cycleStatus = (doc: Doctrine) => {
    const cycle: Doctrine["status"][] = ["emerging", "established", "superseded"];
    const next = cycle[(cycle.indexOf(doc.status as Doctrine["status"]) + 1) % cycle.length];
    updateMutation.mutate({ id: doc.id, data: { status: next } });
  };

  const emerging = doctrines?.filter(d => d.status === "emerging") ?? [];
  const established = doctrines?.filter(d => d.status === "established") ?? [];
  const superseded = doctrines?.filter(d => d.status === "superseded") ?? [];

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-1">
            Working Doctrines
          </h2>
          <p className="text-sm text-muted-foreground">
            Provisional truths derived from lived experience rather than theory.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-new-doctrine"
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={14} /> Record Doctrine
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-medium">
                New Working Doctrine
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="statement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                        Doctrine
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="textarea-doctrine-statement"
                          placeholder="e.g. Creative energy increases when autonomy exceeds structure."
                          {...field}
                          className="bg-muted/40 border-border resize-none min-h-[90px] focus:border-primary/40"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                        Certainty
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/40 border-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="emerging">Emerging — tentative</SelectItem>
                          <SelectItem value="established">Established — tested</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/70">
                        Notes <span className="normal-case text-muted-foreground/50 tracking-normal ml-1">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="textarea-doctrine-notes"
                          placeholder="Supporting evidence, context..."
                          {...field}
                          className="bg-muted/40 border-border resize-none min-h-[60px] focus:border-primary/40"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    data-testid="button-submit-doctrine"
                    type="submit"
                    size="sm"
                    disabled={createMutation.isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Record
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isError ? (
        <ErrorCard message="Could not load doctrines." onRetry={() => window.location.reload()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-md" />)}
        </div>
      ) : doctrines?.length === 0 ? (
        <div className="border border-dashed border-border rounded-md py-16 text-center">
          <BookOpen size={24} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-1">
            No doctrines yet.
          </p>
          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
            Principles you've validated through experimentation will be collected here.
            You can also record one directly from your own understanding.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {established.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium mb-3">
                Established
              </h3>
              <div className="space-y-2">
                {established.map(doc => <DoctrineCard key={doc.id} doc={doc} onCycleStatus={cycleStatus} onDelete={() => deleteMutation.mutate(doc.id)} />)}
              </div>
            </section>
          )}
          {emerging.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium mb-3">
                Emerging
              </h3>
              <div className="space-y-2">
                {emerging.map(doc => <DoctrineCard key={doc.id} doc={doc} onCycleStatus={cycleStatus} onDelete={() => deleteMutation.mutate(doc.id)} />)}
              </div>
            </section>
          )}
          {superseded.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground/60 font-medium mb-3">
                Superseded
              </h3>
              <div className="space-y-2">
                {superseded.map(doc => <DoctrineCard key={doc.id} doc={doc} onCycleStatus={cycleStatus} onDelete={() => deleteMutation.mutate(doc.id)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DoctrineCard({
  doc,
  onCycleStatus,
  onDelete,
}: {
  doc: Doctrine;
  onCycleStatus: (doc: Doctrine) => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid={`card-doctrine-${doc.id}`}
      className="bg-card border border-border rounded-md p-5 group"
    >
      <div className="flex items-start gap-3">
        <p className={cn(
          "font-display text-base leading-relaxed flex-1",
          doc.status === "superseded" ? "text-muted-foreground/50 line-through" : "text-foreground italic"
        )}>
          "{doc.statement}"
        </p>
        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            data-testid={`button-cycle-${doc.id}`}
            onClick={() => onCycleStatus(doc)}
            title="Change status"
            className="text-muted-foreground/50 hover:text-primary p-2 min-h-[44px] min-w-[44px] md:p-1 md:min-h-0 md:min-w-0 flex items-center justify-center rounded transition-colors"
          >
            <Check size={13} />
          </button>
          <button
            data-testid={`button-delete-doctrine-${doc.id}`}
            onClick={onDelete}
            className="text-muted-foreground/50 hover:text-destructive p-2 min-h-[44px] min-w-[44px] md:p-1 md:min-h-0 md:min-w-0 flex items-center justify-center rounded transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded font-medium",
          doc.status === "established" ? "bg-primary/10 text-primary" :
          doc.status === "superseded" ? "bg-muted text-muted-foreground/50" :
          "bg-muted text-muted-foreground"
        )}>
          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
        </span>
        <span className="text-xs text-muted-foreground/50">{formatDate(doc.createdAt)}</span>
        {doc.notes && (
          <p className="text-xs text-muted-foreground/60 italic truncate">{doc.notes}</p>
        )}
      </div>
    </div>
  );
}
