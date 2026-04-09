/**
 * Liminal SVG logo mark — a threshold arch with a vertical line,
 * evoking passage, liminality, and a doorway between states.
 * Works at 24px and 200px. Uses currentColor.
 */
export function LiminalLogo({
  size = 32,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-label="Liminal"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Arch / threshold */}
      <path
        d="M6 28 L6 14 Q6 6 16 6 Q26 6 26 14 L26 28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Threshold line */}
      <line
        x1="16"
        y1="6"
        x2="16"
        y2="28"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="1.5 2.5"
        opacity="0.5"
      />
      {/* Ground line */}
      <line
        x1="4"
        y1="28"
        x2="28"
        y2="28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wordmark variant: logo + "LIMINAL" text */
export function LiminalWordmark({
  className = '',
}: {
  className?: string;
}) {
  return (
    <span
      className={`flex items-center gap-2.5 ${className}`}
      aria-label="Liminal"
    >
      <LiminalLogo size={24} />
      <span
        style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.125rem',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Liminal
      </span>
    </span>
  );
}

