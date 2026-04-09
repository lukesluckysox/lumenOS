import Link from 'next/link';
import { Nav } from '@/components/nav';
import { HexProgress } from '@/components/hex-progress';
import { ToolIcon } from '@/components/tool-icon';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { InquirySeedsSection } from '@/components/inquiry-seeds-section';
import { LoopOnboarding } from '@/components/loop-onboarding';
import { getSession } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db';
import { computeStreak, getRecentDays } from '@/lib/user-progress';
import { TOOL_ACCENTS } from '@/lib/tools/constants';

// ── Tool registry ──────────────────────────────────────────────────────────────
const TOOLS = [
  {
    slug: 'small-council',
    name: 'Small Council',
    tagline: 'Deliberate among divided voices.',
    blurb:
      'Five advisors — Instinct, Critic, Realist, Shadow, Sage — debate your dilemma across two rounds. Watch the council work in real time, then read the synthesis.',
    glyph: 'I',
    accentHue: '156 134 84',
  },
  {
    slug: 'genealogist',
    name: 'The Genealogist',
    tagline: 'Trace a belief to its buried origins.',
    blurb:
      'Intellectual archaeology. Where did this conviction come from? What was its function? What does it protect, and what tensions does it carry silently?',
    glyph: 'II',
    accentHue: '110 120 98',
  },
  {
    slug: 'interlocutor',
    name: 'The Interlocutor',
    tagline: 'Submit an argument. Receive its full examination.',
    blurb:
      'Socratic examination in six parts. Assumptions exposed, objections mounted, weak spots named, better formulations offered. Not to destroy — to clarify.',
    glyph: 'III',
    accentHue: '96 116 140',
  },
  {
    slug: 'stoics-ledger',
    name: "The Stoic's Ledger",
    tagline: 'Reckon daily with conduct and avoidance.',
    blurb:
      'A daily moral inventory in the tradition of Marcus Aurelius. Duties met, duties neglected, avoidances named, excuses detected. One maxim. One act of repair.',
    glyph: 'IV',
    accentHue: '98 96 88',
  },
  {
    slug: 'fool',
    name: 'The Fool',
    tagline: 'Hear the strongest case that you are wrong.',
    blurb:
      'The one voice permitted to say what no one else will. Blind spots, second-order risks, dangerous assumptions — mounted without mercy, but never without honesty.',
    glyph: 'V',
    accentHue: '136 78 70',
  },
  {
    slug: 'interpreter',
    name: 'The Interpreter',
    tagline: 'Hold a symbol beneath multiple lights.',
    blurb:
      'Five interpretive lenses — Jungian, Narrative, Somatic, Cultural, Existential — applied simultaneously to a dream, symbol, or recurring pattern.',
    glyph: 'VI',
    accentHue: '104 94 120',
  },
] as const;

// ── Small Council preview ──────────────────────────────────────────────────────
const COUNCIL_ADVISORS = [
  {
    name: 'The Instinct',
    accent: '155 104 58',
    stance:
      'Something in you already knows the answer. The fact that you are asking this suggests the timing — not the direction — may be the real problem.',
  },
  {
    name: 'The Critic',
    accent: '86 106 136',
    stance:
      'Your runway assumptions are optimistic. Have you modeled three consecutive months of zero revenue? That is the test, not the good-case scenario.',
  },
  {
    name: 'The Realist',
    accent: '94 110 98',
    stance:
      'The first client always takes longer than expected. Savings trajectory matters more than conviction, and conviction will not cover rent in month four.',
  },
  {
    name: 'The Shadow',
    accent: '92 78 98',
    stance:
      'You may not be running toward independence. You may be running away from accountability — a distinction that will become clear about six months in.',
  },
  {
    name: 'The Sage',
    accent: '156 134 84',
    stance:
      'Every generation believes its moment is uniquely suited to independence. Some are right. The question is what, specifically, differentiates those who succeed.',
  },
] as const;

const COUNCIL_QUESTION = '"Should I leave my job and go independent?"';
const COUNCIL_SYNTHESIS =
  'The council is divided on timing, not direction. The Instinct and Sage allow for the possibility; The Critic and Realist demand that the material case be made first. The Shadow\'s reading — that avoidance may be driving the urgency — is the question none of the others can answer for you.';

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function Home() {
  const user = await getSession();

  // Progress data — only fetched when authenticated
  let usedSlugs: string[]   = [];
  let streak                = 0;
  let recentDays: boolean[] = Array(7).fill(false);
  let sessionCount          = 0;
  let lastSession: { id: string; tool_slug: string; title: string } | null = null;

  if (user) {
    const [usedRows, activityRows, lastRow] = await Promise.all([
      query<{ tool_slug: string }>(
        `SELECT DISTINCT tool_slug FROM tool_sessions WHERE user_id = $1`,
        [user.id]
      ),
      query<{ day: string }>(
        `SELECT DISTINCT DATE(created_at) AS day
         FROM tool_sessions
         WHERE user_id = $1
         ORDER BY day DESC
         LIMIT 90`,
        [user.id]
      ),
      queryOne<{ id: string; tool_slug: string; title: string }>(
        `SELECT id, tool_slug, title FROM tool_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      ),
    ]);
    usedSlugs    = usedRows.map((r) => r.tool_slug);
    const dates  = activityRows.map((r) => new Date(r.day));
    streak       = computeStreak(dates);
    recentDays   = getRecentDays(dates);
    sessionCount = activityRows.length;
    lastSession  = lastRow;
  }

  // Split tools into left and right columns (alternating by index)
  const leftTools  = TOOLS.filter((_, i) => i % 2 === 0);
  const rightTools = TOOLS.filter((_, i) => i % 2 === 1);

  return (
    <>
      <Nav user={user} />

      <main
        style={{
          maxWidth: '1060px',
          margin: '0 auto',
          padding: '0 clamp(1.25rem, 4vw, 2.5rem)',
          paddingBottom: '5rem',
        }}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <header
          style={{
            paddingTop: 'clamp(3rem, 7vw, 5.5rem)',
            paddingBottom: 'clamp(2.5rem, 5vw, 4rem)',
          }}
        >
          <p
            className="eyebrow"
            style={{ marginBottom: user ? '1.75rem' : '1.5rem' }}
          >
            Liminal — instruments for the examined life
          </p>

          {/* ── Progress widget (authenticated users only) ─ */}
          {user && (
            <div
              style={{
                paddingBottom: 'clamp(1.5rem, 3vw, 2rem)',
                marginBottom: 'clamp(1.5rem, 3vw, 2rem)',
                borderBottom: '1px solid rgb(var(--color-border) / 0.08)',
              }}
            >
              <HexProgress
                usedSlugs={usedSlugs}
                streak={streak}
                recentDays={recentDays}
              />
            </div>
          )}

          {/* Onboarding guide — new authenticated users only */}
          {user && sessionCount === 0 && (
            <OnboardingGuide />
          )}

          {/* Resume last session — returning users only */}
          {user && lastSession && (
            <div
              style={{
                marginBottom: 'clamp(1.25rem, 2.5vw, 2rem)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(0.625rem, 0.58rem + 0.12vw, 0.6875rem)',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgb(var(--color-text-faint))',
                  whiteSpace: 'nowrap',
                }}
              >
                Last inquiry
              </span>
              <Link
                href={`/session/${lastSession.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textDecoration: 'none',
                  padding: '0.375rem 0.75rem',
                  border: `1px solid rgb(${TOOL_ACCENTS[lastSession.tool_slug] ?? '156 134 84'} / 0.2)`,
                  borderRadius: '3px',
                  background: `rgb(${TOOL_ACCENTS[lastSession.tool_slug] ?? '156 134 84'} / 0.04)`,
                  minWidth: 0,
                  maxWidth: '42ch',
                }}
              >
                <ToolIcon
                  slug={lastSession.tool_slug}
                  size={12}
                  style={{
                    color: `rgb(${TOOL_ACCENTS[lastSession.tool_slug] ?? '156 134 84'} / 0.7)`,
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span
                  style={{
                    fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
                    color: 'rgb(var(--color-text-muted))',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lastSession.title}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: `rgb(${TOOL_ACCENTS[lastSession.tool_slug] ?? '156 134 84'} / 0.65)`,
                    marginLeft: 'auto',
                    paddingLeft: '0.5rem',
                    flexShrink: 0,
                  }}
                >
                  Return →
                </span>
              </Link>
            </div>
          )}

          {/* Inquiry seeds from the Lumen recursive loop — authenticated users only */}
          {user && <InquirySeedsSection />}

          {/* Loop onboarding — shown after 1st and 3rd sessions */}
          {user && <LoopOnboarding />}

          <h1
            className="text-display"
            style={{
              fontStyle: 'italic',
              maxWidth: '22ch',
              color: 'rgb(var(--color-text))',
              marginBottom: 'clamp(1.25rem, 2.5vw, 2rem)',
            }}
          >
            Most thought is shadow. Six instruments for those willing to face the
            fire.
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.9375rem, 0.875rem + 0.3vw, 1.0625rem)',
              color: 'rgb(var(--color-text-muted))',
              maxWidth: '52ch',
              lineHeight: 1.72,
            }}
          >
            Not chatbots. Not therapy. A private cabinet for the passage between
            received belief and earned clarity — for the kind of thinking that
            lives at the threshold, where the shadow and the thing diverge.
          </p>

          {/* Compact guide for returning users */}
          {user && sessionCount > 0 && (
            <OnboardingGuide compact />
          )}

          {!user && (
            <div
              style={{
                marginTop: '2rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/signup"
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Begin
              </Link>
              <Link
                href="/login"
                className="btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                Sign in
              </Link>
            </div>
          )}
        </header>

        <hr className="page-rule" style={{ margin: '0 0 clamp(2rem, 4vw, 3rem)' }} />

        {/* ── Six instruments ───────────────────────────────────────── */}
        <section aria-label="The six instruments">
          <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>
            The six instruments
          </p>

          <div className="tools-columns">
            {/* Left column: I, III, V */}
            <div className="tools-col">
              {leftTools.map((tool) => {
                const href = user
                  ? `/tool/${tool.slug}`
                  : `/login?from=/tool/${tool.slug}`;
                return (
                  <Link
                    key={tool.slug}
                    href={href}
                    className="tool-entry"
                    style={{
                      borderTopColor: `rgb(${tool.accentHue} / 0.38)`,
                      color: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        className="tool-entry-glyph"
                        style={{ color: `rgb(${tool.accentHue})` }}
                      >
                        {tool.glyph}
                      </span>
                      <ToolIcon
                        slug={tool.slug}
                        size={15}
                        style={{ color: `rgb(${tool.accentHue} / 0.4)`, flexShrink: 0 }}
                        aria-hidden
                      />
                    </span>
                    <span className="tool-entry-name">
                      {tool.name}
                    </span>
                    <span
                      className="tool-entry-tagline"
                      style={{ color: `rgb(${tool.accentHue} / 0.8)` }}
                    >
                      {tool.tagline}
                    </span>
                    <span className="tool-entry-blurb">
                      {tool.blurb}
                    </span>
                    <span
                      className="tool-entry-cta"
                      style={{ color: `rgb(${tool.accentHue})` }}
                    >
                      Examine →
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Right column: II, IV, VI */}
            <div className="tools-col">
              {rightTools.map((tool) => {
                const href = user
                  ? `/tool/${tool.slug}`
                  : `/login?from=/tool/${tool.slug}`;
                return (
                  <Link
                    key={tool.slug}
                    href={href}
                    className="tool-entry"
                    style={{
                      borderTopColor: `rgb(${tool.accentHue} / 0.38)`,
                      color: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        className="tool-entry-glyph"
                        style={{ color: `rgb(${tool.accentHue})` }}
                      >
                        {tool.glyph}
                      </span>
                      <ToolIcon
                        slug={tool.slug}
                        size={15}
                        style={{ color: `rgb(${tool.accentHue} / 0.4)`, flexShrink: 0 }}
                        aria-hidden
                      />
                    </span>
                    <span className="tool-entry-name">
                      {tool.name}
                    </span>
                    <span
                      className="tool-entry-tagline"
                      style={{ color: `rgb(${tool.accentHue} / 0.8)` }}
                    >
                      {tool.tagline}
                    </span>
                    <span className="tool-entry-blurb">
                      {tool.blurb}
                    </span>
                    <span
                      className="tool-entry-cta"
                      style={{ color: `rgb(${tool.accentHue})` }}
                    >
                      Examine →
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <hr className="page-rule" />

        {/* ── Small Council preview ─────────────────────────────────── */}
        <section
          aria-label="Sample session — Small Council"
          style={{
            paddingBottom: 'clamp(4rem, 8vw, 7rem)',
            maxWidth: '680px',
          }}
        >
          <p className="eyebrow" style={{ marginBottom: '1.75rem' }}>
            From a session — Small Council
          </p>

          {/* Question */}
          <h2
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(1.0625rem, 0.9rem + 0.55vw, 1.375rem)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'rgb(var(--color-text))',
              lineHeight: 1.3,
              marginBottom: '2rem',
            }}
          >
            {COUNCIL_QUESTION}
          </h2>

          {/* Advisor entries — ruled debate folio */}
          <div role="list">
            {COUNCIL_ADVISORS.map((advisor) => (
              <div
                key={advisor.name}
                role="listitem"
                style={{
                  paddingBottom: '1.25rem',
                  marginBottom: '1.25rem',
                  borderBottom: '1px solid rgb(var(--color-border) / 0.09)',
                }}
              >
                <p
                  style={{
                    fontSize: '0.5875rem',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: `rgb(${advisor.accent})`,
                    marginBottom: '0.5rem',
                  }}
                >
                  {advisor.name}
                </p>
                <p
                  style={{
                    fontSize: 'clamp(0.875rem, 0.82rem + 0.25vw, 0.9375rem)',
                    color: 'rgb(var(--color-text-muted))',
                    lineHeight: 1.72,
                    fontStyle: 'italic',
                  }}
                >
                  {advisor.stance}
                </p>
              </div>
            ))}
          </div>

          {/* Synthesis */}
          <div
            style={{
              paddingLeft: '1rem',
              borderLeft: '1.5px solid rgb(var(--color-gold) / 0.3)',
              marginTop: '0.25rem',
            }}
          >
            <p
              style={{
                fontSize: '0.5875rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgb(var(--color-gold) / 0.65)',
                marginBottom: '0.625rem',
              }}
            >
              Synthesis
            </p>
            <p
              style={{
                fontSize: 'clamp(0.875rem, 0.82rem + 0.25vw, 0.9375rem)',
                color: 'rgb(var(--color-text-muted))',
                lineHeight: 1.72,
              }}
            >
              {COUNCIL_SYNTHESIS}
            </p>
          </div>

          {!user && (
            <div
              style={{
                marginTop: '2.5rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/signup"
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Begin
              </Link>
              <span
                style={{
                  fontSize: 'clamp(0.8125rem, 0.76rem + 0.18vw, 0.875rem)',
                  color: 'rgb(var(--color-text-faint))',
                  fontStyle: 'italic',
                }}
              >
                Free to start.
              </span>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
