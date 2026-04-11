import { Router, Request, Response } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import {
  db,
  sqlite,
  epistemicEvents,
  epistemicCandidates,
  promptQueue,
} from '../../db';
import { processEvent } from '../../services/epistemicPromotion';
import { backfillLiminalEntries, backfillParallaxData, backfillAxiomSeededState } from '../../jobs/backfill';
import { flushEpistemicQueue } from '../../services/epistemicPush';
import { seedExistingAxiomEntries, seedFromEntries } from '../../jobs/seedExistingAxiom';
import { requireAuth, requireInternalToken } from './epistemicAuth';

const router = Router();

const now = () => new Date().toISOString();

// ─── POST /backfill/liminal ───────────────────────────────────────────────────

router.post('/backfill/liminal', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId, entries } = req.body;
  if (!userId || !entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'userId and entries[] are required.' });
  }

  try {
    const result = await backfillLiminalEntries(userId, entries);
    return res.json(result);
  } catch (err) {
    console.error('[epistemic/backfill/liminal]', err);
    return res.status(500).json({ error: 'Liminal backfill failed.' });
  }
});

// ─── POST /backfill/parallax ─────────────────────────────────────────────────

router.post('/backfill/parallax', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId, records } = req.body;
  if (!userId || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'userId and records[] are required.' });
  }

  try {
    const result = await backfillParallaxData(userId, records);
    return res.json(result);
  } catch (err) {
    console.error('[epistemic/backfill/parallax]', err);
    return res.status(500).json({ error: 'Parallax backfill failed.' });
  }
});

// ─── POST /backfill/axiom-seeded ─────────────────────────────────────────────

router.post('/backfill/axiom-seeded', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId, statements } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  try {
    const result = await backfillAxiomSeededState(userId, statements);
    return res.json(result);
  } catch (err) {
    console.error('[epistemic/backfill/axiom-seeded]', err);
    return res.status(500).json({ error: 'Axiom seeded backfill failed.' });
  }
});

// ─── POST /seed/axiom ────────────────────────────────────────────────────────

router.post('/seed/axiom', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId, entries } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  try {
    let result;
    if (entries && Array.isArray(entries)) {
      result = await seedFromEntries(userId, entries);
    } else {
      result = await seedExistingAxiomEntries(userId);
    }
    return res.json(result);
  } catch (err) {
    console.error('[epistemic/seed/axiom]', err);
    return res.status(500).json({ error: 'Axiom seed failed.' });
  }
});

// ─── POST /push/:userId — flush epistemic queue to Axiomtool + Praxis ────────
router.post('/push/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const expectedToken = process.env.LUMEN_INTERNAL_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ error: 'Internal token not configured.' });
  }
  const token = (req.headers as Record<string, string>)['x-lumen-internal-token'];
  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await flushEpistemicQueue(userId);
    res.json(result);
  } catch (e: any) {
    console.error('[epistemic/push]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /reprocess/:userId ─────────────────────────────────────────────────────────
// Re-evaluates all existing events against current sensitivity thresholds.
// createCandidate is idempotent (upserts by title+type+user), so we no longer
// delete candidates before reprocessing. Accepted candidates that need re-pushing
// (e.g. after Axiomtool DB loss) are re-queued via ?force=true.

router.post('/reprocess/:userId', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId } = req.params;
  const force = req.query.force === 'true'; // re-queue accepted candidates for re-push

  try {
    // If force=true, reset accepted (non-seeded) candidates back to queued
    // so they get re-pushed to Axiomtool/Praxis on flush
    let requeued = 0;
    if (force) {
      const accepted = db
        .select()
        .from(epistemicCandidates)
        .where(
          and(
            eq(epistemicCandidates.userId, userId),
            eq(epistemicCandidates.status, 'accepted')
          )
        )
        .all()
        .filter(c => !c.seeded);

      for (const c of accepted) {
        const newStatus = c.targetApp === 'praxis' ? 'queued_for_praxis' : 'queued_for_axiom';
        db.update(epistemicCandidates)
          .set({ status: newStatus, updatedAt: now() })
          .where(eq(epistemicCandidates.id, c.id))
          .run();
        requeued++;
      }
    }

    // Clear non-seeded open prompts (these are just notification queue items, safe to clear)
    const promptsToDelete = db
      .select()
      .from(promptQueue)
      .where(and(eq(promptQueue.userId, userId), eq(promptQueue.status, 'open')))
      .all()
      .filter(p => !p.seeded);

    for (const p of promptsToDelete) {
      db.delete(promptQueue).where(eq(promptQueue.id, p.id)).run();
    }

    // Re-run processEvent on all events — createCandidate is idempotent,
    // so duplicates won't be created. New events get new candidates.
    const events = db
      .select()
      .from(epistemicEvents)
      .where(eq(epistemicEvents.userId, userId))
      .all();

    let promoted = 0;
    for (const event of events) {
      await processEvent(event);
      promoted++;
    }

    // Count queued candidates
    const queuedCandidates = db
      .select()
      .from(epistemicCandidates)
      .where(
        and(
          eq(epistemicCandidates.userId, userId),
          inArray(epistemicCandidates.status, ['open', 'queued_for_axiom', 'queued_for_praxis'])
        )
      )
      .all();

    // Fire-and-forget push after reprocess
    flushEpistemicQueue(userId).catch((e: unknown) => {
      console.error('[epistemic/reprocess] push flush error:', e);
    });

    return res.json({
      requeued,
      clearedPrompts: promptsToDelete.length,
      eventsReprocessed: promoted,
      queuedCandidates: queuedCandidates.length,
    });
  } catch (err) {
    console.error('[epistemic/reprocess]', err);
    return res.status(500).json({ error: 'Reprocess failed.' });
  }
});

// ─── POST /clear/:userId — clear all pipeline entries for cleanup ───────────

router.post('/clear/:userId', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId } = req.params;
  if (String(auth.userId) !== String(userId)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const { scope } = req.body ?? {};
  // scope: 'candidates', 'events', 'prompts', 'all'
  let candidatesDeleted = 0;
  let eventsDeleted = 0;
  let promptsDeleted = 0;

  if (scope === 'candidates' || scope === 'all') {
    const r = sqlite.prepare('DELETE FROM epistemic_candidates WHERE user_id = ?').run(userId);
    candidatesDeleted = r.changes;
  }
  if (scope === 'events' || scope === 'all') {
    const r = sqlite.prepare('DELETE FROM epistemic_events WHERE user_id = ?').run(userId);
    eventsDeleted = r.changes;
  }
  if (scope === 'prompts' || scope === 'all') {
    const r = sqlite.prepare('DELETE FROM prompt_queue WHERE user_id = ?').run(userId);
    promptsDeleted = r.changes;
  }

  res.json({ candidatesDeleted, eventsDeleted, promptsDeleted });
});

// ─── DELETE /prompts/:id — delete a single prompt queue item ────────────────

router.delete('/prompts/:id', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;
  const result = sqlite
    .prepare('DELETE FROM prompt_queue WHERE id = ? AND user_id = ?')
    .run(id, auth.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Prompt not found.' });
  }
  res.json({ deleted: true });
});

export { router as maintenanceRouter };
