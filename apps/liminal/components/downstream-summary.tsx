'use client';

export interface DownstreamItem {
  destination: string;
  description: string;
}

const DESTINATION_COLORS: Record<string, string> = {
  parallax: '#4d8c9e',
  axiom:    '#3d7bba',
  praxis:   '#c4943e',
};

const DESTINATION_LABELS: Record<string, string> = {
  parallax: 'Parallax',
  axiom:    'Axiom',
  praxis:   'Praxis',
};

const DESTINATION_URLS: Record<string, string> = {
  parallax: 'https://parallaxapp.up.railway.app',
  axiom:    'https://axiomtool-production.up.railway.app',
  praxis:   'https://praxis-app.up.railway.app',
};

// Simple loop icon (SVG)
function LoopIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8 2.5A5.5 5.5 0 1 1 2.5 8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M2.5 5V8H5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownstreamSummary({ downstream }: { downstream: DownstreamItem[] }) {
  // Only render items that were actually sent
  const items = downstream.filter(d => d.destination);
  if (items.length === 0) return null;

  return (
    <div
      style={{
        marginTop: '2.5rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid rgb(var(--color-border) / 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'rgb(var(--color-text-faint))',
          fontSize: 'clamp(0.625rem, 0.58rem + 0.12vw, 0.6875rem)',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '0.875rem',
        }}
      >
        <LoopIcon size={12} />
        Where this resonated
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          animation: 'fadeSlideUp 0.2s ease both',
        }}
      >
        {items.map((item, i) => {
          const color = DESTINATION_COLORS[item.destination] ?? '#8D99AE';
          const label = DESTINATION_LABELS[item.destination] || item.destination;
          const url = DESTINATION_URLS[item.destination];
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.625rem',
              }}
            >
              {/* Colored dot */}
              <span
                aria-hidden="true"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                  marginTop: '0.4rem',
                  display: 'inline-block',
                  opacity: 0.75,
                }}
              />
              <div style={{ lineHeight: 1.55 }}>
                <p
                  style={{
                    fontSize: 'clamp(0.8rem, 0.75rem + 0.15vw, 0.85rem)',
                    color: 'rgb(var(--color-text-faint))',
                  }}
                >
                  <span
                    style={{
                      color,
                      fontWeight: 600,
                      fontSize: 'clamp(0.6rem, 0.56rem + 0.1vw, 0.65rem)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginRight: '0.375rem',
                    }}
                  >
                    {label}
                  </span>
                  {item.description}
                </p>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 'clamp(0.7rem, 0.65rem + 0.12vw, 0.75rem)',
                      color,
                      textDecoration: 'none',
                      letterSpacing: '0.03em',
                      opacity: 0.8,
                      transition: 'opacity 140ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                  >
                    See what emerged →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
