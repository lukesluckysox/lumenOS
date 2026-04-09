'use client';

/**
 * ArchiveClient — searchable, filterable, chronologically grouped session list.
 *
 * Receives all sessions from the server component. All search/filter/sort
 * state is client-side — no round trips for small collections (<= 100 items).
 */

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ToolIcon } from '@/components/tool-icon';
import { DeleteSessionButton } from '@/components/delete-session-button';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ArchiveSession {
  id: string;
  tool_slug: string;
  title: string;
  input_text: string | null;
  summary: string | null;
  created_at: string; // ISO string (serialized from Date in server component)
}

// ── Tool metadata (mirrors constants.ts — kept inline for client bundle)
const TOOL_ACCENTS: Record<string, string> = {
  'small-council': '156 134 84',
  'genealogist':   '110 120 98',
  'interlocutor':   '96 116 140',
  'stoics-ledger':  '98  96  88',
  'fool':          '136  78  70',
  'interpreter':   '104  94 120',
};

const TOOL_LABELS: Record<string, string> = {
  'small-council': 'Small Council',
  'genealogist':   'The Genealogist',
  'interlocutor':  'The Interlocutor',
  'stoics-ledger': "The Stoic's Ledger",
  'fool':          'The Fool',
  'interpreter':   'The Interpreter',
};

const TOOL_SLUGS = Object.keys(TOOL_ACCENTS);

// ── Time grouping ─────────────────────────────────────────────────────────────

type TimeGroup = 'Today' | 'This week' | 'This month' | 'Earlier';

function getTimeGroup(dateStr: string): TimeGroup {
  const date = new Date(dateStr);
  const now  = new Date();

  const dayMs = 86_400_000;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays   = Math.round((todayStart - sessionDay) / dayMs);

  if (diffDays === 0) return 'Today';
  if (diffDays < 7)  return 'This week';
  if (
    date.getMonth()    === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) return 'This month';
  return 'Earlier';
}

const GROUP_ORDER: TimeGroup[] = ['Today', 'This week', 'This month', 'Earlier'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string | null, len: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= len) return trimmed;
  return trimmed.slice(0, len).replace(/\s+\S*$/, '') + '…';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ArchiveClientProps {
  sessions: ArchiveSession[];
  canCompare?: boolean;
}

export function ArchiveClient({ sessions, canCompare: canCompareFeature = true }: ArchiveClientProps) {
  const router = useRouter();
  const [search,       setSearch]       = useState('');
  const [toolFilter,   setToolFilter]   = useState<string>('all');
  const [sortOrder,    setSortOrder]    = useState<'newest' | 'oldest'>('newest');
  const [compareMode,  setCompareMode]  = useState(false);
  const [compareIds,   setCompareIds]   = useState<[string, string | null]>(['', null]);

  function toggleCompareSelect(id: string) {
    setCompareIds(([a, b]) => {
      if (a === id) return ['', null];
      if (b === id) return [a, null];
      if (!a) return [id, null];
      if (!b) return [a, id];
      return [id, null]; // replace first if both already selected
    });
  }

  function launchCompare() {
    const [a, b] = compareIds;
    if (a && b) router.push(`/compare?a=${a}&b=${b}`);
  }

  // ── Derived filtered + sorted + grouped list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let results = sessions.filter((s) => {
      // Tool filter
      if (toolFilter !== 'all' && s.tool_slug !== toolFilter) return false;

      // Text search: title, input, summary
      if (q) {
        const haystack = [s.title, s.input_text, s.summary]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // Sort
    results = results.slice().sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });

    return results;
  }, [sessions, search, toolFilter, sortOrder]);

  // Group by time
  const grouped = useMemo(() => {
    const map = new Map<TimeGroup, ArchiveSession[]>();
    for (const s of filtered) {
      const g = getTimeGroup(s.created_at);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return map;
  }, [filtered]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  // ── Tool filter pills
  const toolsUsed = useMemo(
    () => new Set(sessions.map((s) => s.tool_slug)),
    [sessions]
  );

  return (
    <div>
      {/* ── Controls ─────────────────────────────────────────────── */}
      <div
        style={{
          marginBottom: 'clamp(1.5rem, 3vw, 2.5rem)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        {/* Compare toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canCompareFeature ? (
            <button
              onClick={() => { setCompareMode((v) => !v); setCompareIds(['', null]); }}
              style={{
                background: compareMode ? 'rgb(var(--color-gold) / 0.1)' : 'transparent',
                border: `1px solid ${compareMode ? 'rgb(var(--color-gold) / 0.3)' : 'rgb(var(--color-border) / 0.12)'}`,
                borderRadius: '3px',
                padding: '0.3rem 0.75rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.6875rem',
                fontWeight: compareMode ? 600 : 400,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: compareMode ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-faint))',
                transition: 'all 140ms ease',
              }}
            >
              Compare
            </button>
          ) : (
            <a
              href="/account"
              style={{
                background: 'transparent',
                border: '1px solid rgb(var(--color-border) / 0.12)',
                borderRadius: '3px',
                padding: '0.3rem 0.75rem',
                fontFamily: 'inherit',
                fontSize: '0.6875rem',
                fontWeight: 400,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'rgb(var(--color-gold) / 0.6)',
                textDecoration: 'none',
                fontStyle: 'italic',
              }}
            >
              Compare with Cabinet
            </a>
          )}

          {compareMode && canCompareFeature && (
            <>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'rgb(var(--color-text-faint))',
                  fontStyle: 'italic',
                }}
              >
                {compareIds[0] && compareIds[1]
                  ? 'Ready to compare'
                  : compareIds[0]
                  ? 'Select one more'
                  : 'Select two sessions'}
              </span>
              {compareIds[0] && compareIds[1] && (
                <button
                  onClick={launchCompare}
                  className="btn-primary"
                  style={{ padding: '0.3rem 1rem', fontSize: '0.75rem' }}
                >
                  Compare side by side →
                </button>
              )}
            </>
          )}
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="Search sessions…"
            className="liminal-input"
            style={{ paddingLeft: '2.25rem' }}
            aria-label="Search sessions"
          />
          {/* Search glyph */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgb(var(--color-text-faint))',
              fontSize: '0.875rem',
              pointerEvents: 'none',
              lineHeight: 1,
            }}
          >
            ⌕
          </span>
        </div>

        {/* Filter + sort row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Tool pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              flexWrap: 'wrap',
              flex: 1,
            }}
          >
            <FilterPill
              active={toolFilter === 'all'}
              onClick={() => setToolFilter('all')}
              accentHue={null}
            >
              All
            </FilterPill>

            {TOOL_SLUGS.filter((s) => toolsUsed.has(s)).map((slug) => (
              <FilterPill
                key={slug}
                active={toolFilter === slug}
                onClick={() => setToolFilter(slug)}
                accentHue={TOOL_ACCENTS[slug]}
              >
                <ToolIcon
                  slug={slug}
                  size={11}
                  style={{ flexShrink: 0 }}
                  aria-hidden
                />
                {TOOL_LABELS[slug]}
              </FilterPill>
            ))}
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
            style={{
              background: 'none',
              border: '1px solid rgb(var(--color-border) / 0.1)',
              borderRadius: '3px',
              padding: '0.5rem 0.625rem',
              minHeight: '44px',
              cursor: 'pointer',
              fontSize: '0.6875rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'rgb(var(--color-text-faint))',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'border-color 140ms ease, color 140ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-muted))';
              e.currentTarget.style.borderColor = 'rgb(var(--color-border) / 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-faint))';
              e.currentTarget.style.borderColor = 'rgb(var(--color-border) / 0.1)';
            }}
          >
            {sortOrder === 'newest' ? 'Newest ↓' : 'Oldest ↑'}
          </button>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptySearch query={search} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {GROUP_ORDER.filter((g) => grouped.has(g)).map((group) => (
            <section key={group} aria-label={group}>
              {/* Group header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.875rem',
                }}
              >
                <span
                  className="eyebrow"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {group}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'rgb(var(--color-border) / 0.1)',
                  }}
                  aria-hidden
                />
              </div>

              {/* Session cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {grouped.get(group)!.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    compareMode={compareMode}
                    compareSelected={compareIds[0] === session.id || compareIds[1] === session.id}
                    onCompareToggle={() => toggleCompareSelect(session.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  accentHue,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accentHue: string | null;
  children: React.ReactNode;
}) {
  const accent = accentHue ?? 'var(--color-gold)';
  const accentRgb = accentHue ? `rgb(${accentHue})` : 'rgb(var(--color-gold))';
  const accentBg  = accentHue ? `rgb(${accentHue} / 0.08)` : 'rgb(var(--color-gold) / 0.08)';
  const accentBorder = accentHue ? `rgb(${accentHue} / 0.25)` : 'rgb(var(--color-gold) / 0.25)';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: active ? accentBg : 'transparent',
        border: '1px solid',
        borderColor: active ? accentBorder : 'rgb(var(--color-border) / 0.12)',
        borderRadius: '3px',
        padding: '0.5rem 0.625rem',
        minHeight: '44px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.6875rem',
        fontWeight: active ? 600 : 400,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: active ? accentRgb : 'rgb(var(--color-text-faint))',
        transition: 'all 140ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  compareMode = false,
  compareSelected = false,
  onCompareToggle,
}: {
  session: ArchiveSession;
  compareMode?: boolean;
  compareSelected?: boolean;
  onCompareToggle?: () => void;
}) {
  const ac    = TOOL_ACCENTS[session.tool_slug] ?? '184 150 58';
  const label = TOOL_LABELS[session.tool_slug]  ?? session.tool_slug;

  const preview = truncate(session.input_text, 130);

  return (
    <div
      style={{
        position: 'relative',
        outline: compareSelected ? `1.5px solid rgb(${ac} / 0.45)` : 'none',
        outlineOffset: '1px',
        borderRadius: '0 4px 4px 0',
      }}
    >
      {compareMode && (
        <button
          onClick={onCompareToggle}
          aria-pressed={compareSelected}
          style={{
            position: 'absolute',
            left: '-2.25rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '2.75rem',
            height: '2.75rem',
            border: `1px solid ${compareSelected ? `rgb(${ac} / 0.5)` : 'rgb(var(--color-border) / 0.2)'}`,
            borderRadius: '3px',
            background: compareSelected ? `rgb(${ac} / 0.15)` : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.5625rem',
            color: `rgb(${ac})`,
            flexShrink: 0,
            transition: 'all 140ms ease',
          }}
        >
          {compareSelected ? '✓' : ''}
        </button>
      )}
      <Link
        href={compareMode ? '#' : `/session/${session.id}`}
        onClick={compareMode ? (e) => { e.preventDefault(); onCompareToggle?.(); } : undefined}
        className="liminal-card"
        style={{
          display: 'block',
          padding: '1rem 1.25rem',
          textDecoration: 'none',
          // accent border on the left
          borderLeft: `2px solid rgb(${ac} / ${compareSelected ? '0.5' : '0.25'})`,
          borderRadius: '0 4px 4px 0',
          cursor: compareMode ? 'pointer' : undefined,
        }}
      >
        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '0.4rem',
          }}
        >
          <ToolIcon
            slug={session.tool_slug}
            size={11}
            style={{ color: `rgb(${ac} / 0.65)`, flexShrink: 0 }}
            aria-hidden
          />
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: `rgb(${ac})`,
            }}
          >
            {label}
          </span>
          <span
            style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: `rgb(${ac} / 0.25)`,
              flexShrink: 0,
            }}
            aria-hidden
          />
          <span
            style={{
              fontSize: '0.625rem',
              color: 'rgb(var(--color-text-faint))',
              letterSpacing: '0.03em',
            }}
          >
            {formatDate(session.created_at)}
            {' · '}
            {formatTime(session.created_at)}
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: 'clamp(0.875rem, 0.82rem + 0.25vw, 0.9375rem)',
            fontWeight: 500,
            color: 'rgb(var(--color-text))',
            lineHeight: 1.4,
            marginBottom: preview ? '0.3rem' : 0,
            paddingRight: '3rem', // space for delete button
          }}
        >
          {session.title}
        </h2>

        {/* Input preview */}
        {preview && (
          <p
            style={{
              fontSize: 'clamp(0.75rem, 0.7rem + 0.18vw, 0.8125rem)',
              color: 'rgb(var(--color-text-faint))',
              lineHeight: 1.55,
              fontStyle: 'italic',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {preview}
          </p>
        )}
      </Link>

      {/* Delete — positioned outside link */}
      <div
        style={{
          position: 'absolute',
          top: '0.875rem',
          right: '1rem',
        }}
      >
        <DeleteSessionButton sessionId={session.id} redirectTo="/archive" />
      </div>
    </div>
  );
}

// ── Empty search state ────────────────────────────────────────────────────────

function EmptySearch({ query }: { query: string }) {
  return (
    <div
      style={{
        padding: 'clamp(2rem, 4vw, 3.5rem) 0',
        color: 'rgb(var(--color-text-muted))',
      }}
    >
      {query ? (
        <>
          <p style={{ fontSize: 'clamp(0.875rem, 0.82rem + 0.2vw, 0.9375rem)', marginBottom: '0.25rem' }}>
            No sessions match <em>"{query}"</em>.
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'rgb(var(--color-text-faint))' }}>
            Try a shorter phrase, or clear the filter.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 'clamp(0.875rem, 0.82rem + 0.2vw, 0.9375rem)' }}>
          No sessions for that instrument yet.
        </p>
      )}
    </div>
  );
}

// ── Empty archive state (client — has hover handlers) ─────────────────────────

const EMPTY_TOOL_SLUGS = Object.keys(TOOL_ACCENTS) as Array<keyof typeof TOOL_ACCENTS>;

export function EmptyArchive() {
  return (
    <div>
      <p
        style={{
          fontSize: 'clamp(0.875rem, 0.82rem + 0.25vw, 1rem)',
          color: 'rgb(var(--color-text-muted))',
          lineHeight: 1.65,
          marginBottom: '2.5rem',
          maxWidth: '46ch',
          fontStyle: 'italic',
        }}
      >
        Nothing recorded yet. The archive collects sessions across all six
        instruments — each inquiry saved for future reading.
      </p>

      <p className="eyebrow" style={{ marginBottom: '1.25rem' }}>
        Begin with an instrument
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          maxWidth: '520px',
        }}
      >
        {EMPTY_TOOL_SLUGS.map((slug) => {
          const ac    = TOOL_ACCENTS[slug];
          const label = TOOL_LABELS[slug] ?? slug;
          return (
            <a
              key={slug}
              href={`/tool/${slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 0.875rem',
                background: 'transparent',
                border: '1px solid rgb(var(--color-border) / 0.1)',
                borderRadius: '3px',
                textDecoration: 'none',
                color: 'rgb(var(--color-text-muted))',
                fontSize: 'clamp(0.8125rem, 0.76rem + 0.18vw, 0.875rem)',
                transition: 'border-color 140ms ease, color 140ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `rgb(${ac} / 0.25)`;
                e.currentTarget.style.color = 'rgb(var(--color-text))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgb(var(--color-border) / 0.1)';
                e.currentTarget.style.color = 'rgb(var(--color-text-muted))';
              }}
            >
              <ToolIcon
                slug={slug}
                size={13}
                style={{ color: `rgb(${ac} / 0.6)`, flexShrink: 0 }}
                aria-hidden
              />
              <span style={{ color: `rgb(${ac})`, fontWeight: 500 }}>
                {label}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.7rem',
                  color: 'rgb(var(--color-text-faint))',
                  letterSpacing: '0.03em',
                }}
              >
                Enter →
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
