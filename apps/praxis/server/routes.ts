import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { requireAuth, getUserId, verifyLumenToken } from "./auth";
import { insertExperimentSchema, insertDoctrineSchema, insertTensionSchema } from "@shared/schema";
import { z } from "zod";
import { emitExperimentCompleted, emitDoctrineCrystallized, emitTensionDiscovered } from "./lumenEmitter";

export function registerRoutes(httpServer: Server, app: Express) {
  // ── Auth endpoints ──────────────────────────────────────────────────────

  app.get('/api/auth/sso', async (req: any, res: any) => {
    const { token } = req.query as { token?: string };
    if (!token) return res.status(400).json({ error: 'Missing token' });
    try {
      const payload = verifyLumenToken(token);
      const lumenUserId = String(payload.userId);
      req.session.userId = lumenUserId;
      req.session.username = payload.username;
      req.session.save((err: unknown) => {
        if (err) console.error('[praxis/sso] session save error:', err);
        res.redirect('/#/');
      });
    } catch (err) {
      console.error('[praxis/sso] token error:', err);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  app.get('/api/auth/me', (req: any, res: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ userId: req.session.userId, username: req.session.username });
  });

  app.post('/api/auth/logout', (req: any, res: any) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // ─── Internal: push from Parallax pattern detection ───────────────────────
  app.post('/api/internal/from-parallax', (req: any, res: any) => {
    const token = req.headers['x-lumen-internal-token'];
    const expected = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';
    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { lumenUserId = '1', patterns = [] } = req.body as {
      lumenUserId?: string;
      patterns?: Array<{
        type: string;
        description: string;
        dimensions?: string[];
        confidence: number;
      }>;
    };

    let experimentsCreated = 0;

    for (const pattern of patterns) {
      if (pattern.confidence <= 0.6) continue;

      let hypothesis: string;
      let design: string;

      if (pattern.type === 'trend') {
        const dimension = (pattern.dimensions && pattern.dimensions[0]) || 'relevant dimension';
        hypothesis = `If I counteract the trend in ${dimension}, my ${dimension} will shift`;
        design = `Identify the specific behavior driving the ${dimension} trend and deliberately introduce the opposite behavior for a defined period. Record what shifts.`;
      } else if (pattern.type === 'oscillation') {
        const dimension = (pattern.dimensions && pattern.dimensions[0]) || 'this area';
        hypothesis = `There is a specific trigger causing the oscillation in ${dimension}`;
        design = `Track the conditions before each oscillation in ${dimension} — time of day, social context, energy level, recent events. Look for the repeating variable.`;
      } else if (pattern.type === 'identity_discrepancy') {
        const dimension = (pattern.dimensions && pattern.dimensions[0]) || 'self-perception';
        hypothesis = `My stated identity in ${dimension} diverges from my revealed behavior`;
        design = `For one week, log each instance where your actions in ${dimension} align or conflict with how you describe yourself. Note the gap without judgment.`;
      } else {
        // Generic fallback for unknown pattern types
        hypothesis = pattern.description || `Investigating detected ${pattern.type} pattern`;
        design = `Observe and document this pattern in detail: ${pattern.description || pattern.type}. Note when it appears, under what conditions, and what it might reveal.`;
      }

      try {
        const trialNumber = storage.getNextTrialNumber(String(lumenUserId));
        const dimensions = (pattern.dimensions || []).join(', ') || 'your data';
        const sourceDescription = `A ${pattern.type.replace(/_/g, ' ')} pattern was detected in your ${dimensions} reflections.`;
        storage.createExperiment(
          {
            title: `Parallax: ${pattern.type.replace(/_/g, ' ')} — ${(pattern.dimensions || []).join(', ') || 'detected pattern'}`.slice(0, 200),
            trialNumber,
            status: 'proposed',
            source: 'parallax',
            hypothesis,
            design,
            experimentConstraint: '',
            observation: '',
            meaningExtraction: '',
            tags: '[]',
            sourceDescription,
          },
          String(lumenUserId)
        );
        experimentsCreated++;
      } catch (err: any) {
        console.error('[praxis/internal/from-parallax] createExperiment error:', err);
      }
    }

    return res.status(201).json({ experimentsCreated });
  });

  // ─── Internal: push from Lumen epistemic queue ───────────────────────────────
  app.post('/api/internal/from-lumen', (req: any, res: any) => {
    const token = req.headers['x-lumen-internal-token'];
    const expected = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';
    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      title,
      hypothesis,
      design = 'This experiment was suggested by patterns in your reflections. Shape it into something you can test.',
      source = 'lumen_push',
      experimentConstraint = '',
      observation = '',
      meaningExtraction = '',
      tags = '[]',
      userId = '1',
    } = req.body as Record<string, any>;

    if (!hypothesis) {
      return res.status(400).json({ error: 'hypothesis is required' });
    }

    try {
      const trialNumber = storage.getNextTrialNumber(String(userId));
      const experiment = storage.createExperiment(
        {
          title: title || hypothesis.slice(0, 200),
          trialNumber,
          status: 'proposed',
          source,
          hypothesis,
          design,
          experimentConstraint,
          observation,
          meaningExtraction,
          tags,
          sourceDescription: 'Suggested by your recent reflections.',
        },
        String(userId)
      );
      return res.status(201).json(experiment);
    } catch (err: any) {
      console.error('[praxis/internal/from-lumen]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Internal: stats for Lumen dashboard state cards ──────────────────────
  app.get('/api/internal/stats', (req: any, res: any) => {
    const token = req.headers['x-lumen-internal-token'];
    const expected = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';
    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const userId = (req.query.userId as string) || '1';
      const experiments = storage.getExperiments(userId);
      const doctrines = storage.getDoctrines(userId);
      const tensions = storage.getTensions(userId);
      return res.json({
        experimentCount: experiments.filter(e => e.status === 'active' || e.status === 'proposed').length,
        totalExperiments: experiments.length,
        doctrineCount: doctrines.length,
        tensionCount: tensions.length,
      });
    } catch (err: any) {
      console.error('[praxis/internal/stats]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Auth guard for all /api/* except /api/auth/* ─────────────────────────
  app.use('/api', (req: any, res: any, next: any) => {
    if (req.path.startsWith('/auth/') || req.path === '/health' || req.path.startsWith('/internal/')) return next();
    requireAuth(req, res, next);
  });

  // ── Experiments ────────────────────────────────────────────────────────

  app.get("/api/experiments", (req: any, res: any) => {
    res.json(storage.getExperiments(getUserId(req)));
  });

  app.get("/api/experiments/next-trial", (req: any, res: any) => {
    res.json({ trialNumber: storage.getNextTrialNumber(getUserId(req)) });
  });

  app.get("/api/experiments/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const experiment = storage.getExperiment(id, getUserId(req));
    if (!experiment) return res.status(404).json({ error: "Not found" });
    res.json(experiment);
  });

  app.post("/api/experiments", (req: any, res: any) => {
    const result = insertExperimentSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.flatten() });
    const experiment = storage.createExperiment(result.data, getUserId(req));
    res.status(201).json(experiment);
  });

  app.patch("/api/experiments/:id", async (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const partial = insertExperimentSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error.flatten() });
    const body = req.body as Record<string, unknown>;
    const extra: { completedAt?: number | null } = {};
    if ("completedAt" in body) extra.completedAt = body.completedAt as number | null;
    const updated = storage.updateExperiment(id, { ...partial.data, ...extra }, getUserId(req));
    if (!updated) return res.status(404).json({ error: "Not found" });
    // Fire-and-forget: emit to Lumen when experiment is marked completed with meaning extraction
    if (partial.data.status === "completed" && updated.meaningExtraction) {
      const lumenUserId = getUserId(req);
      emitExperimentCompleted({
        lumenUserId,
        experimentId: updated.id,
        hypothesis: updated.hypothesis,
        observation: updated.observation,
        meaningExtraction: updated.meaningExtraction,
      }).catch((e: unknown) => console.error('[praxis/emitExperimentCompleted]', e));
    }
    res.json(updated);
  });

  app.delete("/api/experiments/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    storage.deleteExperiment(id, getUserId(req));
    res.status(204).end();
  });

  // ── Doctrines ──────────────────────────────────────────────────────────

  app.get("/api/doctrines", (req: any, res: any) => {
    res.json(storage.getDoctrines(getUserId(req)));
  });

  app.get("/api/doctrines/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const doctrine = storage.getDoctrine(id, getUserId(req));
    if (!doctrine) return res.status(404).json({ error: "Not found" });
    res.json(doctrine);
  });

  app.post("/api/doctrines", (req: any, res: any) => {
    const result = insertDoctrineSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.flatten() });
    const doctrine = storage.createDoctrine(result.data, getUserId(req));
    // Fire-and-forget: emit to Lumen when a doctrine is crystallized
    const lumenUserId = getUserId(req);
    emitDoctrineCrystallized({
      lumenUserId,
      doctrineId: doctrine.id,
      title: doctrine.statement,
      description: doctrine.notes || doctrine.statement,
      certainty: doctrine.status,
    }).catch((e: unknown) => console.error('[praxis/emitDoctrineCrystallized]', e));
    res.status(201).json(doctrine);
  });

  app.patch("/api/doctrines/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const partial = insertDoctrineSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error.flatten() });
    const updated = storage.updateDoctrine(id, partial.data, getUserId(req));
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/doctrines/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    storage.deleteDoctrine(id, getUserId(req));
    res.status(204).end();
  });

  // ── Propose Doctrine to Axiom ──────────────────────────────────────────

  app.post("/api/propose-to-axiom", async (req: any, res: any) => {
    const { doctrineId } = req.body as { doctrineId: number };
    if (!doctrineId) return res.status(400).json({ error: "doctrineId is required" });

    const userId = getUserId(req);
    const doctrine = storage.getDoctrine(doctrineId, userId);
    if (!doctrine) return res.status(404).json({ error: "Doctrine not found" });

    const AXIOM_URL = process.env.AXIOM_TOOL_URL;
    const TOKEN = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET;
    if (!AXIOM_URL || !TOKEN) {
      return res.status(503).json({ error: "Axiom integration not configured" });
    }

    try {
      const axiomRes = await fetch(`${AXIOM_URL}/api/internal/from-lumen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lumen-internal-token": TOKEN,
        },
        body: JSON.stringify({
          truthClaim: doctrine.statement,
          title: doctrine.statement.slice(0, 200),
          source: "praxis",
          praxisCount: 1,
          userId,
        }),
      });

      if (!axiomRes.ok) {
        const errBody = await axiomRes.text();
        console.error("[praxis/propose-to-axiom] Axiom returned error:", axiomRes.status, errBody);
        return res.status(502).json({ error: "Axiom rejected the proposal" });
      }

      // Mark doctrine as proposed
      storage.updateDoctrine(doctrineId, { proposedToAxiom: true } as any, userId);

      const result = await axiomRes.json();
      return res.json({ ok: true, axiom: result });
    } catch (err: any) {
      console.error("[praxis/propose-to-axiom]", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Tensions ───────────────────────────────────────────────────────────

  app.get("/api/tensions", (req: any, res: any) => {
    res.json(storage.getTensions(getUserId(req)));
  });

  app.get("/api/tensions/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const tension = storage.getTension(id, getUserId(req));
    if (!tension) return res.status(404).json({ error: "Not found" });
    res.json(tension);
  });

  app.post("/api/tensions", (req: any, res: any) => {
    const result = insertTensionSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.flatten() });
    const tension = storage.createTension(result.data, getUserId(req));
    // Fire-and-forget: emit to Lumen when a tension is discovered
    const lumenUserId = getUserId(req);
    emitTensionDiscovered({
      lumenUserId,
      tensionId: tension.id,
      poleA: tension.poleA,
      poleB: tension.poleB,
      insight: tension.insight,
    }).catch((e: unknown) => console.error('[praxis/emitTensionDiscovered]', e));
    res.status(201).json(tension);
  });

  app.patch("/api/tensions/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const partial = insertTensionSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error.flatten() });
    const updated = storage.updateTension(id, partial.data, getUserId(req));
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/tensions/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    storage.deleteTension(id, getUserId(req));
    res.status(204).end();
  });

  // ─── Sensitivity proxy → Lumen ──────────────────────────────────────────────
  app.get('/api/settings/sensitivity', async (req: any, res: any) => {
    const LUMEN_API_URL = process.env.LUMEN_API_URL;
    const TOKEN = process.env.LUMEN_INTERNAL_TOKEN;
    const USER_ID = req.session?.userId || process.env.LUMEN_USER_ID || '1';
    if (!LUMEN_API_URL || !TOKEN) return res.json({ sensitivity: 'medium' });
    try {
      const r = await fetch(`${LUMEN_API_URL}/api/epistemic/sensitivity/${USER_ID}`, {
        headers: { 'x-lumen-internal-token': TOKEN },
      });
      if (!r.ok) return res.json({ sensitivity: 'medium' });
      const data = await r.json() as { sensitivity: string };
      return res.json(data);
    } catch {
      return res.json({ sensitivity: 'medium' });
    }
  });

  app.post('/api/settings/sensitivity', async (req: any, res: any) => {
    const LUMEN_API_URL = process.env.LUMEN_API_URL;
    const TOKEN = process.env.LUMEN_INTERNAL_TOKEN;
    const USER_ID = req.session?.userId || process.env.LUMEN_USER_ID || '1';
    const { sensitivity } = req.body as { sensitivity: string };
    if (!LUMEN_API_URL || !TOKEN) return res.json({ sensitivity: sensitivity || 'medium' });
    try {
      const r = await fetch(`${LUMEN_API_URL}/api/epistemic/sensitivity/${USER_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-lumen-internal-token': TOKEN },
        body: JSON.stringify({ sensitivity }),
      });
      if (!r.ok) return res.json({ sensitivity: sensitivity || 'medium' });
      const data = await r.json() as { sensitivity: string };
      return res.json(data);
    } catch {
      return res.json({ sensitivity: sensitivity || 'medium' });
    }
  });

  // ── Summary ────────────────────────────────────────────────────────────

  app.get("/api/summary", (req: any, res: any) => {
    const uid = getUserId(req);
    const allExperiments = storage.getExperiments(uid);
    const allDoctrines = storage.getDoctrines(uid);
    const allTensions = storage.getTensions(uid);
    res.json({
      experiments: {
        total: allExperiments.length,
        active: allExperiments.filter(e => e.status === "active").length,
        observing: allExperiments.filter(e => e.status === "observing").length,
        completed: allExperiments.filter(e => e.status === "completed").length,
      },
      doctrines: {
        total: allDoctrines.length,
        emerging: allDoctrines.filter(d => d.status === "emerging").length,
        established: allDoctrines.filter(d => d.status === "established").length,
      },
      tensions: {
        total: allTensions.length,
        primary: allTensions.find(t => t.isPrimary),
      },
    });
  });
}
