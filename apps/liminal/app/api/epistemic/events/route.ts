import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

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

  try {
    await execute(EVENTS_TABLE_SQL);
    const body = await request.json();

    const {
      userId: lumenUserId,
      lumenUserId: altLumenUserId,
      sourceApp,
      sourceRecordId,
      eventType,
      confidence,
      salience,
      domain,
      tags,
      evidence,
      payload,
      ingestionMode,
      createdAt,
    } = body;

    const effectiveUserId = lumenUserId || altLumenUserId;

    if (!effectiveUserId || !sourceApp || !eventType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Try to resolve to internal user_id
    const users = await query<{ id: string }>('SELECT id FROM users WHERE lumen_user_id = $1 OR id::text = $1', [effectiveUserId]);

    await execute(
      `INSERT INTO epistemic_events 
        (user_id, lumen_user_id, source_app, source_record_id, event_type, confidence, salience, domain, tags, evidence, payload, ingestion_mode, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        users[0]?.id || null,
        effectiveUserId,
        sourceApp,
        sourceRecordId || null,
        eventType,
        confidence || null,
        salience || null,
        domain || null,
        JSON.stringify(tags || []),
        JSON.stringify(evidence || []),
        JSON.stringify(payload || {}),
        ingestionMode || 'live',
        createdAt || new Date().toISOString(),
      ]
    );

    // If this is a high-confidence event from Axiom, auto-generate inquiry seeds
    if (sourceApp === 'axiom' && payload?.liminalSeed && (confidence || 0) >= 0.5) {
      // The seed was already posted to /api/internal/inquiry-seeds by Axiom
      // But we can also generate cross-pollination seeds
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[epistemic-events] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
