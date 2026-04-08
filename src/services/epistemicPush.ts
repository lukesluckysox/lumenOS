import { db, sqlite } from '../db';
import { epistemicCandidates } from '../schema/epistemic';
import { eq, and } from 'drizzle-orm';
import { findConvergencePairs, buildConvergencePayload } from '../services/epistemicConvergence.js';
import { distillText, distillPayload } from '../services/distillText.js';

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

    // ── Signal: specific observable fact ────────────────────────────────────
    let signal: string;
    if (isParallax && frequency) {
      signal = `Parallax pattern: "${cleanTitle}" orientation appeared across ${frequency} distinct check-in sessions. This is the primary recurring mode in available pattern data.`;
    } else if (isParallax) {
      signal = `Parallax pattern analysis identified "${cleanTitle}" as a recurring orientation in check-in and writing data.`;
    } else if (isLiminal) {
      signal = `Liminal belief-questioning sessions repeatedly returned to "${cleanTitle}" as a live belief or identity frame across independent sessions.`;
    } else {
      signal = candidate.summary;
    }

    // ── Convergence: structural alignment, not just repetition ──────────────
    let convergence: string;
    if (isParallax && frequency && frequency >= 10) {
      convergence = `High-frequency occurrence (${frequency} sessions) establishes this as structurally durable rather than situational. Patterns at this frequency across Parallax — where each session is an independent observation — indicate a stable perceptual or behavioral orientation, not a contextual response.`;
    } else if (isParallax && frequency) {
      convergence = `Repeated occurrence across ${frequency} distinct Parallax sessions suggests emerging consistency. Below the threshold for structural certainty, but above noise — treat as working pattern pending further confirmation.`;
    } else if (isLiminal) {
      convergence = `Recurrence across separate Liminal sessions — each an independent belief-questioning exercise — indicates this is not a passing thought but a persistent self-concept or identity anchor. Independent recurrence is stronger evidence than single-session depth.`;
    } else {
      convergence = `Pattern identified with ${confScore}% confidence across available data. Convergence is ${confScore >= 70 ? 'sufficient to treat as working doctrine' : 'emergent — interpret provisionally'}.`;
    }

    // ── Interpretation: what it MEANS, one level above the evidence ─────────
    const strengthWord = confScore >= 80 ? 'primary' : confScore >= 60 ? 'significant' : 'notable';
    let interpretation: string;
    if (isParallax) {
      interpretation = `The consistent presence of "${cleanTitle}" as a ${strengthWord} mode suggests this orientation functions as a default cognitive or perceptual frame — the way experience is processed before it is interpreted. ${confScore < 60 ? 'Evidence is moderate; treat as working hypothesis rather than settled truth.' : 'Confidence is sufficient to treat this as a structurally present tendency, not a surface preference.'}`;
    } else if (isLiminal) {
      interpretation = `The persistence of "${cleanTitle}" across independent belief-questioning sessions suggests it functions as an anchor concept — a reference frame from which other beliefs are evaluated. ${confScore < 60 ? 'Evidence is provisional; this belief may be more situational than structural.' : 'Its recurrence indicates it is load-bearing in the current self-model.'}`;
    } else {
      interpretation = `This pattern at ${confScore}% confidence suggests a ${strengthWord} and durable tendency. ${confScore < 60 ? 'Interpret provisionally — evidence threshold is moderate.' : 'Treat as working doctrine pending contradictory evidence.'}`;
    }

    // ── Truth Claim: distilled epistemic claim ───────────────────────────────
    let truthClaim: string;
    if (isParallax && frequency) {
      truthClaim = `${cleanTitle} functions as a primary cognitive orientation — consistent enough across ${frequency} independent observations to be treated as structural rather than incidental. This is how experience tends to be processed, not just how it appears in a given moment.`;
    } else if (isParallax) {
      truthClaim = `${cleanTitle} represents a recurring operational mode in available Parallax data. Treat as a working doctrine pending revision.`;
    } else if (isLiminal) {
      truthClaim = `${cleanTitle} is a persistent identity frame or belief that recurs independently across reflective sessions — making it load-bearing in the current self-model rather than merely reactive.`;
    } else {
      truthClaim = `${cleanTitle}: an active pattern at ${confScore}% confidence. ${confScore < 60 ? 'Provisional — requires further evidence before treating as constitutionally reliable.' : 'Sufficient to treat as working doctrine.'}`;
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
