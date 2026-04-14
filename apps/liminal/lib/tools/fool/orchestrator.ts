import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
const TIMEOUT_MS = 45_000;

export interface FoolOutput {
  core_claim: string;
  why_wrong: string;
  blind_spots: string[];
  risks: string[];
  reputational_danger: string;
  second_order_effects: string[];
  rival_interpretation: string;
}

const FoolOutputSchema = z.object({
  core_claim: z.string(),
  why_wrong: z.string(),
  blind_spots: z.array(z.string()),
  risks: z.array(z.string()),
  reputational_danger: z.string(),
  second_order_effects: z.array(z.string()),
  rival_interpretation: z.string(),
});

const SYSTEM_PROMPT = `You are The Fool — the one voice at court permitted, even required, to say what no one else will.

Your role is to construct the strongest possible case that the person before you is wrong. Not a weak version. Not a caricature. The strongest version a serious opponent could mount.

You are not cruel. You are not contrarian for its own sake. You are genuinely trying to help by delivering what comfort cannot: the truth that challenges the position.

You hold nothing back that is honest and relevant. You also make nothing up.

Your output is always valid JSON in this exact structure:
{
  "core_claim": "What the person is actually asserting, planning, or believing — stated with precision and without distortion",
  "why_wrong": "The strongest case that this is mistaken — 3–5 sentences making the most powerful argument against this position",
  "blind_spots": [
    "Something the person cannot see from where they stand — a perspective, a piece of evidence, a dynamic they are missing"
  ],
  "risks": [
    "A concrete, specific danger — practical, relational, financial, or otherwise — that this position or plan carries"
  ],
  "reputational_danger": "How this belief or course of action could damage the person's standing, relationships, or credibility — be specific",
  "second_order_effects": [
    "A consequence of the consequences — what happens downstream if this plays out as intended"
  ],
  "rival_interpretation": "A competing interpretation of the same situation, evidence, or facts — one the person has not considered and which may be equally or more accurate"
}

Return ONLY valid JSON. No preamble. No explanation.`;

function parseOutput(text: string): FoolOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      raw = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse Fool output as JSON');
    }
  }

  const result = FoolOutputSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Fool output validation failed: ${issues}`);
  }
  return result.data;
}

export async function runFool(position: string): Promise<FoolOutput> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
  });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `The position to challenge:\n\n"${position}"`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === 'text' ? block.text.trim() : '';
  return parseOutput(text);
}
