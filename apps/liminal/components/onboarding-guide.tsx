'use client';

/**
 * OnboardingGuide — shown to authenticated users with 0 sessions.
 *
 * Presents six entry-difficulty choices, routes to the appropriate
 * instrument, and explains the recommendation in one sentence.
 * Skippable; disappears permanently once the user completes any session.
 */

import { useState } from 'react';
import Link from 'next/link';

// ── Tool accent colors (mirror lib/tools/constants.ts — no import to keep client bundle clean)
const TOOL_ACCENTS: Record<string, string> = {
  'small-council': '156 134 84',
  'genealogist':   '110 120 98',
  'interlocutor':   '96 116 140',
  'stoics-ledger':  '98  96  88',
  'fool':          '136  78  70',
  'interpreter':   '104  94 120',
};

// ── Six entry difficulties mapped to instruments
const CHOICES = [
  {
    id: 'torn',
    label: 'I am torn between options or a decision',
    slug: 'small-council',
    tool: 'Small Council',
    reason:
      'Five voices — Instinct, Critic, Realist, Shadow, Sage — deliberate your dilemma across two live rounds and reach a synthesis.',
  },
  {
    id: 'belief',
    label: 'A belief, pattern, or conviction keeps returning',
    slug: 'genealogist',
    tool: 'The Genealogist',
    reason:
      'Intellectual archaeology. The excavation traces where the conviction came from, what it protects, and what tensions it carries silently.',
  },
  {
    id: 'argument',
    label: 'I need to stress-test an argument or position',
    slug: 'interlocutor',
    tool: 'The Interlocutor',
    reason:
      'Socratic examination in six parts — assumptions exposed, objections mounted, weak spots named, better formulations offered.',
  },
  {
    id: 'conduct',
    label: 'I want to examine my conduct or avoidances today',
    slug: 'stoics-ledger',
    tool: "The Stoic's Ledger",
    reason:
      'A daily moral inventory in the tradition of Marcus Aurelius — duties met, duties neglected, avoidances named, one maxim, one act of repair.',
  },
  {
    id: 'wrong',
    label: 'I want the strongest case that I am wrong',
    slug: 'fool',
    tool: 'The Fool',
    reason:
      'The one voice permitted to say what no one else will — blind spots, second-order risks, dangerous assumptions, mounted without mercy.',
  },
  {
    id: 'symbol',
    label: 'A dream, symbol, or image will not leave me',
    slug: 'interpreter',
    tool: 'The Interpreter',
    reason:
      'Five interpretive lenses — Jungian, Narrative, Somatic, Cultural, Existential — applied simultaneously to whatever persists.',
  },
] as const;

type ChoiceId = typeof CHOICES[number]['id'];

interface OnboardingGuideProps {
  /** collapsed helper for returning users who want to re-discover tools */
  compact?: boolean;
}

export function OnboardingGuide({ compact = false }: OnboardingGuideProps) {
  const [phase, setPhase] = useState<'choose' | 'recommend' | 'dismissed'>(
    compact ? 'dismissed' : 'choose'
  );
  const [expanded, setExpanded] = useState(false); // compact mode
  const [selectedId, setSelectedId] = useState<ChoiceId | null>(null);

  const selected = CHOICES.find((c) => c.id === selectedId) ?? null;
  const accent = selected ? TOOL_ACCENTS[selected.slug] : null;

  // ── Compact mode (returning users): inline expandable
  if (compact) {
    return (
      <div
        style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgb(var(--color-border) / 0.08)',
        }}
      >
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.75rem 0',
              minHeight: '44px',
              cursor: 'pointer',
              fontSize: 'clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem)',
              color: 'rgb(var(--color-text-faint))',
              letterSpacing: '0.04em',
              fontFamily: 'inherit',
            }}
          >
            Not sure which instrument? Choose a difficulty →
          </button>
        ) : (
          <ChoicePanel
            onSelect={(id) => {
              setSelectedId(id);
              setPhase('recommend');
            }}
            onDismiss={() => setExpanded(false)}
            selectedId={selectedId}
          />
        )}
        {expanded && phase === 'recommend' && selected && accent && (
          <RecommendPanel
            choice={selected}
            accent={accent}
            onReset={() => { setSelectedId(null); setPhase('choose'); }}
          />
        )}
      </div>
    );
  }

  // ── Full mode (new users with 0 sessions)
  if (phase === 'dismissed') return null;

  return (
    <div
      style={{
        marginBottom: 'clamp(2rem, 4vw, 3rem)',
        paddingBottom: 'clamp(1.75rem, 3.5vw, 2.5rem)',
        borderBottom: '1px solid rgb(var(--color-border) / 0.1)',
        animation: 'fadeSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {/* Label */}
      <p
        className="eyebrow"
        style={{ marginBottom: '1rem', color: 'rgb(var(--color-gold) / 0.6)' }}
      >
        Where to begin
      </p>

      {phase === 'choose' && (
        <>
          <p
            style={{
              fontSize: 'clamp(0.8125rem, 0.76rem + 0.18vw, 0.875rem)',
              color: 'rgb(var(--color-text-muted))',
              marginBottom: '1.25rem',
              maxWidth: '44ch',
              lineHeight: 1.6,
            }}
          >
            Choose the difficulty you are facing. The right instrument will
            be recommended.
          </p>

          <ChoicePanel
            onSelect={(id) => {
              setSelectedId(id);
              setPhase('recommend');
            }}
            onDismiss={() => setPhase('dismissed')}
            selectedId={null}
          />
        </>
      )}

      {phase === 'recommend' && selected && accent && (
        <RecommendPanel
          choice={selected}
          accent={accent}
          onReset={() => { setSelectedId(null); setPhase('choose'); }}
        />
      )}
    </div>
  );
}

// ── Choice grid
function ChoicePanel({
  onSelect,
  onDismiss,
  selectedId,
}: {
  onSelect: (id: ChoiceId) => void;
  onDismiss: () => void;
  selectedId: ChoiceId | null;
}) {
  return (
    <div>
      <div
        role="list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          marginBottom: '1rem',
        }}
      >
        {CHOICES.map((c) => (
          <button
            key={c.id}
            role="listitem"
            onClick={() => onSelect(c.id)}
            style={{
              background:
                selectedId === c.id
                  ? `rgb(${TOOL_ACCENTS[c.slug]} / 0.07)`
                  : 'transparent',
              border: '1px solid',
              borderColor:
                selectedId === c.id
                  ? `rgb(${TOOL_ACCENTS[c.slug]} / 0.25)`
                  : 'rgb(var(--color-border) / 0.1)',
              borderRadius: '3px',
              padding: '0.75rem 0.875rem',
              minHeight: '44px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'clamp(0.8125rem, 0.76rem + 0.2vw, 0.875rem)',
              color: 'rgb(var(--color-text-muted))',
              textAlign: 'left',
              lineHeight: 1.45,
              transition: 'border-color 140ms ease, background 140ms ease, color 140ms ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.color = 'rgb(var(--color-text))';
              el.style.borderColor = `rgb(${TOOL_ACCENTS[c.slug]} / 0.22)`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (selectedId !== c.id) {
                el.style.color = 'rgb(var(--color-text-muted))';
                el.style.borderColor = 'rgb(var(--color-border) / 0.1)';
              }
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          padding: '0.75rem 0',
          minHeight: '44px',
          cursor: 'pointer',
          fontSize: '0.75rem',
          color: 'rgb(var(--color-text-faint))',
          fontFamily: 'inherit',
          letterSpacing: '0.03em',
        }}
      >
        Skip — browse all instruments
      </button>
    </div>
  );
}

// ── Recommendation panel
function RecommendPanel({
  choice,
  accent,
  onReset,
}: {
  choice: typeof CHOICES[number];
  accent: string;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        marginTop: '0.25rem',
        padding: '1rem 1.25rem',
        background: `rgb(${accent} / 0.05)`,
        borderLeft: `2px solid rgb(${accent} / 0.4)`,
        borderRadius: '0 3px 3px 0',
        animation: 'fadeSlideUp 0.25s ease both',
      }}
    >
      {/* Instrument label */}
      <p
        style={{
          fontSize: '0.5875rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: `rgb(${accent})`,
          marginBottom: '0.375rem',
        }}
      >
        Recommended — {choice.tool}
      </p>

      {/* Reason */}
      <p
        style={{
          fontSize: 'clamp(0.8125rem, 0.76rem + 0.2vw, 0.875rem)',
          color: 'rgb(var(--color-text-muted))',
          lineHeight: 1.6,
          fontStyle: 'italic',
          marginBottom: '1rem',
          maxWidth: '50ch',
        }}
      >
        {choice.reason}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link
          href={`/tool/${choice.slug}`}
          className="btn-primary"
          style={{ textDecoration: 'none', padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
        >
          Enter {choice.tool}
        </Link>
        <button
          onClick={onReset}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: '0.75rem',
            color: 'rgb(var(--color-text-faint))',
            fontFamily: 'inherit',
            letterSpacing: '0.03em',
          }}
        >
          ← Choose differently
        </button>
      </div>
    </div>
  );
}
