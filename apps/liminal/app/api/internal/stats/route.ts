import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

// GET /api/internal/stats — returns live counts for Lumen OS dashboard
export async function GET(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Pending inquiry seeds (not yet used/dismissed)
    const pendingRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM inquiry_seeds WHERE status = 'pending'`
    );

    // Total tool sessions (all-time)
    const sessionsRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tool_sessions`
    );

    return NextResponse.json({
      pendingSeeds: Number(pendingRow?.count ?? 0),
      totalSessions: Number(sessionsRow?.count ?? 0),
    });
  } catch (err) {
    console.error('[liminal/internal/stats]', err);
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 });
  }
}
