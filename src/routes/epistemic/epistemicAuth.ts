import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lumen-dev-secret-CHANGE-IN-PRODUCTION';
const COOKIE_NAME = 'lumen-session';

export interface AuthPayload {
  userId: number | string; // number from JWT cookie, string from internal calls
  username: string;
}

export function authenticate(req: Request, res: Response): AuthPayload | null {
  // Check internal token for server-to-server calls
  const internalToken = req.headers['x-lumen-internal-token'] as string | undefined;
  if (internalToken) {
    const expectedToken = process.env.LUMEN_INTERNAL_TOKEN;
    if (!expectedToken) return null; // LUMEN_INTERNAL_TOKEN not configured — reject
    if (internalToken === expectedToken) {
      // For internal calls, userId may come from body or query
      const userId = (req.body?.userId || req.query?.userId || 'system') as string;
      return { userId, username: 'internal' };
    }
    return null; // token provided but wrong
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

export function requireAuth(req: Request, res: Response): AuthPayload | null {
  const auth = authenticate(req, res);
  if (!auth) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }
  return auth;
}

export function requireInternalToken(req: Request, res: Response, next: () => void): void {
  const expectedToken = process.env.LUMEN_INTERNAL_TOKEN;
  if (!expectedToken) {
    // Fail loudly: internal token not configured on this instance
    res.status(503).json({ error: 'Internal token not configured.' });
    return;
  }
  const token = (req.headers as Record<string, string>)['x-lumen-internal-token'];
  if (!token || token !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
