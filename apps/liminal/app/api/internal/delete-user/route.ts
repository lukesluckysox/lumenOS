import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

/**
 * POST /api/internal/delete-user
 *
 * Called by Lumen Oracle when an admin deletes a user.
 * Cascading delete is handled by FK ON DELETE CASCADE on auth_sessions + tool_sessions.
 *
 * Header: x-lumen-internal-token
 * Body: { email, username }
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, username } = await request.json();
    if (!email && !username) {
      return NextResponse.json({ error: 'email or username required' }, { status: 400 });
    }

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

    // Delete user — FK CASCADE handles auth_sessions, tool_sessions, council_turns
    await execute(`DELETE FROM users WHERE id = $1`, [user.id]);

    console.log(`[delete-user] Deleted Liminal user ${user.id}`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[delete-user]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
