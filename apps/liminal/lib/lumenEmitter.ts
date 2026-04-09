// lib/lumenEmitter.ts
// Sends epistemic events to Lumen's shared API layer

const LUMEN_API_URL = process.env.LUMEN_API_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

export interface LumenEventPayload {
  userId: string;        // Lumen userId
  sourceApp: "liminal";
  sourceRecordId: string;
  eventType: "belief_candidate" | "tension_candidate" | "hypothesis_candidate";
  confidence: number;
  salience: number;
  domain?: string;
  tags?: string[];
  evidence?: string[];
  payload?: Record<string, unknown>;
  ingestionMode?: "live" | "backfill";
  createdAt?: string;
}

export async function emitLumenEvent(event: LumenEventPayload): Promise<void> {
  if (!LUMEN_API_URL || !LUMEN_INTERNAL_TOKEN) return; // graceful no-op if not configured
  try {
    await fetch(`${LUMEN_API_URL}/api/epistemic/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN },
      body: JSON.stringify(event),
    });
  } catch (e) {
    console.error("[LumenEmitter] Failed to emit event:", e);
    // Never throw — emission must not break the main app flow
  }
}

// Signal classifier — parses entry text for epistemic signal type and confidence
export function classifyEntrySignal(text: string): Array<{ eventType: "belief_candidate"|"tension_candidate"|"hypothesis_candidate"; confidence: number; salience: number; evidence: string[] }> {
  const results: Array<{ eventType: "belief_candidate"|"tension_candidate"|"hypothesis_candidate"; confidence: number; salience: number; evidence: string[] }> = [];
  const lower = text.toLowerCase();

  // Belief signals
  const beliefMarkers = ["i believe", "i value", "i am", "my identity", "i know", "i always", "i never", "fundamentally", "at my core", "i stand for", "i hold that", "my truth", "i'm certain"];
  const beliefMatches = beliefMarkers.filter(m => lower.includes(m));
  if (beliefMatches.length > 0) {
    const conf = Math.min(0.4 + beliefMatches.length * 0.15 + (text.length > 100 ? 0.1 : 0), 1.0);
    results.push({ eventType: "belief_candidate" as const, confidence: conf, salience: conf * 0.8, evidence: beliefMatches.map(m => `marker: "${m}"`) });
  }

  // Tension signals
  const tensionMarkers = ["but", "however", "on the other hand", "i used to", "i thought", "i'm torn", "conflict", "contradiction", "yet i", "and yet", "at the same time", "part of me", "i can't reconcile"];
  const tensionMatches = tensionMarkers.filter(m => lower.includes(m));
  if (tensionMatches.length >= 2) { // require 2+ tension markers to reduce noise
    const conf = Math.min(0.3 + tensionMatches.length * 0.1 + (text.length > 150 ? 0.1 : 0), 1.0);
    results.push({ eventType: "tension_candidate" as const, confidence: conf, salience: conf * 0.9, evidence: tensionMatches.map(m => `marker: "${m}"`) });
  }

  // Hypothesis signals
  const hypothesisMarkers = ["if i", "if i could", "i predict", "i expect", "i assume that", "because", "therefore i", "i hypothesize", "i suspect that", "my theory", "i think this causes", "which means that"];
  const hypothesisMatches = hypothesisMarkers.filter(m => lower.includes(m));
  if (hypothesisMatches.length > 0) {
    const hasCausal = lower.includes("because") || lower.includes("therefore") || lower.includes("causes") || lower.includes("leads to");
    const conf = Math.min(0.35 + hypothesisMatches.length * 0.1 + (hasCausal ? 0.2 : 0), 1.0);
    results.push({ eventType: "hypothesis_candidate" as const, confidence: conf, salience: conf * 0.85, evidence: hypothesisMatches.map(m => `marker: "${m}"`) });
  }

  return results.filter(r => r.confidence >= 0.4); // only high-signal
}
