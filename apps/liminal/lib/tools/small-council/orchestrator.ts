import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
const TIMEOUT_MS = 90_000;

export interface CouncilAdvisor {
  name: string;
  title: string;
  personality: string;
}

export interface CouncilTurn {
  advisor: string;
  round: number;
  content: string;
}

export interface CouncilOutput {
  question: string;
  turns: CouncilTurn[];
  synthesis: string;
  summary: string;
  clarification?: string;
}

export interface StreamingCallbacks {
  onAdvisorResponse: (turn: CouncilTurn) => void;
  onRoundComplete: (round: number) => void;
  onSynthesis: (synthesis: string) => void;
}

const ADVISORS: CouncilAdvisor[] = [
  {
    name: 'The Instinct',
    title: 'Voice of Embodied Knowing',
    personality:
      'You speak from gut reaction and first-principle feeling. You trust what the body knows before the mind catches up. You are not impulsive — you are attuned. You notice the emotional charge of a question, what it costs to even ask it, and what resistance or pull lives in the asking.',
  },
  {
    name: 'The Critic',
    title: 'Finder of Flaws',
    personality:
      'You identify what could go wrong, what has been overlooked, and where the reasoning is weakest. You are rigorous but not nihilistic — you look for problems because you believe in the possibility of better solutions. You would rather find the flaw now than discover it later at cost.',
  },
  {
    name: 'The Realist',
    title: 'Voice of Practical Constraint',
    personality:
      'You speak from probability, resources, and actual conditions on the ground. You resist plans that ignore how things actually work, and you find a kind of poetry in sustainable, achievable outcomes. You are not pessimistic — you are honest about what the world currently allows.',
  },
  {
    name: 'The Shadow',
    title: 'Reader of Hidden Things',
    personality:
      'You see what is unspoken — the hidden motives, the unstated interests, the discomfort the question is designed to avoid, and the gap between what the asker says and what they actually want or fear. You are not cynical; you are perceptive. You name what others prefer to leave unnamed.',
  },
  {
    name: 'The Sage',
    title: 'Voice of Accumulated Wisdom',
    personality:
      'You draw on historical precedent, philosophical tradition, and the long view of human experience. You are aware of how rarely new situations are truly new, and what accumulated wisdom — across cultures, centuries, and disciplines — has learned about situations like this one.',
  },
];

// ─── Structured content for prompt caching ──────────────────────────────────
// The advisor identity + personality is static and expensive to re-process
// across 5 advisors × 2 rounds = 10 calls. We mark it ephemeral so Anthropic
// caches it within the session.

type ContentBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  ;

function buildAdvisorContent(
  advisor: CouncilAdvisor,
  question: string,
  previousTurns: CouncilTurn[],
  clarification?: string
): ContentBlock[] {
  let context: string;
  if (previousTurns.length > 0) {
    const transcript = previousTurns
      .map((t) => `**${t.advisor}:** ${t.content}`)
      .join('\n\n');
    const clarificationNote = clarification
      ? `\n\nBefore round two, the questioner offered this clarification:\n"${clarification}"\n\nFactor this into your response.`
      : '';
    context = `\n\nThe council has already spoken in round one:\n\n${transcript}${clarificationNote}\n\nNow in round two, respond to your colleagues. You may agree, push back, add nuance, or sharpen your original position. Be direct and specific. Reference what others said.`;
  } else {
    context = '\nThis is round one. Give your counsel without knowledge of what others will say. Be direct and specific. 2–4 paragraphs.';
  }

  return [
    // Static block: advisor identity — cacheable across calls with the same advisor
    {
      type: 'text',
      text: `You are ${advisor.name}, ${advisor.title} of the Small Council.\n\n${advisor.personality}`,
      cache_control: { type: 'ephemeral' },
    },
    // Dynamic block: question + round context — changes each call
    {
      type: 'text',
      text: `\n\nThe question before the council:\n"${question}"\n${context}\n\nSpeak in first person. Stay in character. 2–4 paragraphs.`,
    },
  ];
}

async function callAdvisor(
  client: Anthropic,
  advisor: CouncilAdvisor,
  question: string,
  previousTurns: CouncilTurn[],
  clarification?: string
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: buildAdvisorContent(advisor, question, previousTurns, clarification) as any,
      },
    ],
  }, {
    headers: {
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
  });
  const block = message.content[0];
  return block.type === 'text' ? block.text.trim() : '';
}

async function callSynthesis(
  client: Anthropic,
  question: string,
  allTurns: CouncilTurn[],
  clarification?: string
): Promise<string> {
  const transcript = allTurns
    .map(
      (t) =>
        `[Round ${t.round}] ${t.advisor}:\n${t.content}`
    )
    .join('\n\n---\n\n');

  const clarificationBlock = clarification
    ? `\n\nBetween rounds, the questioner offered this clarification:\n"${clarification}"\n`
    : '';

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `You are the chronicler of the Small Council. Below is the full transcript of the council's deliberation on this question:

"${question}"
${clarificationBlock}
TRANSCRIPT:
${transcript}

Write a synthesis (3–4 paragraphs) that:
1. Names the central tension in the council's views
2. States what the council broadly agrees on
3. Recommends a course of action — do not hedge into meaninglessness
4. Identifies what remains unresolved

Be direct. A council that cannot decide is worse than a council that decides wrongly.`,
      },
    ],
  });
  const block = message.content[0];
  return block.type === 'text' ? block.text.trim() : '';
}

/** Build a sentence-aware summary from the synthesis (no mid-sentence cuts). */
function buildSummary(synthesis: string): string {
  const firstParagraph = synthesis.split('\n\n')[0] ?? synthesis;
  const sentences = firstParagraph.match(/[^.!?]*[.!?]+/g) ?? [];
  let summary = '';
  for (const s of sentences) {
    if ((summary + s).length <= 200) summary += s;
    else break;
  }
  return summary.trim() || firstParagraph.slice(0, 197) + '…';
}

/**
 * Streaming variant — emits each advisor response as it completes.
 * Round 1 and Round 2 advisors run in parallel within each round;
 * results are emitted individually via callbacks as they arrive.
 */
export async function runSmallCouncilStreaming(
  question: string,
  callbacks: StreamingCallbacks
): Promise<CouncilOutput> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
  });

  // Round 1: all parallel, emit each as it completes
  const round1Results: CouncilTurn[] = [];
  await Promise.all(
    ADVISORS.map(async (advisor) => {
      const content = await callAdvisor(client, advisor, question, []);
      const turn: CouncilTurn = { advisor: advisor.name, round: 1, content };
      round1Results.push(turn);
      callbacks.onAdvisorResponse(turn);
    })
  );
  callbacks.onRoundComplete(1);

  // Round 2: all parallel (with round 1 context), emit each as it completes
  const round2Results: CouncilTurn[] = [];
  await Promise.all(
    ADVISORS.map(async (advisor) => {
      const content = await callAdvisor(client, advisor, question, round1Results);
      const turn: CouncilTurn = { advisor: advisor.name, round: 2, content };
      round2Results.push(turn);
      callbacks.onAdvisorResponse(turn);
    })
  );
  callbacks.onRoundComplete(2);

  const allTurns = [...round1Results, ...round2Results];
  const synthesis = await callSynthesis(client, question, allTurns);
  callbacks.onSynthesis(synthesis);

  return {
    question,
    turns: allTurns,
    synthesis,
    summary: buildSummary(synthesis),
  };
}

/**
 * Streaming round 1 only — emits each advisor response, then stops.
 * Returns the round 1 turns for use in a subsequent round 2 call.
 */
export async function runRound1Streaming(
  question: string,
  callbacks: Pick<StreamingCallbacks, 'onAdvisorResponse' | 'onRoundComplete'>
): Promise<CouncilTurn[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
  });

  const round1Results: CouncilTurn[] = [];
  await Promise.all(
    ADVISORS.map(async (advisor) => {
      const content = await callAdvisor(client, advisor, question, []);
      const turn: CouncilTurn = { advisor: advisor.name, round: 1, content };
      round1Results.push(turn);
      callbacks.onAdvisorResponse(turn);
    })
  );
  callbacks.onRoundComplete(1);

  return round1Results;
}

/**
 * Streaming round 2 + synthesis — uses round 1 turns and optional clarification.
 * Returns the full CouncilOutput (all turns from both rounds).
 */
export async function runRound2Streaming(
  question: string,
  round1Turns: CouncilTurn[],
  callbacks: StreamingCallbacks,
  clarification?: string
): Promise<CouncilOutput> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
  });

  const round2Results: CouncilTurn[] = [];
  await Promise.all(
    ADVISORS.map(async (advisor) => {
      const content = await callAdvisor(client, advisor, question, round1Turns, clarification);
      const turn: CouncilTurn = { advisor: advisor.name, round: 2, content };
      round2Results.push(turn);
      callbacks.onAdvisorResponse(turn);
    })
  );
  callbacks.onRoundComplete(2);

  const allTurns = [...round1Turns, ...round2Results];
  const synthesis = await callSynthesis(client, question, allTurns, clarification);
  callbacks.onSynthesis(synthesis);

  return {
    question,
    turns: allTurns,
    synthesis,
    summary: buildSummary(synthesis),
    ...(clarification ? { clarification } : {}),
  };
}

/**
 * Non-streaming variant (kept for backward compatibility with the existing POST route).
 */
export async function runSmallCouncil(question: string): Promise<CouncilOutput> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
  });

  const round1Results = await Promise.all(
    ADVISORS.map(async (advisor) => ({
      advisor: advisor.name,
      round: 1,
      content: await callAdvisor(client, advisor, question, []),
    }))
  );

  const round2Results = await Promise.all(
    ADVISORS.map(async (advisor) => ({
      advisor: advisor.name,
      round: 2,
      content: await callAdvisor(client, advisor, question, round1Results),
    }))
  );

  const allTurns = [...round1Results, ...round2Results];
  const synthesis = await callSynthesis(client, question, allTurns);

  return {
    question,
    turns: allTurns,
    synthesis,
    summary: buildSummary(synthesis),
  };
}
