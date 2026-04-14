import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

export async function GET(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = request.nextUrl.searchParams.get('userId');

    // Count pending inquiry seeds
    let pendingSeeds = 0;
    try {
      // Table may not exist yet — guard against that
      const seedRows = userId
        ? await query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM inquiry_seeds
             WHERE status = 'pending'
             AND user_id IN (SELECT id FROM users WHERE lumen_user_id = $1)`,
            [userId]
          )
        : await query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM inquiry_seeds WHERE status = 'pending'`
          );
      pendingSeeds = parseInt(seedRows[0]?.count || '0', 10);
    } catch {
      // inquiry_seeds table may not exist yet — that's fine
    }

    // Count recent sessions (last 7 days) as a secondary metric
    let recentSessions = 0;
    try {
      const sessionRows = userId
        ? await query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM tool_sessions
             WHERE created_at > NOW() - INTERVAL '7 days'
             AND user_id IN (SELECT id FROM users WHERE lumen_user_id = $1)`,
            [userId]
          )
        : await query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM tool_sessions
             WHERE created_at > NOW() - INTERVAL '7 days'`
          );
      recentSessions = parseInt(sessionRows[0]?.count || '0', 10);
    } catch {
      // tool_sessions table structure may differ
    }

    return NextResponse.json({
      pendingSeeds,
      recentSessions,
    });
  } catch (err: any) {
    console.error('[internal/stats]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
