import { cn } from "@/lib/utils";

/** Reusable shimmer skeleton primitives */

function SkeletonLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-muted/30 rounded h-4", className)}
      {...props}
    />
  );
}

function SkeletonCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted/30 rounded border border-border p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Composed skeletons for specific pages ──────────────────────────────────

/** Dashboard stat card skeleton */
function StatSkeleton() {
  return (
    <div className="bg-card border border-border rounded-md p-5">
      <SkeletonLine className="h-7 w-12 mb-3" />
      <SkeletonLine className="h-4 w-24 mb-1.5" />
      <SkeletonLine className="h-3 w-20" />
    </div>
  );
}

/** Experiment card skeleton (Dashboard & Experiments list) */
function ExperimentCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-3 mb-3">
        <SkeletonLine className="h-3 w-3 rounded-full" />
        <SkeletonLine className="h-3 w-16" />
        <SkeletonLine className="h-5 w-14 rounded ml-auto" />
      </div>
      <SkeletonLine className="h-4 w-3/4 mb-2" />
      <SkeletonLine className="h-3 w-full mb-3" />
      <SkeletonLine className="h-1.5 w-full rounded-full" />
    </SkeletonCard>
  );
}

/** Doctrine card skeleton */
function DoctrineCardSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-4 w-full mb-2" />
      <SkeletonLine className="h-4 w-2/3 mb-3" />
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-5 w-16 rounded" />
        <SkeletonLine className="h-3 w-20" />
      </div>
    </SkeletonCard>
  );
}

/** Tension card skeleton */
function TensionCardSkeleton() {
  return (
    <SkeletonCard className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonLine className="h-5 w-24" />
        <SkeletonLine className="h-5 w-4" />
        <SkeletonLine className="h-5 w-24" />
      </div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="h-3 w-8" />
        </div>
        <SkeletonLine className="h-1 w-full rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-full mb-1" />
      <SkeletonLine className="h-3 w-4/5" />
    </SkeletonCard>
  );
}

/** Filter pill row skeleton */
function FilterPillsSkeleton() {
  return (
    <div className="flex items-center gap-1 mb-6 animate-pulse">
      {[16, 14, 18, 20, 16].map((w, i) => (
        <div key={i} className={`bg-muted/30 rounded h-7`} style={{ width: `${w * 4}px` }} />
      ))}
    </div>
  );
}

/** Experiment detail title bar skeleton */
function ExperimentDetailTitleSkeleton() {
  return (
    <div className="animate-pulse mb-8">
      <div className="flex items-center gap-3 mb-3">
        <SkeletonLine className="h-5 w-16" />
        <SkeletonLine className="h-5 w-14 rounded ml-auto" />
      </div>
      <SkeletonLine className="h-6 w-3/4 mb-2" />
      <SkeletonLine className="h-3 w-48 mb-4" />
      <SkeletonLine className="h-1.5 w-full rounded-full" />
    </div>
  );
}

/** Phase section card skeleton (for ExperimentDetail) */
function PhaseSectionSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-3 w-28 mb-1" />
      <SkeletonLine className="h-3 w-48 mb-4" />
      <SkeletonLine className="h-4 w-full mb-2" />
      <SkeletonLine className="h-4 w-full mb-2" />
      <SkeletonLine className="h-4 w-3/5" />
    </SkeletonCard>
  );
}

/** Primary tension skeleton for Dashboard */
function PrimaryTensionSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-3 mb-2">
        <SkeletonLine className="h-5 w-28" />
        <SkeletonLine className="h-5 w-4" />
        <SkeletonLine className="h-5 w-28" />
      </div>
      <SkeletonLine className="h-3 w-full" />
    </SkeletonCard>
  );
}

/** Dashboard doctrine card skeleton (compact) */
function DoctrineDashboardSkeleton() {
  return (
    <SkeletonCard className="p-4">
      <SkeletonLine className="h-4 w-full mb-2" />
      <SkeletonLine className="h-5 w-16 rounded" />
    </SkeletonCard>
  );
}

export {
  SkeletonLine,
  SkeletonCard,
  StatSkeleton,
  ExperimentCardSkeleton,
  DoctrineCardSkeleton,
  TensionCardSkeleton,
  FilterPillsSkeleton,
  ExperimentDetailTitleSkeleton,
  PhaseSectionSkeleton,
  PrimaryTensionSkeleton,
  DoctrineDashboardSkeleton,
};
