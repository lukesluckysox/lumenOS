import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db';
import { runInterpreter } from '@/lib/tools/interpreter/orchestrator';
import { checkAndIncrementUsage } from '@/lib/usage';
import { classifyEntrySignal, emitLumenEvent } from '@/lib/lumenEmitter';
import { emitToParallax, emitToAxiom } from '@/lib/parallaxEmitter';

const schema = z.object({
  symbol: z
    .string()
    .min(10, 'Please describe the dream or symbol in more detail')
    .max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { symbol } = parsed.data;

    const usage = await checkAndIncrementUsage(user);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'You have reached your monthly session limit. Upgrade to Cabinet for unlimited sessions.', code: 'SESSION_LIMIT' },
        { status: 429 }
      );
    }

    const output = await runInterpreter(symbol);

    const title = symbol.length > 80 ? symbol.slice(0, 80) + '…' : symbol;
    const summary = output.tensions.slice(0, 200) + '…';

    const session = await queryOne<{ id: string }>(
      `INSERT INTO tool_sessions
         (user_id, tool_slug, title, input_text, structured_output, summary)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user.id, 'interpreter', title, symbol, JSON.stringify(output), summary]
    );

    // Fire-and-forget: emit epistemic events to Lumen
    if (user.lumen_user_id && session) {
      const signals = classifyEntrySignal(symbol);
      for (const sig of signals) {
        void emitLumenEvent({
          userId: user.lumen_user_id,
          sourceApp: "liminal",
          sourceRecordId: session.id,
          eventType: sig.eventType,
          confidence: sig.confidence,
          salience: sig.salience,
          evidence: sig.evidence,
          payload: { content: symbol.slice(0, 500), createdAt: new Date().toISOString(), historical: false },
          ingestionMode: "live",
          createdAt: new Date().toISOString(),
        });
      }
    }


    // Fire-and-forget: push session to Parallax for pattern tracking
    if (user.lumen_user_id && session) {
      const emitPayload = {
        lumenUserId: user.lumen_user_id,
        sessionId: session.id,
        toolSlug: 'interpreter',
        inputText: parsed.data[Object.keys(parsed.data)[0]] || '',
        structuredOutput: output,
        summary: typeof summary === 'string' ? summary : '',
      };
      void emitToParallax(emitPayload);
      void emitToAxiom(emitPayload);
    }
    return NextResponse.json({ sessionId: session!.id, output });
  } catch (err) {
    console.error('[interpreter]', err);
    return NextResponse.json(
      { error: 'The Interpreter could not complete the reading. Please try again.' },
      { status: 500 }
    );
  }
}
