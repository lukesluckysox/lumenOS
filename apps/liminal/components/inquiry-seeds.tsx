'use client';

import { useState, useEffect } from 'react';

interface Seed {
  id: string;
  source_app: string;
  source_event_type: string;
  seed_text: string;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  axiom: 'From your Constitution',
  parallax: 'From your Patterns',
  praxis: 'From your Experiments',
};

const EVENT_LABELS: Record<string, string> = {
  constitutional_promotion: 'A new truth was established',
  truth_revision: 'A belief was revised',
  tension_surfaced: 'A tension emerged',
  pattern_detected: 'A pattern was noticed',
  experiment_completed: 'An experiment concluded',
};

// ─── Client-side distillation safety net ──────────────────────────────────────
// Ensures no tool names leak even from legacy seeds or future pipeline gaps.
const DISTILL_RULES: [RegExp, string][] = [
  [/Parallax\s+calls\s+you/gi, 'I am called'],
  [/Parallax\s+detected\s+a\s+gap/gi, 'A gap was detected'],
  [/Parallax\s+identified/gi, 'Pattern recognition identified'],
  [/Parallax\s+pattern:?\s*/gi, 'Observed pattern: '],
  [/Parallax\s+detected/gi, 'Pattern recognition detected'],
  [/across\s+(?:distinct\s+)?Parallax\s+sessions/gi, 'across distinct observation sessions'],
  [/Liminal\s+surfaced:?\s*/gi, 'Reflection surfaced: '],
  [/(?:in|during)\s+your\s+next\s+Liminal\s+session/gi, 'in your next reflection'],
  [/Liminal\s+sessions/gi, 'reflective sessions'],
  [/\bParallax\b/g, 'observation'],
  [/\bLiminal\b/g, 'reflection'],
  [/\bPraxis\b/g, 'experimentation'],
];

function distillSeedText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of DISTILL_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}

export function InquirySeeds({ onSelectSeed }: { onSelectSeed?: (text: string) => void }) {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/internal/inquiry-seeds')
      .then(r => r.ok ? r.json() : [])
      .then(setSeeds)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, []);

  if (loading || seeds.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-medium text-[#8D99AE] uppercase tracking-wider mb-3">
        The Loop Returns
      </h3>
      <p className="text-xs text-[#8D99AE]/60 mb-4">
        Your other tools have surfaced new questions for inquiry.
      </p>
      <div className="space-y-3">
        {seeds.map((seed) => (
          <button
            key={seed.id}
            onClick={() => onSelectSeed?.(seed.seed_text)}
            className="w-full text-left p-4 rounded-lg border border-[#2B2D42]/40 bg-[#2B2D42]/20 hover:bg-[#2B2D42]/40 hover:border-[#FFD166]/30 transition-all duration-200 group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-[#FFD166]/70">
                {SOURCE_LABELS[seed.source_app] || seed.source_app}
              </span>
              <span className="text-[10px] text-[#8D99AE]/40">·</span>
              <span className="text-[10px] text-[#8D99AE]/40">
                {EVENT_LABELS[seed.source_event_type] || seed.source_event_type}
              </span>
            </div>
            <p className="text-sm text-[#EDF2F4] leading-relaxed group-hover:text-white transition-colors">
              {distillSeedText(seed.seed_text)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
