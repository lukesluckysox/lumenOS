import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { query, queryOne, execute } from '@/lib/db';
import { isOracle } from '@/lib/permissions';

/**
 * GET /api/oracle/users — Full user list for oracle dashboard.
 */
export async function GET() {
  try {
    const user = await getSession();
    if (!user || !isOracle(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await query<{
      id: string;
      email: string;
      role: string;
      plan: string;
      monthly_session_count: number;
      stripe_customer_id: string | null;
      plan_changed_at: Date | null;
      created_at: Date;
    }>(
      `SELECT u.id, u.email, u.role, u.plan,
              u.monthly_session_count, u.stripe_customer_id,
              u.plan_changed_at, u.created_at,
              COALESCE(ts.session_count, 0) AS total_sessions,
              ts.last_session_at
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS session_count, MAX(created_at) AS last_session_at
         FROM tool_sessions GROUP BY user_id
       ) ts ON ts.user_id = u.id
       ORDER BY u.created_at DESC`
    );

    return NextResponse.json({
      users: users.map((u: Record<string, unknown>) => ({
        ...u,
        created_at: u.created_at instanceof Date ? (u.created_at as Date).toISOString() : String(u.created_at),
        plan_changed_at: u.plan_changed_at ? (u.plan_changed_at instanceof Date ? (u.plan_changed_at as Date).toISOString() : String(u.plan_changed_at)) : null,
        last_session_at: u.last_session_at ? (u.last_session_at instanceof Date ? (u.last_session_at as Date).toISOString() : String(u.last_session_at)) : null,
      })),
    });
  } catch (err) {
    console.error('[oracle/users]', err);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

/**
 * PATCH /api/oracle/users — Toggle a user's plan (Aspirant <-> Fellow).
 * Body: { userId: string, plan: 'aspirant' | 'fellow' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const actor = await getSession();
    if (!actor || !isOracle(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, plan } = body;

    if (!userId || !['aspirant', 'fellow'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get current user state for audit log
    const target = await queryOne<{ email: string; plan: string }>(
      `SELECT email, plan FROM users WHERE id = $1`,
      [userId]
    );

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const oldPlan = target.plan;

    // Update plan
    await execute(
      `UPDATE users SET plan = $1, plan_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [plan, userId]
    );

    // Audit log
    await execute(
      `INSERT INTO audit_log (actor_id, target_user_id, action, details)
       VALUES ($1, $2, 'plan_change', $3)`,
      [
        actor.id,
        userId,
        JSON.stringify({ from: oldPlan, to: plan, target_email: target.email }),
      ]
    );

    return NextResponse.json({ success: true, oldPlan, newPlan: plan });
  } catch (err) {
    console.error('[oracle/users PATCH]', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
