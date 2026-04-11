import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  db,
  sqlite,
  epistemicCandidates,
  axiomStatements,
  axiomProvenance,
  promptQueue,
} from '../../db';
import {
  createPraxisQueueItem,
  createWatchRules,
  createLiminalRevisionPrompts,
} from '../../services/epistemicPromotion';
import { requireAuth } from './epistemicAuth';

const router = Router();

function uid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

function mapCandidateToAxiomKind(candidateType: string): 'truth_claim' | 'tension' | 'revision' | 'working_doctrine' {
  switch (candidateType) {
    case 'tension_candidate': return 'tension';
    case 'revision_candidate': return 'revision';
    case 'doctrine_candidate': return 'working_doctrine';
    default: return 'truth_claim';
  }
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ─── GET /queue/:userId ──────────────────────────────────────────────────────

router.get('/queue/:userId', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId } = req.params;
  const target = req.query.target as string | undefined;

  try {
    let candidates;
    if (target) {
      candidates = db
        .select()
        .from(epistemicCandidates)
        .where(
          and(
            eq(epistemicCandidates.userId, userId),
            sql`${epistemicCandidates.targetApp} = ${target}`,
            inArray(epistemicCandidates.status, ['open', 'queued_for_axiom', 'queued_for_praxis'])
          )
        )
        .all();
    } else {
      candidates = db
        .select()
        .from(epistemicCandidates)
        .where(
          and(
            eq(epistemicCandidates.userId, userId),
            inArray(epistemicCandidates.status, ['open', 'queued_for_axiom', 'queued_for_praxis'])
          )
        )
        .all();
    }

    let prompts: typeof promptQueue.$inferSelect[] = [];
    if (target === 'liminal' || target === 'praxis') {
      prompts = db
        .select()
        .from(promptQueue)
        .where(
          and(
            eq(promptQueue.userId, userId),
            eq(promptQueue.destinationApp, target),
            eq(promptQueue.status, 'open')
          )
        )
        .all();
    }

    return res.json({ candidates, prompts });
  } catch (err) {
    console.error('[epistemic/queue]', err);
    return res.status(500).json({ error: 'Failed to fetch queue.' });
  }
});

// ─── POST /candidates/:id/accept ─────────────────────────────────────────────

router.post('/candidates/:id/accept', async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;
  const { statement, kind, confidence } = req.body;

  try {
    const candidate = db.select().from(epistemicCandidates).where(eq(epistemicCandidates.id, id)).get();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

    // Mark accepted
    db.update(epistemicCandidates)
      .set({ status: 'accepted', updatedAt: now() })
      .where(eq(epistemicCandidates.id, id))
      .run();

    let result: Record<string, unknown> = { candidate: { ...candidate, status: 'accepted' } };

    if (candidate.targetApp === 'axiom') {
      // Create axiom_statement
      const axiomKind = kind || mapCandidateToAxiomKind(candidate.candidateType);
      const axiom = db
        .insert(axiomStatements)
        .values({
          id: uid(),
          userId: candidate.userId,
          statement: statement || candidate.title,
          status: 'provisional',
          kind: axiomKind,
          confidence: confidence ?? candidate.confidence,
          sourceCandidateIds: JSON.stringify([candidate.id]),
          provenanceSummary: `Accepted from ${candidate.candidateType}: "${candidate.summary}"`,
          createdAt: now(),
          updatedAt: now(),
        })
        .returning()
        .get();

      // Create provenance entries
      const sourceEventIds: string[] = safeParse(candidate.sourceEventIds, []);
      for (const eventId of sourceEventIds) {
        db.insert(axiomProvenance)
          .values({
            id: uid(),
            userId: candidate.userId,
            axiomStatementId: axiom.id,
            eventId,
            candidateId: candidate.id,
            evidenceType: 'entry',
            note: `Auto-linked from candidate acceptance`,
            createdAt: now(),
          })
          .run();
      }

      // Create watch rules for Parallax
      createWatchRules(axiom);

      // Create prompt queue items for Liminal
      createLiminalRevisionPrompts(axiom);

      result.axiom = axiom;
    } else if (candidate.targetApp === 'praxis') {
      // Create prompt_queue item for Praxis
      createPraxisQueueItem(
        { ...candidate, status: 'accepted' } as typeof epistemicCandidates.$inferSelect,
        `Ready to become an experiment: "${candidate.summary}"`
      );
      result.queued = 'praxis';
    }

    return res.json(result);
  } catch (err) {
    console.error('[epistemic/accept]', err);
    return res.status(500).json({ error: 'Failed to accept candidate.' });
  }
});

// ─── POST /candidates/:id/reject ─────────────────────────────────────────────

router.post('/candidates/:id/reject', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;

  try {
    const candidate = db.select().from(epistemicCandidates).where(eq(epistemicCandidates.id, id)).get();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

    db.update(epistemicCandidates)
      .set({ status: 'rejected', updatedAt: now() })
      .where(eq(epistemicCandidates.id, id))
      .run();

    return res.json({ ...candidate, status: 'rejected' });
  } catch (err) {
    console.error('[epistemic/reject]', err);
    return res.status(500).json({ error: 'Failed to reject candidate.' });
  }
});

// ─── POST /candidates/:id/test ───────────────────────────────────────────────

router.post('/candidates/:id/test', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;

  try {
    const candidate = db.select().from(epistemicCandidates).where(eq(epistemicCandidates.id, id)).get();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

    db.update(epistemicCandidates)
      .set({ status: 'testing', targetApp: 'praxis', updatedAt: now() })
      .where(eq(epistemicCandidates.id, id))
      .run();

    // Create prompt_queue item for Praxis
    createPraxisQueueItem(
      { ...candidate, status: 'testing', targetApp: 'praxis' } as typeof epistemicCandidates.$inferSelect,
      `Design an experiment to test: "${candidate.summary}"`
    );

    return res.json({ ...candidate, status: 'testing', targetApp: 'praxis' });
  } catch (err) {
    console.error('[epistemic/test]', err);
    return res.status(500).json({ error: 'Failed to mark candidate for testing.' });
  }
});

// ─── DELETE /candidates/:id — delete a single candidate ─────────────────────

router.delete('/candidates/:id', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { id } = req.params;
  const result = sqlite
    .prepare('DELETE FROM epistemic_candidates WHERE id = ? AND user_id = ?')
    .run(id, auth.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }
  res.json({ deleted: true });
});

export { router as candidatesRouter };
