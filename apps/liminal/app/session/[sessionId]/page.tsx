import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Nav } from '@/components/nav';
import { SessionOutput } from '@/components/session-output';
import { DeleteSessionButton } from '@/components/delete-session-button';
import { SessionOutputErrorBoundary } from '@/components/session-output-error-boundary';
import { LocalDate } from '@/components/local-date';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';
import { SessionFeedback } from '@/components/session-feedback';
import { getSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db';
import { TOOL_LABELS, TOOL_ACCENTS, TOOL_SLUGS } from '@/lib/tools/constants';
import { canExport } from '@/lib/permissions';

interface ToolSession {
  id: string;
  tool_slug: string;
  title: string;
  input_text: string;
  structured_output: unknown;
  created_at: Date;
  feedback: string | null;
}

interface PageProps {
  params: { sessionId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const row = await queryOne<{ title: string; tool_slug: string }>(
    `SELECT title, tool_slug FROM tool_sessions WHERE id = $1`,
    [params.sessionId]
  );
  if (!row) return { title: 'Session — Liminal' };
  const toolLabel = TOOL_LABELS[row.tool_slug] ?? row.tool_slug;
  return {
    title: `${row.title} — ${toolLabel} — Liminal`,
  };
}

export default async function SessionPage({ params }: PageProps) {
  const user = await getSession();
  if (!user) notFound();

  const session = await queryOne<ToolSession>(
    `SELECT id, tool_slug, title, input_text, structured_output, created_at, feedback
     FROM tool_sessions
     WHERE id = $1 AND user_id = $2`,
    [params.sessionId, user.id]
  );

  if (!session) notFound();

  const ac = TOOL_ACCENTS[session.tool_slug] ?? '184 150 58';
  const toolLabel = TOOL_LABELS[session.tool_slug] ?? session.tool_slug;
  const toolHref = `/tool/${session.tool_slug}`;

  // Serialize created_at for client components
  const createdAtIso =
    session.created_at instanceof Date
      ? session.created_at.toISOString()
      : String(session.created_at);

  // Other instruments for "Examine with another lens" section
  const otherTools = TOOL_SLUGS.filter((s) => s !== session.tool_slug);

  return (
    <>
      <Nav user={user} />
      <main
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: 'clamp(2.5rem, 5vw, 5rem) 1.5rem',
        }}
      >
        {/* Breadcrumb */}
        <nav style={{ marginBottom: '2rem' }} aria-label="Breadcrumb">
          <Link
            href="/archive"
            style={{
              fontSize: 'clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem)',
              color: 'rgb(var(--color-text-faint))',
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}
          >
            ← Archive
          </Link>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <Link
              href={toolHref}
              style={{
                fontSize: 'clamp(0.7rem, 0.65rem + 0.15vw, 0.75rem)',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: `rgb(${ac})`,
                textDecoration: 'none',
              }}
            >
              {toolLabel}
            </Link>
            <span
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: `rgb(${ac} / 0.4)`,
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            {/* LocalDate renders in user's timezone on the client */}
            <LocalDate
              isoString={createdAtIso}
              format="long"
              style={{
                fontSize: 'clamp(0.7rem, 0.65rem + 0.15vw, 0.75rem)',
                color: 'rgb(var(--color-text-faint))',
                letterSpacing: '0.03em',
              }}
            />
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(1.375rem, 1rem + 1vw, 1.875rem)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'rgb(var(--color-text))',
              lineHeight: 1.2,
              marginBottom: '1.5rem',
            }}
          >
            {session.title}
          </h1>

          {/* Input collapsible */}
          <details
            style={{
              padding: '0.875rem 1rem',
              background: 'rgb(var(--color-surface-2))',
              borderRadius: '6px',
              border: '1px solid rgb(var(--color-border) / 0.08)',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 'clamp(0.7rem, 0.65rem + 0.15vw, 0.75rem)',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgb(var(--color-text-muted))',
                userSelect: 'none',
              }}
            >
              Show original input
            </summary>
            <p
              style={{
                marginTop: '0.75rem',
                fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 0.9375rem)',
                color: 'rgb(var(--color-text-muted))',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}
            >
              {session.input_text}
            </p>
          </details>
        </header>

        {/* Output */}
        <div className="animate-result">
          <SessionOutputErrorBoundary>
            <SessionOutput
              toolSlug={session.tool_slug}
              output={session.structured_output}
            />
          </SessionOutputErrorBoundary>
        </div>

        {/* Feedback */}
        <SessionFeedback
          sessionId={session.id}
          initialFeedback={session.feedback}
          accentHue={ac}
        />

        {/* Footer actions */}
        <footer
          style={{
            marginTop: 'clamp(2.5rem, 4vw, 3.5rem)',
            paddingTop: '2rem',
            borderTop: '1px solid rgb(var(--color-border) / 0.1)',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              href={toolHref}
              className="btn-primary"
              style={{ textDecoration: 'none', padding: '0.6rem 1.5rem' }}
            >
              Return to this inquiry
            </Link>
            {canExport(user.plan) ? (
              <CopyMarkdownButton
                toolSlug={session.tool_slug}
                toolLabel={toolLabel}
                title={session.title}
                createdAt={createdAtIso}
                output={session.structured_output}
              />
            ) : (
              <a
                href="/account"
                className="btn-ghost"
                style={{
                  textDecoration: 'none',
                  fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
                  fontStyle: 'italic',
                  color: 'rgb(var(--color-gold) / 0.7)',
                }}
              >
                Export with Cabinet
              </a>
            )}
          </div>
          <DeleteSessionButton sessionId={session.id} redirectTo="/archive" />
        </footer>

        {/* Inter-app CTAs — where this session's reflections continue */}
        <section
          style={{
            marginTop: 'clamp(2rem, 3vw, 2.5rem)',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgb(var(--color-border) / 0.06)',
          }}
          aria-label="Continue your inquiry"
        >
          <p
            style={{
              fontSize: 'clamp(0.625rem, 0.58rem + 0.12vw, 0.6875rem)',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgb(var(--color-text-faint))',
              marginBottom: '0.75rem',
            }}
          >
            Continue the thread
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <a
              href="https://parallaxapp.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 'clamp(0.8rem, 0.75rem + 0.15vw, 0.85rem)',
                color: '#4d8c9e',
                textDecoration: 'none',
                letterSpacing: '0.03em',
                transition: 'opacity 140ms ease',
              }}
            >
              See what patterns emerged →
            </a>
            <a
              href="https://axiomtool-production.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 'clamp(0.8rem, 0.75rem + 0.15vw, 0.85rem)',
                color: '#3d7bba',
                textDecoration: 'none',
                letterSpacing: '0.03em',
                transition: 'opacity 140ms ease',
              }}
            >
              Review your evolving principles →
            </a>
          </div>
        </section>

        {/* Other instruments */}
        <section
          style={{
            marginTop: 'clamp(2.5rem, 4vw, 3.5rem)',
            paddingTop: '2rem',
            borderTop: '1px solid rgb(var(--color-border) / 0.06)',
          }}
          aria-label="Examine with another instrument"
        >
          <p
            style={{
              fontSize: 'clamp(0.625rem, 0.58rem + 0.12vw, 0.6875rem)',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgb(var(--color-text-faint))',
              marginBottom: '0.875rem',
            }}
          >
            Examine with another instrument
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {otherTools.map((slug) => {
              const label = TOOL_LABELS[slug] ?? slug;
              const accent = TOOL_ACCENTS[slug] ?? '156 134 84';
              return (
                <Link
                  key={slug}
                  href={`/tool/${slug}`}
                  style={{
                    fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
                    color: `rgb(${accent})`,
                    textDecoration: 'none',
                    padding: '0.3rem 0.625rem',
                    border: `1px solid rgb(${accent} / 0.2)`,
                    borderRadius: '3px',
                    transition: 'border-color 140ms ease',
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
