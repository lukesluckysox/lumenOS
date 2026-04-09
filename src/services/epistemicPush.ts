import { db, sqlite } from '../db';
import { epistemicCandidates } from '../schema/epistemic';
import { eq, and } from 'drizzle-orm';
import { findConvergencePairs, buildConvergencePayload } from '../services/epistemicConvergence.js';
import { distillText, distillPayload } from '../services/distillText.js';
import { transformForAxiom, transformPayloadForAxiom, transformVoice } from '../services/voiceTransform.js';
import { routeToLiminalTool, toolToPromptType } from '../services/liminalRouter.js';

const LIMINAL_API_URL = process.env.LIMINAL_API_URL || 'https://liminal-app.up.railway.app';

const AXIOM_API_URL = process.env.AXIOM_API_URL || 'https://axiomtool-production.up.railway.app';
const PRAXIS_API_URL = process.env.PRAXIS_API_URL || 'https://praxis-app.up.railway.app';
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
      signal = `I keep coming back to "${cleanTitle}" — it showed up across ${frequency} separate moments, which makes it more than situational.`;
    } else if (isParallax) {
      signal = `"${cleanTitle}" keeps showing up in how I behave and reflect.`;
    } else if (isLiminal) {
      signal = `I keep returning to "${cleanTitle}" as something I believe or identify with across separate reflections.`;
    } else {
      signal = transformForAxiom(candidate.summary);
    }

    // ── Convergence: structural alignment — first-person ────────────────────
    let convergence: string;
    if (isParallax && frequency && frequency >= 10) {
      convergence = `This has appeared ${frequency} separate times — it's not situational, it's how I tend to operate.`;
    } else if (isParallax && frequency) {
      convergence = `This pattern appeared ${frequency} times. Consistent enough to be real, still worth watching.`;
    } else if (isLiminal) {
      convergence = `I've come back to this across separate reflections — each time independently. It recurs because it matters to how I see myself.`;
    } else {
      convergence = `I hold this at ${confScore}% confidence. ${confScore >= 70 ? 'Strong enough to act on.' : 'Still emerging — worth watching.'}`;
    }

    // ── Interpretation: one level above the evidence — first-person ─────────
    let interpretation: string;
    if (isParallax) {
      interpretation = `"${cleanTitle}" is part of how I process things by default — not just a one-time response. ${confScore < 60 ? 'The evidence is moderate, so I\'m treating this as a hypothesis for now.' : 'There\'s enough evidence to take this seriously as part of how I work.'}`;
    } else if (isLiminal) {
      interpretation = `"${cleanTitle}" anchors how I evaluate other beliefs. ${confScore < 60 ? 'Still provisional — might be more situational than structural.' : 'It keeps showing up, which means it\'s load-bearing.'}`;
    } else {
      const strengthWord = confScore >= 80 ? 'strong' : confScore >= 60 ? 'real' : 'emerging';
      interpretation = `This is a ${strengthWord} tendency at ${confScore}% confidence. ${confScore < 60 ? 'Still provisional.' : 'Solid enough to guide decisions until contradicted.'}`;
    }

    // ── Truth Claim: distilled first-person epistemic claim ──────────────────
    let truthClaim: string;
    if (isParallax && frequency) {
      truthClaim = `I am someone who "${cleanTitle.toLowerCase()}" — this showed up ${frequency} times independently, which makes it structural, not incidental.`;
    } else if (isParallax) {
      truthClaim = `I am someone who "${cleanTitle.toLowerCase()}." This keeps showing up in how I operate.`;
    } else if (isLiminal) {
      truthClaim = `"${cleanTitle}" is something I keep returning to across reflection — it's not reactive, it's part of how I understand myself.`;
    } else {
      truthClaim = `I hold "${cleanTitle}" at ${confScore}% confidence. ${confScore < 60 ? 'Provisional — needs more evidence.' : 'Solid enough to act on.'}`;
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
      design: 'This experiment was suggested by patterns in my reflections. Shape it into something I can test.',
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
