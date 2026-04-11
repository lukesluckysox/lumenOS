import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import {
  db,
  sqlite,
  epistemicEvents,
  epistemicCandidates,
} from '../../db';
import { processEvent } from '../../services/epistemicPromotion';
import { flushEpistemicQueue } from '../../services/epistemicPush';
import { requireAuth } from './epistemicAuth';

const router = Router();

function uid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

// ─── POST /events ────────────────────────────────────────────────────────────

router.post('/events', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const {
    userId,
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
  } = req.body;

  if (!userId || !sourceApp || !sourceRecordId || !eventType) {
    return res.status(400).json({ error: 'userId, sourceApp, sourceRecordId, and eventType are required.' });
  }

  try {
    // Deduplicate by sourceApp + sourceRecordId + eventType
    const existing = db
      .select()
      .from(epistemicEvents)
      .where(
        and(
          eq(epistemicEvents.sourceApp, sourceApp),
          eq(epistemicEvents.sourceRecordId, sourceRecordId),
          eq(epistemicEvents.eventType, eventType)
        )
      )
      .get();

    let event;
    if (existing) {
      // Upsert — update confidence/salience but do NOT duplicate
      db.update(epistemicEvents)
        .set({
          confidence: confidence ?? existing.confidence,
          salience: salience ?? existing.salience,
          updatedAt: now(),
        })
        .where(eq(epistemicEvents.id, existing.id))
        .run();

      event = db.select().from(epistemicEvents).where(eq(epistemicEvents.id, existing.id)).get()!;
    } else {
      event = db
        .insert(epistemicEvents)
        .values({
          id: uid(),
          userId,
          sourceApp,
          sourceRecordId,
          eventType,
          confidence: confidence ?? 0,
          salience: salience ?? 0,
          domain: domain ?? null,
          tags: tags ? JSON.stringify(tags) : '[]',
          evidence: evidence ? JSON.stringify(evidence) : '[]',
          payload: payload ? JSON.stringify(payload) : '{}',
          ingestionMode: ingestionMode ?? 'live',
          createdAt: createdAt ?? now(),
          updatedAt: now(),
        })
        .returning()
        .get();
    }

    // After insert/update, run processEvent
    await processEvent(event);

    // Fire-and-forget: push any newly queued candidates to Axiomtool / Praxis
    // cross-app: always string
    flushEpistemicQueue(String(event.userId)).catch((e: unknown) => {
      console.error('[epistemic/events] push flush error:', e);
    });

    return res.status(201).json(event);
  } catch (err) {
    console.error('[epistemic/events]', err);
    return res.status(500).json({ error: 'Failed to create event.' });
  }
});

// ─── POST /promote ───────────────────────────────────────────────────────────

router.post('/promote', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { eventId, candidateTitle, candidateSummary, candidateType, targetApp, confidence, originMode } = req.body;

  if (!eventId || !candidateTitle || !candidateSummary || !candidateType) {
    return res.status(400).json({ error: 'eventId, candidateTitle, candidateSummary, and candidateType are required.' });
  }

  try {
    const event = db.select().from(epistemicEvents).where(eq(epistemicEvents.id, eventId)).get();
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const candidate = db
      .insert(epistemicCandidates)
      .values({
        id: uid(),
        userId: event.userId,
        candidateType,
        title: candidateTitle,
        summary: candidateSummary,
        status: targetApp ? (targetApp === 'axiom' ? 'queued_for_axiom' : 'queued_for_praxis') : 'open',
        targetApp: targetApp ?? null,
        confidence: confidence ?? event.confidence,
        sourceEventIds: JSON.stringify([eventId]),
        originMode: originMode ?? 'live',
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();

    return res.status(201).json(candidate);
  } catch (err) {
    console.error('[epistemic/promote]', err);
    return res.status(500).json({ error: 'Failed to promote event.' });
  }
});

// ─── DELETE /events/:id — delete a single epistemic event ───────────────────

router.delete('/events/:id', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;
  const result = sqlite
    .prepare('DELETE FROM epistemic_events WHERE id = ? AND user_id = ?')
    .run(id, auth.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  res.json({ deleted: true });
});

export { router as eventsRouter };
