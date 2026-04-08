// server/lumenEmitter.ts
// Sends epistemic events back to Liminal when truth claims are promoted

const LUMEN_API_URL = process.env.LUMEN_API_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET;

// ─── Client-side routing: map seed text to Liminal tool ─────────────────────
// Mirrors the server-side liminalRouter logic, kept minimal here since Axiom
// already knows the event type which is a strong routing signal.

type LiminalTool = 'small-council' | 'fool' | 'genealogist' | 'interlocutor' | 'interpreter' | 'stoics-ledger';

function routeSeedToTool(
  seedText: string,
  eventType: string,
  extra?: { poleA?: string; poleB?: string }
): { tool: LiminalTool; reason: string } {
  // Event-type-based routing (strong signal)
  if (eventType === 'tension_surfaced') {
    return { tool: 'small-council', reason: 'Tension between poles → deliberation' };
  }
  if (eventType === 'truth_revision') {
    return { tool: 'fool', reason: 'Revised truth → challenge the replacement belief' };
  }

  // Text-pattern routing for constitutional_promotion
  const lower = seedText.toLowerCase();

  // Absolute/certain language → Fool
  if (/\b(always|never|certainly|absolutely|of course|without doubt)\b/.test(lower)) {
    return { tool: 'fool', reason: 'Certain language in claim → reckoning' };
  }

  // Identity / origin framing → Genealogist
  if (/\b(kind of person|who i am|identity|core|always been|inherited|grew up)\b/.test(lower)) {
    return { tool: 'genealogist', reason: 'Identity claim → trace origin' };
  }

  // Argument / thesis framing → Interlocutor
  if (/\b(i believe|i think|i argue|i hold|principle|therefore|because)\b/.test(lower)) {
    return { tool: 'interlocutor', reason: 'Thesis/principle → examination' };
  }

  // Symbol / recurring pattern → Interpreter
  if (/\b(symbol|recurring|keep seeing|dream|pattern|lens)\b/.test(lower)) {
    return { tool: 'interpreter', reason: 'Symbolic content → multi-lens reading' };
  }

  // Default for constitutional promotion: Genealogist (trace the origin of this truth)
  return { tool: 'genealogist', reason: 'Constitutional truth → examine where it came from' };
}

export interface AxiomFeedbackEvent {
  lumenUserId: string;
  axiomId: number;
  eventType: "constitutional_promotion" | "truth_revision" | "tension_surfaced" | "constitution_updated";
  payload: Record<string, unknown>;
  createdAt: string;
}

// Fire when an axiom is promoted to constitutional status
export async function emitConstitutionalPromotion(event: {
  lumenUserId: string;
  axiomId: number;
  truthClaim: string;
  workingPrinciple: string;
  confidence: string;
  confidenceScore: number;
  sourceCounts: { liminal: number; parallax: number; praxis: number };
}): Promise<void> {
  await emitAxiomEvent({
    lumenUserId: event.lumenUserId,
    axiomId: event.axiomId,
    eventType: "constitutional_promotion",
    payload: {
      truthClaim: event.truthClaim,
      workingPrinciple: event.workingPrinciple,
      confidence: event.confidence,
      confidenceScore: event.confidenceScore,
      sourceCounts: event.sourceCounts,
      // This becomes the seed for a new Liminal inquiry
      liminalSeed: generateLiminalSeed(event.truthClaim, event.workingPrinciple, event.confidence),
    },
    createdAt: new Date().toISOString(),
  });
}

// Fire when a truth claim is revised
export async function emitTruthRevision(event: {
  lumenUserId: string;
  axiomId: number;
  previousClaim: string;
  newClaim: string;
  revisionNote: string;
  significance: string;
}): Promise<void> {
  await emitAxiomEvent({
    lumenUserId: event.lumenUserId,
    axiomId: event.axiomId,
    eventType: "truth_revision",
    payload: {
      previousClaim: event.previousClaim,
      newClaim: event.newClaim,
      revisionNote: event.revisionNote,
      significance: event.significance,
      liminalSeed: generateRevisionSeed(event.previousClaim, event.newClaim),
    },
    createdAt: new Date().toISOString(),
  });
}

// Fire when a new tension is surfaced
export async function emitTensionSurfaced(event: {
  lumenUserId: string;
  poleA: string;
  poleB: string;
  description: string;
}): Promise<void> {
  await emitAxiomEvent({
    lumenUserId: event.lumenUserId,
    axiomId: 0,
    eventType: "tension_surfaced",
    payload: {
      poleA: event.poleA,
      poleB: event.poleB,
      description: event.description,
      liminalSeed: `I live between ${event.poleA} and ${event.poleB}. ${event.description} What does this tension reveal about what I actually value?`,
    },
    createdAt: new Date().toISOString(),
  });
}

function generateLiminalSeed(truthClaim: string, workingPrinciple: string, confidence: string): string {
  if (confidence === "high") {
    return `I now hold this as a governing truth: "${truthClaim}" — which leads me to this principle: "${workingPrinciple}". What am I not seeing? What would need to be true for this to be wrong?`;
  } else if (confidence === "medium" || confidence === "medium-high") {
    return `Through reflection and evidence, I've arrived at this provisional truth: "${truthClaim}". But I'm not fully certain. What assumptions am I making? Where might this crack under pressure?`;
  } else {
    return `I've proposed this truth claim but I'm uncertain: "${truthClaim}". What would it take to either strengthen this into a conviction or abandon it entirely?`;
  }
}

function generateRevisionSeed(previousClaim: string, newClaim: string): string {
  return `I used to believe: "${previousClaim}". Now I believe: "${newClaim}". What changed in me? Is this growth, or am I just replacing one comfortable story with another?`;
}

async function emitAxiomEvent(event: AxiomFeedbackEvent): Promise<void> {
  if (!LUMEN_API_URL || !LUMEN_INTERNAL_TOKEN) return;
  try {
    // Send to Lumen's epistemic event bus
    await fetch(`${LUMEN_API_URL}/api/epistemic/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN },
      body: JSON.stringify({ ...event, sourceApp: "axiom" }),
    });

    // Also send the liminalSeed directly to Liminal's seed queue, with tool routing
    if (event.payload.liminalSeed) {
      const seedText = event.payload.liminalSeed as string;
      const routing = routeSeedToTool(seedText, event.eventType, {
        poleA: event.payload.poleA as string | undefined,
        poleB: event.payload.poleB as string | undefined,
      });

      await fetch(`${LUMEN_API_URL}/api/internal/inquiry-seeds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN },
        body: JSON.stringify({
          lumenUserId: event.lumenUserId,
          sourceApp: "axiom",
          sourceEventType: event.eventType,
          sourceId: String(event.axiomId),
          seedText,
          suggestedTool: routing.tool,
          routingReason: routing.reason,
          createdAt: event.createdAt,
        }),
      });
    }
  } catch (e) {
    console.error("[LumenEmitter:Axiom] Failed:", e);
  }
}
