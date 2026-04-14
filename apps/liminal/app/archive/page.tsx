import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { HexProgress } from '@/components/hex-progress';
import { ArchiveClient, EmptyArchive } from '@/components/archive-client';
import { getSession } from '@/lib/auth/session';
import { query } from '@/lib/db';
import { TOOL_LABELS, TOOL_ACCENTS } from '@/lib/tools/constants';
import { ToolIcon } from '@/components/tool-icon';
import { computeStreak, getRecentDays } from '@/lib/user-progress';
import { archiveLimits, isPaidPlan } from '@/lib/permissions';
import { UpgradePrompt } from '@/components/upgrade-prompt';

export const metadata: Metadata = {
  title: 'Archive — Liminal',
  description: 'Your past sessions across all six instruments.',
};

interface ToolSession {
  id: string;
  tool_slug: string;
  title: string;
  input_text: string | null;
  summary: string | null;
  created_at: Date;
}

// ── Most-used tool ────────────────────────────────────────────────────────────
function mostUsedTool(sessions: ToolSession[]): string | null {
  if (!sessions.length) return null;
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    counts[s.tool_slug] = (counts[s.tool_slug] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ArchivePage() {
  const user = await getSession();
  const plan = user!.plan ?? 'aspirant';
  const limits = archiveLimits(plan);
  const paid = isPaidPlan(plan);

  // Build archive query with plan-based limits
  const archiveWhereClause = limits.days !== Infinity
    ? `AND created_at > NOW() - INTERVAL '${limits.days} days'`
    : '';
  const archiveLimit = limits.maxSessions === Infinity ? 200 : limits.maxSessions;

  const [sessions, usedRows, activityRows, totalCount] = await Promise.all([
    query<ToolSession>(
      `SELECT id, tool_slug, title, input_text, summary, created_at
       FROM tool_sessions
       WHERE user_id = $1 ${archiveWhereClause}
       ORDER BY created_at DESC
       LIMIT ${archiveLimit}`,
      [user!.id]
    ),
    query<{ tool_slug: string }>(
      `SELECT DISTINCT tool_slug FROM tool_sessions WHERE user_id = $1`,
      [user!.id]
    ),
    query<{ day: string }>(
      `SELECT DISTINCT DATE(created_at) AS day
       FROM tool_sessions
       WHERE user_id = $1
       ORDER BY day DESC
       LIMIT 90`,
      [user!.id]
    ),
    // Total session count (for showing "N more sessions hidden" message)
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tool_sessions WHERE user_id = $1`,
      [user!.id]
    ),
  ]);

  const totalSessionCount = Number(totalCount[0]?.count ?? 0);
  const hiddenCount = totalSessionCount - sessions.length;

  const usedSlugs  = usedRows.map((r) => r.tool_slug);
  const dates      = activityRows.map((r) => new Date(r.day));
  const streak     = computeStreak(dates);
  const recentDays = getRecentDays(dates);
  const topTool    = mostUsedTool(sessions);
  const topLabel   = topTool ? (TOOL_LABELS[topTool] ?? topTool) : null;
  const topAccent  = topTool ? (TOOL_ACCENTS[topTool] ?? '156 134 84') : '156 134 84';

  // Serialize Date objects for the client component
  const serializedSessions = sessions.map((s) => ({
    ...s,
    created_at: s.created_at instanceof Date
      ? s.created_at.toISOString()
      : String(s.created_at),
  }));

  return (
    <>
      <Nav user={user} />
      <main
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: 'clamp(2.5rem, 5vw, 5rem) 1.5rem',
        }}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <header style={{ marginBottom: 'clamp(2rem, 4vw, 3.5rem)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'rgb(var(--color-text))',
              marginBottom: '0.25rem',
            }}
          >
            Archive
          </h1>

          {/* Stats row */}
          {sessions.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                flexWrap: 'wrap',
                marginBottom: 'clamp(1.5rem, 3vw, 2rem)',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
                  color: 'rgb(var(--color-text-muted))',
                }}
              >
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </span>

              {topLabel && (
                <>
                  <span
                    style={{
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      background: 'rgb(var(--color-border) / 0.3)',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
                      color: 'rgb(var(--color-text-muted))',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <ToolIcon
                      slug={topTool!}
                      size={11}
                      style={{ color: `rgb(${topAccent} / 0.7)`, flexShrink: 0 }}
                      aria-hidden
                    />
                    Most used:{' '}
                    <span style={{ color: `rgb(${topAccent})`, fontWeight: 500 }}>
                      {topLabel}
                    </span>
                  </span>
                </>
              )}

              {streak > 0 && (
                <>
                  <span
                    style={{
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      background: 'rgb(var(--color-border) / 0.3)',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
                      color: 'rgb(var(--color-text-muted))',
                    }}
                  >
                    {streak}-day streak
                  </span>
                </>
              )}
            </div>
          )}

          {/* Hex progress */}
          <div
            style={{
              paddingBottom: 'clamp(1.5rem, 3vw, 2rem)',
              borderBottom: '1px solid rgb(var(--color-border) / 0.08)',
            }}
          >
            <HexProgress
              usedSlugs={usedSlugs}
              streak={streak}
              recentDays={recentDays}
            />
          </div>
        </header>

        {/* ── Content ───────────────────────────────────────────── */}
        {sessions.length === 0 ? (
          <EmptyArchive />
        ) : (
          <ArchiveClient sessions={serializedSessions} canCompare={paid} />
        )}

        {/* Archive depth upgrade prompt for free users */}
        {!paid && hiddenCount > 0 && (
          <UpgradePrompt
            feature="archive"
            message={`${hiddenCount} earlier session${hiddenCount !== 1 ? 's' : ''} beyond the last ${limits.days} days. Upgrade to Fellow to return to all prior inquiries.`}
          />
        )}

        {/* Footer */}
        {sessions.length > 0 && (
          <footer style={{ marginTop: '3rem', textAlign: 'center' }}>
            <Link href="/" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Return to the cabinet
            </Link>
          </footer>
        )}
      </main>
    </>
  );
}

