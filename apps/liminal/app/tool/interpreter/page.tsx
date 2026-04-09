import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { ToolPageClient } from '@/components/tool-page-client';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'The Interpreter — Liminal',
  description:
    'Multi-lens interpretation of a dream, symbol, or recurring pattern.',
};

const ACCENT = '128 108 172';

export default async function InterpreterPage() {
  const user = await getSession();

  return (
    <>
      <Nav user={user} />
      <main>
        <ToolPageClient
          config={{
            slug: 'interpreter',
            name: 'The Interpreter',
            tagline: 'Hold a symbol beneath multiple lights.',
            inputLabel: 'The dream, symbol, or recurring pattern',
            inputPlaceholder:
              'Describe the dream, symbol, or pattern.',
            inputFieldName: 'symbol',
            minLength: 20,
            submitLabel: 'Begin the interpretation',
            processingLabel: 'The Interpreter is reading the symbol…',
            accentHue: ACCENT,
            cardBorderColor: '#7a6b8a',
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
                  Five lenses, applied simultaneously
                </strong>
                The five frameworks: <strong style={{ color: 'rgb(var(--color-text))' }}>Jungian</strong> (archetypes, shadow, individuation),{' '}
                <strong style={{ color: 'rgb(var(--color-text))' }}>Narrative</strong> (story structure, your role, genre),{' '}
                <strong style={{ color: 'rgb(var(--color-text))' }}>Somatic</strong> (what the body knows, embodied sensation),{' '}
                <strong style={{ color: 'rgb(var(--color-text))' }}>Cultural/Historical</strong> (collective inheritance, resonance across traditions),{' '}
                and <strong style={{ color: 'rgb(var(--color-text))' }}>Existential</strong> (meaning, finitude, authenticity).
                Each lens also names what it cannot see. The goal is illumination through divergence — not resolution into a single answer.
              </div>
            ),
          }}
        />
      </main>
    </>
  );
}
