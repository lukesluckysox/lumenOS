import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertAxiomSchema, insertTensionSchema, insertRevisionSchema } from "@shared/schema";
import type { Axiom, Tension, Revision, InsertAxiom } from "@shared/schema";
import { requireAuth, getUserId, verifyLumenToken } from "./auth";
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  emitConstitutionalPromotion,
  emitTruthRevision,
  emitTensionSurfaced,
} from "./lumenEmitter";

// ─── AI Provider abstraction ─────────────────────────────────────────────────
// Prefers ANTHROPIC_API_KEY; falls back to OPENAI_API_KEY.
// Returns null if neither is available.
interface AIResult { text: string }

async function aiComplete(opts: {
  system: string;
  user: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<AIResult | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Prefer Anthropic
  if (anthropicKey) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.65,
        system: opts.system,
        messages: [{ role: 'user', content: opts.jsonMode
          ? opts.user + '\n\nRespond with ONLY valid JSON — no markdown fences, no explanation.'
          : opts.user }],
      });
      const block = msg.content[0];
      return { text: block.type === 'text' ? block.text : '' };
    } catch (err: any) {
      console.error('[ai/anthropic]', err.message);
      // Fall through to OpenAI if available
      if (!openaiKey) throw err;
    }
  }

  // Fallback to OpenAI
  if (openaiKey) {
    const openai = new OpenAI({ apiKey: openaiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      temperature: opts.temperature ?? 0.65,
      max_tokens: opts.maxTokens || 1024,
    });
    return { text: completion.choices[0].message.content || '' };
  }

  return null; // no key configured
}

const ENRICHMENT_SYSTEM_PROMPT = `You are an epistemic synthesis engine inside a philosophical operating system called Axiom. You transform observed evidence about a person into truth claims that are specific, earned, and interpretively meaningful.

Given signal inputs (raw observations, patterns, or reflections), produce FIVE epistemically distinct layers. Each layer must be clearly different from the one before it — do not paraphrase or repeat.

SIGNAL: What is the core observable fact? Be specific — cite counts, patterns, concrete observations. Do not interpret yet. Identify what is genuinely there and worth noting.

CONVERGENCE: Why does this signal matter structurally? What about its frequency, cross-source consistency, or durability makes it more than noise? Where do multiple observations align meaningfully?

INTERPRETATION: What does this convergence reveal? Infer the underlying orientation, tendency, or principle. Go one level beyond the data — synthesize, don't describe. What does it mean that this pattern exists?

TRUTH CLAIM (1-2 sentences): The distilled epistemic claim. A specific, non-obvious insight proportional to the evidence. Not a platitude. If evidence is thin, express appropriate provisionality.

WORKING PRINCIPLE (1 sentence): How this truth should govern future action, judgment, or orientation. Phrase as an actionable rule. Example formats: "When X arises, treat it as Y." / "Before deciding Z, check whether..." / "Treat [pattern] as structural rather than situational unless..."

Return ONLY a valid JSON object with keys: signal, convergence, interpretation, truthClaim, workingPrinciple`;

const PREAMBLE_SYSTEM_PROMPT = `You are writing the preamble to a living personal constitution inside a philosophical operating system.

The preamble should be 3-5 sentences. It must:
- Synthesize the SPIRIT of the constitution — its core orientations, tensions, and conditions of formation
- Sound like a constitutional preface: earned, cumulative, serious, specific
- NOT list or enumerate the axioms — synthesize their spirit into coherent prose
- NOT sound like self-help, AI-generated inspiration, or vague profundity
- Use impersonal or document-voice ("This constitution...", "The principles here...")
- Note the provisional, revisable nature without making it sound weak

Return ONLY the preamble text — no JSON, no headers, no explanation.`;

function generateTemplatePreamble(axioms: Axiom[], tensions: Tension[], revisions: Revision[]): string {
  const high = axioms.filter(a => ['high', 'medium-high'].includes(a.confidence));
  const total = axioms.length;
  const tensionCount = tensions.length;
  const revCount = revisions.length;

  let p = `This constitution is assembled from ${total} truth claim${total !== 1 ? 's' : ''}, ${tensionCount} active tension${tensionCount !== 1 ? 's' : ''}, and ${revCount} recorded revision${revCount !== 1 ? 's' : ''}.`;

  if (high.length > 0) {
    const sample = high.slice(0, 2).map(a => `"${a.truthClaim.slice(0, 80)}${a.truthClaim.length > 80 ? '...' : ''}"`).join(' and ');
    p += ` Its high-confidence premises include ${sample}.`;
  }

  if (tensionCount > 0) {
    const t = tensions[0];
    p += ` The tension between ${t.poleA} and ${t.poleB} remains unresolved and continues to organize decisions this constitution cannot yet settle.`;
  }

  p += ' Each principle here is provisional, traceable to evidence, and open to revision. The constitution does not claim final certainty — it claims earned orientation.';
  return p;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ─── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── SSO Auth ────────────────────────────────────────────────────────────────
  app.get('/api/auth/sso', async (req: any, res: any) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).send('Missing token');
    try {
      const payload = verifyLumenToken(token);
      const lumenUserId = String(payload.userId);
      // Store in session
      req.session.userId = lumenUserId;
      req.session.username = payload.username;
      // Persist session before redirect
      req.session.save((err: unknown) => {
        if (err) console.error('[axiom/sso] session save error:', err);
        res.redirect('/#/');
      });
    } catch (err) {
      console.error('[axiom/sso] token error:', err);
      res.status(401).send('Invalid or expired token. Please re-enter from Lumen.');
    }
  });

  app.get('/api/auth/me', (req: any, res: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ userId: req.session.userId, username: req.session.username });
  });

  app.post('/api/auth/logout', (req: any, res: any) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // ─── Internal: push from Lumen epistemic queue ───────────────────────────────
  // Note: incoming axioms default to stage='proving_ground' via schema default.
  // They remain in the Proving Ground until the user Deepens or manually promotes them.
  app.post('/api/internal/from-lumen', (req: any, res: any) => {
    const token = req.headers['x-lumen-internal-token'];
    const expected = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';
    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      title,
      truthClaim,
      signal = '',
      convergence = '',
      interpretation = '',
      workingPrinciple = '',
      confidence = 'medium',
      confidenceScore = 50,
      counterevidence = '',
      revisionNote = '',
      revisionHistory = '[]',
      liminalCount = 0,
      parallaxCount = 0,
      praxisCount = 0,
      inputDescriptions = '[]',
      userId = '1',
    } = req.body as Record<string, any>;

    if (!truthClaim) {
      return res.status(400).json({ error: 'truthClaim is required' });
    }

    try {
      // Idempotent upsert: if an axiom with same title + source already exists, update it
      const existingAxioms = storage.getAxioms(String(userId));
      const existing = existingAxioms.find(a =>
        a.title === (title || truthClaim.slice(0, 200)) &&
        a.source === 'lumen_push'
      );

      if (existing) {
        const updated = storage.updateAxiom(existing.id, {
          truthClaim,
          signal,
          convergence,
          interpretation,
          workingPrinciple: existing.workingPrinciple || workingPrinciple, // preserve user edits
          confidence,
          confidenceScore: Number(confidenceScore),
          counterevidence: existing.counterevidence || counterevidence, // preserve user edits
          revisionNote: existing.revisionNote || revisionNote,
          liminalCount: Number(liminalCount),
          parallaxCount: Number(parallaxCount),
          praxisCount: Number(praxisCount),
          inputDescriptions: typeof inputDescriptions === 'string' ? inputDescriptions : JSON.stringify(inputDescriptions),
          source: 'lumen_push',
        } as any, String(userId));
        return res.json({ axiom: updated, action: 'updated' });
      }

      const axiom = storage.createAxiom(
        {
          title: title || truthClaim.slice(0, 200),
          truthClaim,
          signal,
          convergence,
          interpretation,
          workingPrinciple,
          confidence,
          confidenceScore: Number(confidenceScore),
          counterevidence,
          revisionNote,
          revisionHistory,
          liminalCount: Number(liminalCount),
          parallaxCount: Number(parallaxCount),
          praxisCount: Number(praxisCount),
          inputDescriptions,
          source: 'lumen_push',
        } as any,
        String(userId)
      );
      return res.status(201).json(axiom);
    } catch (err: any) {
      console.error('[axiom/internal/from-lumen]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Internal: push from Parallax behavioral pattern engine ────────────────
  // Receives archetypal patterns and cross-references with existing axioms.
  // Bumps confidence on corroborating axioms; creates tensions on contradictions.
  app.post('/api/internal/from-parallax', async (req: any, res: any) => {
    const token = req.headers['x-lumen-internal-token'];
    const expected = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';
    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      lumenUserId,
      patterns = [],
      archetypeShift = '',
      identityModes = [],
    } = req.body as {
      lumenUserId: string;
      patterns: Array<{ type: string; description: string; confidence: number; dimensions?: string[] }>;
      archetypeShift?: string;
      identityModes?: string[];
    };

    if (!lumenUserId) {
      return res.status(400).json({ error: 'lumenUserId is required' });
    }

    const userId = String(lumenUserId);

    try {
      const existingAxioms = storage.getAxioms(userId);
      let axiomsUpdated = 0;
      let tensionsCreated = 0;
      const processed = patterns.length;

      for (const pattern of patterns) {
        const { description, confidence, type } = pattern;
        if (!description) continue;

        const descLower = description.toLowerCase();

        // Check each existing axiom for alignment or contradiction
        for (const axiom of existingAxioms) {
          const claimLower = axiom.truthClaim.toLowerCase();
          const principLower = (axiom.workingPrinciple || '').toLowerCase();

          // Simple keyword overlap: share 2+ meaningful words (>4 chars)
          const patternWords = descLower.split(/\W+/).filter(w => w.length > 4);
          const axiomWords = (claimLower + ' ' + principLower).split(/\W+/).filter(w => w.length > 4);
          const overlap = patternWords.filter(w => axiomWords.includes(w));

          const isCorroborating = overlap.length >= 2;

          // Contradiction heuristic: pattern contains negation words paired with axiom keywords
          const negationPhrases = ['not ', 'never ', 'contra', 'opposite', 'against', "doesn't", 'cannot', 'undermine'];
          const hasNegation = negationPhrases.some(n => descLower.includes(n));
          const isContradicting = hasNegation && overlap.length >= 1;

          if (isContradicting && axiom.stage === 'proving_ground') {
            // Create a tension between the parallax pattern and the axiom
            const poleA = type || 'Parallax Pattern';
            const poleB = axiom.title.slice(0, 80);
            // Avoid duplicate tensions with same pole pair
            const existingTensions = storage.getTensions(userId);
            const duplicate = existingTensions.find(
              t => t.poleA === poleA && t.poleB === poleB
            );
            if (!duplicate) {
              storage.createTension({
                poleA,
                poleB,
                description: `Parallax pattern contradicts proposed axiom. Pattern: "${description.slice(0, 200)}". Axiom: "${axiom.truthClaim.slice(0, 200)}".`,
                evidence: JSON.stringify([`Parallax confidence: ${confidence}`, `Axiom confidence: ${axiom.confidence}`]),
                relatedAxiomIds: JSON.stringify([axiom.id]),
              }, userId);
              tensionsCreated++;
            }
          } else if (isCorroborating && confidence > 0.7 && axiom.stage === 'proving_ground') {
            // Bump confidence score by a small increment (cap at existing band ceiling)
            const currentScore = axiom.confidenceScore;
            // Map confidence label to ceiling for its band
            const bandCeilings: Record<string, number> = {
              low: 25,
              'medium-low': 45,
              medium: 65,
              'medium-high': 80,
              high: 100,
            };
            const ceiling = bandCeilings[axiom.confidence] ?? 100;
            const newScore = Math.min(currentScore + Math.round(confidence * 5), ceiling);
            if (newScore > currentScore) {
              storage.updateAxiom(axiom.id, {
                confidenceScore: newScore,
                // Track that parallax corroborated this
                inputDescriptions: (() => {
                  try {
                    const descs: string[] = JSON.parse(axiom.inputDescriptions || '[]');
                    descs.push(`Parallax: ${description.slice(0, 150)}`);
                    return JSON.stringify(descs);
                  } catch {
                    return axiom.inputDescriptions;
                  }
                })(),
                parallaxCount: (axiom.parallaxCount || 0) + 1,
              } as any, userId);
              axiomsUpdated++;
            }
          }
        }
      }

      return res.json({ processed, axiomsUpdated, tensionsCreated });
    } catch (err: any) {
      console.error('[axiom/internal/from-parallax]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Internal: constitution summary for Lumen feedback loop ──────────────────
  // Returns a structured snapshot of the user's constitution for Lumen/Liminal
  // to generate deeper, more targeted epistemic questions.
  app.get('/api/internal/constitution-summary', (req: any, res: any) => {
    const token = req.headers['x-lumen-internal-token'];
    const expected = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';
    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const lumenUserId = req.query.lumenUserId as string | undefined;
    if (!lumenUserId) {
      return res.status(400).json({ error: 'lumenUserId query param is required' });
    }

    const userId = String(lumenUserId);

    try {
      const allAxioms = storage.getAxioms(userId);
      const allTensions = storage.getTensions(userId);
      const allRevisions = storage.getRevisions(userId);
      const constitutionMeta = storage.getConstitutionMeta(userId);

      const constitutionalAxioms = allAxioms
        .filter(a => a.stage === 'constitutional')
        .map(a => ({
          id: a.id,
          truthClaim: a.truthClaim,
          workingPrinciple: a.workingPrinciple,
          confidence: a.confidence,
          confidenceScore: a.confidenceScore,
          counterevidence: a.counterevidence,
        }));

      const activeTensions = allTensions.map(t => ({
        id: t.id,
        poleA: t.poleA,
        poleB: t.poleB,
        description: t.description,
      }));

      const recentRevisions = allRevisions.slice(0, 5).map(r => ({
        id: r.id,
        date: r.date,
        previousBelief: r.previousBelief,
        newBelief: r.newBelief,
        significance: r.significance,
        triggeringEvidence: r.triggeringEvidence,
      }));

      return res.json({
        constitutionalAxioms,
        activeTensions,
        recentRevisions,
        preamble: constitutionMeta?.preamble || '',
      });
    } catch (err: any) {
      console.error('[axiom/internal/constitution-summary]', err);
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
      const axioms = storage.getAxioms(userId);
      const tensions = storage.getTensions(userId);
      return res.json({
        axiomCount: axioms.filter(a => a.stage === 'constitutional').length,
        tensionCount: tensions.length,
        proposalCount: axioms.filter(a => a.stage === 'proving_ground').length,
        totalAxioms: axioms.length,
      });
    } catch (err: any) {
      console.error('[axiom/internal/stats]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Internal: tensions for cross-app consumption (Praxis, etc.) ──────────
  app.get('/api/internal/tensions', (req: any, res: any) => {
    const token = req.headers['x-lumen-internal-token'];
    const expected = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '4gLtMuM38OkYGIpM1SCD+QQLgBPqgrKFB3aZeObkaqobhpeFOCV3NkAMW2dyOS17';
    if (!token || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const userId = (req.query.userId as string) || '1';
      const tensions = storage.getTensions(userId);
      return res.json(tensions);
    } catch (err: any) {
      console.error('[axiom/internal/tensions]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Auth guard for all /api/* except /api/auth/* and /api/health
  app.use('/api', (req: any, res: any, next: any) => {
    if (req.path.startsWith('/auth/') || req.path === '/health' || req.path.startsWith('/internal/')) return next();
    requireAuth(req, res, next);
  });

  // ─── Axioms ────────────────────────────────────────────────────────────────
  // ─── AI Enrichment ────────────────────────────────────────────────────────
  app.post('/api/axioms/:id/enrich', async (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const userId = getUserId(req);
    const axiom = storage.getAxiom(id, userId);
    if (!axiom) return res.status(404).json({ error: 'Axiom not found' });

    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'Enrichment is temporarily unavailable. Please try again later.', available: false });
    }

    try {
      const inputDescs: string[] = JSON.parse(axiom.inputDescriptions || '[]');
      const evidenceText = inputDescs.length > 0
        ? inputDescs.join('\n')
        : (axiom.signal || axiom.truthClaim || axiom.title);

      const userMsg = `Signal Inputs (raw evidence):\n${evidenceText}\n\nCurrent signal (may be shallow): ${axiom.signal || '(none)'}\nCurrent truth claim (may need deepening): ${axiom.truthClaim}\nConfidence level: ${axiom.confidence} (${axiom.confidenceScore}/100)`;

      const result = await aiComplete({
        system: ENRICHMENT_SYSTEM_PROMPT,
        user: userMsg,
        jsonMode: true,
        temperature: 0.65,
        maxTokens: 800,
      });

      if (!result) return res.status(503).json({ error: 'AI call failed' });

      const enriched = JSON.parse(result.text) as Partial<InsertAxiom>;
      const allowed = ['signal', 'convergence', 'interpretation', 'truthClaim', 'workingPrinciple'] as const;
      const update: Partial<InsertAxiom> = {};
      for (const key of allowed) {
        if (enriched[key] && typeof enriched[key] === 'string') {
          (update as any)[key] = (enriched[key] as string).trim();
        }
      }

      storage.updateAxiom(id, update, userId);
      // Deepen always promotes to constitutional
      storage.setAxiomStage(id, 'constitutional', userId);
      const final = storage.getAxiom(id, userId)!;
      res.json({ axiom: final, enriched: true, promoted: true });

      // Fire-and-forget: notify Lumen of constitutional promotion
      emitConstitutionalPromotion({
        lumenUserId: userId,
        axiomId: final.id,
        truthClaim: final.truthClaim,
        workingPrinciple: final.workingPrinciple,
        confidence: final.confidence,
        confidenceScore: final.confidenceScore,
        sourceCounts: {
          liminal: final.liminalCount,
          parallax: final.parallaxCount,
          praxis: final.praxisCount,
        },
      }).catch(() => { /* swallow — emitter logs internally */ });
    } catch (err: any) {
      console.error('[axiom/enrich]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Constitution preamble ────────────────────────────────────────────────
  app.get('/api/constitution/meta', (req: any, res: any) => {
    const userId = getUserId(req);
    const meta = storage.getConstitutionMeta(userId);
    res.json(meta || { preamble: '', updatedAt: null });
  });

  app.post('/api/constitution/preamble', async (req: any, res: any) => {
    const userId = getUserId(req);
    const axiomsList = storage.getAxioms(userId);
    const tensionsList = storage.getTensions(userId);
    const revisionsList = storage.getRevisions(userId);

    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      const preamble = generateTemplatePreamble(axiomsList, tensionsList, revisionsList);
      const meta = storage.upsertConstitutionMeta(userId, preamble);
      return res.json({ preamble: meta.preamble, aiPowered: false });
    }

    try {
      const claimsText = axiomsList
        .filter(a => ['high', 'medium-high', 'medium'].includes(a.confidence))
        .slice(0, 8)
        .map(a => `- [${a.confidence}] ${a.truthClaim}`)
        .join('\n');
      const tensionsText = tensionsList
        .slice(0, 4)
        .map(t => `- ${t.poleA} \u2194 ${t.poleB}: ${t.description}`)
        .join('\n');
      const revisionsText = revisionsList
        .filter(r => r.significance === 'major')
        .slice(0, 3)
        .map(r => `- Revised: "${r.previousBelief}" \u2192 "${r.newBelief}"`)
        .join('\n');

      const userMsg = `Truth claims:\n${claimsText || '(none yet)'}\n\nActive tensions:\n${tensionsText || '(none yet)'}\n\nMajor revisions:\n${revisionsText || '(none yet)'}\n\nTotal: ${axiomsList.length} claims, ${tensionsList.length} tensions, ${revisionsList.length} revisions.`;

      const result = await aiComplete({
        system: PREAMBLE_SYSTEM_PROMPT,
        user: userMsg,
        temperature: 0.7,
        maxTokens: 300,
      });

      const preamble = result?.text?.trim() || generateTemplatePreamble(axiomsList, tensionsList, revisionsList);
      const meta = storage.upsertConstitutionMeta(userId, preamble);
      res.json({ preamble: meta.preamble, aiPowered: !!result });
    } catch (err: any) {
      console.error('[constitution/preamble]', err);
      const preamble = generateTemplatePreamble(axiomsList, tensionsList, revisionsList);
      const meta = storage.upsertConstitutionMeta(userId, preamble);
      res.json({ preamble: meta.preamble, aiPowered: false });
    }
  });

  app.get("/api/axioms", (req: any, res: any) => {
    const userId = getUserId(req);
    const stage = req.query.stage as string | undefined;
    const all = storage.getAxioms(userId);
    if (stage) {
      res.json(all.filter((a: any) => a.stage === stage));
    } else {
      res.json(all);
    }
  });

  app.get("/api/axioms/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const axiom = storage.getAxiom(id, getUserId(req));
    if (!axiom) return res.status(404).json({ error: "Axiom not found" });
    res.json(axiom);
  });

  app.post("/api/axioms", (req: any, res: any) => {
    const parsed = insertAxiomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const axiom = storage.createAxiom(parsed.data, getUserId(req));
    res.status(201).json(axiom);
  });

  app.patch("/api/axioms/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const parsed = insertAxiomSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const axiom = storage.updateAxiom(id, parsed.data, getUserId(req));
    if (!axiom) return res.status(404).json({ error: "Axiom not found" });
    res.json(axiom);
  });

  app.delete("/api/axioms/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const deleted = storage.deleteAxiom(id, getUserId(req));
    if (!deleted) return res.status(404).json({ error: "Axiom not found" });
    res.status(204).send();
  });

  app.post('/api/axioms/:id/promote', (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const userId = getUserId(req);
    const axiom = storage.getAxiom(id, userId);
    if (!axiom) return res.status(404).json({ error: 'Axiom not found' });

    const { workingPrinciple } = req.body as { workingPrinciple?: string };
    if (!workingPrinciple || workingPrinciple.trim().length < 5) {
      return res.status(400).json({ error: 'A working principle is required for manual promotion.' });
    }

    // Build constitutional-format interpretation if missing
    const interpretation = axiom.interpretation && axiom.interpretation.length > 20
      ? axiom.interpretation
      : `Manually endorsed as a governing principle. The claim "${axiom.truthClaim.slice(0, 100)}" is treated as self-evident based on direct recognition rather than algorithmic synthesis.`;

    const convergence = axiom.convergence && axiom.convergence.length > 20
      ? axiom.convergence
      : `Promoted by direct endorsement — the user recognized this as a standing truth without requiring further analysis.`;

    const update: Partial<InsertAxiom> = {
      workingPrinciple: workingPrinciple.trim(),
      interpretation,
      convergence,
    };

    storage.updateAxiom(id, update, userId);
    storage.setAxiomStage(id, 'constitutional', userId);
    const final = storage.getAxiom(id, userId)!;
    res.json({ axiom: final, promoted: true, method: 'manual' });

    // Fire-and-forget: notify Lumen of constitutional promotion
    emitConstitutionalPromotion({
      lumenUserId: userId,
      axiomId: final.id,
      truthClaim: final.truthClaim,
      workingPrinciple: final.workingPrinciple,
      confidence: final.confidence,
      confidenceScore: final.confidenceScore,
      sourceCounts: {
        liminal: final.liminalCount,
        parallax: final.parallaxCount,
        praxis: final.praxisCount,
      },
    }).catch(() => { /* swallow — emitter logs internally */ });
  });

  // ─── Tensions ──────────────────────────────────────────────────────────────
  app.get("/api/tensions", (req: any, res: any) => {
    res.json(storage.getTensions(getUserId(req)));
  });

  app.get("/api/tensions/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const tension = storage.getTension(id, getUserId(req));
    if (!tension) return res.status(404).json({ error: "Tension not found" });
    res.json(tension);
  });

  app.post("/api/tensions", (req: any, res: any) => {
    const parsed = insertTensionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const userId = getUserId(req);
    const tension = storage.createTension(parsed.data, userId);
    res.status(201).json(tension);

    // Fire-and-forget: notify Lumen a new tension has been surfaced
    emitTensionSurfaced({
      lumenUserId: userId,
      poleA: tension.poleA,
      poleB: tension.poleB,
      description: tension.description,
    }).catch(() => { /* swallow — emitter logs internally */ });
  });

  app.patch("/api/tensions/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const parsed = insertTensionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const tension = storage.updateTension(id, parsed.data, getUserId(req));
    if (!tension) return res.status(404).json({ error: "Tension not found" });
    res.json(tension);
  });

  app.delete("/api/tensions/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const deleted = storage.deleteTension(id, getUserId(req));
    if (!deleted) return res.status(404).json({ error: "Tension not found" });
    res.status(204).send();
  });

  // ─── Revisions ─────────────────────────────────────────────────────────────
  app.get("/api/revisions", (req: any, res: any) => {
    res.json(storage.getRevisions(getUserId(req)));
  });

  app.post("/api/revisions", (req: any, res: any) => {
    const parsed = insertRevisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const userId = getUserId(req);
    const revision = storage.createRevision(parsed.data, userId);
    res.status(201).json(revision);

    // Fire-and-forget: notify Lumen of a truth revision
    emitTruthRevision({
      lumenUserId: userId,
      axiomId: revision.relatedAxiomId ?? 0,
      previousClaim: revision.previousBelief,
      newClaim: revision.newBelief,
      revisionNote: revision.triggeringEvidence || '',
      significance: revision.significance,
    }).catch(() => { /* swallow — emitter logs internally */ });
  });

  app.delete("/api/revisions/:id", (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const deleted = storage.deleteRevision(id, getUserId(req));
    if (!deleted) return res.status(404).json({ error: "Revision not found" });
    res.status(204).send();
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

  return httpServer;
}
