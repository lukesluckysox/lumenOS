import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

/**
 * GET /api/internal/users
 *
 * Called by Lumen Oracle to list all registered Liminal users.
 * Header: x-lumen-internal-token
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await query<{ email: string; username: string | null; plan: string | null; created_at: string }>(
      `SELECT email, username, plan, created_at FROM users ORDER BY created_at ASC`
    );

    return NextResponse.json({
      users: rows.map(u => ({
        email:     u.email,
        username:  u.username || u.email.split('@')[0],
        plan:      u.plan || 'free',
        createdAt: u.created_at,
      })),
    });
  } catch (err: any) {
    console.error('[internal/users]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
