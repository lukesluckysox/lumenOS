import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { classifyEntrySignal } from '@/lib/lumenEmitter';

const LUMEN_API_URL = process.env.LUMEN_API_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;
const BATCH_SIZE = 50;

/**
 * POST /api/internal/backfill-to-lumen
 *
 * Reads all Liminal entries and POSTs them in batches to Lumen's
 * epistemic backfill endpoint. Requires x-lumen-internal-token header.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!LUMEN_API_URL) {
    return NextResponse.json({ error: 'LUMEN_API_URL not configured' }, { status: 503 });
  }

  interface SessionRow {
    id: string;
    input_text: string;
    created_at: string;
    tool_slug: string;
    lumen_user_id: string;
  }

  const rows = await query<SessionRow>(
    `SELECT ts.id, ts.input_text, ts.created_at, ts.tool_slug, u.lumen_user_id
     FROM tool_sessions ts
     JOIN users u ON ts.user_id = u.id
     WHERE u.lumen_user_id IS NOT NULL
       AND ts.input_text IS NOT NULL
     ORDER BY ts.created_at ASC`
  );

  let sent = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const entries = batch.map(row => ({
      id: row.id,
      content: row.input_text,
      createdAt: row.created_at,
      toolSlug: row.tool_slug,
      lumenUserId: row.lumen_user_id,
      signals: classifyEntrySignal(row.input_text),
    }));

    // Group by lumenUserId
    const byUser = new Map<string, typeof entries>();
    for (const entry of entries) {
      if (!byUser.has(entry.lumenUserId)) byUser.set(entry.lumenUserId, []);
      byUser.get(entry.lumenUserId)!.push(entry);
    }

    for (const lumenUserId of Array.from(byUser.keys())) {
      const userEntries = byUser.get(lumenUserId)!;
      try {
        const res = await fetch(`${LUMEN_API_URL}/api/epistemic/backfill/liminal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
          },
          body: JSON.stringify({
            userId: lumenUserId,
            entries: userEntries.map(e => ({
              id: e.id,
              content: e.content.slice(0, 500),
              createdAt: e.createdAt,
            })),
          }),
        });
        if (!res.ok) errors++;
      } catch (_e: unknown) {
        errors++;
      }
    }

    sent += batch.length;
  }

  return NextResponse.json({ total: rows.length, sent, errors });
}
