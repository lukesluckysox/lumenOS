import { EpistemicCandidate } from '../schema/epistemic.js';
import { distillText } from '../services/distillText.js';
import { transformForAxiom } from '../services/voiceTransform.js';

const THEMES: Record<string, string[]> = {
  visibility: ['visibility', 'visible', 'concealment', 'conceal', 'hide', 'hiding', 'exposure', 'expose', 'judgment', 'seen', 'recognition', 'show', 'public', 'private', 'reveal'],
  autonomy: ['autonomy', 'autonomous', 'freedom', 'independent', 'independence', 'control', 'constraint', 'structure', 'agency'],
  solitude: ['solitude', 'alone', 'isolation', 'isolate', 'withdrawal', 'withdraw', 'quiet', 'introspect', 'retreat'],
  creativity: ['creative', 'creativity', 'creation', 'expression', 'craft', 'work', 'making', 'build', 'output'],
  identity: ['identity', 'outsider', 'belonging', 'role', 'authentic', 'authenticity', 'self', 'persona'],
  social: ['social', 'people', 'others', 'relationship', 'crowd', 'group', 'community', 'connection'],
  fear_anxiety: ['fear', 'anxiety', 'worry', 'threat', 'risk', 'scared', 'afraid', 'apprehensive', 'dread'],
  observer: ['observer', 'observe', 'watching', 'watch', 'witness', 'detach', 'detached', 'distant'],
  grounded: ['grounded', 'ground', 'stable', 'stability', 'anchor', 'foundation', 'base'],
  dissent: ['dissenter', 'dissent', 'resist', 'resistance', 'contrary', 'oppose', 'disagree'],
  explorer: ['explorer', 'explore', 'discovery', 'discover', 'curious', 'curiosity', 'seek', 'seeker'],
  builder: ['builder', 'build', 'construct', 'create', 'make', 'produce', 'craft', 'develop'],
  seeker: ['seeker', 'seek', 'search', 'quest', 'meaning', 'truth', 'understanding'],
};

export function classifyThemes(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(THEMES)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([theme]) => theme);
}

function candidateText(c: EpistemicCandidate): string {
  const parts: string[] = [];
  if (c.title) parts.push(c.title);
  if (c.summary) parts.push(c.summary);
  return parts.join(' ');
}

function sharedThemes(a: EpistemicCandidate, b: EpistemicCandidate): string[] {
  const ta = new Set(classifyThemes(candidateText(a)));
  const tb = new Set(classifyThemes(candidateText(b)));
  return [...ta].filter(t => tb.has(t));
}

export interface ConvergencePair {
  liminal: EpistemicCandidate;
  parallax: EpistemicCandidate;
  themes: string[];
}

export function findConvergencePairs(
  liminalCandidates: EpistemicCandidate[],
  parallaxCandidates: EpistemicCandidate[]
): ConvergencePair[] {
  const usedParallax = new Set<string>();
  const pairs: ConvergencePair[] = [];

  for (const lim of liminalCandidates) {
    let bestMatch: EpistemicCandidate | null = null;
    let bestThemes: string[] = [];

    for (const par of parallaxCandidates) {
      if (usedParallax.has(par.id)) continue;
      const themes = sharedThemes(lim, par);
      if (themes.length > bestThemes.length) {
        bestThemes = themes;
        bestMatch = par;
      }
    }

    if (bestMatch && bestThemes.length >= 1) {
      usedParallax.add(bestMatch.id);
      pairs.push({ liminal: lim, parallax: bestMatch, themes: bestThemes });
    }
  }

  return pairs;
}

export function buildConvergencePayload(
  liminal: EpistemicCandidate,
  parallax: EpistemicCandidate,
  sharedThemesList: string[],
  userId: string
): Record<string, unknown> {
  const liminalClean = (liminal.title || liminal.summary || 'Liminal observation').slice(0, 120).trim();
  const parallaxClean = (parallax.title || parallax.summary || 'Parallax archetype').slice(0, 120).trim();

  // Extract parallax frequency from title if available (e.g. "×25", "x 10 times")
  let parFreq = 1;
  const freqMatch = parallax.title.match(/[×xX]\s*(\d+)/) || parallax.summary.match(/frequency[:\s]+(\d+)/i) || parallax.summary.match(/(\d+)\s*times/i);
  if (freqMatch) parFreq = parseInt(freqMatch[1], 10);

  // Both pieces arrive in first-person for the constitutional proposal
  return {
    userId,
    title: `${liminalClean} / ${parallaxClean}`,
    signal: `I believe "${liminalClean}" and independently I tend toward "${parallaxClean}" (observed across ${parFreq} sessions). These arrived from different methods of inquiry.`,
    convergence: `I hold "${sharedThemesList.join(', ')}" at two distinct levels simultaneously — as a belief I return to in reflection, and as a pattern in how I actually behave. When two independent methods of inquiry reach the same ground, the evidence is stronger than either alone.`,
    interpretation: `"${sharedThemesList[0] || 'this theme'}" is not incidental for me — it shows up in what I believe and in how I act. This is a consistent operating principle, not a passing preoccupation.`,
    truthClaim: `I hold "${liminalClean}" as both a lived belief and a demonstrated behavioral tendency — confirmed through independent inquiry from two different angles.`,
    workingPrinciple: '',
    liminalCount: 1,
    parallaxCount: parFreq,
    praxisCount: 0,
    inputDescriptions: [
      `Reflection: ${liminalClean}`,
      `Observation: ${parallaxClean} (×${parFreq})`,
    ],
    source: 'lumen_push',
  };
}
