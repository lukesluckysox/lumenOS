import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  sqlite,
  epistemicEvents,
  epistemicCandidates,
  promptQueue,
} from '../db';
import type { EpistemicCandidate } from '../schema/epistemic';

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
    if (typeof p.description === 'string' && p.description.trim()) {
      const snippet = p.description.trim().slice(0, 120);
      return snippet.length < p.description.trim().length ? snippet + '…' : snippet;
    }
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

  // Client sends its IANA timezone via header; fall back to UTC
  const tz = (req.headers['x-timezone'] as string) || 'UTC';

  // Format a Date to "YYYY-MM-DD" in the user's local timezone
  function toLocalDateStr(date: Date): string {
    // Intl gives locale-independent ISO-like parts
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    return parts; // en-CA format is YYYY-MM-DD
  }

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

    // byDay counts — group each event by its local date in the user's timezone
    const dayMap: Record<string, number> = {};
    for (const r of rows) {
      const day = toLocalDateStr(new Date(r.createdAt));
      dayMap[day] = (dayMap[day] ?? 0) + 1;
    }

    // Build a 7-entry array for the last 7 days (oldest first), using local dates
    const byDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = toLocalDateStr(d);
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

// ─── GET /api/loop/promoted ──────────────────────────────────────────────────
// Returns recently promoted/advanced candidates with plain-language explanations.

function generateExplanation(candidate: EpistemicCandidate): string {
  const parts: string[] = [];

  // Why it was promoted — based on candidateType and scores
  if (candidate.candidateType === 'doctrine_candidate') {
    if (candidate.recurrenceScore >= 0.6) {
      parts.push('Repeated across multiple reflections');
    } else if (candidate.recurrenceScore >= 0.3) {
      parts.push('Appeared in more than one context');
    }
    if (candidate.confidence >= 0.7) {
      parts.push('high-confidence pattern');
    }
  }

  if (candidate.candidateType === 'tension_candidate') {
    parts.push('Identity discrepancy detected between stated beliefs and observed patterns');
  }

  if (candidate.candidateType === 'pattern_candidate') {
    parts.push('Behavioral pattern exceeded current sensitivity threshold');
  }

  if (candidate.candidateType === 'hypothesis_candidate') {
    parts.push('Testable hypothesis derived from observed patterns');
  }

  if (candidate.candidateType === 'identity_discrepancy') {
    parts.push('Inconsistency found between what you believe and how you behave');
  }

  if (candidate.candidateType === 'revision_candidate') {
    parts.push('Existing belief challenged by new evidence');
  }

  // Where it went
  if (candidate.status === 'queued_for_axiom') {
    parts.push('sent to Axiom for constitutional review');
  } else if (candidate.status === 'queued_for_praxis') {
    parts.push('sent to Praxis for experimental testing');
  } else if (candidate.status === 'accepted') {
    parts.push('accepted into the governing framework');
  } else if (candidate.status === 'testing') {
    parts.push('under active experimental testing');
  }

  // Source event count for depth
  try {
    const sourceIds = JSON.parse(candidate.sourceEventIds || '[]');
    if (sourceIds.length >= 3) {
      parts.push(`drawn from ${sourceIds.length} separate observations`);
    }
  } catch {}

  return parts.length > 0 ? parts.join(' — ') : 'Promoted based on accumulated evidence';
}

const PROMPT_EXPLANATIONS: Record<string, string> = {
  followup_question:   'A thread worth returning to — routed to Liminal for deeper inquiry',
  experiment_prompt:   'Pattern strong enough to test — sent to Praxis as an experiment seed',
  revision_prompt:     'Existing belief challenged — flagged for reconsideration',
  discrepancy_prompt:  'Gap between stated belief and behavior — surfaced for examination',
  counter_examination: 'Opposing perspective identified — sent for Socratic challenge',
  deliberation_prompt: 'A question requiring careful weighing — sent for deliberation',
  reckoning_prompt:    'A moment of reckoning surfaced — sent for honest confrontation',
  origin_prompt:       'Origin of a belief traced — sent for deeper excavation',
  examination_prompt:  'A claim worth examining — routed for structured inquiry',
  interpretation_prompt:'An observation needing interpretation — sent for meaning-making',
  accountability_prompt:'A commitment surfaced — sent for accountability tracking',
};

router.get('/promoted', (req: Request, res: Response) => {
  const user = authenticate(req, res);
  if (!user) return;

  const userId = String(user.userId);

  try {
    // Fetch promoted candidates (status != 'open'), ordered by updated_at DESC
    const candidates = db
      .select()
      .from(epistemicCandidates)
      .where(sql`${epistemicCandidates.userId} = ${userId} AND ${epistemicCandidates.status} != 'open'`)
      .orderBy(desc(epistemicCandidates.updatedAt))
      .limit(10)
      .all();

    // Fetch recent prompt_queue items
    const prompts = db
      .select()
      .from(promptQueue)
      .where(eq(promptQueue.userId, userId))
      .orderBy(desc(promptQueue.createdAt))
      .limit(5)
      .all();

    const promoted: any[] = [];

    for (const c of candidates) {
      promoted.push({
        id: c.id,
        type: 'candidate',
        candidateType: c.candidateType,
        title: c.title,
        summary: c.summary,
        status: c.status,
        targetApp: c.targetApp,
        explanation: generateExplanation(c),
        confidence: c.confidence,
        recurrenceScore: c.recurrenceScore,
        updatedAt: c.updatedAt,
      });
    }

    for (const p of prompts) {
      promoted.push({
        id: p.id,
        type: 'prompt',
        candidateType: p.promptType,
        title: p.title,
        summary: p.body,
        status: p.status,
        targetApp: p.destinationApp,
        explanation: PROMPT_EXPLANATIONS[p.promptType] || 'Routed for further inquiry',
        confidence: null,
        recurrenceScore: null,
        updatedAt: p.createdAt,
      });
    }

    // Sort all by updatedAt DESC, limit to 10
    promoted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const result = promoted.slice(0, 10);

    return res.json({ promoted: result });
  } catch (err) {
    console.error('[loop/promoted]', err);
    return res.status(500).json({ error: 'Failed to load promoted items.' });
  }
});

export { router as loopRouter };
