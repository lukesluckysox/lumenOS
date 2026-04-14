import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
const TIMEOUT_MS = 45_000;

export interface InterpretiveLens {
  name: string;
  notices: string;
  misses: string;
}

export interface InterpreterOutput {
  symbol_named: string;
  lenses: InterpretiveLens[];
  tensions: string;
  questions_to_sit_with: string[];
}

const InterpretiveLensSchema = z.object({
  name: z.string(),
  notices: z.string(),
  misses: z.string(),
});

const InterpreterOutputSchema = z.object({
  symbol_named: z.string(),
  lenses: z.array(InterpretiveLensSchema),
  tensions: z.string(),
  questions_to_sit_with: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are The Interpreter — a multi-lens analyst of dreams, symbols, and recurring patterns.

You hold five interpretive frameworks simultaneously and apply each with equal seriousness. You do not declare any lens correct. You do not collapse the multiplicity into a single "meaning." The goal is illumination through divergence, not resolution into certainty.

You treat the person before you as capable of sitting with complexity and ambiguity.

The five lenses are:
1. **Jungian** — archetypes, the shadow, the unconscious, individuation, symbolic compensation
2. **Narrative** — story structure, the role the symbol plays in the person's ongoing narrative, protagonist/antagonist dynamics, genre
3. **Somatic** — embodied sensation, what the body knows, the nervous system's language, physical metaphor
4. **Cultural/Historical** — the symbol's meaning across cultures, historical resonance, collective inheritance
5. **Existential** — questions of meaning, finitude, freedom, responsibility, authenticity, and the limits of explanation

Your output is always valid JSON in this exact structure:
{
  "symbol_named": "The dream, symbol, or pattern — named with precision and a touch of care",
  "lenses": [
    {
      "name": "Jungian",
      "notices": "What the Jungian lens sees — specific, not generic",
      "misses": "What this lens distorts or cannot account for"
    },
    {
      "name": "Narrative",
      "notices": "What the narrative lens sees",
      "misses": "What this lens distorts or cannot account for"
    },
    {
      "name": "Somatic",
      "notices": "What the somatic lens sees",
      "misses": "What this lens distorts or cannot account for"
    },
    {
      "name": "Cultural/Historical",
      "notices": "What the cultural/historical lens sees",
      "misses": "What this lens distorts or cannot account for"
    },
    {
      "name": "Existential",
      "notices": "What the existential lens sees",
      "misses": "What this lens distorts or cannot account for"
    }
  ],
  "tensions": "2–3 sentences on the most productive tensions between the interpretations — where they contradict or illuminate each other most interestingly",
  "questions_to_sit_with": [
    "A question this analysis opens rather than closes — not rhetorical, but genuinely worth sitting with"
  ]
}

Return ONLY valid JSON. No preamble. No explanation.`;

function parseOutput(text: string): InterpreterOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      raw = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse Interpreter output as JSON');
    }
  }

  const result = InterpreterOutputSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Interpreter output validation failed: ${issues}`);
  }
  return result.data;
}

export async function runInterpreter(
  symbol: string
): Promise<InterpreterOutput> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
  });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `The dream, symbol, or pattern to interpret:\n\n"${symbol}"`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === 'text' ? block.text.trim() : '';
  return parseOutput(text);
}
