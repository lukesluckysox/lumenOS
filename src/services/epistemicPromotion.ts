import crypto from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import {
  db,
  users,
  epistemicEvents,
  epistemicCandidates,
  axiomStatements,
  axiomProvenance,
  watchRules,
  promptQueue,
} from '../db';
import { distillText } from '../services/distillText.js';
import { transformVoice, transformForAxiom } from '../services/voiceTransform.js';
import { routeToLiminalTool, toolToPromptType } from '../services/liminalRouter.js';

type EpistemicEvent = typeof epistemicEvents.$inferSelect;
type AxiomStatement = typeof axiomStatements.$inferSelect;

function uid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

// ─── Sensitivity Thresholds ──────────────────────────────────────────────────

type Sensitivity = 'low' | 'medium' | 'high';

interface SensitivityThresholds {
  beliefSimilarMin: number;  // min similar events before promoting belief candidate
  patternFreq: number;       // min frequency for Parallax pattern candidates
  patternCtx: number;        // min context days for Parallax pattern candidates
  patternConf: number;       // min confidence for Parallax pattern candidates
  tensionConf: number;       // min confidence for tension candidates
  hypothesisConf: number;    // min confidence for hypothesis candidates
}

const SENSITIVITY_THRESHOLDS: Record<Sensitivity, SensitivityThresholds> = {
  low:    { beliefSimilarMin: 0, patternFreq: 2, patternCtx: 1, patternConf: 0.2, tensionConf: 0.1, hypothesisConf: 0.2 },
  medium: { beliefSimilarMin: 1, patternFreq: 3, patternCtx: 2, patternConf: 0.3, tensionConf: 0.3, hypothesisConf: 0.3 },
  high:   { beliefSimilarMin: 2, patternFreq: 5, patternCtx: 3, patternConf: 0.7, tensionConf: 0.5, hypothesisConf: 0.5 },
};

function getUserSensitivity(userId: string): SensitivityThresholds {
  try {
    const uid = parseInt(userId, 10);
    const user = db.select().from(users).where(eq(users.id, isNaN(uid) ? 0 : uid)).get();
    const s = ((user as Record<string, unknown>)?.sensitivity as Sensitivity) || 'medium';
    return SENSITIVITY_THRESHOLDS[s] ?? SENSITIVITY_THRESHOLDS.medium;
  } catch {
    return SENSITIVITY_THRESHOLDS.medium;
  }
}

// ─── processEvent ────────────────────────────────────────────────────────────
// Called after every event insert. Applies threshold logic and auto-promotes
// to candidates + queue items.

export async function processEvent(event: EpistemicEvent): Promise<void> {
  // Seeded records must never be re-promoted as newly discovered
  if (event.seeded) return;

  switch (event.sourceApp) {
    case 'liminal':
      await processLiminalEvent(event);
      break;
    case 'parallax':
      await processParallaxEvent(event);
      break;
    case 'praxis':
      await processPraxisEvent(event);
      break;
    case 'axiom':
      // Axiom events are typically seeded or direct statements — no auto-promotion
      break;
  }
}

// ─── Liminal thresholds ──────────────────────────────────────────────────────

async function processLiminalEvent(event: EpistemicEvent): Promise<void> {
  switch (event.eventType) {
    case 'belief_candidate': {
      // If 2+ semantically similar events from same user → create/update doctrine_candidate
      const similar = db
        .select()
        .from(epistemicEvents)
        .where(
          and(
            eq(epistemicEvents.userId, event.userId),
            eq(epistemicEvents.sourceApp, 'liminal'),
            eq(epistemicEvents.eventType, 'belief_candidate')
          )
        )
        .all();

      const semanticallyRelated = similar.filter((e) => {
        if (e.id === event.id) return false;
        // Same domain
        if (event.domain && e.domain === event.domain) return true;
        // Tag overlap >= 1
        const eventTags: string[] = safeParse(event.tags, []);
        const eTags: string[] = safeParse(e.tags, []);
        if (eventTags.some((t) => eTags.includes(t)) && eventTags.length > 0) return true;
        return false;
      });

      const thresh = getUserSensitivity(event.userId);
      if (semanticallyRelated.length >= thresh.beliefSimilarMin) {
        // 2+ total (current + 1 similar)
        const allEventIds = [event.id, ...semanticallyRelated.map((e) => e.id)];
        const recurrenceScore = Math.min(allEventIds.length / 5, 1.0);
        const payload = safeParse(event.payload, {});
        const title = (payload as Record<string, string>).summary || (payload as Record<string, string>).text || `Recurring belief pattern`;
        const originMode = event.ingestionMode === 'backfill' ? 'historical_derivation' as const : 'live' as const;

        await createCandidate({
          userId: event.userId,
          candidateType: 'doctrine_candidate',
          title,
          summary: `A recurring theme across ${allEventIds.length} reflections`,
          status: 'queued_for_axiom',
          targetApp: 'axiom',
          confidence: event.confidence,
          recurrenceScore,
          sourceEventIds: allEventIds,
          originMode,
          seeded: false,
        });
      }
      break;
    }
    case 'tension_candidate': {
      const tThresh = getUserSensitivity(event.userId);
      if (event.confidence >= tThresh.tensionConf) {
        const payload = safeParse(event.payload, {}) as Record<string, string>;
        await createCandidate({
          userId: event.userId,
          candidateType: 'tension_candidate',
          title: payload.summary || 'Tension detected',
          summary: payload.text || 'A tension was noticed in your writing',
          status: 'open',
          targetApp: 'axiom',
          confidence: event.confidence,
          sourceEventIds: [event.id],
          originMode: event.ingestionMode === 'backfill' ? 'historical_derivation' : 'live',
          seeded: false,
        });
      }
      break;
    }
    case 'hypothesis_candidate': {
      const payload = safeParse(event.payload, {}) as Record<string, unknown>;
      const hThresh = getUserSensitivity(event.userId);
      if (payload.causalStructure || event.confidence >= hThresh.hypothesisConf) {
        await createCandidate({
          userId: event.userId,
          candidateType: 'hypothesis_candidate',
          title: (payload.summary as string) || 'Hypothesis from reflection',
          summary: (payload.text as string) || 'A hypothesis was formed from journal analysis',
          status: 'queued_for_praxis',
          targetApp: 'praxis',
          confidence: event.confidence,
          sourceEventIds: [event.id],
          originMode: event.ingestionMode === 'backfill' ? 'historical_derivation' : 'live',
          seeded: false,
        });
      }
      break;
    }
  }
}

// ─── Parallax thresholds ─────────────────────────────────────────────────────

async function processParallaxEvent(event: EpistemicEvent): Promise<void> {
  const payload = safeParse(event.payload, {}) as Record<string, unknown>;

  switch (event.eventType) {
    case 'pattern_candidate': {
      const freq = typeof payload.frequency === 'number' ? payload.frequency : 0;
      const ctxCount = typeof payload.contextCount === 'number' ? payload.contextCount : 0;
      const pThresh = getUserSensitivity(event.userId);
      if (freq >= pThresh.patternFreq && ctxCount >= pThresh.patternCtx && event.confidence >= pThresh.patternConf) {
        await createCandidate({
          userId: event.userId,
          candidateType: 'doctrine_candidate',
          title: (payload.summary as string) || 'Behavioral pattern detected',
          summary: (payload.text as string) || `Pattern observed ${freq} times across ${ctxCount} contexts`,
          status: 'queued_for_axiom',
          targetApp: 'axiom',
          confidence: event.confidence,
          sourceEventIds: [event.id],
          originMode: event.ingestionMode === 'backfill' ? 'historical_derivation' : 'live',
          seeded: false,
        });
      }
      break;
    }
    case 'identity_discrepancy': {
      // Raw text from Parallax is in "you" voice — convert to first-person for Liminal
      const rawSummary = (payload.summary as string) || 'A gap was detected between stated values and observed behavior.';
      const rawBody    = (payload.text as string)    || rawSummary;

      // Transform to first-person "I" voice for the user-facing seed
      const seedText = transformVoice(distillText(rawBody), {
        sourceApp: 'parallax',
        destinationApp: 'liminal',
        layer: 'user_facing',
      });

      // Route to the best Liminal tool based on content
      const routing = routeToLiminalTool({
        text: seedText,
        sourceApp: 'parallax',
        sourceEventType: 'identity_discrepancy',
        candidateType: 'identity_discrepancy',
      });

      db.insert(promptQueue)
        .values({
          id: uid(),
          userId: event.userId,
          destinationApp: 'liminal',
          promptType: toolToPromptType(routing.tool),
          title: distillText(rawSummary).slice(0, 120),
          body: seedText,
          relatedCandidateId: null,
          priority: 80,
          status: 'open',
          seeded: false,
          createdAt: now(),
        })
        .run();
      break;
    }
    case 'hypothesis_candidate': {
      await createCandidate({
        userId: event.userId,
        candidateType: 'hypothesis_candidate',
        title: (payload.summary as string) || 'Hypothesis from tracking',
        summary: (payload.text as string) || 'A hypothesis was formed from observed patterns',
        status: 'queued_for_praxis',
        targetApp: 'praxis',
        confidence: event.confidence,
        sourceEventIds: [event.id],
        originMode: event.ingestionMode === 'backfill' ? 'historical_derivation' : 'live',
        seeded: false,
      });
      break;
    }
  }
}

// ─── Praxis thresholds ───────────────────────────────────────────────────────

async function processPraxisEvent(event: EpistemicEvent): Promise<void> {
  const payload = safeParse(event.payload, {}) as Record<string, unknown>;

  switch (event.eventType) {
    case 'experiment_result': {
      if (payload.signal === 'strong' || payload.replicated === true) {
        const candidateType = payload.revisionTarget ? 'revision_candidate' : 'doctrine_candidate';
        await createCandidate({
          userId: event.userId,
          candidateType,
          title: (payload.summary as string) || 'Experiment result confirmed',
          summary: (payload.text as string) || 'Strong experimental evidence supports this finding',
          status: 'queued_for_axiom',
          targetApp: 'axiom',
          confidence: event.confidence,
          sourceEventIds: [event.id],
          originMode: 'live',
          seeded: false,
        });
      }
      break;
    }
    case 'revision_candidate': {
      await createCandidate({
        userId: event.userId,
        candidateType: 'revision_candidate',
        title: (payload.summary as string) || 'Revision proposal',
        summary: (payload.text as string) || 'A revision to an existing belief has been proposed',
        status: 'queued_for_axiom',
        targetApp: 'axiom',
        confidence: event.confidence,
        sourceEventIds: [event.id],
        originMode: 'live',
        seeded: false,
      });
      break;
    }
  }
}

// ─── Helper: Create candidate ────────────────────────────────────────────────

interface CreateCandidateParams {
  userId: string;
  candidateType: typeof epistemicCandidates.$inferInsert['candidateType'];
  title: string;
  summary: string;
  status: typeof epistemicCandidates.$inferInsert['status'];
  targetApp: typeof epistemicCandidates.$inferInsert['targetApp'];
  confidence: number;
  recurrenceScore?: number;
  sourceEventIds: string[];
  originMode: typeof epistemicCandidates.$inferInsert['originMode'];
  seeded: boolean;
}

async function createCandidate(params: CreateCandidateParams): Promise<void> {
  // ── Idempotency: if a candidate with the same title+type+user already exists,
  //    update it instead of creating a duplicate. This makes reprocess safe.
  const existing = db
    .select()
    .from(epistemicCandidates)
    .where(
      and(
        eq(epistemicCandidates.userId, params.userId),
        eq(epistemicCandidates.candidateType, params.candidateType),
        eq(epistemicCandidates.title, params.title)
      )
    )
    .get();

  if (existing) {
    // If already accepted/pushed, don't regress status — just update confidence & events
    const newStatus = existing.status === 'accepted' ? 'accepted' : params.status;
    db.update(epistemicCandidates)
      .set({
        summary: params.summary,
        confidence: params.confidence,
        recurrenceScore: params.recurrenceScore ?? existing.recurrenceScore,
        sourceEventIds: JSON.stringify(params.sourceEventIds),
        status: newStatus,
        updatedAt: now(),
      })
      .where(eq(epistemicCandidates.id, existing.id))
      .run();

    // Re-queue only if status was re-opened (not if already accepted)
    if (newStatus !== 'accepted') {
      if (newStatus === 'queued_for_axiom') createAxiomQueueItem(existing);
      else if (newStatus === 'queued_for_praxis') createPraxisQueueItem(existing, 'Revisiting for fresh perspective');
    }
    return;
  }

  const candidate = db
    .insert(epistemicCandidates)
    .values({
      id: uid(),
      userId: params.userId,
      candidateType: params.candidateType,
      title: params.title,
      summary: params.summary,
      status: params.status,
      targetApp: params.targetApp,
      confidence: params.confidence,
      recurrenceScore: params.recurrenceScore ?? 0,
      sourceEventIds: JSON.stringify(params.sourceEventIds),
      originMode: params.originMode,
      seeded: params.seeded,
      createdAt: now(),
      updatedAt: now(),
    })
    .returning()
    .get();

  // Auto-queue based on status
  if (candidate.status === 'queued_for_axiom') {
    createAxiomQueueItem(candidate);
  } else if (candidate.status === 'queued_for_praxis') {
    createPraxisQueueItem(candidate, 'Emerged from recent inquiry');
  }
}

// ─── Auto-queuing helpers ────────────────────────────────────────────────────

function createAxiomQueueItem(candidate: typeof epistemicCandidates.$inferSelect): void {
  // Convert candidate summary to first-person "I" voice for Liminal
  const rawBody = candidate.summary || candidate.title;
  const seedText = transformVoice(distillText(rawBody), {
    sourceApp: candidate.candidateType?.includes('liminal') ? 'liminal' : 'parallax',
    destinationApp: 'liminal',
    layer: 'user_facing',
  });

  // Route to the most appropriate Liminal tool
  const routing = routeToLiminalTool({
    text: seedText,
    sourceApp: 'axiom',
    candidateType: candidate.candidateType,
  });

  db.insert(promptQueue)
    .values({
      id: uid(),
      userId: candidate.userId,
      destinationApp: 'liminal',
      promptType: toolToPromptType(routing.tool),
      title: distillText(candidate.title).slice(0, 120),
      body: seedText,
      relatedCandidateId: candidate.id,
      priority: 60,
      status: 'open',
      seeded: candidate.seeded,
      createdAt: now(),
    })
    .run();
}

export function createPraxisQueueItem(candidate: typeof epistemicCandidates.$inferSelect, note: string): void {
  db.insert(promptQueue)
    .values({
      id: uid(),
      userId: candidate.userId,
      destinationApp: 'praxis',
      promptType: 'experiment_prompt',
      title: candidate.title,
      body: note || `Design an experiment to test: "${candidate.summary}"`,
      relatedCandidateId: candidate.id,
      priority: 50,
      status: 'open',
      seeded: candidate.seeded,
      createdAt: now(),
    })
    .run();
}

export function createWatchRules(axiom: AxiomStatement): void {
  // Create Parallax watch rule for pattern monitoring
  db.insert(watchRules)
    .values({
      id: uid(),
      userId: axiom.userId,
      createdBy: 'axiom',
      targetApp: 'parallax',
      ruleType: 'pattern_watch',
      label: `Watch: ${axiom.statement.slice(0, 50)}`,
      description: `Monitor behavioral patterns related to axiom: "${axiom.statement}"`,
      ruleJson: JSON.stringify({ axiomId: axiom.id, kind: axiom.kind }),
      active: true,
      seeded: axiom.seeded,
      createdAt: now(),
    })
    .run();

  // Create Liminal watch rule for contradiction monitoring
  db.insert(watchRules)
    .values({
      id: uid(),
      userId: axiom.userId,
      createdBy: 'axiom',
      targetApp: 'liminal',
      ruleType: 'contradiction_watch',
      label: `Contradiction watch: ${axiom.statement.slice(0, 40)}`,
      description: `Watch for journal entries that contradict axiom: "${axiom.statement}"`,
      ruleJson: JSON.stringify({ axiomId: axiom.id, kind: axiom.kind }),
      active: true,
      seeded: axiom.seeded,
      createdAt: now(),
    })
    .run();
}

export function createLiminalRevisionPrompts(axiom: AxiomStatement): void {
  // Axiom statements are already first-person ("I …") — just distill tool names
  const rawStatement = axiom.statement;
  const seedText = transformVoice(distillText(
    `A truth has taken shape: "${rawStatement}". Consider how this shows up in lived experience.`
  ), {
    sourceApp: 'axiom',
    destinationApp: 'liminal',
    layer: 'user_facing',
  });

  // Route based on the axiom content
  const routing = routeToLiminalTool({
    text: rawStatement,
    sourceApp: 'axiom',
    sourceEventType: 'constitutional_promotion',
  });

  db.insert(promptQueue)
    .values({
      id: uid(),
      userId: axiom.userId,
      destinationApp: 'liminal',
      promptType: toolToPromptType(routing.tool),
      title: distillText(rawStatement).slice(0, 80),
      body: seedText,
      relatedAxiomId: axiom.id,
      priority: 40,
      status: 'open',
      seeded: axiom.seeded,
      createdAt: now(),
    })
    .run();
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
