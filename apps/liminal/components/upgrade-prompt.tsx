'use client';

import Link from 'next/link';

/**
 * Tasteful, literary upgrade prompt.
 *
 * Used throughout the app when free-tier users hit limits.
 * Literary tone, calm, not aggressive SaaS upsell.
 */

const FEATURE_COPY: Record<string, { heading: string; body: string }> = {
  archive: {
    heading: 'Return to prior inquiries',
    body: 'The Fellow tier keeps your full archive — every session, every instrument, as far back as you need. The examined life requires more than a week of memory.',
  },
  compare: {
    heading: 'Compare how your thinking changes',
    body: 'Place two sessions side by side and watch your reasoning evolve. What shifted? What held firm? The Fellow tier makes this visible.',
  },
  export: {
    heading: 'Save what is worth keeping',
    body: 'Export sessions as Markdown — for your journal, your notes, your own private record. Some inquiries deserve to be preserved beyond this screen.',
  },
  sessions: {
    heading: 'Keep a private cabinet of thought',
    body: 'You have used your free sessions for the month. The Fellow tier offers unlimited access to all six instruments — as many inquiries as the examined life demands.',
  },
};

interface UpgradePromptProps {
  feature: 'archive' | 'compare' | 'export' | 'sessions';
  message?: string;
}

export function UpgradePrompt({ feature, message }: UpgradePromptProps) {
  const copy = FEATURE_COPY[feature];

  return (
    <div
      style={{
        marginTop: '2rem',
        padding: '1.75rem 2rem',
        background: 'rgb(var(--color-gold-dim) / 0.35)',
        border: '1px solid rgb(var(--color-gold) / 0.12)',
        borderRadius: '4px',
        borderLeft: '2px solid rgb(var(--color-gold) / 0.3)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: 'clamp(1rem, 0.9rem + 0.4vw, 1.1875rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          color: 'rgb(var(--color-text))',
          lineHeight: 1.3,
          marginBottom: '0.75rem',
        }}
      >
        {copy.heading}
      </p>

      <p
        style={{
          fontSize: 'clamp(0.8125rem, 0.76rem + 0.2vw, 0.875rem)',
          color: 'rgb(var(--color-text-muted))',
          lineHeight: 1.65,
          marginBottom: message ? '0.75rem' : '1.25rem',
          maxWidth: '52ch',
        }}
      >
        {copy.body}
      </p>

      {message && (
        <p
          style={{
            fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
            color: 'rgb(var(--color-text-faint))',
            fontStyle: 'italic',
            marginBottom: '1.25rem',
          }}
        >
          {message}
        </p>
      )}

      <Link
        href="/account"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          background: 'rgb(var(--color-gold))',
          color: 'rgb(20 18 14)',
          fontSize: 'clamp(0.8125rem, 0.76rem + 0.15vw, 0.875rem)',
          fontWeight: 500,
          borderRadius: '3px',
          textDecoration: 'none',
          letterSpacing: '0.01em',
          transition: 'background 160ms ease',
        }}
      >
        Upgrade to Fellow
      </Link>
    </div>
  );
}

/**
 * Inline upgrade gate — wraps a feature with a soft lock for free users.
 * Shows children if allowed, shows upgrade prompt if not.
 */
export function UpgradeGate({
  allowed,
  feature,
  children,
}: {
  allowed: boolean;
  feature: 'archive' | 'compare' | 'export' | 'sessions';
  children: React.ReactNode;
}) {
  if (allowed) return <>{children}</>;
  return <UpgradePrompt feature={feature} />;
}
