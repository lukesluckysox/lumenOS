'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Seed {
  id: string;
  source_app: string;
  source_event_type: string;
  seed_text: string;
  created_at: string;
}

const SOURCE_COLORS: Record<string, string> = {
  axiom:   '#3d7bba',
  parallax: '#4d8c9e',
  praxis:  '#c4943e',
};

const SOURCE_LABELS: Record<string, string> = {
  axiom:   'Axiom',
  parallax: 'Parallax',
  praxis:  'Praxis',
};

const SOURCE_URLS: Record<string, string> = {
  axiom:   'https://axiomtool-production.up.railway.app',
  parallax: 'https://parallaxapp.up.railway.app',
  praxis:  'https://praxis-production-da89.up.railway.app',
};

const SOURCE_CTAS: Record<string, string> = {
  axiom:   'Review your evolving principles →',
  parallax: 'See the full pattern →',
  praxis:  'See the experiment →',
};

const EVENT_PROVOCATIONS: Record<string, string> = {
  constitutional_promotion: 'A truth was established. Does it hold?',
  truth_revision:           'A belief shifted. What does that reveal?',
  tension_surfaced:         'A contradiction demands attention.',
  pattern_detected:         'Your patterns tell a different story.',
  experiment_completed:     'An experiment ended. The question deepens.',
};

export function InquirySeeds({ onSelectSeed }: { onSelectSeed?: (text: string) => void }) {
  const router = useRouter();
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/internal/inquiry-seeds')
      .then(r => r.ok ? r.json() : [])
      .then(setSeeds)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  if (loading || seeds.length === 0) return null;

  const COLLAPSE_THRESHOLD = 3;
  const visibleSeeds = (seeds.length >= COLLAPSE_THRESHOLD && !showAll)
    ? seeds.slice(0, 2)
    : seeds;
  const hiddenCount = seeds.length - 2;

  function handleClick(seed: Seed) {
    if (onSelectSeed) {
      onSelectSeed(seed.seed_text);
    } else {
      const params = new URLSearchParams({ seed: seed.seed_text });
      router.push(`/tool/small-council?${params.toString()}`);
    }
  }

  return (
    <div className="mb-8">
      <div style={{ marginBottom: '1rem' }}>
        <h3
          style={{
            fontSize: 'clamp(0.625rem, 0.58rem + 0.15vw, 0.6875rem)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgb(var(--color-text-faint))',
            marginBottom: '0.25rem',
          }}
        >
          The Loop Returns
        </h3>
        <p
          style={{
            fontSize: 'clamp(0.8rem, 0.75rem + 0.15vw, 0.85rem)',
            color: 'rgb(var(--color-text-faint))',
            fontStyle: 'italic',
            fontFamily: 'var(--font-display), Georgia, serif',
          }}
        >
          Your reflections have been evolving.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {visibleSeeds.map((seed) => {
          const accentColor = SOURCE_COLORS[seed.source_app] ?? '#8D99AE';
          const provocation = EVENT_PROVOCATIONS[seed.source_event_type]
            || seed.source_event_type;
          const sourceLabel = SOURCE_LABELS[seed.source_app] || seed.source_app;

          return (
            <button
              key={seed.id}
              onClick={() => handleClick(seed)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'rgb(var(--color-surface-2))',
                border: '1px solid rgb(var(--color-border) / 0.1)',
                borderLeft: `3px solid ${accentColor}`,
                borderRadius: '0 4px 4px 0',
                padding: '0.875rem 1.125rem',
                cursor: 'pointer',
                transition: 'background 160ms ease, border-color 160ms ease',
                position: 'relative',
              }}
              className="seed-card"
            >
              {/* Source + provocation line */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 'clamp(0.6rem, 0.56rem + 0.12vw, 0.65rem)',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: accentColor,
                    opacity: 0.85,
                  }}
                >
                  {sourceLabel}
                </span>
                <span
                  style={{
                    fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
                    color: 'rgb(var(--color-text-muted))',
                    fontStyle: 'italic',
                    fontFamily: 'var(--font-display), Georgia, serif',
                  }}
                >
                  {provocation}
                </span>
              </div>

              {/* Seed text in Cormorant */}
              <p
                style={{
                  fontSize: 'clamp(0.9375rem, 0.875rem + 0.3vw, 1.0625rem)',
                  fontFamily: 'var(--font-display), Georgia, serif',
                  color: 'rgb(var(--color-text))',
                  lineHeight: 1.5,
                  fontWeight: 400,
                }}
              >
                {seed.seed_text}
              </p>

              {/* Explore hint — shown on hover via CSS */}
              <span
                className="seed-card-explore"
                style={{
                  position: 'absolute',
                  bottom: '0.625rem',
                  right: '0.875rem',
                  fontSize: '0.75rem',
                  color: accentColor,
                  opacity: 0,
                  transition: 'opacity 160ms ease',
                  letterSpacing: '0.03em',
                }}
                aria-hidden="true"
              >
                Explore →
              </span>

              {/* Inter-app CTA */}
              {SOURCE_URLS[seed.source_app] && (
                <a
                  href={SOURCE_URLS[seed.source_app]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'block',
                    marginTop: '0.5rem',
                    fontSize: 'clamp(0.7rem, 0.65rem + 0.12vw, 0.75rem)',
                    color: accentColor,
                    textDecoration: 'none',
                    letterSpacing: '0.03em',
                    opacity: 0.7,
                    transition: 'opacity 140ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                >
                  {SOURCE_CTAS[seed.source_app] || 'View source →'}
                </a>
              )}
            </button>
          );
        })}
      </div>

      {/* Show more / less toggle */}
      {seeds.length >= COLLAPSE_THRESHOLD && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            marginTop: '0.625rem',
            background: 'transparent',
            border: 'none',
            padding: '0.25rem 0',
            cursor: 'pointer',
            fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
            color: 'rgb(var(--color-text-faint))',
            letterSpacing: '0.03em',
            transition: 'color 140ms ease',
          }}
        >
          {showAll
            ? 'Show less'
            : `Show ${hiddenCount} more ${hiddenCount === 1 ? 'provocation' : 'provocations'}`
          }
        </button>
      )}
    </div>
  );
}
