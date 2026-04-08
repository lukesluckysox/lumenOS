import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

const EVENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS epistemic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lumen_user_id TEXT NOT NULL,
  source_app TEXT NOT NULL, -- 'liminal', 'parallax', 'praxis', 'axiom'
  source_record_id TEXT,
  event_type TEXT NOT NULL, -- 'belief_candidate', 'tension_candidate', 'hypothesis_candidate', 'pattern_candidate', 'identity_discrepancy', 'constitutional_promotion', 'truth_revision', 'tension_surfaced'
  confidence REAL,
  salience REAL,
  domain TEXT,
  tags JSONB DEFAULT '[]',
  evidence JSONB DEFAULT '[]',
  payload JSONB DEFAULT '{}',
  ingestion_mode TEXT DEFAULT 'live', -- 'live' | 'backfill'
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-lumen-internal-token');
  if (!LUMEN_INTERNAL_TOKEN || token !== LUMEN_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, entries } = await request.json();
  if (!userId || !entries?.length) {
    return NextResponse.json({ error: 'Missing userId or entries' }, { status: 400 });
  }

  // Ensure the epistemic_events table exists before inserting
  await execute(EVENTS_TABLE_SQL);

  let processed = 0;
  for (const entry of entries) {
    try {
      await execute(
        `INSERT INTO epistemic_events (lumen_user_id, source_app, source_record_id, event_type, payload, ingestion_mode, created_at)
         VALUES ($1, 'liminal', $2, 'session_backfill', $3, 'backfill', $4)
         ON CONFLICT DO NOTHING`,
        [userId, entry.id, JSON.stringify({ content: entry.content }), entry.createdAt]
      );
      processed++;
    } catch { /* skip duplicates */ }
  }

  return NextResponse.json({ processed, total: entries.length });
}
