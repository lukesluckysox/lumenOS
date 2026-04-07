import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import {
  db,
  epistemicEvents,
  epistemicCandidates,
  axiomStatements,
  axiomProvenance,
} from '../db';
import { processEvent } from '../services/epistemicPromotion';

function uid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LiminalEntry {
  id: string;
  content: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ParallaxRecord {
  id: string;
  frequency?: number;
  count?: number;
  contextCount?: number;
  trigger?: string;
  response?: string;
  statedValue?: string;
  observedBehavior?: string;
  summary?: string;
  text?: string;
  [key: string]: unknown;
}

// ─── Belief/Tension/Hypothesis marker detection ──────────────────────────────

const BELIEF_MARKERS = ['i believe', 'i value', 'i am', 'my identity', 'i know', 'i always', 'i never', 'fundamentally'];
const TENSION_MARKERS = ['but', 'however', 'on the other hand', 'i used to', 'i thought', "i'm torn", 'conflict', 'contradiction'];
const HYPOTHESIS_MARKERS = ['if', 'when i', 'i expect', 'i predict', 'i assume', 'because', 'therefore'];
const REPEATED_QUESTION_MARKERS = ['why do i', "i don't understand why", 'i keep'];

function detectSignals(content: string): { eventType: string; confidence: number }[] {
  const lower = content.toLowerCase();
  const results: { eventType: string; confidence: number }[] = [];

  let beliefScore = 0;
  let tensionScore = 0;
  let hypothesisScore = 0;

  if (content.length > 50) {
    beliefScore += 0.1;
    tensionScore += 0.1;
    hypothesisScore += 0.1;
  }

  for (const marker of BELIEF_MARKERS) {
    if (lower.includes(marker)) beliefScore += 0.2;
  }
  for (const marker of TENSION_MARKERS) {
    if (lower.includes(marker)) tensionScore += 0.2;
  }
  for (const marker of HYPOTHESIS_MARKERS) {
    if (lower.includes(marker)) hypothesisScore += 0.2;
  }
  for (const marker of REPEATED_QUESTION_MARKERS) {
    if (lower.includes(marker)) beliefScore += 0.2;
  }

  beliefScore = Math.min(beliefScore, 1.0);
  tensionScore = Math.min(tensionScore, 1.0);
  hypothesisScore = Math.min(hypothesisScore, 1.0);

  if (beliefScore >= 0.4) results.push({ eventType: 'belief_candidate', confidence: beliefScore });
  if (tensionScore >= 0.4) results.push({ eventType: 'tension_candidate', confidence: tensionScore });
  if (hypothesisScore >= 0.4) results.push({ eventType: 'hypothesis_candidate', confidence: hypothesisScore });

  return results;
}

// ─── backfillLiminalEntries ──────────────────────────────────────────────────

export async function backfillLiminalEntries(userId: string, entries: LiminalEntry[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const createdEvents: (typeof epistemicEvents.$inferSelect)[] = [];

  for (const entry of entries) {
    const signals = detectSignals(entry.content);

    for (const signal of signals) {
      // Deduplicate
      const existing = db
        .select()
        .from(epistemicEvents)
        .where(
          and(
            eq(epistemicEvents.sourceApp, 'liminal'),
            eq(epistemicEvents.sourceRecordId, entry.id),
            eq(epistemicEvents.eventType, signal.eventType as typeof epistemicEvents.$inferSelect['eventType'])
          )
        )
        .get();

      if (existing) {
        skipped++;
        continue;
      }

      const event = db
        .insert(epistemicEvents)
        .values({
          id: uid(),
          userId,
          sourceApp: 'liminal',
          sourceRecordId: entry.id,
          eventType: signal.eventType as typeof epistemicEvents.$inferInsert['eventType'],
          confidence: signal.confidence,
          salience: signal.confidence * 0.8,
          ingestionMode: 'backfill',
          payload: JSON.stringify({ text: entry.content.slice(0, 500), summary: entry.content.slice(0, 100) }),
          createdAt: entry.createdAt || now(),
          updatedAt: now(),
        })
        .returning()
        .get();

      createdEvents.push(event);
      created++;
    }
  }

  // Run processEvent on all created events
  for (const event of createdEvents) {
    await processEvent(event);
  }

  return { created, skipped };
}

// ─── backfillParallaxData ────────────────────────────────────────────────────

export async function backfillParallaxData(userId: string, records: ParallaxRecord[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const createdEvents: (typeof epistemicEvents.$inferSelect)[] = [];

  for (const record of records) {
    const events: { eventType: string; confidence: number; payload: Record<string, unknown> }[] = [];

    // Pattern candidate: frequency >= 2
    const freq = record.frequency ?? record.count ?? 0;
    if (freq >= 2) {
      events.push({
        eventType: 'pattern_candidate',
        confidence: Math.min(freq / 10, 1.0),
        payload: {
          frequency: freq,
          contextCount: record.contextCount ?? 1,
          summary: record.summary || `Pattern observed ${freq} times`,
          text: record.text || record.summary || '',
        },
      });
    }

    // Hypothesis candidate: trigger/response structure
    if (record.trigger && record.response) {
      events.push({
        eventType: 'hypothesis_candidate',
        confidence: 0.5,
        payload: {
          trigger: record.trigger,
          response: record.response,
          summary: record.summary || `When ${record.trigger}, then ${record.response}`,
          text: record.text || '',
        },
      });
    }

    // Identity discrepancy: stated vs observed
    if (record.statedValue && record.observedBehavior) {
      events.push({
        eventType: 'identity_discrepancy',
        confidence: 0.7,
        payload: {
          statedValue: record.statedValue,
          observedBehavior: record.observedBehavior,
          summary: record.summary || `Gap between "${record.statedValue}" and observed "${record.observedBehavior}"`,
          text: record.text || '',
        },
      });
    }

    for (const ev of events) {
      // Deduplicate
      const existing = db
        .select()
        .from(epistemicEvents)
        .where(
          and(
            eq(epistemicEvents.sourceApp, 'parallax'),
            eq(epistemicEvents.sourceRecordId, record.id),
            eq(epistemicEvents.eventType, ev.eventType as typeof epistemicEvents.$inferSelect['eventType'])
          )
        )
        .get();

      if (existing) {
        skipped++;
        continue;
      }

      const event = db
        .insert(epistemicEvents)
        .values({
          id: uid(),
          userId,
          sourceApp: 'parallax',
          sourceRecordId: record.id,
          eventType: ev.eventType as typeof epistemicEvents.$inferInsert['eventType'],
          confidence: ev.confidence,
          salience: ev.confidence * 0.7,
          ingestionMode: 'backfill',
          payload: JSON.stringify(ev.payload),
          createdAt: now(),
          updatedAt: now(),
        })
        .returning()
        .get();

      createdEvents.push(event);
      created++;
    }
  }

  // Run processEvent, marking resulting candidates with historical_derivation
  for (const event of createdEvents) {
    await processEvent(event);
  }

  return { created, skipped };
}

// ─── backfillAxiomSeededState ────────────────────────────────────────────────

export interface AxiomSeedStatement {
  statement: string;
  kind: 'truth_claim' | 'tension' | 'revision' | 'working_doctrine';
  confidence?: number;
}

export async function backfillAxiomSeededState(
  userId: string,
  payload?: AxiomSeedStatement[]
): Promise<{ created: number; skipped: number }> {
  let statements: AxiomSeedStatement[] = [];

  if (payload && payload.length > 0) {
    statements = payload;
  } else if (process.env.AXIOMTOOL_INTERNAL_URL) {
    // Attempt to fetch from Axiomtool
    try {
      const resp = await fetch(`${process.env.AXIOMTOOL_INTERNAL_URL}/api/internal/export-truths`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lumen-internal-token': process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '',
        },
        body: JSON.stringify({ userId }),
      });
      if (resp.ok) {
        const data = await resp.json() as { statements?: AxiomSeedStatement[] };
        statements = data.statements ?? [];
      }
    } catch (err) {
      console.error('[backfill/axiom-seeded] Failed to fetch from Axiomtool:', err);
    }
  }

  let created = 0;
  let skipped = 0;

  for (const stmt of statements) {
    // Idempotent: check by statement text
    const existing = db
      .select()
      .from(axiomStatements)
      .where(
        and(
          eq(axiomStatements.userId, userId),
          eq(axiomStatements.statement, stmt.statement)
        )
      )
      .get();

    if (existing) {
      skipped++;
      continue;
    }

    const axiom = db
      .insert(axiomStatements)
      .values({
        id: uid(),
        userId,
        statement: stmt.statement,
        status: 'seeded',
        seeded: true,
        kind: stmt.kind,
        confidence: stmt.confidence ?? 0.8,
        provenanceSummary: 'Seeded from existing Axiom records',
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();

    // Create provenance
    db.insert(axiomProvenance)
      .values({
        id: uid(),
        userId,
        axiomStatementId: axiom.id,
        evidenceType: 'manual_seed',
        note: 'Imported from existing Axiom records during backfill',
        createdAt: now(),
      })
      .run();

    created++;
  }

  return { created, skipped };
}
