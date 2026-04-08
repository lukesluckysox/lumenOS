import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  sqlite,
  epistemicEvents,
} from '../db';

const router = Router();

const JWT_SECRET  = process.env.JWT_SECRET || 'lumen-dev-secret-CHANGE-IN-PRODUCTION';
const COOKIE_NAME = 'lumen-session';

// ─── Auth Middleware ───────────────────────────────────────────────────────────

interface AuthPayload {
  userId: number | string;
  username: string;
}

function authenticate(req: Request, res: Response): AuthPayload | null {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return payload;
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({ error: 'Session expired.' });
    return null;
  }
}

// ─── Summary derivation ───────────────────────────────────────────────────────

/**
 * Derive a human-readable summary from the event payload.
 * Prefers payload.title or payload.statement; falls back to a generic phrase.
 */
function deriveSummary(payload: string, eventType: string): string {
  try {
    const p = JSON.parse(payload);
    if (typeof p.title === 'string' && p.title.trim()) return p.title.trim();
    if (typeof p.statement === 'string' && p.statement.trim()) return p.statement.trim();
    if (typeof p.text === 'string' && p.text.trim()) {
      const snippet = p.text.trim().slice(0, 120);
      return snippet.length < p.text.trim().length ? snippet + '…' : snippet;
    }
    if (typeof p.summary === 'string' && p.summary.trim()) return p.summary.trim();
  } catch {
    // non-parsable payload
  }
  // Generic fallback per event type
  const fallbacks: Record<string, string> = {
    belief_candidate:        'A belief surfaced for examination',
    tension_candidate:       'An unresolved tension detected',
    pattern_candidate:       'A behavioral pattern observed',
    hypothesis_candidate:    'A hypothesis proposed for testing',
    constitutional_promotion:'A truth promoted to constitutional status',
    truth_revision:          'A foundational belief revised',
    experiment_completed:    'A lived experiment concluded',
    doctrine_crystallized:   'A working doctrine crystallized',
  };
  return fallbacks[eventType] ?? 'An epistemic event recorded';
}

// ─── GET /api/loop/feed ────────────────────────────────────────────────────────

router.get('/feed', (req: Request, res: Response) => {
  const user = authenticate(req, res);
  if (!user) return;

  const userId = String(user.userId);

  try {
    const rows = db
      .select()
      .from(epistemicEvents)
      .where(eq(epistemicEvents.userId, userId))
      .orderBy(desc(epistemicEvents.createdAt))
      .limit(20)
      .all();

    const feed = rows.map((r) => ({
      id:        r.id,
      sourceApp: r.sourceApp,
      eventType: r.eventType,
      summary:   deriveSummary(r.payload, r.eventType),
      createdAt: r.createdAt,
    }));

    return res.json(feed);
  } catch (err) {
    console.error('[loop/feed]', err);
    return res.status(500).json({ error: 'Failed to load feed.' });
  }
});

// ─── GET /api/loop/pulse ──────────────────────────────────────────────────────

router.get('/pulse', (req: Request, res: Response) => {
  const user = authenticate(req, res);
  if (!user) return;

  const userId = String(user.userId);

  try {
    // Seven-day window
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // All events in window
    const rows = db
      .select()
      .from(epistemicEvents)
      .where(
        sql`${epistemicEvents.userId} = ${userId} AND ${epistemicEvents.createdAt} >= ${sevenDaysAgo}`
      )
      .all();

    // byApp counts
    const byApp: Record<string, number> = { liminal: 0, parallax: 0, praxis: 0, axiom: 0 };
    for (const r of rows) {
      if (r.sourceApp in byApp) byApp[r.sourceApp]++;
    }

    // byDay counts — build a 7-entry array for the last 7 days (oldest first)
    const dayMap: Record<string, number> = {};
    for (const r of rows) {
      const day = r.createdAt.slice(0, 10); // "YYYY-MM-DD"
      dayMap[day] = (dayMap[day] ?? 0) + 1;
    }

    const byDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      byDay.push({ date: dateStr, count: dayMap[dateStr] ?? 0 });
    }

    return res.json({
      totalEvents: rows.length,
      byApp,
      byDay,
    });
  } catch (err) {
    console.error('[loop/pulse]', err);
    return res.status(500).json({ error: 'Failed to load pulse.' });
  }
});

// ─── GET /api/loop/state ──────────────────────────────────────────────────────

router.get('/state', (req: Request, res: Response) => {
  const user = authenticate(req, res);
  if (!user) return;

  const userId = String(user.userId);

  try {
    // Constitutional principles — axiom_statements that are stable/provisional and kind=truth_claim
    const axiomCount = (sqlite
      .prepare(
        `SELECT COUNT(*) as cnt FROM axiom_statements
         WHERE user_id = ? AND status NOT IN ('retired') AND kind = 'truth_claim'`
      )
      .get(userId) as { cnt: number } | undefined)?.cnt ?? 0;

    // Active tensions — axiom_statements with kind=tension and status not retired
    const tensionCount = (sqlite
      .prepare(
        `SELECT COUNT(*) as cnt FROM axiom_statements
         WHERE user_id = ? AND kind = 'tension' AND status NOT IN ('retired')`
      )
      .get(userId) as { cnt: number } | undefined)?.cnt ?? 0;

    // Live experiments — epistemic_candidates with candidate_type=hypothesis_candidate, status=testing
    // Also check for experiment_candidate events as a fallback
    const experimentCount = (sqlite
      .prepare(
        `SELECT COUNT(*) as cnt FROM epistemic_candidates
         WHERE user_id = ? AND candidate_type = 'hypothesis_candidate' AND status = 'testing'`
      )
      .get(userId) as { cnt: number } | undefined)?.cnt ?? 0;

    // Pending inquiries — prompt_queue items that are 'open'
    const pendingCount = (sqlite
      .prepare(
        `SELECT COUNT(*) as cnt FROM prompt_queue
         WHERE user_id = ? AND status = 'open'`
      )
      .get(userId) as { cnt: number } | undefined)?.cnt ?? 0;

    return res.json({
      axiomCount,
      tensionCount,
      experimentCount,
      pendingCount,
    });
  } catch (err) {
    console.error('[loop/state]', err);
    return res.status(500).json({ error: 'Failed to load state.' });
  }
});

export { router as loopRouter };
