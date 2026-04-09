import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { ToolPageClient } from '@/components/tool-page-client';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'The Interlocutor — Liminal',
  description: 'Test an idea or argument against rigorous Socratic examination.',
};

const ACCENT = '120 148 180';

export default async function InterlocutorPage() {
  const user = await getSession();

  return (
    <>
      <Nav user={user} />
      <main>
        <ToolPageClient
          config={{
            slug: 'interlocutor',
            name: 'The Interlocutor',
            tagline: 'Submit an argument. Receive its full examination.',
            inputLabel: 'The thesis or argument to examine',
            inputPlaceholder:
              'Present your thesis. The examination begins.',
            inputFieldName: 'thesis',
            minLength: 20,
            submitLabel: 'Begin the examination',
            processingLabel: 'The Interlocutor is examining your argument…',
            accentHue: ACCENT,
            cardBorderColor: '#5a6e8a',
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
                  What you will receive
                </strong>
                A Socratic examination in six parts: the thesis restated with
                maximum precision (so you know what is actually being tested), the assumptions
                it implicitly requires, the strongest objections a thoughtful opponent would
                mount, the specific logical or empirical weak spots, better formulations of the
                thesis, and the questions it still must answer. Not demolition — refinement.
              </div>
            ),
          }}
        />
      </main>
    </>
  );
}
