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
  return fallbacks[eventType] ?? 'A moment of inquiry noted';
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
// Fetches live counts from sub-apps so the dashboard accurately reflects
// the real state of Axiom, Praxis, and Liminal — not local queue tallies.

const AXIOM_API_URL   = process.env.AXIOM_API_URL   || 'https://axiomtool-production.up.railway.app';
const PRAXIS_API_URL  = process.env.PRAXIS_API_URL  || 'https://praxis-app.up.railway.app';
const LIMINAL_API_URL = process.env.LIMINAL_API_URL || 'https://liminal-app.up.railway.app';
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || '';

async function fetchAppStats(url: string): Promise<Record<string, number>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { 'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return {};
    return await res.json() as Record<string, number>;
  } catch {
    return {};
  }
}

router.get('/state', async (req: Request, res: Response) => {
  const user = authenticate(req, res);
  if (!user) return;

  try {
    // Fetch live counts from all three apps in parallel
    const uid = String(user.userId);
    const [axiomStats, praxisStats, liminalStats] = await Promise.all([
      fetchAppStats(`${AXIOM_API_URL}/api/internal/stats?userId=${uid}`),
      fetchAppStats(`${PRAXIS_API_URL}/api/internal/stats?userId=${uid}`),
      fetchAppStats(`${LIMINAL_API_URL}/api/internal/stats?userId=${uid}`),
    ]);

    return res.json({
      axiomCount:      axiomStats.axiomCount ?? 0,
      tensionCount:    axiomStats.tensionCount ?? 0,
      experimentCount: praxisStats.experimentCount ?? 0,
      pendingCount:    liminalStats.pendingSeeds ?? 0,
    });
  } catch (err) {
    console.error('[loop/state]', err);
    return res.status(500).json({ error: 'Failed to load state.' });
  }
});

// ─── GET /api/loop/health ────────────────────────────────────────────────────
// Diagnostic endpoint: verifies connectivity to all sub-apps,
// checks token configuration, and reports the Loop's operational status.

router.get('/health', async (req: Request, res: Response) => {
  const user = authenticate(req, res);
  if (!user) return;

  const checks: Record<string, { status: string; detail?: string; latencyMs?: number }> = {};

  // 1. Check JWT_SECRET is not the dev fallback
  const jwtOk = !!process.env.JWT_SECRET && process.env.JWT_SECRET !== 'lumen-dev-secret-CHANGE-IN-PRODUCTION';
  checks.jwtSecret = {
    status: jwtOk ? 'ok' : 'warning',
    detail: jwtOk ? 'Production secret configured' : 'Using dev fallback — SSO may fail with sub-apps',
  };

  // 2. Check LUMEN_INTERNAL_TOKEN is set
  const tokenOk = !!process.env.LUMEN_INTERNAL_TOKEN && process.env.LUMEN_INTERNAL_TOKEN !== 'your-shared-internal-token';
  checks.internalToken = {
    status: tokenOk ? 'ok' : 'error',
    detail: tokenOk ? 'Token configured' : 'LUMEN_INTERNAL_TOKEN not set — Loop events will silently fail',
  };

  // 3. Check sub-app URLs are configured
  checks.subAppUrls = {
    status: (AXIOM_API_URL && PRAXIS_API_URL && LIMINAL_API_URL) ? 'ok' : 'warning',
    detail: [
      AXIOM_API_URL ? null : 'AXIOM_API_URL missing',
      PRAXIS_API_URL ? null : 'PRAXIS_API_URL missing',
      LIMINAL_API_URL ? null : 'LIMINAL_API_URL missing',
    ].filter(Boolean).join(', ') || 'All sub-app URLs configured',
  };

  // 4. Ping each sub-app's stats endpoint
  async function pingApp(name: string, url: string): Promise<void> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(`${url}/api/internal/stats?userId=${user!.userId}`, {
        headers: { 'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      if (r.ok) {
        const data = await r.json();
        checks[name] = { status: 'ok', detail: JSON.stringify(data), latencyMs };
      } else {
        checks[name] = { status: 'error', detail: `HTTP ${r.status}`, latencyMs };
      }
    } catch (e: any) {
      checks[name] = { status: 'error', detail: e.name === 'AbortError' ? 'Timeout (5s)' : e.message, latencyMs: Date.now() - start };
    }
  }

  await Promise.all([
    pingApp('axiom', AXIOM_API_URL),
    pingApp('praxis', PRAXIS_API_URL),
    pingApp('liminal', LIMINAL_API_URL),
  ]);

  // 5. Check local event data
  try {
    const row = sqlite.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 ELSE 0 END) as last24h
       FROM epistemic_events WHERE user_id = ?`
    ).get(String(user.userId)) as { total: number; last24h: number };
    checks.localEvents = {
      status: 'ok',
      detail: `${row.total} total events, ${row.last24h} in last 24h`,
    };
  } catch (e: any) {
    checks.localEvents = { status: 'error', detail: e.message };
  }

  // 6. Check queue for stuck candidates
  try {
    const stuckRow = sqlite.prepare(
      `SELECT COUNT(*) as count FROM epistemic_candidates
       WHERE user_id = ? AND status = 'open'
       AND updated_at < datetime('now', '-1 hour')`
    ).get(String(user.userId)) as { count: number };
    checks.stuckCandidates = {
      status: stuckRow.count > 0 ? 'warning' : 'ok',
      detail: stuckRow.count > 0 ? `${stuckRow.count} candidates stuck in 'open' for >1 hour` : 'No stuck candidates',
    };
  } catch (e: any) {
    checks.stuckCandidates = { status: 'error', detail: e.message };
  }

  const overallStatus = Object.values(checks).some(c => c.status === 'error') ? 'degraded'
    : Object.values(checks).some(c => c.status === 'warning') ? 'warning'
    : 'healthy';

  return res.json({ status: overallStatus, checks });
});

export { router as loopRouter };
