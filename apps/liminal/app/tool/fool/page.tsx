import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { ToolPageClient } from '@/components/tool-page-client';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'The Fool — Liminal',
  description:
    'Hear the strongest possible case that you are wrong.',
};

const ACCENT = '180 100 100';

export default async function FoolPage() {
  const user = await getSession();

  return (
    <>
      <Nav user={user} />
      <main>
        <ToolPageClient
          config={{
            slug: 'fool',
            name: 'The Fool',
            tagline: 'Hear the strongest case that you are wrong.',
            inputLabel: 'The position to challenge',
            inputPlaceholder:
              'State your position. I\'ll find its weakest point.',
            inputFieldName: 'position',
            minLength: 20,
            submitLabel: 'Hear the Fool',
            processingLabel: 'The Fool is preparing the challenge…',
            accentHue: ACCENT,
            submitClassName: 'btn-fool-submit',
            cardBorderColor: '#a0524d',
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
                  The licensed truth-teller
                </strong>
                In medieval courts, the Fool was the one voice permitted to say
                what no one else would. The Fool returns seven findings: your core claim
                stated without distortion, the strongest case that it is wrong, your blind
                spots, the concrete risks you carry, reputational danger, second-order
                effects, and a rival interpretation of the same situation — one you have
                not considered. Not cruelty. Not contrarianism. The truth that comfort withholds.
              </div>
            ),
          }}
        />
      </main>
    </>
  );
}
