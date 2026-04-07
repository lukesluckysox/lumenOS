import crypto from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import {
  db,
  epistemicEvents,
  epistemicCandidates,
  axiomStatements,
  axiomProvenance,
  watchRules,
  promptQueue,
} from '../db';

type EpistemicEvent = typeof epistemicEvents.$inferSelect;
type AxiomStatement = typeof axiomStatements.$inferSelect;

function uid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

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

      if (semanticallyRelated.length >= 1) {
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
          summary: `Belief pattern detected across ${allEventIds.length} entries`,
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
      if (event.confidence >= 0.3) {
        const payload = safeParse(event.payload, {}) as Record<string, string>;
        await createCandidate({
          userId: event.userId,
          candidateType: 'tension_candidate',
          title: payload.summary || 'Tension detected',
          summary: payload.text || 'A tension was identified in journal reflection',
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
      if (payload.causalStructure || event.confidence >= 0.4) {
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
      if (freq >= 3 && ctxCount >= 2 && event.confidence >= 0.7) {
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
      // Always create prompt_queue item for Liminal
      db.insert(promptQueue)
        .values({
          id: uid(),
          userId: event.userId,
          destinationApp: 'liminal',
          promptType: 'discrepancy_prompt',
          title: (payload.summary as string) || 'Identity discrepancy detected',
          body: (payload.text as string) || 'Parallax detected a gap between your stated values and observed behavior. Reflect on this in your next Liminal session.',
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
        summary: (payload.text as string) || 'A hypothesis was formed from behavioral tracking data',
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
    createPraxisQueueItem(candidate, 'Auto-promoted from event processing');
  }
}

// ─── Auto-queuing helpers ────────────────────────────────────────────────────

function createAxiomQueueItem(candidate: typeof epistemicCandidates.$inferSelect): void {
  db.insert(promptQueue)
    .values({
      id: uid(),
      userId: candidate.userId,
      destinationApp: 'liminal',
      promptType: 'followup_question',
      title: `Review candidate: ${candidate.title}`,
      body: `A new ${candidate.candidateType} has been queued for Axiom review: "${candidate.summary}". Consider accepting, rejecting, or testing this candidate.`,
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
      title: `Test: ${candidate.title}`,
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
  db.insert(promptQueue)
    .values({
      id: uid(),
      userId: axiom.userId,
      destinationApp: 'liminal',
      promptType: 'revision_prompt',
      title: `Reflect on new truth: ${axiom.statement.slice(0, 50)}`,
      body: `A new axiom has been accepted: "${axiom.statement}". In your next Liminal session, reflect on how this truth shows up in your lived experience.`,
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
