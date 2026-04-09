import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';

export interface LumenTokenPayload {
  userId: string | number;
  username: string;
  email?: string;
}

export function verifyLumenToken(token: string): LumenTokenPayload {
  return jwt.verify(token, JWT_SECRET) as LumenTokenPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sess = req.session as unknown as Record<string, unknown>;
  if (!sess.userId) {
    res.status(401).json({ error: 'Not authenticated. Please enter via Lumen.' });
    return;
  }
  next();
}

export function getUserId(req: Request): string {
  const sess = req.session as unknown as Record<string, unknown>;
  return String(sess.userId || '1');
}
