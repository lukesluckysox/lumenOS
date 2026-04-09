/**
 * distillText — Cross-Tool Language Distillation Layer
 *
 * Rewrites third-person tool references in user-facing content to
 * first-person voice. Lumen tools should never "know" about each other
 * by name in the content layer.
 *
 * Provenance metadata (sourceApp, createdBy, etc.) is preserved
 * separately for the dashboard/cockpit — only the text that reaches
 * the user passes through distillation.
 *
 * Examples:
 *   "Parallax calls you an observer…"  → "I am an observer…"
 *   "Liminal surfaced: X"              → "Reflection surfaced: X"
 *   "Parallax detected a gap…"         → "A gap was detected…"
 *   "…in your next Liminal session"    → "…in your next reflection"
 */

// ─── Tool name → neutral synonym map ─────────────────────────────────────────

const TOOL_SYNONYMS: Record<string, string> = {
  liminal:  'reflection',
  parallax: 'observation',
  praxis:   'experimentation',
  axiom:    'conviction',
};

// ─── Replacement rules (ordered — apply sequentially) ─────────────────────────
//
// Each rule is [pattern, replacement]. Patterns are case-insensitive.
// The order matters: more specific phrases should come before generic ones
// so that e.g. "Parallax pattern analysis identified" is caught before
// the generic "Parallax" → "observation" fallback.

interface RewriteRule {
  pattern: RegExp;
  replacement: string;
}

const REWRITE_RULES: RewriteRule[] = [
  // ── Parallax-specific phrases ───────────────────────────────────────────────
  { pattern: /Parallax\s+calls\s+you/gi,                            replacement: 'I am called' },
  { pattern: /Parallax\s+detected\s+a\s+gap/gi,                     replacement: 'A gap was detected' },
  { pattern: /Parallax\s+identified/gi,                              replacement: 'Pattern recognition identified' },
  { pattern: /Parallax\s+pattern\s+analysis\s+identified/gi,         replacement: 'Pattern analysis identified' },
  { pattern: /Parallax\s+pattern:?\s*"([^"]+)"/gi,                   replacement: 'Observed pattern: "$1"' },
  { pattern: /Parallax\s+pattern:?\s*/gi,                            replacement: 'Observed pattern: ' },
  { pattern: /Parallax\s+detected/gi,                                replacement: 'Pattern recognition detected' },
  { pattern: /Parallax\s+observed/gi,                                replacement: 'Observation revealed' },
  { pattern: /across\s+(?:distinct\s+)?Parallax\s+sessions/gi,       replacement: 'across distinct observation sessions' },
  { pattern: /across\s+Parallax/gi,                                  replacement: 'across observation data' },
  { pattern: /(?:in|from|through)\s+available\s+Parallax\s+data/gi,  replacement: 'in available observation data' },
  { pattern: /(?:in|from)\s+Parallax\s+data/gi,                      replacement: 'in observation data' },
  { pattern: /pattern\s+recognition\s+\(Parallax\)/gi,               replacement: 'pattern recognition' },
  { pattern: /behavioral\s+pattern\s+recognition\s+\(Parallax\)/gi,  replacement: 'behavioral pattern recognition' },

  // ── Liminal-specific phrases ────────────────────────────────────────────────
  { pattern: /Liminal\s+surfaced:?\s*/gi,                            replacement: 'Reflection surfaced: ' },
  { pattern: /Liminal\s+belief-questioning\s+sessions/gi,            replacement: 'belief-questioning sessions' },
  { pattern: /Liminal\s+sessions/gi,                                 replacement: 'reflective sessions' },
  { pattern: /(?:in|during)\s+your\s+next\s+Liminal\s+session/gi,    replacement: 'in your next reflection' },
  { pattern: /belief-questioning\s+\(Liminal\)/gi,                    replacement: 'belief-questioning' },
  { pattern: /Reflect\s+on\s+this\s+in\s+your\s+next\s+Liminal\s+session\.?/gi, replacement: 'Reflect on this in your next session.' },

  // ── Praxis-specific phrases ─────────────────────────────────────────────────
  { pattern: /Praxis\s+experiment/gi,                                replacement: 'lived experiment' },
  { pattern: /(?:in|from)\s+my\s+experiments/gi,                     replacement: 'in my experiments' },

  // ── Axiom-specific phrases ──────────────────────────────────────────────────
  { pattern: /queued\s+for\s+Axiom\s+review/gi,                     replacement: 'queued for review' },
  { pattern: /Axiom\s+review/gi,                                     replacement: 'constitutional review' },
  { pattern: /A\s+new\s+axiom\s+has\s+been\s+accepted:\s*/gi,        replacement: 'A new truth has been accepted: ' },

  // ── Cross-tool convergence phrases ──────────────────────────────────────────
  { pattern: /Two\s+independent\s+instruments\s*—\s*belief-questioning\s*\(Liminal\)\s*and\s*pattern\s+recognition\s*\(Parallax\)\s*—/gi,
    replacement: 'Two independent methods — belief-questioning and pattern recognition —' },
  { pattern: /confirmed\s+by\s+independent\s+evidence\s+from\s+both\s+sources:\s*belief-questioning\s*\(Liminal\)\s*and\s*behavioral\s+pattern\s+recognition\s*\(Parallax\)/gi,
    replacement: 'confirmed by independent evidence from both belief-questioning and behavioral pattern recognition' },
  { pattern: /Cross-tool\s+agreement/gi,                             replacement: 'Cross-method agreement' },
  { pattern: /as\s+a\s+held\s+belief\s*\(Liminal\)\s*and\s+as\s+a\s+behavioral\s+tendency\s*\(Parallax\)/gi,
    replacement: 'as a held belief and as a behavioral tendency' },

  // ── Epistemic pipeline / queue / internal language cleanup ──────────────────
  { pattern: /\bepistemic queue\b/gi,                                  replacement: 'your reflections' },
  { pattern: /\bepistemic event\b/gi,                                  replacement: 'moment of inquiry' },
  { pattern: /\bepistemic pipeline\b/gi,                               replacement: 'inquiry process' },
  { pattern: /\bepistemic\b/gi,                                        replacement: 'inquiry' },
  { pattern: /\bauto-promoted from event processing\b/gi,              replacement: 'emerged from recent inquiry' },
  { pattern: /\bre-queued from reprocess\b/gi,                         replacement: 'revisiting for fresh perspective' },
  { pattern: /\baccepted candidate ready for experimentation\b/gi,     replacement: 'ready to become an experiment' },
  { pattern: /\bauto-generated from .+?\. Review and refine to structure your experiment\./gi,
    replacement: 'This experiment was suggested by patterns in your reflections. Shape it into something you can test.' },
  { pattern: /\bidentified in journal reflection\b/gi,                 replacement: 'noticed in your writing' },
  { pattern: /\bfrom behavioral tracking data\b/gi,                    replacement: 'observed in your patterns' },
  { pattern: /\bbelief pattern detected across (\d+) entries\b/gi,     replacement: 'a recurring theme across $1 reflections' },
  { pattern: /\blumen_push\b/gi,                                       replacement: 'from your reflections' },

  // ── Generic fallback: any remaining bare tool names ─────────────────────────
  // These run last so the specific phrases above are matched first.
  { pattern: /\bParallax\b/g,  replacement: 'observation' },
  { pattern: /\bLiminal\b/g,   replacement: 'reflection' },
  { pattern: /\bPraxis\b/g,    replacement: 'experimentation' },
  // Don't replace "Axiom" generically — it's also an English word meaning
  // "self-evident truth", which is exactly what the tool deals with.
  // Only replace when it's clearly a tool reference (handled above).
];

// ─── Main distillation function ───────────────────────────────────────────────

/**
 * Distill user-facing text by rewriting third-person tool references
 * to first-person or neutral voice.
 *
 * @param text  Raw text that may contain tool names
 * @returns     Distilled text with tool names removed from the narrative
 */
export function distillText(text: string): string {
  if (!text) return text;

  let result = text;
  for (const rule of REWRITE_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  // Clean up double spaces, leading/trailing whitespace
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * Distill all string values in an object (shallow — one level deep).
 * Useful for distilling entire push payloads.
 * Skips fields that are provenance metadata.
 */
const PROVENANCE_FIELDS = new Set([
  'sourceApp', 'source_app', 'source', 'createdBy', 'created_by',
  'targetApp', 'target_app', 'destinationApp', 'destination_app',
  'userId', 'user_id', 'lumenUserId',
]);

export function distillPayload<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (PROVENANCE_FIELDS.has(key)) continue; // preserve metadata
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = distillText(value);
    }
  }
  return result;
}

/**
 * Get a neutral label for a source app (for UI display).
 * Returns a human-friendly label without exposing the tool name.
 */
export function neutralSourceLabel(sourceApp: string): string {
  return TOOL_SYNONYMS[sourceApp.toLowerCase()] ?? sourceApp;
}
