import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

// First, ensure the table exists (add to schema)
const SEED_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inquiry_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_app TEXT NOT NULL, -- 'axiom', 'parallax', 'praxis'
  source_event_type TEXT NOT NULL, -- 'constitutional_promotion', 'truth_revision', 'tension_surfaced', 'pattern_detected', 'experiment_completed'
  source_id TEXT, -- ID from the source app
  seed_text TEXT NOT NULL, -- The actual inquiry prompt
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'used', 'dismissed'
  used_in_session_id UUID REFERENCES tool_sessions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ensure table exists
    await execute(SEED_TABLE_SQL);

    const body = await request.json();
    const { lumenUserId, sourceApp, sourceEventType, sourceId, seedText, createdAt } = body;

    if (!lumenUserId || !sourceApp || !seedText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find user by lumen_user_id
    const users = await query<{ id: string }>('SELECT id FROM users WHERE lumen_user_id = $1', [lumenUserId]);
    // Also try matching by id directly
    let userId = users[0]?.id;
    if (!userId) {
      const byId = await query<{ id: string }>('SELECT id FROM users WHERE id::text = $1', [lumenUserId]);
      userId = byId[0]?.id;
    }
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await execute(
      `INSERT INTO inquiry_seeds (user_id, source_app, source_event_type, source_id, seed_text, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, sourceApp, sourceEventType, sourceId || null, seedText, createdAt || new Date().toISOString()]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[inquiry-seeds] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — fetch pending seeds for the authenticated user
export async function GET(request: NextRequest) {
  // This is user-facing, so check session cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/liminal_session=([^;]+)/);
  if (!tokenMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await execute(SEED_TABLE_SQL);

    const sessions = await query<{ user_id: string }>(
      'SELECT user_id FROM auth_sessions WHERE token = $1 AND expires_at > NOW()',
      [tokenMatch[1]]
    );
    if (!sessions[0]) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const seeds = await query(
      `SELECT id, source_app, source_event_type, seed_text, created_at 
       FROM inquiry_seeds 
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 10`,
      [sessions[0].user_id]
    );

    return NextResponse.json(seeds);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
