// server/lumenEmitter.ts
// Classifies Parallax records (check-ins, writings, decisions) into epistemic
// signals and emits them to the Lumen OS epistemic event bus.

const LUMEN_API_URL = process.env.LUMEN_API_URL || process.env.LUMEN_OS_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET;

// Startup diagnostics — surfaces in Railway logs so missing env vars are obvious
if (!LUMEN_API_URL)          console.warn('[lumenEmitter:Parallax] LUMEN_API_URL not set — Parallax→Lumen OS feed is DISABLED');
if (!LUMEN_INTERNAL_TOKEN)   console.warn('[lumenEmitter:Parallax] LUMEN_INTERNAL_TOKEN not set — cross-app auth is DISABLED');

// ─── Signal classification ──────────────────────────────────────────────────
// Each record can emit 0–N signals depending on its textual content.
// Mirrors the eventTypes that epistemicPromotion.ts (in Lumen OS) processes
// under the "parallax" sourceApp case:
//   • pattern_candidate  → checks frequency/contextCount thresholds → doctrine_candidate → Axiom
//   • identity_discrepancy → creates Liminal prompt_queue item
//   • hypothesis_candidate → queued_for_praxis

export interface ParallaxSignal {
  eventType: 'pattern_candidate' | 'identity_discrepancy' | 'hypothesis_candidate';
  confidence: number;
  salience: number;
  payload: Record<string, unknown>;
}

export function classifyParallaxRecord(record: any): ParallaxSignal[] {
  const signals: ParallaxSignal[] = [];
  const text = buildText(record);
  const lower = text.toLowerCase();
  if (!lower || lower.length < 10) return signals;

  // ── Pattern candidate: recurring behavioral or identity patterns ──────────
  // Triggered by check-ins with self_vec/data_vec, writings with analysis,
  // or any record with a label (e.g. liminal cross-talk).
  const frequency = typeof record.frequency === 'number' ? record.frequency : 1;
  const contextCount = typeof record.contextCount === 'number' ? record.contextCount : 1;

  if (record.self_vec || record.self_archetype || record.label || record.analysis || frequency > 1) {
    const confBase = Math.min(0.3 + (frequency * 0.05) + (contextCount * 0.03), 0.95);
    signals.push({
      eventType: 'pattern_candidate',
      confidence: round(confBase),
      salience: round(Math.min(0.2 + frequency * 0.08, 0.9)),
      payload: {
        summary: extractSummary(record, text),
        text: text.slice(0, 500),
        frequency,
        contextCount,
        archetype: record.self_archetype || record.data_archetype || null,
      },
    });
  }

  // ── Identity discrepancy: stated values vs. observed behavior gap ─────────
  // Look for contrast/contradiction language suggesting a gap between
  // who the user says they are and what their data shows.
  if (
    /\b(but I|yet I|even though I|despite|contradicts?|gap between|don['']t match|disconnect)\b/i.test(text) ||
    (record.alignment_before != null && record.alignment_after != null &&
      Math.abs(record.alignment_before - record.alignment_after) > 20)
  ) {
    signals.push({
      eventType: 'identity_discrepancy',
      confidence: round(0.6),
      salience: round(0.7),
      payload: {
        summary: `Identity gap detected: ${extractSummary(record, text).slice(0, 120)}`,
        text: text.slice(0, 500),
      },
    });
  }

  // ── Hypothesis candidate: "if…then" or causal structure → route to Praxis ─
  if (
    /\b(if I|when I|maybe I should|I wonder (?:if|whether)|what if I|hypothesis|experiment|test whether)\b/i.test(lower)
  ) {
    signals.push({
      eventType: 'hypothesis_candidate',
      confidence: round(0.5),
      salience: round(0.6),
      payload: {
        summary: extractSummary(record, text),
        text: text.slice(0, 500),
        causalStructure: true,
      },
    });
  }

  return signals;
}

// ─── Emit to Lumen OS epistemic event bus ───────────────────────────────────

export interface LumenEventPayload {
  userId: string;            // lumen_user_id
  sourceRecordId: string;
  eventType: string;
  confidence: number;
  salience: number;
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
        sourceApp: 'parallax',
        sourceRecordId: event.sourceRecordId,
        eventType: event.eventType,
        confidence: event.confidence,
        salience: event.salience,
        payload: event.payload,
        ingestionMode: event.ingestionMode,
        createdAt: event.createdAt,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[lumenEmitter:Parallax] Event rejected: ${res.status} ${text}`);
    }
  } catch (e) {
    console.error('[lumenEmitter:Parallax] Failed to emit event:', e);
    // Never throw — emission must not break the main app flow
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildText(record: any): string {
  const parts: string[] = [];
  if (record.feeling_text)   parts.push(record.feeling_text);
  if (record.content)        parts.push(record.content);
  if (record.decision_text)  parts.push(record.decision_text);
  if (record.title)          parts.push(record.title);
  if (record.verdict)        parts.push(record.verdict);
  if (record.analysis)       parts.push(record.analysis);
  if (record.label)          parts.push(record.label);
  return parts.join(' ').trim();
}

function extractSummary(record: any, text: string): string {
  if (record.title) return record.title;
  if (record.label) return record.label;
  if (record.self_archetype) return `${record.self_archetype} pattern`;
  return text.slice(0, 120);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
