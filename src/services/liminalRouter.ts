/**
 * liminalRouter — Intelligent Tool Routing for Incoming Loop Feeds
 *
 * When cross-talk arrives at Liminal from Parallax, Axiom, or Praxis,
 * this module determines which Liminal tool should receive the inquiry.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  ROUTING LOGIC                                                       │
 * │                                                                      │
 * │  Small Council   — debates, dilemmas, multi-perspective questions,   │
 * │                    trade-offs, "should I…", competing values          │
 * │                                                                      │
 * │  The Fool        — absolute statements, certainties, "I always…",   │
 * │                    "I never…", identity claims that need reckoning   │
 * │                                                                      │
 * │  The Genealogist — beliefs about self/identity, origin stories,     │
 * │                    "I am the kind of person who…", inherited ideas   │
 * │                                                                      │
 * │  The Interlocutor— theses, arguments, intellectual positions,       │
 * │                    claims that need Socratic examination             │
 * │                                                                      │
 * │  The Interpreter — dreams, symbols, recurring images, patterns      │
 * │                    that need multi-lens reading                      │
 * │                                                                      │
 * │  Stoic's Ledger  — daily conduct, moral accounting, "today I…",     │
 * │                    behavioral reports, accountability                │
 * └──────────────────────────────────────────────────────────────────────┘
 */

export type LiminalTool =
  | 'small-council'
  | 'fool'
  | 'genealogist'
  | 'interlocutor'
  | 'interpreter'
  | 'stoics-ledger';

export interface RoutingResult {
  tool: LiminalTool;
  confidence: number;   // 0–1, how certain the routing is
  reason: string;       // Human-readable explanation (for provenance/debug)
}

// ─── Signal patterns ────────────────────────────────────────────────────────

interface SignalRule {
  tool: LiminalTool;
  weight: number;
  patterns: RegExp[];
}

const SIGNAL_RULES: SignalRule[] = [
  // ── The Fool: absolutes, certainties, strong identity claims ──────────
  {
    tool: 'fool',
    weight: 1.0,
    patterns: [
      /\bI always\b/i,
      /\bI never\b/i,
      /\bI('m| am) (definitely|certainly|absolutely|completely|100%)/i,
      /\bI('m| am) (sure|certain|positive|convinced)\b/i,
      /\bwithout (a )?doubt\b/i,
      /\bthere('s| is) no (way|chance|question)\b/i,
      /\bI (just )?know (that |this )?for (a fact|certain|sure)\b/i,
      /\bobviously\b/i,
      /\bof course I\b/i,
      /\bevery(one|body) (knows|agrees|thinks)\b/i,
      /\bit('s| is) (obvious|clear|undeniable|unquestionable)\b/i,
      /\bno one (can|could|would)\b/i,
      /\bI could never\b/i,
      /\bI will always\b/i,
      /\bthat('s| is) just (how|who|what) I am\b/i,
    ],
  },

  // ── Small Council: debates, dilemmas, trade-offs ──────────────────────
  {
    tool: 'small-council',
    weight: 0.9,
    patterns: [
      /\bshould I\b/i,
      /\bon (one|the one) hand\b/i,
      /\bon the other hand\b/i,
      /\bbut (at the same time|also|then again)\b/i,
      /\btorn between\b/i,
      /\bcan('t| not) decide\b/i,
      /\bdilemma\b/i,
      /\btrade-?off\b/i,
      /\bpart of me (wants|thinks|feels|believes)\b/i,
      /\bweighing\b.*\b(options|choices|pros|cons)\b/i,
      /\b(stuck|caught) between\b/i,
      /\bboth (sides|options|paths)\b/i,
      /\bI('m| am) conflicted\b/i,
      /\bI('m| am) (not sure|unsure) (whether|if)\b/i,
      /\bcompeting (values|priorities|interests|desires)\b/i,
    ],
  },

  // ── The Genealogist: identity, origin, "kind of person who" ───────────
  {
    tool: 'genealogist',
    weight: 0.85,
    patterns: [
      /\bI('m| am) the (kind|type|sort) of person (who|that)\b/i,
      /\bI've always been\b/i,
      /\b(my (family|parents|mother|father|upbringing)) (taught|told|made|raised)\b/i,
      /\bwhere (does|did) this (belief|feeling|thought|idea) come from\b/i,
      /\bI inherited\b/i,
      /\bgrew up (thinking|believing|feeling)\b/i,
      /\bI was (taught|raised|told) (to|that)\b/i,
      /\bcore (belief|identity|value)\b/i,
      /\bwho I (really )?am\b/i,
      /\bmy (identity|nature|essence|character)\b/i,
      /\bI('ve| have) always (thought|believed|felt|been)\b/i,
      /\bdeep down\b/i,
      /\bat (my )?core\b/i,
    ],
  },

  // ── The Interlocutor: theses, arguments, intellectual claims ──────────
  {
    tool: 'interlocutor',
    weight: 0.8,
    patterns: [
      /\bI (think|argue|claim|contend|maintain|assert|propose|posit) that\b/i,
      /\bmy (thesis|argument|position|claim|view|stance) is\b/i,
      /\bthe (problem|issue|question|matter) (is|with)\b/i,
      /\bbecause (I think|I believe|it follows|therefore|logically)\b/i,
      /\b(therefore|thus|hence|consequently|it follows)\b/i,
      /\bif .+ then\b/i,
      /\bthe (evidence|data|facts|reason) (suggests?|shows?|indicates?|proves?)\b/i,
      /\bI (disagree|agree) (with|that)\b/i,
      /\bin principle\b/i,
      /\bfundamentally\b/i,
    ],
  },

  // ── The Interpreter: dreams, symbols, images, recurring motifs ────────
  {
    tool: 'interpreter',
    weight: 0.85,
    patterns: [
      /\bI (dreamt|dreamed|had a dream)\b/i,
      /\bin (my|the|a) dream\b/i,
      /\brecurring (dream|image|symbol|motif|pattern|vision)\b/i,
      /\bsymbol(ic|ism|s)?\b/i,
      /\b(keeps?|kept) (coming back|appearing|showing up|recurring)\b/i,
      /\bwhat does .+ (mean|signify|represent|symbolize)\b/i,
      /\bI keep (seeing|hearing|imagining|dreaming about|thinking about)\b/i,
      /\bvision\b/i,
      /\bmetaphor(ic|ically)?\b/i,
    ],
  },

  // ── Stoic's Ledger: daily conduct, accountability, moral report ───────
  {
    tool: 'stoics-ledger',
    weight: 0.8,
    patterns: [
      /\btoday I\b/i,
      /\bthis (morning|afternoon|evening)\b/i,
      /\bI (did|didn't|avoided|procrastinated|followed through|kept|broke)\b/i,
      /\bI (should have|could have|failed to|managed to|succeeded in)\b/i,
      /\bmy (conduct|behavior|actions|discipline|habits?) today\b/i,
      /\bI (was|wasn't) (disciplined|lazy|productive|accountable)\b/i,
      /\bI (made|broke) (a |my )(promise|commitment|rule|habit)\b/i,
      /\baccountab(le|ility)\b/i,
      /\bI (need to|must) (do better|improve|change)\b/i,
      /\bI (fell short|dropped the ball|let myself down)\b/i,
    ],
  },
];

// ─── Source-context boosters ────────────────────────────────────────────────
// Certain event types from certain source apps bias toward specific tools.

interface ContextBoost {
  sourceApp: string;
  sourceEventType?: string;
  candidateType?: string;
  tool: LiminalTool;
  boost: number;  // added to that tool's score
}

const CONTEXT_BOOSTS: ContextBoost[] = [
  // Axiom constitutional promotions → Genealogist (trace the origin of this new truth)
  { sourceApp: 'axiom', sourceEventType: 'constitutional_promotion', tool: 'genealogist', boost: 0.3 },
  // Axiom truth revisions → Fool (challenge the revision, reckon with it)
  { sourceApp: 'axiom', sourceEventType: 'truth_revision', tool: 'fool', boost: 0.3 },
  // Axiom tensions → Small Council (deliberate on the tension)
  { sourceApp: 'axiom', sourceEventType: 'tension_surfaced', tool: 'small-council', boost: 0.4 },
  // Parallax pattern detected → Genealogist (where did this pattern originate?)
  { sourceApp: 'parallax', sourceEventType: 'pattern_detected', tool: 'genealogist', boost: 0.2 },
  // Parallax identity discrepancy → Fool (challenge the gap)
  { sourceApp: 'parallax', candidateType: 'identity_discrepancy', tool: 'fool', boost: 0.35 },
  // Praxis experiment → Interlocutor (examine the findings)
  { sourceApp: 'praxis', sourceEventType: 'experiment_completed', tool: 'interlocutor', boost: 0.3 },
  // Praxis experiment → Stoic's Ledger (accountability for follow-through)
  { sourceApp: 'praxis', sourceEventType: 'experiment_completed', tool: 'stoics-ledger', boost: 0.15 },
];

// ─── Main routing function ──────────────────────────────────────────────────

export interface RoutingInput {
  text: string;
  sourceApp?: string;
  sourceEventType?: string;
  candidateType?: string;
}

/**
 * Route incoming loop feed text to the most appropriate Liminal tool.
 *
 * @param input  The text and optional source metadata
 * @returns      The recommended tool, confidence, and reason
 */
export function routeToLiminalTool(input: RoutingInput): RoutingResult {
  const { text, sourceApp, sourceEventType, candidateType } = input;

  // Score each tool
  const scores: Record<LiminalTool, number> = {
    'small-council': 0,
    'fool': 0,
    'genealogist': 0,
    'interlocutor': 0,
    'interpreter': 0,
    'stoics-ledger': 0,
  };

  const lower = text.toLowerCase();

  // 1. Pattern matching
  for (const rule of SIGNAL_RULES) {
    let matchCount = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
      // Reset lastIndex for /g patterns
      pattern.lastIndex = 0;
    }
    if (matchCount > 0) {
      // Diminishing returns: first match is full weight, subsequent are halved
      scores[rule.tool] += rule.weight * (1 + Math.log2(matchCount)) / (1 + Math.log2(rule.patterns.length));
    }
  }

  // 2. Context boosts from source metadata
  if (sourceApp) {
    for (const boost of CONTEXT_BOOSTS) {
      if (boost.sourceApp !== sourceApp) continue;
      if (boost.sourceEventType && boost.sourceEventType !== sourceEventType) continue;
      if (boost.candidateType && boost.candidateType !== candidateType) continue;
      scores[boost.tool] += boost.boost;
    }
  }

  // 3. Find winner
  const entries = Object.entries(scores) as [LiminalTool, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [topTool, topScore] = entries[0];
  const [, secondScore] = entries[1] || [null, 0];

  // If no signals matched at all, fall back based on source context
  if (topScore === 0) {
    return selectFallback(sourceApp, sourceEventType);
  }

  // Confidence: how much the top pick leads over the second
  const gap = topScore - secondScore;
  const confidence = Math.min(1.0, 0.5 + gap * 0.5);

  return {
    tool: topTool,
    confidence,
    reason: buildReason(topTool, sourceApp, sourceEventType),
  };
}

// ─── Fallback: when no text patterns match ──────────────────────────────────

function selectFallback(sourceApp?: string, sourceEventType?: string): RoutingResult {
  // Sensible defaults based on where the feed came from
  if (sourceApp === 'axiom') {
    if (sourceEventType === 'tension_surfaced') {
      return { tool: 'small-council', confidence: 0.5, reason: 'Tension from constitution → deliberation' };
    }
    return { tool: 'genealogist', confidence: 0.4, reason: 'Constitutional insight → trace origin' };
  }

  if (sourceApp === 'parallax') {
    return { tool: 'genealogist', confidence: 0.4, reason: 'Observed pattern → investigate origin' };
  }

  if (sourceApp === 'praxis') {
    return { tool: 'interlocutor', confidence: 0.4, reason: 'Experiment result → examine findings' };
  }

  // Pure fallback: Small Council handles ambiguity well
  return { tool: 'small-council', confidence: 0.3, reason: 'Ambiguous input → multi-perspective deliberation' };
}

function buildReason(tool: LiminalTool, sourceApp?: string, eventType?: string): string {
  const toolNames: Record<LiminalTool, string> = {
    'small-council': 'deliberation (competing perspectives detected)',
    'fool': 'reckoning (absolute/certain language detected)',
    'genealogist': 'origin tracing (identity/belief claim detected)',
    'interlocutor': 'examination (thesis/argument detected)',
    'interpreter': 'multi-lens reading (symbolic/dream content detected)',
    'stoics-ledger': 'accountability (daily conduct report detected)',
  };

  let reason = toolNames[tool];
  if (sourceApp) {
    reason += ` [from: ${sourceApp}${eventType ? '/' + eventType : ''}]`;
  }
  return reason;
}

export type LiminalPromptType =
  | 'followup_question'
  | 'experiment_prompt'
  | 'revision_prompt'
  | 'discrepancy_prompt'
  | 'deliberation_prompt'
  | 'reckoning_prompt'
  | 'origin_prompt'
  | 'examination_prompt'
  | 'interpretation_prompt'
  | 'accountability_prompt';

/**
 * Route and return a suggested promptType for the inquiry-seeds table.
 * Maps the tool to the kind of prompt it generates.
 */
export function toolToPromptType(tool: LiminalTool): LiminalPromptType {
  const map: Record<LiminalTool, LiminalPromptType> = {
    'small-council': 'deliberation_prompt',
    'fool': 'reckoning_prompt',
    'genealogist': 'origin_prompt',
    'interlocutor': 'examination_prompt',
    'interpreter': 'interpretation_prompt',
    'stoics-ledger': 'accountability_prompt',
  };
  return map[tool] ?? 'followup_question';
}
