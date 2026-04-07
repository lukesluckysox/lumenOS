import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  db,
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
import { backfillLiminalEntries, backfillParallaxData, backfillAxiomSeededState } from '../jobs/backfill';
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
        `Accepted candidate ready for experimentation: "${candidate.summary}"`
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

export { router as epistemicRouter };
