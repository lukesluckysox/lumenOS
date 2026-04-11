import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, users } from '../../db';
import { requireAuth } from './epistemicAuth';

const router = Router();

// ─── GET /sensitivity/:userId ────────────────────────────────────────────────────────

router.get('/sensitivity/:userId', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId } = req.params;

  try {
    const uid = parseInt(userId, 10);
    const user = db.select().from(users).where(eq(users.id, isNaN(uid) ? 0 : uid)).get();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ sensitivity: (user as Record<string, unknown>).sensitivity || 'medium' });
  } catch (err) {
    console.error('[epistemic/sensitivity/get]', err);
    return res.status(500).json({ error: 'Failed to get sensitivity.' });
  }
});

// ─── POST /sensitivity/:userId ────────────────────────────────────────────────────────

router.post('/sensitivity/:userId', (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { userId } = req.params;
  const { sensitivity } = req.body as { sensitivity: string };

  if (!['low', 'medium', 'high'].includes(sensitivity)) {
    return res.status(400).json({ error: 'sensitivity must be low, medium, or high.' });
  }

  try {
    const uid = parseInt(userId, 10);
    db.update(users)
      .set({ sensitivity } as Record<string, unknown>)
      .where(eq(users.id, isNaN(uid) ? 0 : uid))
      .run();
    return res.json({ sensitivity });
  } catch (err) {
    console.error('[epistemic/sensitivity/post]', err);
    return res.status(500).json({ error: 'Failed to update sensitivity.' });
  }
});

export { router as preferencesRouter };
