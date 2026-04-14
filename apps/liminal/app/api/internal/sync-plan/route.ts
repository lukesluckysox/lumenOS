import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

/**
 * POST /api/internal/sync-plan
 *
 * Called by Lumen Oracle when an admin changes a user's plan.
 * Maps Lumen canonical plan → Liminal local plan:
 *   free              → open
 *   pro / founder     → cabinet
 *
 * Header: x-lumen-internal-token
 * Body: { email, username, plan }
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, username, plan } = await request.json();
    if (!plan || !['free', 'pro', 'founder', 'aspirant', 'fellow'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!email && !username) {
      return NextResponse.json({ error: 'email or username required' }, { status: 400 });
    }

    // Map Lumen plan → Liminal plan
    // New values: aspirant/fellow passed directly
    // Legacy: free→aspirant, pro/founder→fellow
    const liminalPlan = plan === 'aspirant' ? 'aspirant' : (plan === 'free' ? 'aspirant' : 'fellow');

    // Find user by email (primary) or username (fallback)
    let user: { id: string } | null = null;
    if (email) {
      user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    }
    if (!user && username) {
      user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [username.toLowerCase().trim()]);
    }

    if (!user) {
      return NextResponse.json({ ok: false, reason: 'User not found in Liminal' }, { status: 404 });
    }

    await execute(
      `UPDATE users SET plan = $1, plan_changed_at = NOW() WHERE id = $2`,
      [liminalPlan, user.id]
    );

    console.log(`[sync-plan] Updated Liminal user ${user.id} to plan=${liminalPlan} (from Lumen plan=${plan})`);
    return NextResponse.json({ ok: true, liminalPlan });
  } catch (err: any) {
    console.error('[sync-plan]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
