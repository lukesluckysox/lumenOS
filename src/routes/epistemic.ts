import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  db,
  sqlite,
  users,
  epistemicEvents,
  epistemicCandidates,
  axiomStatements,
  axiomProvenance,
  watchRules,
  promptQueue,
} from '../db';
import {
  processEvent,
  createPraxisQueueItem,
  createWatchRules,
  createLiminalRevisionPrompts,
} from '../services/epistemicPromotion';
import type { EpistemicCandidate } from '../schema/epistemic';
import { backfillLiminalEntries, backfillParallaxData, backfillAxiomSeededState } from '../jobs/backfill';
import { flushEpistemicQueue } from '../services/epistemicPush';
import { seedExistingAxiomEntries, seedFromEntries } from '../jobs/seedExistingAxiom';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'lumen-dev-secret-CHANGE-IN-PRODUCTION';
const COOKIE_NAME = 'lumen-session';

function uid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// Accepts JWT cookie auth OR x-lumen-internal-token header for server-to-server

interface AuthPayload {
  userId: number | string;
  username: string;
}

function authenticate(req: Request, res: Response): AuthPayload | null {
  // Check internal token for server-to-server calls
  const internalToken = req.headers['x-lumen-internal-token'] as string | undefined;
  const expectedToken = process.env.LUMEN_INTERNAL_TOKEN || JWT_SECRET;
  if (internalToken && internalToken === expectedToken) {
    // For internal calls, userId may come from body or query
    const userId = (req.body?.userId || req.query?.userId || 'system') as string;
    return { userId, username: 'internal' };
  }

  // Check JWT cookie
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response): AuthPayload | null {
  const auth = authenticate(req, res);
  if (!auth) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }
  return auth;
}

function requireInternalToken(req: Request, res: Response, next: () => void): void {
  const token = (req.headers as Record<string, string>)['x-lumen-internal-token'];
  const expectedToken = process.env.LUMEN_INTERNAL_TOKEN || JWT_SECRET;
  if (!token || token !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

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

// ─── GET /provenance/:axiomId ────────────────────────────────────────────────

router.get('/provenance/:axiomId', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { axiomId } = req.params;

  try {
    const axiom = db.select().from(axiomStatements).where(eq(axiomStatements.id, axiomId)).get();
    if (!axiom) return res.status(404).json({ error: 'Axiom statement not found.' });

    const provenanceRows = db
      .select()
      .from(axiomProvenance)
      .where(eq(axiomProvenance.axiomStatementId, axiomId))
      .all();

    // Gather linked event IDs and candidate IDs
    const eventIds = provenanceRows.map((p) => p.eventId).filter(Boolean) as string[];
    const candidateIds = provenanceRows.map((p) => p.candidateId).filter(Boolean) as string[];

    const events = eventIds.length > 0
      ? db.select().from(epistemicEvents).where(inArray(epistemicEvents.id, eventIds)).all()
      : [];

    const candidates = candidateIds.length > 0
      ? db.select().from(epistemicCandidates).where(inArray(epistemicCandidates.id, candidateIds)).all()
      : [];

    return res.json({
      statement: axiom,
      provenance: provenanceRows,
      events,
      candidates,
    });
  } catch (err) {
    console.error('[epistemic/provenance]', err);
    return res.status(500).json({ error: 'Failed to fetch provenance.' });
  }
});

// ─── Utilities ───────────────────────────────────────────────────────────────

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

// ─── GET /sensitivity/:userId ────────────────────────────────────────────────────────

router.get('/sensitivity/:userId', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId } = req.params;

  try {
    const uid = parseInt(userId, 10);
    const user = db.select().from(users).where(eq(users.id, isNaN(uid) ? 0 : uid)).get();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ sensitivity: (user as Record<string, unknown>).sensitivity || 'medium' });
  } catch (err) {
    console.error('[epistemic/sensitivity/get]', err);
    return res.status(500).json({ error: 'Failed to get sensitivity.' });
  }
});

// ─── POST /sensitivity/:userId ────────────────────────────────────────────────────────

router.post('/sensitivity/:userId', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId } = req.params;
  const { sensitivity } = req.body as { sensitivity: string };

  if (!['low', 'medium', 'high'].includes(sensitivity)) {
    return res.status(400).json({ error: 'sensitivity must be low, medium, or high.' });
  }

  try {
    const uid = parseInt(userId, 10);
    db.update(users)
      .set({ sensitivity } as Record<string, unknown>)
      .where(eq(users.id, isNaN(uid) ? 0 : uid))
      .run();
    return res.json({ sensitivity });
  } catch (err) {
    console.error('[epistemic/sensitivity/post]', err);
    return res.status(500).json({ error: 'Failed to update sensitivity.' });
  }
});

// ─── POST /push/:userId — flush epistemic queue to Axiomtool + Praxis ────────
router.post('/push/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const token = (req.headers as Record<string, string>)['x-lumen-internal-token'];
  const expectedToken = process.env.LUMEN_INTERNAL_TOKEN;
  if (!expectedToken || token !== expectedToken) {
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

// ─── GET /convergence/:userId — inspect convergence groups ─────────────────

router.get('/convergence/:userId', requireInternalToken, (req: Request, res: Response) => {
  const { userId } = req.params;
  const rows = sqlite
    .prepare(`SELECT * FROM epistemic_candidates WHERE user_id = ? AND convergence_group_id IS NOT NULL ORDER BY convergence_group_id, created_at DESC`)
    .all(userId) as (EpistemicCandidate & { convergence_group_id: string })[];

  // Group by convergence_group_id
  const groups: Record<string, (EpistemicCandidate & { convergence_group_id: string })[]> = {};
  for (const row of rows) {
    const gid = row.convergence_group_id;
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(row);
  }

  res.json({
    userId,
    convergenceGroups: Object.entries(groups).map(([groupId, members]) => ({
      groupId,
      memberCount: members.length,
      sources: [...new Set(members.map(m => m.candidateType))],
      members,
    })),
  });
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

export { router as epistemicRouter };
