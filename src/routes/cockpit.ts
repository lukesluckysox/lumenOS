import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  db,
  sqlite,
  epistemicEvents,
  epistemicCandidates,
  axiomStatements,
} from '../db';

const router = Router();

const JWT_SECRET  = process.env.JWT_SECRET || 'lumen-dev-secret-CHANGE-IN-PRODUCTION';
const COOKIE_NAME = 'lumen-session';

// ─── Cockpit Dimensions ──────────────────────────────────────────────────────
// Maps each cockpit dimension to its Parallax source dimensions and weights

const COCKPIT_DIMS = [
  'clarity', 'groundedness', 'agency', 'vitality',
  'connection', 'expression', 'discovery', 'purpose', 'integrity',
] as const;
type CockpitDim = typeof COCKPIT_DIMS[number];

// How to derive each cockpit dimension from Parallax's 8-dim vector (0-100 scale)
const PARALLAX_MAPPING: Record<CockpitDim, Record<string, number>> = {
  clarity:      { focus: 0.6, calm: 0.4 },
  groundedness: { calm: 0.7, focus: 0.3 },
  agency:       { agency: 1.0 },
  vitality:     { vitality: 1.0 },
  connection:   { social: 1.0 },
  expression:   { creativity: 0.7, exploration: 0.3 },
  discovery:    { exploration: 0.7, creativity: 0.3 },
  purpose:      { drive: 0.7, agency: 0.3 },
  integrity:    {}, // computed from cross-app synthesis, not from Parallax alone
};

// Epistemic theme keywords that boost each cockpit dimension
const EPISTEMIC_THEMES: Record<CockpitDim, string[]> = {
  clarity:      ['clarity', 'understanding', 'insight', 'focus', 'lucid', 'clear'],
  groundedness: ['grounded', 'stable', 'anchor', 'foundation', 'calm', 'centered'],
  agency:       ['agency', 'autonomy', 'control', 'freedom', 'independent', 'choice'],
  vitality:     ['vitality', 'energy', 'alive', 'health', 'physical', 'body'],
  connection:   ['connection', 'social', 'relationship', 'belonging', 'community', 'people'],
  expression:   ['expression', 'creative', 'creativity', 'voice', 'art', 'writing'],
  discovery:    ['discovery', 'explore', 'curiosity', 'novelty', 'new', 'seek'],
  purpose:      ['purpose', 'meaning', 'drive', 'direction', 'goal', 'mission'],
  integrity:    ['integrity', 'authentic', 'honest', 'consistent', 'alignment', 'congruent'],
};

// ─── Auth ──────────────────────────────────────────────────────────────────────

interface AuthPayload { userId: number | string; username: string; }

function authenticate(req: Request): AuthPayload | null {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch { return null; }
}

function requireAuth(req: Request, res: Response): AuthPayload | null {
  const auth = authenticate(req);
  if (!auth) { res.status(401).json({ error: 'Not authenticated.' }); return null; }
  return auth;
}

// ─── DB Migrations ──────────────────────────────────────────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS cockpit_targets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    dimension  TEXT NOT NULL,
    target     REAL NOT NULL DEFAULT 20,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, dimension)
  )
`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS cockpit_targets_user_idx ON cockpit_targets(user_id)`);

// ─── Helpers ────────────────────────────────────────────────────────────────────

const PARALLAX_API_URL = process.env.PARALLAX_API_URL || 'https://parallax-production.up.railway.app';
const AXIOM_API_URL    = process.env.AXIOM_API_URL    || 'https://axiomtool-production.up.railway.app';
const PRAXIS_API_URL   = process.env.PRAXIS_API_URL   || 'https://praxis-app.up.railway.app';
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || '';

async function fetchParallaxVector(lumenUserId: string): Promise<Record<string, number> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${PARALLAX_API_URL}/api/internal/patterns-for-lumen?lumenUserId=${lumenUserId}`,
      { headers: { 'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.currentVector || null;
  } catch { return null; }
}

async function fetchPraxisStats(userId: string): Promise<{ experimentCount: number; completedCount: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${PRAXIS_API_URL}/api/internal/stats?userId=${userId}`,
      { headers: { 'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return { experimentCount: 0, completedCount: 0 };
    const data = await res.json() as any;
    return {
      experimentCount: data.experimentCount || 0,
      completedCount: data.completedCount || data.experimentCount || 0,
    };
  } catch { return { experimentCount: 0, completedCount: 0 }; }
}

/** Scale a Parallax dimension value (0-100) to the cockpit scale (0-40) */
function scaleTo40(val: number): number {
  return Math.round((Math.max(0, Math.min(100, val)) / 100) * 40 * 100) / 100;
}

/** Compute cockpit fed values from Parallax vector + epistemic signals */
function computeFedValues(
  parallaxVec: Record<string, number> | null,
  epistemicBoosts: Record<CockpitDim, number>,
  integrityScore: number,
  praxisBoost: Record<CockpitDim, number>,
): Record<CockpitDim, number> {
  const fed = {} as Record<CockpitDim, number>;

  for (const dim of COCKPIT_DIMS) {
    if (dim === 'integrity') {
      // Integrity is entirely from cross-app synthesis
      fed[dim] = Math.round(Math.max(0, Math.min(40, integrityScore)) * 100) / 100;
      continue;
    }

    let base = 0;
    const mapping = PARALLAX_MAPPING[dim];
    if (parallaxVec && Object.keys(mapping).length > 0) {
      for (const [pDim, weight] of Object.entries(mapping)) {
        base += (parallaxVec[pDim] || 50) * weight;
      }
    } else {
      base = 50; // neutral if no Parallax data
    }

    // Scale base (0-100) to cockpit (0-40)
    let scaled = scaleTo40(base);

    // Apply epistemic boost (small nudge from reflective activity, max ±4)
    scaled += Math.max(-4, Math.min(4, epistemicBoosts[dim] || 0));

    // Apply praxis boost (experiments that touched this dimension, max ±3)
    scaled += Math.max(-3, Math.min(3, praxisBoost[dim] || 0));

    fed[dim] = Math.round(Math.max(0, Math.min(40, scaled)) * 100) / 100;
  }

  return fed;
}

/** Compute epistemic boosts from recent events and candidates */
function computeEpistemicBoosts(userId: string): Record<CockpitDim, number> {
  const boosts = {} as Record<CockpitDim, number>;
  for (const d of COCKPIT_DIMS) boosts[d] = 0;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const events = db
      .select()
      .from(epistemicEvents)
      .where(sql`${epistemicEvents.userId} = ${userId} AND ${epistemicEvents.createdAt} >= ${thirtyDaysAgo}`)
      .all();

    // Scan event payloads and tags for theme keywords
    for (const evt of events) {
      const text = (evt.payload + ' ' + evt.tags).toLowerCase();
      for (const dim of COCKPIT_DIMS) {
        const keywords = EPISTEMIC_THEMES[dim];
        const hits = keywords.filter(kw => text.includes(kw)).length;
        if (hits > 0) {
          // Each thematic hit nudges the dimension by 0.5, capped at 4
          boosts[dim] += 0.5;
        }
      }
    }

    // Cap boosts
    for (const d of COCKPIT_DIMS) {
      boosts[d] = Math.min(4, boosts[d]);
    }
  } catch (e) {
    console.error('[cockpit] epistemic boost error:', e);
  }

  return boosts;
}

/** Compute integrity score (0-40) from cross-app synthesis:
 *  - Axiom confidence (are your truth claims well-supported?)
 *  - Identity discrepancy count (lower is better)
 *  - Convergence pairs (beliefs matching observed patterns)  */
function computeIntegrity(userId: string): number {
  try {
    // 1. Average axiom confidence (0-1)
    const axioms = db
      .select()
      .from(axiomStatements)
      .where(sql`${axiomStatements.userId} = ${userId} AND ${axiomStatements.status} IN ('provisional', 'stable')`)
      .all();

    let axiomComponent = 20; // default neutral
    if (axioms.length > 0) {
      const avgConf = axioms.reduce((sum, a) => sum + (a.confidence || 0), 0) / axioms.length;
      axiomComponent = scaleTo40(avgConf * 100); // 0-40 range
    }

    // 2. Identity discrepancy penalty
    const discrepancies = db
      .select()
      .from(epistemicEvents)
      .where(sql`${epistemicEvents.userId} = ${userId} AND ${epistemicEvents.eventType} = 'identity_discrepancy'`)
      .all();
    const discrepancyPenalty = Math.min(10, discrepancies.length * 2);

    // 3. Convergence bonus (beliefs that match patterns)
    const convergences = db
      .select()
      .from(epistemicCandidates)
      .where(sql`${epistemicCandidates.userId} = ${userId} AND convergence_group_id IS NOT NULL`)
      .all();
    const convergenceBonus = Math.min(8, convergences.length * 2);

    const score = Math.max(0, Math.min(40, axiomComponent - discrepancyPenalty + convergenceBonus));
    return Math.round(score * 100) / 100;
  } catch (e) {
    console.error('[cockpit] integrity computation error:', e);
    return 20; // neutral fallback
  }
}

/** Cosine similarity between two cockpit vectors, returned as 0-100 */
function cosineAlignment(fed: Record<CockpitDim, number>, target: Record<CockpitDim, number>): number {
  let dot = 0, magF = 0, magT = 0;
  for (const dim of COCKPIT_DIMS) {
    const f = fed[dim] || 0;
    const t = target[dim] || 0;
    dot += f * t;
    magF += f * f;
    magT += t * t;
  }
  if (magF === 0 || magT === 0) return 0;
  const cosSim = dot / (Math.sqrt(magF) * Math.sqrt(magT));
  // Scale to 0-100 (cosine similarity is naturally 0-1 for non-negative vectors)
  return Math.round(cosSim * 100);
}

// ─── GET /api/cockpit/state ─────────────────────────────────────────────────

router.get('/state', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const userId = String(user.userId);

  try {
    // 1. Fetch Parallax vector (async)
    // 2. Compute epistemic boosts (local DB)
    // 3. Fetch Praxis stats (async)
    // 4. Compute integrity (local DB)
    // 5. Load stored targets

    const [parallaxVec, praxisStats] = await Promise.all([
      fetchParallaxVector(userId),
      fetchPraxisStats(userId),
    ]);

    const epistemicBoosts = computeEpistemicBoosts(userId);

    // Praxis boosts agency and discovery based on experiment activity
    const praxisBoost = {} as Record<CockpitDim, number>;
    for (const d of COCKPIT_DIMS) praxisBoost[d] = 0;
    if (praxisStats.experimentCount > 0) {
      praxisBoost.agency = Math.min(3, praxisStats.completedCount * 0.5);
      praxisBoost.discovery = Math.min(3, praxisStats.experimentCount * 0.3);
    }

    const integrityScore = computeIntegrity(userId);
    const fed = computeFedValues(parallaxVec, epistemicBoosts, integrityScore, praxisBoost);

    // Load targets (defaults to 20 for each dimension if not set)
    const targetRows = sqlite.prepare(
      `SELECT dimension, target FROM cockpit_targets WHERE user_id = ?`
    ).all(userId) as Array<{ dimension: string; target: number }>;

    const targets = {} as Record<CockpitDim, number>;
    for (const d of COCKPIT_DIMS) targets[d] = 20; // default: midpoint
    for (const row of targetRows) {
      if (COCKPIT_DIMS.includes(row.dimension as CockpitDim)) {
        targets[row.dimension as CockpitDim] = row.target;
      }
    }

    const alignment = cosineAlignment(fed, targets);

    // Build response
    const dimensions = COCKPIT_DIMS.map(dim => ({
      name: dim,
      label: dim.charAt(0).toUpperCase() + dim.slice(1),
      fed: fed[dim],
      target: targets[dim],
    }));

    return res.json({
      alignment,
      dimensions,
      sources: {
        parallax: !!parallaxVec,
        epistemic: true,
        praxis: praxisStats.experimentCount > 0,
        axiom: true,
      },
    });
  } catch (err) {
    console.error('[cockpit/state]', err);
    return res.status(500).json({ error: 'Failed to compute cockpit state.' });
  }
});

// ─── GET /api/cockpit/targets ───────────────────────────────────────────────

router.get('/targets', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const userId = String(user.userId);

  try {
    const rows = sqlite.prepare(
      `SELECT dimension, target, updated_at FROM cockpit_targets WHERE user_id = ?`
    ).all(userId) as Array<{ dimension: string; target: number; updated_at: string }>;

    const targets = {} as Record<string, { target: number; updatedAt: string }>;
    for (const d of COCKPIT_DIMS) {
      targets[d] = { target: 20, updatedAt: '' };
    }
    for (const row of rows) {
      targets[row.dimension] = { target: row.target, updatedAt: row.updated_at };
    }

    return res.json({ targets });
  } catch (err) {
    console.error('[cockpit/targets GET]', err);
    return res.status(500).json({ error: 'Failed to load targets.' });
  }
});

// ─── PUT /api/cockpit/targets ───────────────────────────────────────────────

router.put('/targets', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const userId = String(user.userId);
  const body = req.body as Record<string, number>;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body must be an object of { dimension: target }' });
  }

  try {
    const now = new Date().toISOString();
    const upsert = sqlite.prepare(`
      INSERT INTO cockpit_targets (user_id, dimension, target, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, dimension) DO UPDATE SET target = excluded.target, updated_at = excluded.updated_at
    `);

    const tx = sqlite.transaction(() => {
      for (const [dim, val] of Object.entries(body)) {
        if (!COCKPIT_DIMS.includes(dim as CockpitDim)) continue;
        const clamped = Math.max(0, Math.min(40, Number(val) || 20));
        upsert.run(userId, dim, clamped, now);
      }
    });
    tx();

    return res.json({ ok: true });
  } catch (err) {
    console.error('[cockpit/targets PUT]', err);
    return res.status(500).json({ error: 'Failed to save targets.' });
  }
});

export { router as cockpitRouter };
