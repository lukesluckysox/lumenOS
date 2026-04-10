import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, or } from 'drizzle-orm';
import { db, users } from '../db';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'lumen-dev-secret-CHANGE-IN-PRODUCTION';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[auth] WARNING: JWT_SECRET env var not set — using dev fallback. SSO will fail if sub-apps use a different secret.');
}
const COOKIE_NAME   = 'lumen-session';
const COOKIE_MAXAGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Cross-app SSO link ─────────────────────────────────────────────────────
// After login/register, silently link the user to Parallax (and other sub-apps)
// so epistemic event emission works immediately.

const PARALLAX_API_URL     = process.env.PARALLAX_API_URL || 'https://parallaxapp.up.railway.app';
const LIMINAL_API_URL      = process.env.LIMINAL_API_URL  || 'https://liminal-app.up.railway.app';
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || '';

function linkSubApps(userId: number, username: string, email: string): void {
  if (!LUMEN_INTERNAL_TOKEN) return;

  // Fire-and-forget: link Parallax
  fetch(`${PARALLAX_API_URL}/api/internal/link-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
    },
    body: JSON.stringify({ username, lumenUserId: String(userId) }),
    signal: AbortSignal.timeout(5000),
  })
    .then(r => { if (!r.ok) console.error('[sso-link] Parallax link failed:', r.status); })
    .catch(e => console.error('[sso-link] Parallax link error:', e.message));

  // Fire-and-forget: link Liminal (endpoint may not exist yet — fails silently)
  fetch(`${LIMINAL_API_URL}/api/internal/link-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
    },
    body: JSON.stringify({ email, username, lumenUserId: String(userId) }),
    signal: AbortSignal.timeout(5000),
  })
    .then(r => { if (!r.ok) console.error('[sso-link] Liminal link failed:', r.status); })
    .catch(e => console.error('[sso-link] Liminal link error:', e.message));
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge:   COOKIE_MAXAGE,
  };
}

function signToken(userId: number, username: string) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '30d' });
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body ?? {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (typeof username !== 'string' || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const uname = username.trim().toLowerCase();
  const mail  = email.trim().toLowerCase();

  try {
    const existing = db
      .select()
      .from(users)
      .where(or(eq(users.email, mail), eq(users.username, uname)))
      .get();

    if (existing) {
      return res.status(409).json({ error: 'Email or username already in use.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db
      .insert(users)
      .values({ username: uname, email: mail, passwordHash, createdAt: new Date().toISOString() })
      .returning({ id: users.id, username: users.username })
      .get();

    const token = signToken(result.id, result.username);
    res.cookie(COOKIE_NAME, token, cookieOpts());

    // Link sub-apps (fire-and-forget)
    linkSubApps(result.id, result.username, mail);

    return res.status(201).json({ username: result.username });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Username or email and password are required.' });
  }

  try {
    const identifier = email.trim().toLowerCase();
    const user = db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
      .get();

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user.id, user.username);
    res.cookie(COOKIE_NAME, token, cookieOpts());

    // Link sub-apps (fire-and-forget)
    linkSubApps(user.id, user.username, user.email);

    return res.json({ username: user.username });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true });
});

// ─── GET /api/auth/sso-token ────────────────────────────────────────────────────
// Issues a short-lived (2 min) cross-app SSO token from an active Lumen session.
// Sub-apps call GET /api/auth/sso?token=<value> to exchange it for their own session.

router.get('/sso-token', (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };

    // Fetch the user's real email so sub-apps can look up existing accounts
    const user = db.select({ email: users.email }).from(users).where(eq(users.id, payload.userId)).get();

    const ssoToken = jwt.sign(
      { userId: payload.userId, username: payload.username, email: user?.email ?? null, sso: true },
      JWT_SECRET,
      { expiresIn: '2m' }
    );
    return res.json({ token: ssoToken });
  } catch {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    return res.json({ userId: payload.userId, username: payload.username });
  } catch {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
});

export { router as authRouter };
