import { db, sqlite } from '../db';
import { epistemicCandidates } from '../schema/epistemic';
import { eq, and } from 'drizzle-orm';
import { findConvergencePairs, buildConvergencePayload } from '../services/epistemicConvergence.js';
import { distillText, distillPayload } from '../services/distillText.js';
import { transformForAxiom, transformPayloadForAxiom, transformVoice } from '../services/voiceTransform.js';
import { routeToLiminalTool, toolToPromptType } from '../services/liminalRouter.js';

const LIMINAL_API_URL = process.env.LIMINAL_API_URL || 'https://liminal-app.up.railway.app';

const AXIOM_API_URL = process.env.AXIOM_API_URL || 'https://axiomtool-production.up.railway.app';
const PRAXIS_API_URL = process.env.PRAXIS_API_URL || 'https://praxis-production-da89.up.railway.app';
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN || '';

function confidenceToText(score: number): string {
  if (score >= 0.85) return 'high';
  if (score >= 0.70) return 'medium-high';
  if (score >= 0.50) return 'medium';
  if (score >= 0.35) return 'medium-low';
  return 'low';
}

export async function pushCandidateToAxiomtool(candidate: typeof epistemicCandidates.$inferSelect): Promise<boolean> {
  try {
    // ── Provenance counts ────────────────────────────────────────────────────
    const isParallax = ['doctrine_candidate', 'pattern_candidate'].includes(candidate.candidateType);
    const isLiminal  = ['belief_candidate', 'tension_candidate'].includes(candidate.candidateType);

    // Extract frequency if present in title: "×25", "× 25", "x25", "×25 check-ins"
    const freqMatch = candidate.title.match(/[×xX]\s*(\d+)/);
    const frequency = freqMatch ? parseInt(freqMatch[1]) : null;

    // Clean title: strip frequency marker + trailing whitespace
    const cleanTitle = candidate.title
      .replace(/[×xX]\s*\d+(\s*(check-ins?|sessions?|entries?|times?))?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[-–—]\s*$/, '')
      .trim();

    const parallaxCount = isParallax ? (frequency ?? 1) : 0;
    const liminalCount  = isLiminal  ? 1 : 0;

    const confScore = Math.round(candidate.confidence * 100);
    const confLabel = confidenceToText(candidate.confidence);

    // ── Signal: specific observable fact — first-person for Axiom ────────────
    let signal: string;
    if (isParallax && frequency) {
      signal = `I orient toward "${cleanTitle}" — this pattern appeared across ${frequency} distinct observation sessions, making it a primary recurring mode rather than a situational response.`;
    } else if (isParallax) {
      signal = `I demonstrate "${cleanTitle}" as a recurring orientation across check-in and writing data.`;
    } else if (isLiminal) {
      signal = `I return repeatedly to "${cleanTitle}" as a live belief or identity frame across independent reflection sessions.`;
    } else {
      signal = transformForAxiom(candidate.summary);
    }

    // ── Convergence: structural alignment — first-person ────────────────────
    let convergence: string;
    if (isParallax && frequency && frequency >= 10) {
      convergence = `I have expressed this orientation across ${frequency} independent sessions — a frequency that makes it structurally durable rather than situational. This is not how I respond sometimes; it is how I tend to process experience.`;
    } else if (isParallax && frequency) {
      convergence = `I have demonstrated this pattern across ${frequency} distinct sessions. Emerging consistency — not yet structurally certain, but above noise. I should treat this as a working orientation pending further confirmation.`;
    } else if (isLiminal) {
      convergence = `I have returned to this independently across separate reflection sessions — each one a fresh inquiry. This is not a passing thought; it recurs because it is load-bearing in how I understand myself.`;
    } else {
      convergence = `I hold this pattern at ${confScore}% confidence across available evidence. ${confScore >= 70 ? 'I can treat this as a working doctrine.' : 'I should interpret this provisionally — the evidence is emergent.'}`;
    }

    // ── Interpretation: one level above the evidence — first-person ─────────
    const strengthWord = confScore >= 80 ? 'primary' : confScore >= 60 ? 'significant' : 'notable';
    let interpretation: string;
    if (isParallax) {
      interpretation = `"${cleanTitle}" functions as a default cognitive frame for me — this is how I process experience before I interpret it. ${confScore < 60 ? 'The evidence is moderate; I should treat this as a working hypothesis rather than settled truth.' : 'The confidence is sufficient to treat this as a structurally present tendency in how I operate.'}`;
    } else if (isLiminal) {
      interpretation = `"${cleanTitle}" functions as an anchor concept for me — a reference frame from which I evaluate other beliefs. ${confScore < 60 ? 'The evidence is provisional; this may be more situational than structural.' : 'Its recurrence indicates it is load-bearing in my current self-model.'}`;
    } else {
      interpretation = `I hold this as a ${strengthWord} and durable tendency at ${confScore}% confidence. ${confScore < 60 ? 'I should interpret this provisionally.' : 'I can treat this as working doctrine pending contradictory evidence.'}`;
    }

    // ── Truth Claim: distilled first-person epistemic claim ──────────────────
    let truthClaim: string;
    if (isParallax && frequency) {
      truthClaim = `I tend toward "${cleanTitle}" — consistent enough across ${frequency} independent observations to be structural rather than incidental. This is how I process experience, not just how it appears in a given moment.`;
    } else if (isParallax) {
      truthClaim = `I demonstrate "${cleanTitle}" as a recurring operational mode. I treat this as a working doctrine, open to revision.`;
    } else if (isLiminal) {
      truthClaim = `"${cleanTitle}" is a persistent identity frame or belief I return to independently across reflection — making it load-bearing in my self-model rather than merely reactive.`;
    } else {
      truthClaim = `I hold "${cleanTitle}" as an active pattern at ${confScore}% confidence. ${confScore < 60 ? 'Provisional — I need further evidence before treating this as constitutionally reliable.' : 'I can treat this as working doctrine.'}`;
    }

    const body = distillPayload({
      title: cleanTitle.slice(0, 200),
      truthClaim: truthClaim.slice(0, 500),
      signal,
      convergence,
      interpretation,
      workingPrinciple: '', // Left for user to derive or AI enrichment
      confidence: confLabel,
      confidenceScore: confScore,
      counterevidence: '',
      revisionNote: '',
      revisionHistory: '[]',
      liminalCount,
      parallaxCount,
      praxisCount: 0,
      inputDescriptions: JSON.stringify([candidate.summary]),
      source: 'lumen_push',
      userId: candidate.userId,
    });

    const res = await fetch(`${AXIOM_API_URL}/api/internal/from-lumen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[epistemicPush] Axiomtool rejected candidate ${candidate.id}: ${res.status} ${text}`);
    }
    return res.ok;
  } catch (e) {
    console.error('[epistemicPush] Axiomtool push error:', e);
    return false;
  }
}

export async function pushCandidateToPraxis(candidate: typeof epistemicCandidates.$inferSelect): Promise<boolean> {
  try {
    const body = distillPayload({
      title: candidate.title.slice(0, 200),
      hypothesis: candidate.summary,
      design: 'Auto-generated from epistemic queue. Review and refine to structure your experiment.',
      source: ['belief_candidate', 'tension_candidate', 'hypothesis_candidate'].includes(candidate.candidateType) ? 'liminal' : 'parallax',
      status: 'active',
      experimentConstraint: '',
      observation: '',
      meaningExtraction: '',
      tags: '[]',
      userId: candidate.userId,
    });
    const res = await fetch(`${PRAXIS_API_URL}/api/internal/from-lumen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[epistemicPush] Praxis rejected candidate ${candidate.id}: ${res.status} ${text}`);
    }
    return res.ok;
  } catch (e) {
    console.error('[epistemicPush] Praxis push error:', e);
    return false;
  }
}

export async function flushEpistemicQueue(userId: string): Promise<{ pushed: number; failed: number; axiom: number; praxis: number }> {
  let pushed = 0;
  let failed = 0;
  let axiomCount = 0;
  let praxisCount = 0;

  // ── Convergence pass: pair Liminal + Parallax candidates before individual pushes ──
  const pairedIds = new Set<string>();

  try {
    const allQueued = db
      .select()
      .from(epistemicCandidates)
      .where(and(
        eq(epistemicCandidates.userId, userId),
        eq(epistemicCandidates.status, 'queued_for_axiom')
      ))
      .all();

    // Resolve sourceApp for each candidate via its sourceEventIds
    // (candidateType alone is insufficient: Liminal belief_candidates and
    //  Parallax pattern_candidates both produce doctrine_candidate type)
    const candidateSourceApp = new Map<string, string>();
    for (const c of allQueued) {
      let eventIds: string[] = [];
      try { eventIds = JSON.parse((c as any).sourceEventIds || '[]'); } catch {}
      if (eventIds.length > 0) {
        const ev = sqlite
          .prepare('SELECT source_app FROM epistemic_events WHERE id = ? LIMIT 1')
          .get(eventIds[0]) as { source_app: string } | undefined;
        if (ev) candidateSourceApp.set(c.id, ev.source_app);
      }
    }

    // Split by source app (resolved above), not by candidateType
    const liminalCandidates = allQueued.filter(c =>
      candidateSourceApp.get(c.id) === 'liminal'
    );
    const parallaxCandidates = allQueued.filter(c =>
      candidateSourceApp.get(c.id) === 'parallax'
    );

    const pairs = findConvergencePairs(liminalCandidates, parallaxCandidates);

    for (const pair of pairs) {
      const payload = buildConvergencePayload(pair.liminal, pair.parallax, pair.themes, userId);
      try {
        const res = await fetch(`${AXIOM_API_URL}/api/internal/from-lumen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-lumen-internal-token': LUMEN_INTERNAL_TOKEN,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const convergenceGroupId = Date.now().toString(36) + Math.random().toString(36).slice(2);
          sqlite
            .prepare(`UPDATE epistemic_candidates SET status = 'accepted', convergence_group_id = ?, updated_at = ? WHERE id = ?`)
            .run(convergenceGroupId, new Date().toISOString(), pair.liminal.id);
          sqlite
            .prepare(`UPDATE epistemic_candidates SET status = 'accepted', convergence_group_id = ?, updated_at = ? WHERE id = ?`)
            .run(convergenceGroupId, new Date().toISOString(), pair.parallax.id);
          pairedIds.add(pair.liminal.id);
          pairedIds.add(pair.parallax.id);
          pushed++;
          axiomCount++;
        } else {
          const text = await res.text().catch(() => '');
          console.error(`[epistemicPush] Convergence push rejected for pair ${pair.liminal.id}/${pair.parallax.id}: ${res.status} ${text}`);
        }
      } catch (e) {
        console.error('[epistemicPush] Convergence push error:', e);
      }
    }
  } catch (e) {
    console.error('[epistemicPush] Convergence pass error:', e);
  }

  // Push doctrine_candidates to Axiomtool
  const axiomCandidates = db
    .select()
    .from(epistemicCandidates)
    .where(and(
      eq(epistemicCandidates.userId, userId),
      eq(epistemicCandidates.status, 'queued_for_axiom')
    ))
    .all();

  for (const candidate of axiomCandidates) {
    // Skip candidates already handled in convergence pass
    if (pairedIds.has(candidate.id)) continue;
    const ok = await pushCandidateToAxiomtool(candidate);
    if (ok) {
      db.update(epistemicCandidates)
        .set({ status: 'accepted', updatedAt: new Date().toISOString() })
        .where(eq(epistemicCandidates.id, candidate.id))
        .run();
      pushed++;
      axiomCount++;
    } else {
      failed++;
    }
  }

  // Push hypothesis_candidates to Praxis
  const praxisCandidates = db
    .select()
    .from(epistemicCandidates)
    .where(and(
      eq(epistemicCandidates.userId, userId),
      eq(epistemicCandidates.status, 'queued_for_praxis')
    ))
    .all();

  for (const candidate of praxisCandidates) {
    const ok = await pushCandidateToPraxis(candidate);
    if (ok) {
      db.update(epistemicCandidates)
        .set({ status: 'accepted', updatedAt: new Date().toISOString() })
        .where(eq(epistemicCandidates.id, candidate.id))
        .run();
      pushed++;
      praxisCount++;
    } else {
      failed++;
    }
  }

  return { pushed, failed, axiom: axiomCount, praxis: praxisCount };
}
