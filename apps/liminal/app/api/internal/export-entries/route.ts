import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

/**
 * GET /api/internal/export-entries
 *
 * Returns all tool_sessions with user identity for Lumen's seeding.
 * Requires x-lumen-internal-token header.
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  interface EntryRow {
    id: string;
    user_id: string;
    lumen_user_id: string | null;
    tool_slug: string;
    title: string | null;
    input_text: string | null;
    summary: string | null;
    created_at: string;
  }

  const rows = await query<EntryRow>(
    `SELECT ts.id, ts.user_id, u.lumen_user_id, ts.tool_slug, ts.title,
            ts.input_text, ts.summary, ts.created_at
     FROM tool_sessions ts
     JOIN users u ON ts.user_id = u.id
     ORDER BY ts.created_at ASC`
  );

  return NextResponse.json(rows);
}
