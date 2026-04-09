interface SourceTagsProps {
  liminal: number;
  parallax: number;
  praxis: number;
  size?: "sm" | "md";
}

export default function SourceTags({ liminal, parallax, praxis, size = "sm" }: SourceTagsProps) {
  const textSize = size === "md" ? "text-xs" : "text-[10px]";

  return (
    <div className="flex items-center gap-3">
      {liminal > 0 && (
        <span className={`font-mono ${textSize} tracking-wider text-purple-500/80 dark:text-purple-400/70`}>
          L·{liminal}
        </span>
      )}
      {parallax > 0 && (
        <span className={`font-mono ${textSize} tracking-wider text-blue-500/80 dark:text-blue-400/70`}>
          P·{parallax}
        </span>
      )}
      {praxis > 0 && (
        <span className={`font-mono ${textSize} tracking-wider text-emerald-600/80 dark:text-emerald-500/70`}>
          Pr·{praxis}
        </span>
      )}
    </div>
  );
}

export function SourceLegend() {
  return (
    <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
      <span className="text-purple-500/70">L — Inquiry</span>
      <span className="text-blue-500/70">P — Patterns</span>
      <span className="text-emerald-600/70">Pr — Experiments</span>
    </div>
  );
}
