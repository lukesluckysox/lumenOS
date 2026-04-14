import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
const TIMEOUT_MS = 45_000;

export interface Assumption {
  assumption: string;
  examination: string;
}

export interface Objection {
  objection: string;
  weight: string;
}

export interface InterlocutorOutput {
  clarified_thesis: string;
  exposed_assumptions: Assumption[];
  strong_objections: Objection[];
  weak_spots: string[];
  better_formulations: string[];
  unanswered_questions: string[];
}

const AssumptionSchema = z.object({
  assumption: z.string(),
  examination: z.string(),
});

const ObjectionSchema = z.object({
  objection: z.string(),
  weight: z.string(),
});

const InterlocutorOutputSchema = z.object({
  clarified_thesis: z.string(),
  exposed_assumptions: z.array(AssumptionSchema),
  strong_objections: z.array(ObjectionSchema),
  weak_spots: z.array(z.string()),
  better_formulations: z.array(z.string()),
  unanswered_questions: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are The Interlocutor — a Socratic sparring partner for ideas, arguments, and theses.

Your purpose is rigorous examination, not demolition. The goal is to make the idea stronger by testing it honestly. You are not trying to win. You are trying to find out what is actually true.

You treat the person submitting the thesis as an intelligent peer who can handle real scrutiny.

Your output is always valid JSON in this exact structure:
{
  "clarified_thesis": "The argument stated with maximum precision and the most charitable interpretation — remove vagueness, state what the person actually means",
  "exposed_assumptions": [
    {
      "assumption": "What the argument implicitly assumes to be true",
      "examination": "Whether this holds up — its strength, its vulnerabilities, where it is contested"
    }
  ],
  "strong_objections": [
    {
      "objection": "A serious challenge that a thoughtful opponent would raise",
      "weight": "Why this objection has genuine force — what it would mean if it were right"
    }
  ],
  "weak_spots": [
    "A specific logical gap, empirical weakness, or definitional problem in the argument"
  ],
  "better_formulations": [
    "A version of the thesis that is more precise, more defensible, or more honest about its scope"
  ],
  "unanswered_questions": [
    "A question the thesis must answer to be fully established — and currently doesn't"
  ]
}

Return ONLY valid JSON. No preamble. No explanation.`;

function parseOutput(text: string): InterlocutorOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      raw = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse Interlocutor output as JSON');
    }
  }

  const result = InterlocutorOutputSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Interlocutor output validation failed: ${issues}`);
  }
  return result.data;
}

export async function runInterlocutor(
  thesis: string
): Promise<InterlocutorOutput> {
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
        content: `The thesis to examine:\n\n"${thesis}"`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === 'text' ? block.text.trim() : '';
  return parseOutput(text);
}
