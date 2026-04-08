const LUMEN_API_URL = process.env.LUMEN_API_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET;

export interface PraxisLumenEvent {
  lumenUserId: string;
  sourceRecordId: string;
  eventType: "experiment_completed" | "doctrine_crystallized" | "observation_logged" | "tension_discovered";
  confidence: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

// Fire when an experiment reaches the meaning-extraction phase
export async function emitExperimentCompleted(event: {
  lumenUserId: string;
  experimentId: number;
  hypothesis: string;
  observation: string;
  meaningExtraction: string;
}): Promise<void> {
  await emitEvent({
    lumenUserId: event.lumenUserId,
    sourceRecordId: String(event.experimentId),
    eventType: "experiment_completed",
    confidence: 0.8,
    payload: {
      hypothesis: event.hypothesis,
      observation: event.observation,
      meaningExtraction: event.meaningExtraction,
      // Seed for Axiom: this is evidence for/against a truth claim
      axiomSignal: {
        signal: event.observation,
        interpretation: event.meaningExtraction,
        suggestedTruthClaim: `When I ${event.hypothesis.toLowerCase()}, I discovered: ${event.meaningExtraction}`,
      },
      // Seed for Liminal: the completed experiment raises new questions
      liminalSeed: `I tested this hypothesis: "${event.hypothesis}". What I observed: "${event.observation}". What I think it means: "${event.meaningExtraction}". What deeper question does this answer reveal?`,
    },
    createdAt: new Date().toISOString(),
  });
}

// Fire when a doctrine is established
export async function emitDoctrineCrystallized(event: {
  lumenUserId: string;
  doctrineId: number;
  title: string;
  description: string;
  certainty: string;
}): Promise<void> {
  await emitEvent({
    lumenUserId: event.lumenUserId,
    sourceRecordId: String(event.doctrineId),
    eventType: "doctrine_crystallized",
    confidence: event.certainty === "established" ? 0.85 : 0.6,
    payload: {
      title: event.title,
      description: event.description,
      certainty: event.certainty,
      axiomSignal: {
        signal: event.description,
        suggestedTruthClaim: event.title,
      },
    },
    createdAt: new Date().toISOString(),
  });
}

// Fire when a tension pair is created
export async function emitTensionDiscovered(event: {
  lumenUserId: string;
  tensionId: number;
  poleA: string;
  poleB: string;
  insight: string;
}): Promise<void> {
  await emitEvent({
    lumenUserId: event.lumenUserId,
    sourceRecordId: String(event.tensionId),
    eventType: "tension_discovered",
    confidence: 0.7,
    payload: {
      poleA: event.poleA,
      poleB: event.poleB,
      insight: event.insight,
      liminalSeed: `In my experiments, I've discovered a tension between ${event.poleA} and ${event.poleB}. ${event.insight || ''} How do I hold both without collapsing into one?`,
    },
    createdAt: new Date().toISOString(),
  });
}

async function emitEvent(event: PraxisLumenEvent): Promise<void> {
  if (!LUMEN_API_URL || !LUMEN_INTERNAL_TOKEN) return;
  try {
    // Emit to Lumen epistemic event bus
    await fetch(`${LUMEN_API_URL}/api/epistemic/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN },
      body: JSON.stringify({ ...event, sourceApp: "praxis", userId: event.lumenUserId }),
    });

    // If there's an axiom signal, push directly to Axiom
    const AXIOM_URL = process.env.AXIOM_TOOL_URL;
    if (AXIOM_URL && event.payload.axiomSignal) {
      await fetch(`${AXIOM_URL}/api/internal/from-lumen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN },
        body: JSON.stringify({
          lumenUserId: event.lumenUserId,
          source: "praxis",
          axioms: [{
            title: (event.payload.axiomSignal as any).suggestedTruthClaim || "Experimental finding",
            signal: (event.payload.axiomSignal as any).signal || "",
            interpretation: (event.payload.axiomSignal as any).interpretation || "",
            truthClaim: (event.payload.axiomSignal as any).suggestedTruthClaim || "",
            sourceCounts: { liminal: 0, parallax: 0, praxis: 1 },
          }],
        }),
      }).catch(() => {});
    }

    // If there's a liminal seed, push to Liminal
    if (event.payload.liminalSeed) {
      await fetch(`${LUMEN_API_URL}/api/internal/inquiry-seeds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN },
        body: JSON.stringify({
          lumenUserId: event.lumenUserId,
          sourceApp: "praxis",
          sourceEventType: event.eventType,
          sourceId: event.sourceRecordId,
          seedText: event.payload.liminalSeed,
          createdAt: event.createdAt,
        }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[LumenEmitter:Praxis] Failed:", e);
  }
}
