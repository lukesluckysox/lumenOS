'use client';

import { useState, useEffect } from 'react';

interface Seed {
  id: string;
  source_app: string;
  source_event_type: string;
  seed_text: string;
  suggested_tool: string | null;
  routing_reason: string | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  axiom: 'Constitutional insight',
  parallax: 'Pattern observed',
  praxis: 'Experiment concluded',
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
  // Specific phrases first
  [/Parallax\s+calls\s+you/gi, 'I am called'],
  [/Parallax\s+detected\s+a\s+gap/gi, 'A gap was detected'],
  [/Parallax\s+identified/gi, 'Pattern recognition identified'],
  [/Parallax\s+pattern:?\s*/gi, 'Observed pattern: '],
  [/Parallax\s+detected/gi, 'Pattern recognition detected'],
  [/across\s+(?:distinct\s+)?Parallax\s+sessions/gi, 'across distinct observation sessions'],
  [/Liminal\s+surfaced:?\s*/gi, 'Reflection surfaced: '],
  [/(?:in|during)\s+your\s+next\s+Liminal\s+session/gi, 'in your next reflection'],
  [/Liminal\s+sessions/gi, 'reflective sessions'],
  [/Axiom\s+review/gi, 'constitutional review'],
  [/queued\s+for\s+Axiom/gi, 'queued for review'],
  [/Cross-tool\s+agreement/gi, 'Cross-method agreement'],
  // Generic fallback — bare tool names
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

// Tool display names for the seed label
const TOOL_LABELS: Record<string, string> = {
  'small-council':  'Small Council',
  'fool':           'The Fool',
  'genealogist':    'The Genealogist',
  'interlocutor':   'The Interlocutor',
  'interpreter':    'The Interpreter',
  'stoics-ledger':  "The Stoic's Ledger",
};

export function InquirySeeds({ onSelectSeed }: { onSelectSeed?: (seed: Seed) => void }) {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);

  function fetchSeeds() {
    setLoading(true);
    fetch('/api/internal/inquiry-seeds')
      .then(r => r.ok ? r.json() : [])
      .then(setSeeds)
      .catch(() => [])
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchSeeds(); }, []);

  function dismissSeed(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSeeds(prev => prev.filter(s => s.id !== id));
    fetch('/api/internal/inquiry-seeds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  function dismissAll() {
    setSeeds([]);
    fetch('/api/internal/inquiry-seeds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  if (loading || seeds.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[#8D99AE] uppercase tracking-wider">
          The Loop Returns
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSeeds}
            className="text-[10px] uppercase tracking-widest text-[#8D99AE]/50 hover:text-[#FFD166]/70 transition-colors"
            title="Refresh"
          >
            ↻ Refresh
          </button>
          <button
            onClick={dismissAll}
            className="text-[10px] uppercase tracking-widest text-[#8D99AE]/50 hover:text-[#c96a5a]/80 transition-colors"
            title="Clear all"
          >
            ✕ Clear all
          </button>
        </div>
      </div>
      <p className="text-xs text-[#8D99AE]/60 mb-4">
        New questions have surfaced from the loop.
      </p>
      <div className="space-y-3">
        {seeds.map((seed) => {
          const toolLabel = seed.suggested_tool ? TOOL_LABELS[seed.suggested_tool] : null;
          return (
            <button
              key={seed.id}
              onClick={() => onSelectSeed?.(seed)}
              className="w-full text-left p-4 rounded-lg border border-[#2B2D42]/40 bg-[#2B2D42]/20 hover:bg-[#2B2D42]/40 hover:border-[#FFD166]/30 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#FFD166]/70">
                    {SOURCE_LABELS[seed.source_app] || seed.source_app}
                  </span>
                  <span className="text-[10px] text-[#8D99AE]/40">·</span>
                  <span className="text-[10px] text-[#8D99AE]/40">
                    {EVENT_LABELS[seed.source_event_type] || seed.source_event_type}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {toolLabel && (
                    <span className="text-[10px] uppercase tracking-widest text-[#8D99AE]/50">
                      → {toolLabel}
                    </span>
                  )}
                  <button
                    onClick={(e) => dismissSeed(seed.id, e)}
                    className="text-[#8D99AE]/30 hover:text-[#c96a5a]/80 transition-colors text-xs leading-none px-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-sm text-[#EDF2F4] leading-relaxed group-hover:text-white transition-colors">
                {distillSeedText(seed.seed_text)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
