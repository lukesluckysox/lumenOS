'use client';

/**
 * Account upgrade section — displayed for free-tier users on /account.
 * Literary, calm upgrade copy. No aggressive SaaS upsell.
 */

import Link from 'next/link';

const TIERS = [
  {
    name: 'Open',
    price: 'Free',
    current: true,
    features: [
      '8 sessions per month',
      'Last 7 days of archive',
      'All six instruments',
    ],
    excluded: [
      'Session comparison',
      'Markdown export',
      'Full archive history',
    ],
  },
  {
    name: 'Cabinet',
    price: 'Coming soon',
    current: false,
    features: [
      'Unlimited sessions',
      'Full archive — all time',
      'Session comparison',
      'Markdown export',
      'All current and future instruments',
    ],
    excluded: [],
  },
];

export function AccountClient() {
  return (
    <section>
      <p className="eyebrow" style={{ marginBottom: '1rem' }}>
        Upgrade
      </p>

      {/* Literary pitch */}
      <div
        style={{
          marginBottom: '2rem',
          maxWidth: '48ch',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: 'clamp(1.0625rem, 0.95rem + 0.4vw, 1.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'rgb(var(--color-text))',
            lineHeight: 1.3,
            marginBottom: '0.75rem',
          }}
        >
          The examined life deserves a private cabinet.
        </p>
        <p
          style={{
            fontSize: 'clamp(0.8125rem, 0.76rem + 0.2vw, 0.875rem)',
            color: 'rgb(var(--color-text-muted))',
            lineHeight: 1.65,
          }}
        >
          Return to prior inquiries. Compare how your thinking changes over time.
          Save what is worth keeping. The Cabinet is for those who treat reflection
          as a practice, not an event.
        </p>
      </div>

      {/* Comparison */}
      <div
        className="tier-compare-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            style={{
              padding: '1.5rem 1.25rem',
              background: tier.current ? 'rgb(var(--color-surface))' : 'rgb(var(--color-gold-dim) / 0.35)',
              border: `1px solid ${tier.current ? 'rgb(var(--color-border) / 0.1)' : 'rgb(var(--color-gold) / 0.15)'}`,
              borderRadius: '4px',
            }}
          >
            <div style={{ marginBottom: '1rem' }}>
              <p
                style={{
                  fontFamily: 'var(--font-display), Georgia, serif',
                  fontSize: '1.25rem',
                  fontWeight: 400,
                  color: tier.current ? 'rgb(var(--color-text))' : 'rgb(var(--color-gold))',
                  marginBottom: '0.25rem',
                }}
              >
                {tier.name}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-faint))' }}>
                {tier.price}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {tier.features.map((f) => (
                <div
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    color: 'rgb(var(--color-text-muted))',
                  }}
                >
                  <span style={{ color: 'rgb(var(--color-gold) / 0.7)', fontSize: '0.6875rem', flexShrink: 0 }}>+</span>
                  {f}
                </div>
              ))}
              {tier.excluded.map((f) => (
                <div
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    color: 'rgb(var(--color-text-faint) / 0.6)',
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', flexShrink: 0 }}>—</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          padding: '1.5rem 1.75rem',
          background: 'rgb(var(--color-gold-dim) / 0.4)',
          border: '1px solid rgb(var(--color-gold) / 0.15)',
          borderRadius: '4px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: 'clamp(0.9375rem, 0.875rem + 0.3vw, 1.0625rem)',
            fontStyle: 'italic',
            color: 'rgb(var(--color-text))',
            marginBottom: '0.75rem',
          }}
        >
          Billing is coming soon.
        </p>
        <p
          style={{
            fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
            color: 'rgb(var(--color-text-faint))',
            lineHeight: 1.6,
            maxWidth: '40ch',
            margin: '0 auto',
          }}
        >
          When Cabinet is ready, you will be able to subscribe here.
          Until then, early access may be granted on request.
        </p>
      </div>
    </section>
  );
}
