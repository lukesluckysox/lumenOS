import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { ToolPageClient } from '@/components/tool-page-client';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: "The Stoic's Ledger — Liminal",
  description:
    'A daily self-accountability practice in the tradition of Marcus Aurelius.',
};

const ACCENT = '148 140 124';

export default async function StoicsLedgerPage() {
  const user = await getSession();

  return (
    <>
      <Nav user={user} />
      <main>
        <ToolPageClient
          config={{
            slug: 'stoics-ledger',
            name: "The Stoic's Ledger",
            tagline: 'Reckon daily with conduct and avoidance.',
            inputLabel: 'Your report for today',
            inputPlaceholder: 'What did you do today? What did you avoid?',
            inputFieldName: 'report',
            minLength: 80,
            submitLabel: 'Open the ledger',
            processingLabel: 'The Ledger is reviewing your account…',
            accentHue: ACCENT,
            cardBorderColor: '#6b7280',
            preamble: (
              <div
                style={{
                  padding: '1.25rem 1.5rem',
                  background: 'rgb(var(--color-surface-2))',
                  borderRadius: '6px',
                  border: '1px solid rgb(var(--color-border) / 0.1)',
                  fontSize: 'clamp(0.8rem, 0.75rem + 0.2vw, 0.875rem)',
                  color: 'rgb(var(--color-text-muted))',
                  lineHeight: 1.65,
                }}
              >
                <strong
                  style={{
                    color: `rgb(${ACCENT})`,
                    display: 'block',
                    marginBottom: '0.375rem',
                    fontSize: 'clamp(0.7rem, 0.65rem + 0.2vw, 0.75rem)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  In the tradition of the evening review
                </strong>
                Marcus Aurelius, Epictetus, and the Stoic tradition practiced a nightly
                review of the day's conduct — not to punish, but to see clearly. The Ledger
                returns a conduct review, duties met and neglected, avoidances named, excuses
                detected, one maxim derived from today's specifics, and one concrete act of
                repair. This is not therapy. It is a reckoning.
              </div>
            ),
          }}
        />
      </main>
    </>
  );
}
