/**
 * scripts/backfillToLumen.ts
 *
 * Reads all existing Liminal tool_sessions and POSTs batches to
 * Lumen's epistemic backfill endpoint.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfillToLumen.ts
 *
 * Required env vars: DATABASE_URL, LUMEN_API_URL, LUMEN_INTERNAL_TOKEN
 */

import { Pool } from 'pg';

// ── Config ──────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const LUMEN_API_URL = process.env.LUMEN_API_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;
const BATCH_SIZE = 50;

if (!DATABASE_URL || !LUMEN_API_URL || !LUMEN_INTERNAL_TOKEN) {
  console.error('Missing required env vars: DATABASE_URL, LUMEN_API_URL, LUMEN_INTERNAL_TOKEN');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Signal classifier (duplicated to avoid path-alias issues) ───────────────
function classifyEntrySignal(text: string): Array<{ eventType: string; confidence: number; salience: number; evidence: string[] }> {
  const results: Array<{ eventType: string; confidence: number; salience: number; evidence: string[] }> = [];
  const lower = text.toLowerCase();

  const beliefMarkers = ["i believe", "i value", "i am", "my identity", "i know", "i always", "i never", "fundamentally", "at my core", "i stand for", "i hold that", "my truth", "i'm certain"];
  const beliefMatches = beliefMarkers.filter(m => lower.includes(m));
  if (beliefMatches.length > 0) {
    const conf = Math.min(0.4 + beliefMatches.length * 0.15 + (text.length > 100 ? 0.1 : 0), 1.0);
    results.push({ eventType: "belief_candidate", confidence: conf, salience: conf * 0.8, evidence: beliefMatches.map(m => `marker: "${m}"`) });
  }

  const tensionMarkers = ["but", "however", "on the other hand", "i used to", "i thought", "i'm torn", "conflict", "contradiction", "yet i", "and yet", "at the same time", "part of me", "i can't reconcile"];
  const tensionMatches = tensionMarkers.filter(m => lower.includes(m));
  if (tensionMatches.length >= 2) {
    const conf = Math.min(0.3 + tensionMatches.length * 0.1 + (text.length > 150 ? 0.1 : 0), 1.0);
    results.push({ eventType: "tension_candidate", confidence: conf, salience: conf * 0.9, evidence: tensionMatches.map(m => `marker: "${m}"`) });
  }

  const hypothesisMarkers = ["if i", "if i could", "i predict", "i expect", "i assume that", "because", "therefore i", "i hypothesize", "i suspect that", "my theory", "i think this causes", "which means that"];
  const hypothesisMatches = hypothesisMarkers.filter(m => lower.includes(m));
  if (hypothesisMatches.length > 0) {
    const hasCausal = lower.includes("because") || lower.includes("therefore") || lower.includes("causes") || lower.includes("leads to");
    const conf = Math.min(0.35 + hypothesisMatches.length * 0.1 + (hasCausal ? 0.2 : 0), 1.0);
    results.push({ eventType: "hypothesis_candidate", confidence: conf, salience: conf * 0.85, evidence: hypothesisMatches.map(m => `marker: "${m}"`) });
  }

  return results.filter(r => r.confidence >= 0.4);
}

// ── Main ────────────────────────────────────────────────────────────────────
interface SessionRow {
  id: string;
  input_text: string;
  created_at: string;
  tool_slug: string;
  lumen_user_id: string | null;
}

async function main() {
  console.log('[backfill] Starting Liminal → Lumen epistemic backfill...');

  const { rows } = await pool.query<SessionRow>(
    `SELECT ts.id, ts.input_text, ts.created_at, ts.tool_slug, u.lumen_user_id
     FROM tool_sessions ts
     JOIN users u ON ts.user_id = u.id
     WHERE u.lumen_user_id IS NOT NULL
       AND ts.input_text IS NOT NULL
     ORDER BY ts.created_at ASC`
  );

  console.log(`[backfill] Found ${rows.length} entries with linked Lumen users`);

  let sent = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // Build per-entry classified events for the batch payload
    const entries = batch.map(row => ({
      id: row.id,
      content: row.input_text,
      createdAt: row.created_at,
      toolSlug: row.tool_slug,
      signals: classifyEntrySignal(row.input_text),
    }));

    // Group by lumenUserId (batches may span users)
    const byUser = new Map<string, typeof entries>();
    for (let j = 0; j < batch.length; j++) {
      const uid = batch[j].lumen_user_id!;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(entries[j]);
    }

    for (const lumenUserId of Array.from(byUser.keys())) {
      const userEntries = byUser.get(lumenUserId)!;
      try {
        const res = await fetch(`${LUMEN_API_URL}/api/epistemic/backfill/liminal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN!,
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
        if (!res.ok) {
          console.error(`[backfill] Lumen returned ${res.status} for user ${lumenUserId}: ${await res.text()}`);
        }
      } catch (err) {
        console.error(`[backfill] Failed to send batch for user ${lumenUserId}:`, err);
      }
    }

    sent += batch.length;
    console.log(`[backfill] Progress: ${sent}/${rows.length}`);
  }

  console.log('[backfill] Done.');
  await pool.end();
}

main().catch(err => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
