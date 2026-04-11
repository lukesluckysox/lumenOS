import { Router, Request, Response } from 'express';
import { eq, inArray } from 'drizzle-orm';
import {
  db,
  sqlite,
  epistemicEvents,
  epistemicCandidates,
  axiomStatements,
  axiomProvenance,
} from '../../db';
import { requireAuth, requireInternalToken } from './epistemicAuth';
import type { EpistemicCandidate } from '../../schema/epistemic';

const router = Router();

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

export { router as provenanceRouter };
