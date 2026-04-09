import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { ToolPageClient } from '@/components/tool-page-client';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'The Genealogist — Liminal',
  description:
    'Trace a belief, conviction, or habit-of-thought to its buried origins.',
};

const ACCENT = '150 160 120';

export default async function GenealogyPage() {
  const user = await getSession();

  return (
    <>
      <Nav user={user} />
      <main>
        <ToolPageClient
          config={{
            slug: 'genealogist',
            name: 'The Genealogist',
            tagline: 'Trace a belief to its buried origins.',
            inputLabel: 'The belief to examine',
            inputPlaceholder:
              'Name the belief you want to trace.',
            inputFieldName: 'belief',
            minLength: 20,
            submitLabel: 'Begin the excavation',
            processingLabel: 'The Genealogist is excavating…',
            accentHue: ACCENT,
            cardBorderColor: '#8a7a5a',
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
                The excavation returns seven findings: the belief restated with
                precision, its lineages (where it came from — people, cultures, institutions,
                experiences), what was inherited versus chosen, the hidden function the
                belief serves, its internal tensions, a map of adjacent beliefs it implies,
                and questions this analysis opens rather than closes.
              </div>
            ),
          }}
        />
      </main>
    </>
  );
}
