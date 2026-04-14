'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Tool metadata (inline for client bundle) ─────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  'small-council': 'Small Council',
  'genealogist':   'The Genealogist',
  'interlocutor':  'The Interlocutor',
  'stoics-ledger': "The Stoic's Ledger",
  'fool':          'The Fool',
  'interpreter':   'The Interpreter',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  activeUsers7d: number;
  totalSessions: number;
  planBreakdown: Array<{ plan: string; count: number }>;
  recentSignups: Array<{
    id: string;
    email: string;
    plan: string;
    role: string;
    created_at: string;
  }>;
  sessionsOverTime: Array<{ day: string; count: number }>;
  sessionsByTool: Array<{ tool_slug: string; count: number }>;
  topUsers: Array<{
    user_id: string;
    email: string;
    plan: string;
    sessionCount: number;
  }>;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  plan: string;
  monthly_session_count: number;
  total_sessions: string;
  last_session_at: string | null;
  plan_changed_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_email: string;
  target_email: string | null;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function OracleDashboardClient() {
  const [tab, setTab] = useState<'overview' | 'users' | 'audit'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (tab === 'overview') {
      fetch('/api/oracle')
        .then((r) => r.json())
        .then(setStats)
        .finally(() => setLoading(false));
    } else if (tab === 'users') {
      fetch('/api/oracle/users')
        .then((r) => r.json())
        .then((d) => setUsers(d.users))
        .finally(() => setLoading(false));
    } else if (tab === 'audit') {
      fetch('/api/oracle/audit')
        .then((r) => r.json())
        .then((d) => setAudit(d.entries))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const handlePlanToggle = useCallback(async (userId: string, currentPlan: string) => {
    const newPlan = currentPlan === 'fellow' ? 'aspirant' : 'fellow';
    setToggling(userId);
    try {
      const res = await fetch('/api/oracle/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: newPlan }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev?.map((u) =>
            u.id === userId ? { ...u, plan: newPlan, plan_changed_at: new Date().toISOString() } : u
          ) ?? null
        );
      }
    } finally {
      setToggling(null);
    }
  }, []);

  const tabStyle = (active: boolean) => ({
    background: active ? 'rgb(var(--color-gold) / 0.1)' : 'transparent',
    border: `1px solid ${active ? 'rgb(var(--color-gold) / 0.3)' : 'rgb(var(--color-border) / 0.12)'}`,
    borderRadius: '3px',
    padding: '0.35rem 0.875rem',
    cursor: 'pointer' as const,
    fontFamily: 'inherit',
    fontSize: '0.6875rem',
    fontWeight: active ? 600 : 400,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: active ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-faint))',
    transition: 'all 140ms ease',
  });

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <button style={tabStyle(tab === 'overview')} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>
          Users
        </button>
        <button style={tabStyle(tab === 'audit')} onClick={() => setTab('audit')}>
          Audit Log
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
          <div className="spinner" />
          <span style={{ color: 'rgb(var(--color-text-faint))', fontStyle: 'italic', fontSize: '0.875rem' }}>
            Loading...
          </span>
        </div>
      ) : (
        <>
          {tab === 'overview' && stats && <OverviewTab stats={stats} />}
          {tab === 'users' && users && (
            <UsersTab users={users} onTogglePlan={handlePlanToggle} toggling={toggling} />
          )}
          {tab === 'audit' && audit && <AuditTab entries={audit} />}
        </>
      )}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        background: 'rgb(var(--color-surface))',
        border: '1px solid rgb(var(--color-border) / 0.1)',
        borderRadius: '4px',
        padding: '1.25rem 1.5rem',
      }}
    >
      <p
        style={{
          fontSize: '0.5875rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgb(var(--color-text-faint))',
          marginBottom: '0.5rem',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: 'clamp(1.5rem, 1.2rem + 1vw, 2rem)',
          fontWeight: 400,
          color: 'rgb(var(--color-text))',
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-faint))', marginTop: '0.25rem' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function OverviewTab({ stats }: { stats: Stats }) {
  const paid = stats.planBreakdown.find((p) => p.plan === 'fellow')?.count ?? 0;
  const free = stats.planBreakdown.find((p) => p.plan === 'aspirant')?.count ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Key metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Active (7d)" value={stats.activeUsers7d} />
        <StatCard label="Total Sessions" value={stats.totalSessions} />
        <StatCard
          label="Paid / Free"
          value={`${paid} / ${free}`}
          sub={paid + free > 0 ? `${Math.round((paid / (paid + free)) * 100)}% paid` : undefined}
        />
      </div>

      {/* Sessions by tool */}
      <section>
        <p className="eyebrow" style={{ marginBottom: '0.875rem' }}>Sessions by Instrument</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {stats.sessionsByTool.map((t) => {
            const maxCount = Math.max(...stats.sessionsByTool.map((x) => x.count), 1);
            const pct = (t.count / maxCount) * 100;
            return (
              <div key={t.tool_slug} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    width: '120px',
                    fontSize: '0.75rem',
                    color: 'rgb(var(--color-text-muted))',
                    flexShrink: 0,
                    textAlign: 'right',
                  }}
                >
                  {TOOL_LABELS[t.tool_slug] ?? t.tool_slug}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '6px',
                    background: 'rgb(var(--color-surface-2))',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: 'rgb(var(--color-gold) / 0.6)',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-faint))', width: '40px' }}>
                  {t.count}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sessions over time (last 30 days) */}
      <section>
        <p className="eyebrow" style={{ marginBottom: '0.875rem' }}>Sessions / Day (Last 30 Days)</p>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '2px',
            height: '80px',
          }}
        >
          {stats.sessionsOverTime.slice().reverse().map((d) => {
            const maxD = Math.max(...stats.sessionsOverTime.map((x) => x.count), 1);
            const h = Math.max(4, (d.count / maxD) * 80);
            return (
              <div
                key={d.day}
                title={`${d.day}: ${d.count} sessions`}
                style={{
                  flex: 1,
                  height: `${h}px`,
                  background: 'rgb(var(--color-gold) / 0.45)',
                  borderRadius: '2px 2px 0 0',
                  minWidth: '3px',
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Top users */}
      <section>
        <p className="eyebrow" style={{ marginBottom: '0.875rem' }}>Top Users by Usage</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {stats.topUsers.map((u) => (
            <div
              key={u.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid rgb(var(--color-border) / 0.06)',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'rgb(var(--color-text-muted))', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email}
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: u.plan === 'fellow' ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-faint))',
                  flexShrink: 0,
                }}
              >
                {u.plan}
              </span>
              <span style={{ color: 'rgb(var(--color-text-faint))', flexShrink: 0, width: '60px', textAlign: 'right' }}>
                {u.sessionCount} sess.
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent signups */}
      <section>
        <p className="eyebrow" style={{ marginBottom: '0.875rem' }}>Recent Signups</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {stats.recentSignups.slice(0, 10).map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.375rem 0.75rem',
                borderBottom: '1px solid rgb(var(--color-border) / 0.06)',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'rgb(var(--color-text-muted))', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'rgb(var(--color-text-faint))', flexShrink: 0 }}>
                {new Date(u.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({
  users,
  onTogglePlan,
  toggling,
}: {
  users: UserRow[];
  onTogglePlan: (userId: string, currentPlan: string) => void;
  toggling: string | null;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.8125rem',
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: '1px solid rgb(var(--color-border) / 0.15)',
            }}
          >
            {['Email', 'Role', 'Plan', 'Sessions', 'Last Active', 'Joined', ''].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '0.625rem 0.5rem',
                  fontSize: '0.5875rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgb(var(--color-text-faint))',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              style={{
                borderBottom: '1px solid rgb(var(--color-border) / 0.06)',
              }}
            >
              <td
                style={{
                  padding: '0.625rem 0.5rem',
                  color: 'rgb(var(--color-text-muted))',
                  maxWidth: '200px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {u.email}
              </td>
              <td style={{ padding: '0.625rem 0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: u.role === 'oracle' ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-faint))',
                  }}
                >
                  {u.role}
                </span>
              </td>
              <td style={{ padding: '0.625rem 0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: u.plan === 'fellow' ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-faint))',
                  }}
                >
                  {u.plan}
                </span>
              </td>
              <td style={{ padding: '0.625rem 0.5rem', color: 'rgb(var(--color-text-faint))' }}>
                {u.total_sessions}
              </td>
              <td style={{ padding: '0.625rem 0.5rem', color: 'rgb(var(--color-text-faint))', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                {u.last_session_at
                  ? new Date(u.last_session_at).toLocaleDateString()
                  : '—'}
              </td>
              <td style={{ padding: '0.625rem 0.5rem', color: 'rgb(var(--color-text-faint))', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td style={{ padding: '0.625rem 0.5rem' }}>
                <button
                  onClick={() => onTogglePlan(u.id, u.plan)}
                  disabled={toggling === u.id}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgb(var(--color-border) / 0.15)',
                    borderRadius: '3px',
                    padding: '0.25rem 0.625rem',
                    cursor: toggling === u.id ? 'wait' : 'pointer',
                    fontSize: '0.625rem',
                    fontWeight: 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'rgb(var(--color-text-muted))',
                    fontFamily: 'inherit',
                    opacity: toggling === u.id ? 0.4 : 1,
                    transition: 'all 140ms ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {toggling === u.id
                    ? '...'
                    : u.plan === 'fellow'
                    ? 'Set Aspirant'
                    : 'Set Fellow'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p style={{ color: 'rgb(var(--color-text-faint))', fontStyle: 'italic', fontSize: '0.875rem' }}>
        No audit entries yet.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {entries.map((e) => (
        <div
          key={e.id}
          style={{
            padding: '0.75rem 1rem',
            background: 'rgb(var(--color-surface))',
            border: '1px solid rgb(var(--color-border) / 0.08)',
            borderRadius: '4px',
            fontSize: '0.8125rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 600, color: 'rgb(var(--color-text-muted))', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {e.action.replace(/_/g, ' ')}
            </span>
            <span style={{ color: 'rgb(var(--color-text-faint))', fontSize: '0.6875rem' }}>
              {new Date(e.created_at).toLocaleString()}
            </span>
          </div>
          <div style={{ color: 'rgb(var(--color-text-faint))', fontSize: '0.75rem' }}>
            <span>by {e.actor_email}</span>
            {e.target_email && <span> on {e.target_email}</span>}
            {e.details && typeof e.details === 'object' && 'from' in (e.details as Record<string, unknown>) && (
              <span>
                {' — '}
                {String((e.details as Record<string, string>).from)}
                {' → '}
                {String((e.details as Record<string, string>).to)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
