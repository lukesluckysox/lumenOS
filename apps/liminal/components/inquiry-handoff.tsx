'use client';

const PRAXIS_URL = process.env.NEXT_PUBLIC_PRAXIS_URL || 'https://praxis-app.up.railway.app';
const AXIOM_URL = process.env.NEXT_PUBLIC_AXIOM_URL || 'https://axiomtool-production.up.railway.app';
const PARALLAX_URL = process.env.NEXT_PUBLIC_PARALLAX_URL || 'https://parallaxapp.up.railway.app';

const HANDOFFS = [
  { label: 'Send to Praxis as tension', href: (c: string) => `${PRAXIS_URL}/tensions?claim=${encodeURIComponent(c)}`, icon: '⚖' },
  { label: 'Send to Axiom as claim', href: (c: string) => `${AXIOM_URL}/#/submit?claim=${encodeURIComponent(c)}`, icon: '◇' },
  { label: 'Explore in Parallax', href: (c: string) => `${PARALLAX_URL}/snapshot?observation=${encodeURIComponent(c)}`, icon: '◬' },
] as const;

export function InquiryHandoff({ claim }: { claim: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
      {HANDOFFS.map(h => (
        <a
          key={h.label}
          href={h.href(claim)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 'clamp(0.7rem, 0.65rem + 0.15vw, 0.75rem)',
            color: 'rgb(var(--color-text-faint))',
            border: '1px solid rgb(var(--color-border) / 0.15)',
            borderRadius: '4px',
            padding: '0.35rem 0.65rem',
            textDecoration: 'none',
            letterSpacing: '0.03em',
            transition: 'color 140ms ease, border-color 140ms ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
          onMouseEnter={e => {
            (e.currentTarget.style.color = 'rgb(var(--color-gold))');
            (e.currentTarget.style.borderColor = 'rgb(var(--color-gold) / 0.4)');
          }}
          onMouseLeave={e => {
            (e.currentTarget.style.color = 'rgb(var(--color-text-faint))');
            (e.currentTarget.style.borderColor = 'rgb(var(--color-border) / 0.15)');
          }}
        >
          <span style={{ fontSize: '0.8em' }}>{h.icon}</span>
          {h.label}
        </a>
      ))}
    </div>
  );
}
