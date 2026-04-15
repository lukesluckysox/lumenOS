import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db';
import { runRound2Streaming, type CouncilTurn } from '@/lib/tools/small-council/orchestrator';
import { emitToParallax, emitToAxiom, emitToPraxis } from '@/lib/parallaxEmitter';
import { emitForSession } from '@/lib/lumenEmitter';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const turnSchema = z.object({
  advisor: z.string(),
  round: z.literal(1),
  content: z.string(),
});

const schema = z.object({
  question: z.string().min(30).max(2000),
  round1Turns: z.array(turnSchema).min(1).max(5),
  clarification: z.string().max(1000).optional(),
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
  let round1Turns: CouncilTurn[];
  let clarification: string | undefined;
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
    round1Turns = parsed.data.round1Turns;
    clarification = parsed.data.clarification?.trim() || undefined;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  function sseEvent(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const output = await runRound2Streaming(question, round1Turns, {
          onAdvisorResponse: (turn) => {
            controller.enqueue(sseEvent('advisor', turn));
          },
          onRoundComplete: (round) => {
            controller.enqueue(sseEvent('round_complete', { round }));
          },
          onSynthesis: (synthesis) => {
            controller.enqueue(sseEvent('synthesis', { content: synthesis }));
          },
        }, clarification);

        const title =
          question.length > 80 ? question.slice(0, 80) + '…' : question;

        const session = await queryOne<{ id: string }>(
          `INSERT INTO tool_sessions
             (user_id, tool_slug, title, input_text, structured_output, summary)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            user.id,
            'small-council',
            title,
            question,
            JSON.stringify(output),
            output.summary,
          ]
        );

        // Fire-and-forget: emit base + enriched epistemic events to Lumen
        if (user.lumen_user_id && session) {
          emitForSession({ lumenUserId: user.lumen_user_id, sessionId: session.id, toolSlug: 'small-council', inputText: question, summary: output.summary });
        }

        // Collect downstream
        const downstream: { destination: string; description: string }[] = [];
        if (user.lumen_user_id && session) {
          const emitPayload = {
            lumenUserId: user.lumen_user_id,
            sessionId: session.id,
            toolSlug: 'small-council',
            inputText: question,
            structuredOutput: output,
            summary: output.summary || '',
          };
          const [parallaxResult, axiomResult, praxisResult] = await Promise.all([
            emitToParallax(emitPayload),
            emitToAxiom(emitPayload),
            emitToPraxis(emitPayload),
          ]);
          if (parallaxResult.sent) downstream.push({ destination: parallaxResult.destination, description: parallaxResult.description });
          if (axiomResult.sent) downstream.push({ destination: axiomResult.destination, description: axiomResult.description });
          if (praxisResult.sent) downstream.push({ destination: praxisResult.destination, description: praxisResult.description });
        }

        controller.enqueue(sseEvent('complete', { sessionId: session!.id, downstream }));
      } catch (err) {
        console.error('[small-council-round2]', err);
        controller.enqueue(
          sseEvent('error', {
            message: 'The council could not complete synthesis. Please try again.',
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
