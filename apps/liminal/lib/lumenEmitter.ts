// lib/lumenEmitter.ts
// Classifies Liminal tool inputs into epistemic signals and emits them
// to the Lumen OS epistemic event bus for processing by epistemicPromotion.ts.

const LUMEN_API_URL = process.env.LUMEN_API_URL || process.env.LUMEN_OS_URL || process.env.NEXT_PUBLIC_LUMEN_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

// Startup diagnostics — surfaces in Railway logs so missing env vars are obvious
if (!LUMEN_API_URL)          console.warn('[lumenEmitter:Liminal] LUMEN_API_URL not set — Liminal→Lumen OS feed is DISABLED');
if (!LUMEN_INTERNAL_TOKEN)   console.warn('[lumenEmitter:Liminal] LUMEN_INTERNAL_TOKEN not set — cross-app auth is DISABLED');

// ─── Signal classification ──────────────────────────────────────────────────
// Each entry can emit 0–N signals depending on its textual content.
// Mirrors the eventTypes that epistemicPromotion.ts processes under "liminal":
//   • belief_candidate      → 2+ similar → doctrine_candidate → Axiom
//   • tension_candidate     → if confidence ≥ threshold → open candidate for Axiom
//   • hypothesis_candidate  → queued_for_praxis

export interface LiminalSignal {
  eventType: 'belief_candidate' | 'tension_candidate' | 'hypothesis_candidate';
  confidence: number;
  salience: number;
  evidence: string[];
}

export function classifyEntrySignal(text: string): LiminalSignal[] {
  const signals: LiminalSignal[] = [];
  if (!text || text.length < 10) return signals;
  const lower = text.toLowerCase();

  // ── Belief candidate: "I believe", "I know", identity claims, convictions ──
  if (
    /\b(i believe|i know|i['']m (certain|sure|convinced)|i think that|i hold|my truth|i['']ve (learned|realized|come to))\b/i.test(text) ||
    /\b(kind of person|who i am|core value|always been|i am someone)\b/i.test(lower)
  ) {
    signals.push({
      eventType: 'belief_candidate',
      confidence: 0.6,
      salience: 0.5,
      evidence: [text.slice(0, 300)],
    });
  }

  // ── Tension candidate: competing values, "but", contradictions, dilemmas ──
  if (
    /\b(but I also|yet I|torn between|on one hand|part of me|i want .+ but|frustrated .+ but|conflicted)\b/i.test(text) ||
    /\b(should I|dilemma|competing|at odds|tension between)\b/i.test(lower)
  ) {
    signals.push({
      eventType: 'tension_candidate',
      confidence: 0.55,
      salience: 0.65,
      evidence: [text.slice(0, 300)],
    });
  }

  // ── Hypothesis candidate: causal reasoning, "what if", experiments ─────────
  if (
    /\b(if I|when I|maybe I should|what if|i wonder (if|whether)|hypothesis|i could try|test whether|experiment)\b/i.test(text)
  ) {
    signals.push({
      eventType: 'hypothesis_candidate',
      confidence: 0.5,
      salience: 0.5,
      evidence: [text.slice(0, 300)],
    });
  }

  // If nothing matched but there's substantial text, still emit a low-confidence
  // belief_candidate so the epistemic engine can accumulate evidence over time.
  if (signals.length === 0 && text.length > 50) {
    signals.push({
      eventType: 'belief_candidate',
      confidence: 0.3,
      salience: 0.3,
      evidence: [text.slice(0, 300)],
    });
  }

  return signals;
}

// ─── Emit to Lumen OS epistemic event bus ───────────────────────────────────

export interface LumenEventPayload {
  userId: string;            // lumen_user_id
  sourceApp: string;
  sourceRecordId: string;
  eventType: string;
  confidence: number;
  salience: number;
  evidence?: string[];
  payload: Record<string, unknown>;
  ingestionMode: 'live' | 'backfill';
  createdAt: string;
}

export async function emitLumenEvent(event: LumenEventPayload): Promise<void> {
  if (!LUMEN_API_URL || !LUMEN_INTERNAL_TOKEN) return;
  try {
    const res = await fetch(`${LUMEN_API_URL}/api/epistemic/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        userId: event.userId,
        sourceApp: event.sourceApp,
        sourceRecordId: event.sourceRecordId,
        eventType: event.eventType,
        confidence: event.confidence,
        salience: event.salience,
        evidence: event.evidence || [],
        payload: event.payload,
        ingestionMode: event.ingestionMode,
        createdAt: event.createdAt,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[lumenEmitter:Liminal] Event rejected: ${res.status} ${text}`);
    }
  } catch (e) {
    console.error('[lumenEmitter:Liminal] Failed to emit event:', e);
    // Never throw — emission must not break the main app flow
  }
}
