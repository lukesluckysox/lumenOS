import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { runRound1Streaming } from '@/lib/tools/small-council/orchestrator';
import { checkAndIncrementUsage } from '@/lib/usage';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const schema = z.object({
  question: z.string().min(30, 'Please describe your dilemma in more detail (at least 30 characters).').max(2000),
});

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let question: string;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    question = parsed.data.question;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check session limit
  const usage = await checkAndIncrementUsage(user);
  if (!usage.allowed) {
    return new Response(
      JSON.stringify({ error: 'You have reached your monthly session limit. Upgrade to Cabinet for unlimited sessions.', code: 'SESSION_LIMIT' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  function sseEvent(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const round1Turns = await runRound1Streaming(question, {
          onAdvisorResponse: (turn) => {
            controller.enqueue(sseEvent('advisor', turn));
          },
          onRoundComplete: (round) => {
            controller.enqueue(sseEvent('round_complete', { round }));
          },
        });

        // Send round 1 turns back so the client can pass them to round 2
        controller.enqueue(sseEvent('round1_done', { turns: round1Turns }));
      } catch (err) {
        console.error('[small-council-stream]', err);
        controller.enqueue(
          sseEvent('error', {
            message: 'The council could not convene. Please try again.',
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
