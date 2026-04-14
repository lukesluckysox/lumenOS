import { cn } from "@/lib/utils";

/** A single text-line shimmer placeholder. */
export function SkeletonLine({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-muted/30 rounded h-3", className)}
      {...props}
    />
  );
}

/** A card-shaped shimmer placeholder with optional children for inner lines. */
export function SkeletonCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted/30 rounded border border-border/30 p-5",
        className,
      )}
      {...props}
    >
      {children ?? (
        <div className="space-y-3">
          <div className="bg-muted/40 rounded h-3 w-1/3" />
          <div className="bg-muted/40 rounded h-4 w-3/4" />
          <div className="bg-muted/40 rounded h-3 w-1/2" />
        </div>
      )}
    </div>
  );
}
