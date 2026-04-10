import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, users } from '../db';

const router = Router();

const JWT_SECRET  = process.env.JWT_SECRET || 'lumen-dev-secret-CHANGE-IN-PRODUCTION';
const COOKIE_NAME = 'lumen-session';
const ORACLE_EMAIL = (process.env.ORACLE_EMAIL || '').toLowerCase().trim();

const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || '';

const SUB_APPS = [
  { key: 'liminal',  label: 'Liminal',  url: process.env.LIMINAL_API_URL  || 'https://liminal-app.up.railway.app' },
  { key: 'parallax', label: 'Parallax', url: process.env.PARALLAX_API_URL || 'https://parallaxapp.up.railway.app' },
  { key: 'praxis',   label: 'Praxis',   url: process.env.PRAXIS_API_URL   || 'https://praxis-app.up.railway.app' },
  { key: 'axiom',    label: 'Axiom',    url: process.env.AXIOM_API_URL    || 'https://axiomtool-production.up.railway.app' },
];

interface AuthPayload { userId: number | string; username: string; }

function authenticate(req: Request): AuthPayload | null {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch { return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pingHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(`${url}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (r.ok) return true;
    // Fallback: some apps use /health instead
    const r2 = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return r2.ok;
  } catch { return false; }
}

async function fetchSubAppUsers(url: string): Promise<any[]> {
  if (!LUMEN_INTERNAL_TOKEN) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(`${url}/api/internal/users`, {
      headers: {
        'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (r.ok) {
      const data = await r.json() as any;
      return data.users || data || [];
    }
    console.error(`[oracle/fetchUsers] ${url} returned ${r.status}`);
    return [];
  } catch (err: any) {
    console.error(`[oracle/fetchUsers] ${url} error:`, err.message);
    return [];
  }
}

// ─── GET /api/oracle/users ──────────────────────────────────────────────────
// Owner-only: returns Lumen users, per-sub-app users, and health status

router.get('/users', async (req: Request, res: Response) => {
  const auth = authenticate(req);
  if (!auth) return res.status(401).json({ error: 'Not authenticated.' });

  // Check oracle access via email (not hardcoded username)
  const caller = db.select({ email: users.email, role: users.role }).from(users).where(eq(users.id, Number(auth.userId))).get();
  if (!caller || caller.role !== 'oracle' || (ORACLE_EMAIL && caller.email !== ORACLE_EMAIL)) {
    return res.status(403).json({ error: 'Oracle access is owner-only.' });
  }

  try {
    // Get all Lumen users (include plan + role)
    const allUsers = db.select({
      id:        users.id,
      username:  users.username,
      email:     users.email,
      plan:      users.plan,
      role:      users.role,
      createdAt: users.createdAt,
    }).from(users).all();

    // Parallel: ping health + fetch users for each sub-app
    const results = await Promise.all(SUB_APPS.map(async (app) => {
      const [online, appUsers] = await Promise.all([
        pingHealth(app.url),
        fetchSubAppUsers(app.url),
      ]);
      return { key: app.key, online, users: appUsers };
    }));

    // Build response shape the frontend expects
    const subAppStatus: Record<string, string> = {};
    const perApp: Record<string, any[]> = {};

    results.forEach(r => {
      subAppStatus[r.key] = r.online ? 'online' : 'offline';
      perApp[r.key] = r.users;
    });

    return res.json({
      lumen: allUsers.map(u => ({
        id:        u.id,
        username:  u.username,
        email:     u.email,
        plan:      u.plan || 'free',
        role:      u.role || 'user',
        createdAt: u.createdAt,
      })),
      subAppStatus,
      ...perApp,  // liminal: [...], parallax: [...], etc.
    });
  } catch (err) {
    console.error('[oracle]', err);
    return res.status(500).json({ error: 'Failed to load oracle data.' });
  }
});

// ─── Helper: Oracle auth guard ─────────────────────────────────────────────
function requireOracle(req: Request, res: Response): AuthPayload | null {
  const auth = authenticate(req);
  if (!auth) { res.status(401).json({ error: 'Not authenticated.' }); return null; }
  const caller = db.select({ email: users.email, role: users.role }).from(users).where(eq(users.id, Number(auth.userId))).get();
  if (!caller || caller.role !== 'oracle' || (ORACLE_EMAIL && caller.email !== ORACLE_EMAIL)) {
    res.status(403).json({ error: 'Oracle access is owner-only.' }); return null;
  }
  return auth;
}

// ─── PATCH /api/oracle/users/:id/plan ──────────────────────────────────────
// Oracle: change a user's plan (free/pro/founder) and sync to sub-apps

router.patch('/users/:id/plan', async (req: Request, res: Response) => {
  const auth = requireOracle(req, res);
  if (!auth) return;

  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid user id.' });

  const plan = req.body?.plan;
  if (!plan || !['free', 'pro', 'founder'].includes(plan)) {
    return res.status(400).json({ error: 'Plan must be free, pro, or founder.' });
  }

  try {
    const target = db.select({ id: users.id, email: users.email, username: users.username }).from(users).where(eq(users.id, targetId)).get();
    if (!target) return res.status(404).json({ error: 'User not found.' });

    db.update(users).set({ plan }).where(eq(users.id, targetId)).run();

    // Fire-and-forget: sync plan to sub-apps
    syncPlanToSubApps(target.username, target.email, plan);

    return res.json({ ok: true, plan });
  } catch (err) {
    console.error('[oracle/plan]', err);
    return res.status(500).json({ error: 'Failed to update plan.' });
  }
});

// ─── DELETE /api/oracle/users/:id ──────────────────────────────────────────
// Oracle: delete a user from Lumen and cascade to sub-apps

router.delete('/users/:id', async (req: Request, res: Response) => {
  const auth = requireOracle(req, res);
  if (!auth) return;

  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) return res.status(400).json({ error: 'Invalid user id.' });

  // Prevent self-deletion
  if (targetId === Number(auth.userId)) {
    return res.status(400).json({ error: 'Cannot delete your own account.' });
  }

  try {
    const target = db.select({ id: users.id, email: users.email, username: users.username }).from(users).where(eq(users.id, targetId)).get();
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Delete from Lumen
    db.delete(users).where(eq(users.id, targetId)).run();

    // Fire-and-forget: delete from sub-apps
    deleteFromSubApps(target.username, target.email);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[oracle/delete]', err);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// ─── DELETE /api/oracle/app/:app/user ─────────────────────────────────────
// Oracle: delete a user from a SINGLE sub-app only (not from Lumen)

router.delete('/app/:app/user', async (req: Request, res: Response) => {
  const auth = requireOracle(req, res);
  if (!auth) return;

  const appKey = req.params.app;
  const subApp = SUB_APPS.find(a => a.key === appKey);
  if (!subApp) return res.status(400).json({ error: 'Unknown app: ' + appKey });

  const { username, email } = req.body || {};
  if (!username && !email) return res.status(400).json({ error: 'username or email required.' });

  if (!LUMEN_INTERNAL_TOKEN) return res.status(500).json({ error: 'Internal token not configured.' });

  try {
    const r = await fetch(`${subApp.url}/api/internal/delete-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN },
      body: JSON.stringify({ username, email }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as any;
      return res.status(r.status).json({ error: body.error || `${subApp.label} returned ${r.status}` });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    console.error(`[oracle/app-delete] ${appKey}:`, err.message);
    return res.status(500).json({ error: 'Failed to delete user from ' + subApp.label });
  }
});

// ─── Sub-app sync helpers ──────────────────────────────────────────────────

function syncPlanToSubApps(username: string, email: string, plan: string): void {
  if (!LUMEN_INTERNAL_TOKEN) return;
  const payload = JSON.stringify({ username, email, plan });
  const headers = { 'Content-Type': 'application/json', 'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN };

  for (const app of SUB_APPS) {
    fetch(`${app.url}/api/internal/sync-plan`, {
      method: 'POST', headers, body: payload,
      signal: AbortSignal.timeout(5000),
    })
      .then(r => { if (!r.ok) console.error(`[sync-plan] ${app.key} failed:`, r.status); })
      .catch(e => console.error(`[sync-plan] ${app.key} error:`, e.message));
  }
}

function deleteFromSubApps(username: string, email: string): void {
  if (!LUMEN_INTERNAL_TOKEN) return;
  const payload = JSON.stringify({ username, email });
  const headers = { 'Content-Type': 'application/json', 'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN };

  for (const app of SUB_APPS) {
    fetch(`${app.url}/api/internal/delete-user`, {
      method: 'POST', headers, body: payload,
      signal: AbortSignal.timeout(5000),
    })
      .then(r => { if (!r.ok) console.error(`[delete-user] ${app.key} failed:`, r.status); })
      .catch(e => console.error(`[delete-user] ${app.key} error:`, e.message));
  }
}

export { router as oracleRouter };
