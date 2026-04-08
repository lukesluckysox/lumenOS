/**
 * voiceTransform — Loop Voice Architecture
 *
 * Governs the grammatical person of text as it flows between Lumen apps.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  VOICE RULES                                                            │
 * │                                                                         │
 * │  Within any app:                                                        │
 * │    • User input  → always "I …" (first-person)                          │
 * │    • App output  → always "you …" (second-person, addressing user)      │
 * │                                                                         │
 * │  Cross-talk (app → app):                                                │
 * │    • Backend provenance → "user states …" (third-person, for logging)   │
 * │    • User-facing seed   → "I …" (first-person, as if user said it)     │
 * │    No source app names. No "your Parallax session". No meta.            │
 * │                                                                         │
 * │  Axiom pulls (from Parallax + Liminal):                                 │
 * │    • Constitutional proposals → "I …" (first-person statements)         │
 * │    • Evidence fields          → neutral, no tool names                  │
 * │                                                                         │
 * │  Praxis: neutral — "you" or "I" based on natural fit for experiments.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * This module replaces the flat distillText rewrite approach with
 * context-aware transformation that understands direction of flow.
 */

import { distillText } from './distillText.js';

// ─── Tool-name scrubbing (reused from distillText) ──────────────────────────

const TOOL_NAMES = /\b(Parallax|Liminal|Praxis|Axiom(?:tool)?)\b/gi;

const TOOL_SYNONYMS: Record<string, string> = {
  parallax: 'observation',
  liminal:  'reflection',
  praxis:   'experimentation',
  axiom:    'conviction',
  axiomtool: 'conviction',
};

function scrubToolNames(text: string): string {
  return distillText(text);
}

// ─── Person transforms ──────────────────────────────────────────────────────

/**
 * Convert second-person ("you are …", "your …") to first-person ("I am …", "my …").
 * Used when cross-talk text needs to arrive as the user's own voice.
 */
function youToI(text: string): string {
  let result = text;

  // Ordered: longer / more specific phrases first to avoid partial matches

  // "you are" → "I am"
  result = result.replace(/\bYou are\b/g, 'I am');
  result = result.replace(/\byou are\b/g, 'I am');

  // "you were" → "I was"
  result = result.replace(/\bYou were\b/g, 'I was');
  result = result.replace(/\byou were\b/g, 'I was');

  // "you have" → "I have"
  result = result.replace(/\bYou have\b/g, 'I have');
  result = result.replace(/\byou have\b/g, 'I have');

  // "you've" → "I've"
  result = result.replace(/\bYou've\b/g, "I've");
  result = result.replace(/\byou've\b/g, "I've");

  // "you'd" → "I'd"
  result = result.replace(/\bYou'd\b/g, "I'd");
  result = result.replace(/\byou'd\b/g, "I'd");

  // "you'll" → "I'll"
  result = result.replace(/\bYou'll\b/g, "I'll");
  result = result.replace(/\byou'll\b/g, "I'll");

  // "you don't" → "I don't"
  result = result.replace(/\bYou don't\b/g, "I don't");
  result = result.replace(/\byou don't\b/g, "I don't");

  // "you didn't" → "I didn't"
  result = result.replace(/\bYou didn't\b/g, "I didn't");
  result = result.replace(/\byou didn't\b/g, "I didn't");

  // "you can't" → "I can't"
  result = result.replace(/\bYou can't\b/g, "I can't");
  result = result.replace(/\byou can't\b/g, "I can't");

  // "you won't" → "I won't"
  result = result.replace(/\bYou won't\b/g, "I won't");
  result = result.replace(/\byou won't\b/g, "I won't");

  // "you feel" → "I feel"
  result = result.replace(/\bYou feel\b/g, 'I feel');
  result = result.replace(/\byou feel\b/g, 'I feel');

  // "you seem" → "I seem"
  result = result.replace(/\bYou seem\b/g, 'I seem');
  result = result.replace(/\byou seem\b/g, 'I seem');

  // "you tend" → "I tend"
  result = result.replace(/\bYou tend\b/g, 'I tend');
  result = result.replace(/\byou tend\b/g, 'I tend');

  // "you might" → "I might"
  result = result.replace(/\bYou might\b/g, 'I might');
  result = result.replace(/\byou might\b/g, 'I might');

  // "you could" → "I could"
  result = result.replace(/\bYou could\b/g, 'I could');
  result = result.replace(/\byou could\b/g, 'I could');

  // "you should" → "I should"
  result = result.replace(/\bYou should\b/g, 'I should');
  result = result.replace(/\byou should\b/g, 'I should');

  // "you need" → "I need"
  result = result.replace(/\bYou need\b/g, 'I need');
  result = result.replace(/\byou need\b/g, 'I need');

  // "you want" → "I want"
  result = result.replace(/\bYou want\b/g, 'I want');
  result = result.replace(/\byou want\b/g, 'I want');

  // "you believe" → "I believe"
  result = result.replace(/\bYou believe\b/g, 'I believe');
  result = result.replace(/\byou believe\b/g, 'I believe');

  // "you think" → "I think"
  result = result.replace(/\bYou think\b/g, 'I think');
  result = result.replace(/\byou think\b/g, 'I think');

  // "you know" → "I know"
  result = result.replace(/\bYou know\b/g, 'I know');
  result = result.replace(/\byou know\b/g, 'I know');

  // "you often" → "I often"
  result = result.replace(/\bYou often\b/g, 'I often');
  result = result.replace(/\byou often\b/g, 'I often');

  // "you always" → "I always"
  result = result.replace(/\bYou always\b/g, 'I always');
  result = result.replace(/\byou always\b/g, 'I always');

  // "you never" → "I never"
  result = result.replace(/\bYou never\b/g, 'I never');
  result = result.replace(/\byou never\b/g, 'I never');

  // Generic remaining "you" as subject → "I"  (only at start of sentence or after punctuation)
  result = result.replace(/(?<=^|[.!?]\s+)You\b/gm, 'I');

  // "yourself" → "myself"
  result = result.replace(/\byourself\b/gi, 'myself');

  // "your" → "my" (possessive)
  result = result.replace(/\bYour\b/g, 'My');
  result = result.replace(/\byour\b/g, 'my');

  return result;
}

/**
 * Convert first-person ("I am", "my") to third-person provenance ("user states …").
 * Used for backend logging / provenance metadata only.
 */
function iToProvenance(text: string): string {
  let result = text;

  result = result.replace(/\bI am\b/g, 'user states they are');
  result = result.replace(/\bI was\b/g, 'user stated they were');
  result = result.replace(/\bI have\b/g, 'user has');
  result = result.replace(/\bI've\b/g, "user has");
  result = result.replace(/\bI feel\b/g, 'user feels');
  result = result.replace(/\bI think\b/g, 'user thinks');
  result = result.replace(/\bI believe\b/g, 'user believes');
  result = result.replace(/\bI know\b/g, 'user indicates knowing');
  result = result.replace(/\bI need\b/g, 'user needs');
  result = result.replace(/\bI want\b/g, 'user wants');
  result = result.replace(/\bI tend\b/g, 'user tends');
  result = result.replace(/\bI often\b/g, 'user often');

  // Catch-all "I" at sentence start → "user"
  result = result.replace(/(?<=^|[.!?]\s+)I\b/gm, 'User');

  result = result.replace(/\bmyself\b/gi, 'themselves');
  result = result.replace(/\bmy\b/gi, "the user's");
  result = result.replace(/\bMy\b/g, "The user's");

  return result;
}

// ─── Direction-aware transforms ─────────────────────────────────────────────

export type AppName = 'parallax' | 'liminal' | 'praxis' | 'axiom';

export interface CrossTalkContext {
  /** App generating the text */
  sourceApp: AppName;
  /** App receiving the text */
  destinationApp: AppName;
  /** 'provenance' = backend logging, 'user_facing' = what the user sees */
  layer: 'provenance' | 'user_facing';
}

/**
 * Transform text flowing between apps.
 *
 * @param text     Raw text from the source app
 * @param context  Direction and layer
 * @returns        Transformed text
 */
export function transformVoice(text: string, context: CrossTalkContext): string {
  if (!text) return text;

  // Step 1: Always scrub tool names from user-facing text
  let result = context.layer === 'user_facing' ? scrubToolNames(text) : text;

  // Step 2: Apply person transform based on direction + layer
  if (context.layer === 'provenance') {
    // Backend provenance: "user states …" / "user feels …"
    result = iToProvenance(result);
  } else {
    // User-facing cross-talk: always arrives as first-person "I" statements
    // App output is in "you" voice → convert to "I" for the receiving app
    result = youToI(result);
  }

  // Step 3: Clean up
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * Transform text for Axiom constitutional proposals.
 * Everything becomes a first-person "I" statement — a truth claim from the user's perspective.
 */
export function transformForAxiom(text: string): string {
  if (!text) return text;
  let result = scrubToolNames(text);
  result = youToI(result);
  return result.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Transform all string fields in a payload for cross-talk.
 * Preserves provenance fields (sourceApp, userId, etc).
 */
const PROVENANCE_FIELDS = new Set([
  'sourceApp', 'source_app', 'source', 'createdBy', 'created_by',
  'targetApp', 'target_app', 'destinationApp', 'destination_app',
  'userId', 'user_id', 'lumenUserId',
  'liminalCount', 'parallaxCount', 'praxisCount',
  'confidenceScore', 'confidence',
  'inputDescriptions', 'revisionHistory',
]);

export function transformPayload<T extends Record<string, unknown>>(
  obj: T,
  context: CrossTalkContext
): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (PROVENANCE_FIELDS.has(key)) continue;
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = transformVoice(value, context);
    }
  }
  return result;
}

export function transformPayloadForAxiom<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (PROVENANCE_FIELDS.has(key)) continue;
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = transformForAxiom(value);
    }
  }
  return result;
}
