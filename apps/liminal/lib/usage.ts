/**
 * Usage tracking — monthly session counter and limit checks.
 *
 * Called by tool API routes before creating a session.
 */

import { queryOne, execute } from '@/lib/db';
import type { AuthUser } from '@/lib/auth/session';
import { canCreateSession, needsMonthlyReset, sessionsRemaining, PLAN_LIMITS } from '@/lib/permissions';

interface UsageRow {
  monthly_session_count: number;
  monthly_session_reset: Date | string;
  plan: string;
}

/**
 * Check whether the user can create a new session.
 * If the monthly counter needs resetting (new calendar month), resets it.
 * Returns { allowed, remaining, limit } or throws nothing.
 */
export async function checkAndIncrementUsage(user: AuthUser): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  // Fetch current usage state
  const row = await queryOne<UsageRow>(
    `SELECT monthly_session_count, monthly_session_reset, plan FROM users WHERE id = $1`,
    [user.id]
  );

  if (!row) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  let count = row.monthly_session_count;

  // Reset counter if new month
  if (needsMonthlyReset(row.monthly_session_reset)) {
    await execute(
      `UPDATE users SET monthly_session_count = 0, monthly_session_reset = NOW() WHERE id = $1`,
      [user.id]
    );
    count = 0;
  }

  const plan = row.plan as AuthUser['plan'];
  const limit = plan === 'fellow' || plan === 'trialing' || plan === 'grandfathered'
    ? PLAN_LIMITS.fellow.monthlySessionLimit
    : PLAN_LIMITS.aspirant.monthlySessionLimit;

  if (!canCreateSession(plan, count)) {
    return { allowed: false, remaining: 0, limit };
  }

  // Increment counter
  await execute(
    `UPDATE users SET monthly_session_count = monthly_session_count + 1 WHERE id = $1`,
    [user.id]
  );

  return {
    allowed: true,
    remaining: sessionsRemaining(plan, count + 1),
    limit,
  };
}
