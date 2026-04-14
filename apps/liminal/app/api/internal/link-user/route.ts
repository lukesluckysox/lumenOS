import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { queryOne, execute } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

/**
 * POST /api/internal/link-user
 *
 * Called by Lumen to link a Lumen account to a Liminal account.
 * Creates the Liminal user if one doesn't exist yet.
 *
 * Body: { email: string; username: string; lumenUserId: string | number }
 * Header: x-lumen-internal-token
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: string; username?: string; lumenUserId?: string | number; plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, username, lumenUserId, plan } = body;
  // Map Lumen canonical plan to Liminal plan on every login
  // New values: aspirant/fellow passed directly; legacy: free→aspirant, pro/founder→fellow
  const liminalPlan = (plan === 'aspirant' || plan === 'free') ? 'aspirant' : (plan === 'fellow' || plan === 'pro' || plan === 'founder') ? 'fellow' : null;

  if (!email) {
    return NextResponse.json({ error: 'Missing required field: email' }, { status: 400 });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Find existing user by email
    let user = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    // Create user if not found
    if (!user) {
      const randomHash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = await queryOne<{ id: string }>(
        `INSERT INTO users (email, password_hash, role, plan)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [normalizedEmail, randomHash, 'user', 'aspirant']
      );
    }

    if (!user) {
      throw new Error('Failed to find or create user');
    }

    // Update lumen_user_id, username, and plan (if provided from Lumen)
    if (liminalPlan) {
      await execute(
        `UPDATE users SET lumen_user_id = $1, username = $2, plan = $3 WHERE id = $4`,
        [lumenUserId != null ? String(lumenUserId) : null, username ?? null, liminalPlan, user.id]
      );
    } else {
      await execute(
        `UPDATE users SET lumen_user_id = $1, username = $2 WHERE id = $3`,
        [lumenUserId != null ? String(lumenUserId) : null, username ?? null, user.id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[internal/link-user]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
