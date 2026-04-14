import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { getSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db';
import { planLabel, isPaidPlan, PLAN_LIMITS, sessionsRemaining } from '@/lib/permissions';
import { AccountClient } from '@/components/account-client';

export const metadata: Metadata = {
  title: 'Account — Liminal',
};

interface UserDetails {
  monthly_session_count: number;
  monthly_session_reset: Date | string;
  stripe_customer_id: string | null;
  plan_changed_at: Date | null;
}

export default async function AccountPage() {
  const user = await getSession();
  if (!user) redirect('/login?from=/account');

  const details = await queryOne<UserDetails>(
    `SELECT monthly_session_count, monthly_session_reset, stripe_customer_id, plan_changed_at
     FROM users WHERE id = $1`,
    [user.id]
  );

  const paid = isPaidPlan(user.plan);
  const remaining = sessionsRemaining(user.plan, details?.monthly_session_count ?? 0);
  const limit = paid ? Infinity : PLAN_LIMITS.aspirant.monthlySessionLimit;

  return (
    <>
      <Nav user={user} />
      <main
        style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: 'clamp(2.5rem, 5vw, 5rem) 1.5rem',
        }}
      >
        <header style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
            Account
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(1.5rem, 1rem + 1.25vw, 2.25rem)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'rgb(var(--color-text))',
              lineHeight: 1.15,
            }}
          >
            {user.email}
          </h1>
        </header>

        <hr className="page-rule" style={{ margin: '0 0 2rem' }} />

        {/* Plan section */}
        <section style={{ marginBottom: '2.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>
            Your Plan
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontSize: 'clamp(1.25rem, 1rem + 0.75vw, 1.75rem)',
                fontWeight: 400,
                color: paid ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text))',
              }}
            >
              {planLabel(user.plan)}
            </span>
          </div>

          {!paid && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  background: 'rgb(var(--color-surface))',
                  border: '1px solid rgb(var(--color-border) / 0.1)',
                  borderRadius: '4px',
                  padding: '1rem 1.25rem',
                }}
              >
                <p style={{ fontSize: '0.5875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgb(var(--color-text-faint))', marginBottom: '0.375rem' }}>
                  Sessions This Month
                </p>
                <p style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.5rem', color: 'rgb(var(--color-text))' }}>
                  {details?.monthly_session_count ?? 0}
                  <span style={{ fontSize: '0.875rem', color: 'rgb(var(--color-text-faint))' }}> / {limit}</span>
                </p>
              </div>
              <div
                style={{
                  background: 'rgb(var(--color-surface))',
                  border: '1px solid rgb(var(--color-border) / 0.1)',
                  borderRadius: '4px',
                  padding: '1rem 1.25rem',
                }}
              >
                <p style={{ fontSize: '0.5875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgb(var(--color-text-faint))', marginBottom: '0.375rem' }}>
                  Remaining
                </p>
                <p style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.5rem', color: remaining > 0 ? 'rgb(var(--color-text))' : 'rgb(var(--color-error))' }}>
                  {remaining}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Upgrade section for free users */}
        {!paid && (
          <>
            <hr className="page-rule" style={{ margin: '0 0 2rem' }} />
            <AccountClient />
          </>
        )}

        {/* What you get with Cabinet (also shown for paid as confirmation) */}
        {paid && (
          <>
            <hr className="page-rule" style={{ margin: '0 0 2rem' }} />
            <section>
              <p className="eyebrow" style={{ marginBottom: '1rem' }}>
                Fellow Includes
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  'Unlimited sessions across all instruments',
                  'Full archive — every session, all time',
                  'Session comparison — side-by-side examination',
                  'Markdown export — save what is worth keeping',
                  'All current and future instruments',
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: 'clamp(0.8125rem, 0.76rem + 0.18vw, 0.875rem)',
                      color: 'rgb(var(--color-text-muted))',
                    }}
                  >
                    <span style={{ color: 'rgb(var(--color-gold))', fontSize: '0.75rem', flexShrink: 0 }}>
                      +
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {/* Lumen suite reference */}
        <hr className="page-rule" style={{ margin: '2rem 0' }} />
        <section>
          <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>
            Part of Lumen
          </p>
          <p
            style={{
              fontSize: 'clamp(0.8125rem, 0.76rem + 0.18vw, 0.875rem)',
              color: 'rgb(var(--color-text-muted))',
              lineHeight: 1.65,
              maxWidth: '44ch',
              marginBottom: '1rem',
            }}
          >
            What you explore here surfaces as patterns, experiments, and principles
            across the suite.
          </p>
          <a
            href="https://lumen-os.up.railway.app"
            style={{
              fontSize: 'clamp(0.8125rem, 0.76rem + 0.18vw, 0.875rem)',
              color: 'rgb(var(--color-gold) / 0.65)',
              textDecoration: 'none',
              borderBottom: '1px solid rgb(var(--color-gold) / 0.15)',
            }}
          >
            Open Lumen &rarr;
          </a>
        </section>
      </main>
    </>
  );
}
