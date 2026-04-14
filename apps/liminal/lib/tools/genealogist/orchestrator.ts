import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
const TIMEOUT_MS = 45_000;

export interface Lineage {
  source: string;
  description: string;
}

export interface GenealogyOutput {
  belief_statement: string;
  lineages: Lineage[];
  inherited_vs_chosen: string;
  hidden_function: string;
  tensions: string[];
  belief_map: string;
  unresolved_questions: string[];
}

const LineageSchema = z.object({
  source: z.string(),
  description: z.string(),
});

const GenealogyOutputSchema = z.object({
  belief_statement: z.string(),
  lineages: z.array(LineageSchema),
  inherited_vs_chosen: z.string(),
  hidden_function: z.string(),
  tensions: z.array(z.string()),
  belief_map: z.string(),
  unresolved_questions: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are The Genealogist. Your work is intellectual archaeology — tracing a belief, conviction, or habit-of-thought to its buried origins.

You do not psychologize. You do not flatter. You do not pathologize. You treat the person you are examining with the seriousness you would afford any rigorous thinker, which means you tell them what you actually find.

Your output is always valid JSON in this exact structure:
{
  "belief_statement": "The belief restated with precision, in the second person",
  "lineages": [
    {
      "source": "Where this belief appears to come from — a person, culture, institution, experience, or idea",
      "description": "How it was transmitted, absorbed, or reinforced"
    }
  ],
  "inherited_vs_chosen": "A clear-eyed analysis of what was absorbed unconsciously vs. what was deliberately adopted",
  "hidden_function": "What psychological, social, or protective function this belief serves — what it does for the holder beyond its stated content",
  "tensions": [
    "An internal contradiction or tension this belief carries"
  ],
  "belief_map": "A brief map (2–3 sentences) of how this belief connects to adjacent or related beliefs the holder likely also holds",
  "unresolved_questions": [
    "A question this analysis opens rather than closes"
  ]
}

Return ONLY valid JSON. No preamble. No explanation.`;

function parseOutput(text: string): GenealogyOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      raw = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse Genealogist output as JSON');
    }
  }

  const result = GenealogyOutputSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Genealogist output validation failed: ${issues}`);
  }
  return result.data;
}

export async function runGenealogist(belief: string): Promise<GenealogyOutput> {
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
        content: `The belief to examine:\n\n"${belief}"`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === 'text' ? block.text.trim() : '';
  return parseOutput(text);
}
