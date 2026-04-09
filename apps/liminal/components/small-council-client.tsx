'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ToolIcon } from '@/components/tool-icon';
import { DownstreamSummary, type DownstreamItem } from '@/components/downstream-summary';

const ACCENT = '184 150 58';

interface AdvisorTurn {
  advisor: string;
  round: number;
  content: string;
}

type Phase = 'idle' | 'streaming' | 'done' | 'error';

// ── SSE stream reader ──────────────────────────────────────────────────────────

async function readSSEStream(
  response: Response,
  handlers: {
    advisor:       (d: AdvisorTurn) => void;
    round_complete:(d: { round: number }) => void;
    synthesis:     (d: { content: string }) => void;
    complete:      (d: { sessionId: string; downstream?: DownstreamItem[] }) => void;
    error:         (d: { message: string }) => void;
  }
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split('\n\n');
    buffer = messages.pop() ?? '';

    for (const message of messages) {
      if (!message.trim()) continue;

      let eventType = 'message';
      let dataStr = '';

      for (const line of message.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataStr = line.slice(6);
      }

      if (!dataStr) continue;

      try {
        const data = JSON.parse(dataStr);
        const handler = handlers[eventType as keyof typeof handlers];
        if (handler) (handler as (d: unknown) => void)(data);
      } catch {
        // ignore malformed SSE frames
      }
    }
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AdvisorCard({
  turn,
  isNew,
}: {
  turn: AdvisorTurn;
  isNew: boolean;
}) {
  return (
    <div
      style={{
        padding: '1.125rem 1.375rem',
        background: 'rgb(var(--color-surface-2))',
        borderRadius: '6px',
        border: '1px solid rgb(var(--color-border) / 0.08)',
        animation: isNew ? 'fadeSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) both' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.625rem',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(0.65rem, 0.6rem + 0.15vw, 0.7rem)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: `rgb(${ACCENT})`,
          }}
        >
          {turn.advisor}
        </span>
      </div>
      <p
        style={{
          fontSize: 'clamp(0.875rem, 0.8rem + 0.3vw, 0.9375rem)',
          color: 'rgb(var(--color-text-muted))',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
        }}
      >
        {turn.content}
      </p>
    </div>
  );
}

function RoundHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        margin: '2rem 0 1.25rem',
        animation: 'fadeSlideUp 0.3s ease both',
      }}
    >
      <span
        style={{
          fontSize: 'clamp(0.7rem, 0.65rem + 0.15vw, 0.75rem)',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: `rgb(${ACCENT} / 0.7)`,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: '1px',
          background: `rgb(${ACCENT} / 0.15)`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SmallCouncilClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Form state
  const [input, setInput] = useState('');
  const [formError, setFormError] = useState('');
  const [seedBannerVisible, setSeedBannerVisible] = useState(false);

  // Pre-fill from ?seed= param on mount
  useEffect(() => {
    const seedParam = searchParams.get('seed');
    if (seedParam) {
      setInput(decodeURIComponent(seedParam));
      setSeedBannerVisible(true);
    }
  }, [searchParams]);

  // Streaming state
  const [phase, setPhase] = useState<Phase>('idle');
  const [streamError, setStreamError] = useState('');
  const [round1Turns, setRound1Turns] = useState<AdvisorTurn[]>([]);
  const [round2Turns, setRound2Turns] = useState<AdvisorTurn[]>([]);
  const [round1Complete, setRound1Complete] = useState(false);
  const [round2Complete, setRound2Complete] = useState(false);
  const [synthesis, setSynthesis] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [downstream, setDownstream] = useState<DownstreamItem[]>([]);

  // Track which turns are "new" (just arrived) for fade-in animation
  const newTurnsRef = useRef<Set<string>>(new Set());

  const MIN_LEN = 30;
  const isReady = input.trim().length >= MIN_LEN;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isReady) {
      setFormError(`Please describe your dilemma in more detail (at least ${MIN_LEN} characters).`);
      return;
    }

    setFormError('');
    setPhase('streaming');
    setRound1Turns([]);
    setRound2Turns([]);
    setRound1Complete(false);
    setRound2Complete(false);
    setSynthesis('');
    setStreamError('');
    newTurnsRef.current = new Set();

    try {
      const res = await fetch('/api/tools/small-council/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input.trim() }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setStreamError((data as { error?: string }).error ?? 'Something went wrong. Please try again.');
        setPhase('error');
        return;
      }

      await readSSEStream(res, {
        advisor: (turn) => {
          const key = `${turn.round}-${turn.advisor}`;
          newTurnsRef.current.add(key);
          if (turn.round === 1) {
            setRound1Turns((prev) => [...prev, turn]);
          } else {
            setRound2Turns((prev) => [...prev, turn]);
          }
          // Remove from "new" set after animation completes
          setTimeout(() => {
            newTurnsRef.current.delete(key);
          }, 500);
        },
        round_complete: ({ round }) => {
          if (round === 1) setRound1Complete(true);
          if (round === 2) setRound2Complete(true);
        },
        synthesis: ({ content }) => {
          setSynthesis(content);
        },
        complete: ({ sessionId: sid, downstream: ds }) => {
          setSessionId(sid);
          if (Array.isArray(ds) && ds.length > 0) setDownstream(ds as DownstreamItem[]);
          setPhase('done');
          // Increment session counter for Loop onboarding
          const prev = parseInt(localStorage.getItem('liminal_sessions_completed') ?? '0', 10);
          localStorage.setItem('liminal_sessions_completed', String(prev + 1));
          // Short pause so the user sees the synthesis + downstream, then auto-navigate
          setTimeout(() => {
            router.push(`/session/${sid}`);
          }, 2400);
        },
        error: ({ message }) => {
          setStreamError(message);
          setPhase('error');
        },
      });
    } catch {
      setStreamError('A network error occurred. Please check your connection.');
      setPhase('error');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: 'clamp(2.5rem, 5vw, 5rem) 1.5rem',
      }}
    >
      {/* Breadcrumb */}
      <nav style={{ marginBottom: '2rem' }} aria-label="Breadcrumb">
        <Link
          href="/"
          style={{
            fontSize: 'clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem)',
            color: 'rgb(var(--color-text-faint))',
            textDecoration: 'none',
            letterSpacing: '0.04em',
          }}
        >
          ← All instruments
        </Link>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: 'clamp(2rem, 4vw, 3.5rem)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            marginBottom: '1.25rem',
          }}
          aria-hidden="true"
        >
          <ToolIcon
            slug="small-council"
            size={18}
            style={{ color: `rgb(${ACCENT} / 0.65)`, flexShrink: 0 }}
          />
          <div
            style={{
              width: '20px',
              height: '1.5px',
              background: `rgb(${ACCENT})`,
              opacity: 0.45,
              borderRadius: '1px',
            }}
          />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: 'clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'rgb(var(--color-text))',
            marginBottom: '0.5rem',
            lineHeight: 1.1,
          }}
        >
          Small Council
        </h1>
        <p
          style={{
            fontSize: 'clamp(0.875rem, 0.8rem + 0.3vw, 1rem)',
            color: `rgb(${ACCENT} / 0.85)`,
            fontStyle: 'italic',
            letterSpacing: '0.01em',
          }}
        >
          Deliberate among divided voices.
        </p>
      </header>

      {/* Seed banner — shown when navigated from inquiry seeds */}
      {phase === 'idle' && seedBannerVisible && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '0.625rem 1rem',
            background: 'rgb(var(--color-surface-2))',
            border: '1px solid rgb(var(--color-border) / 0.1)',
            borderLeft: '2px solid rgb(77 140 158 / 0.6)',
            borderRadius: '0 4px 4px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            animation: 'fadeSlideUp 0.25s ease both',
          }}
          role="status"
        >
          <p
            style={{
              fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
              color: 'rgb(var(--color-text-muted))',
              fontStyle: 'italic',
              fontFamily: 'var(--font-display), Georgia, serif',
            }}
          >
            This question was surfaced by The Loop
          </p>
          <button
            onClick={() => setSeedBannerVisible(false)}
            aria-label="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'rgb(var(--color-text-faint))',
              fontSize: '0.875rem',
              padding: '0.125rem 0.25rem',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Preamble — only shown before streaming starts */}
      {phase === 'idle' && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgb(var(--color-surface-2))',
            borderRadius: '6px',
            border: '1px solid rgb(var(--color-border) / 0.1)',
            fontSize: 'clamp(0.8rem, 0.75rem + 0.2vw, 0.875rem)',
            color: 'rgb(var(--color-text-muted))',
            lineHeight: 1.65,
            marginBottom: '2rem',
          }}
        >
          <strong
            style={{
              color: `rgb(${ACCENT})`,
              display: 'block',
              marginBottom: '0.375rem',
              fontSize: 'clamp(0.7rem, 0.65rem + 0.2vw, 0.75rem)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            How it works
          </strong>
          Five voices — The Instinct, The Critic, The Realist, The Shadow, and The Sage — each respond in
          Round I, then cross-examine each other in Round II. A synthesis follows. Watch the
          council deliberate in real time as each voice arrives.
        </div>
      )}

      {/* Input form — hidden once streaming starts */}
      {phase === 'idle' && (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="tool-input"
              style={{
                display: 'block',
                fontSize: 'clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem)',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgb(var(--color-text-muted))',
                marginBottom: '0.625rem',
              }}
            >
              The question before the council
            </label>

            <textarea
              id="tool-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe the dilemma, decision, or situation you want the council to deliberate on. Be specific — the more context you give, the more useful the counsel."
              rows={8}
              className="liminal-input"
              style={{ resize: 'vertical', minHeight: '180px' }}
            />

            <div
              style={{
                marginTop: '0.375rem',
                textAlign: 'right',
                fontSize: '0.75rem',
                color:
                  input.length < MIN_LEN
                    ? 'rgb(var(--color-text-faint))'
                    : `rgb(${ACCENT} / 0.6)`,
              }}
            >
              {input.length} characters
            </div>
          </div>

          {formError && (
            <div
              className="inline-error"
              role="alert"
              aria-live="polite"
              style={{ marginBottom: '1.25rem' }}
            >
              {formError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={!isReady}
            style={{ padding: '0.7rem 2rem' }}
          >
            Convene the council
          </button>
        </form>
      )}

      {/* ── Streaming panel ──────────────────────────────────────────────────── */}
      {(phase === 'streaming' || phase === 'done') && (
        <div aria-live="polite" aria-label="Council deliberation">
          {/* Question recap */}
          <div
            style={{
              marginBottom: '0.5rem',
              padding: '1rem 1.25rem',
              background: 'rgb(var(--color-surface-2))',
              borderRadius: '6px',
              border: '1px solid rgb(var(--color-border) / 0.08)',
              fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 0.9375rem)',
              color: 'rgb(var(--color-text-muted))',
              fontStyle: 'italic',
              lineHeight: 1.55,
            }}
          >
            {input.trim()}
          </div>

          {/* Round I */}
          {round1Turns.length > 0 && (
            <>
              <RoundHeader label="Round I — Initial counsel" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {round1Turns.map((turn) => {
                  const key = `1-${turn.advisor}`;
                  return (
                    <AdvisorCard
                      key={key}
                      turn={turn}
                      isNew={newTurnsRef.current.has(key)}
                    />
                  );
                })}
              </div>

              {/* Waiting indicator for Round 1 */}
              {!round1Complete && round1Turns.length < 5 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    marginTop: '1rem',
                    color: 'rgb(var(--color-text-faint))',
                    fontSize: '0.8125rem',
                    fontStyle: 'italic',
                  }}
                >
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  <span>
                    {5 - round1Turns.length} voice{5 - round1Turns.length !== 1 ? 's' : ''} still deliberating…
                  </span>
                </div>
              )}
            </>
          )}

          {/* Round I waiting (no turns yet) */}
          {round1Turns.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginTop: '2rem',
                color: 'rgb(var(--color-text-faint))',
                fontSize: '0.875rem',
                fontStyle: 'italic',
              }}
            >
              <div className="spinner" style={{ width: 18, height: 18 }} />
              <span>The council is convening…</span>
            </div>
          )}

          {/* Round II */}
          {round1Complete && (
            <>
              <RoundHeader label="Round II — Cross-examination" />
              {round2Turns.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {round2Turns.map((turn) => {
                    const key = `2-${turn.advisor}`;
                    return (
                      <AdvisorCard
                        key={key}
                        turn={turn}
                        isNew={newTurnsRef.current.has(key)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    color: 'rgb(var(--color-text-faint))',
                    fontSize: '0.8125rem',
                    fontStyle: 'italic',
                  }}
                >
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  <span>Advisors are responding to each other…</span>
                </div>
              )}

              {round2Complete && round2Turns.length < 5 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    marginTop: '1rem',
                    color: 'rgb(var(--color-text-faint))',
                    fontSize: '0.8125rem',
                    fontStyle: 'italic',
                  }}
                >
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  <span>
                    {5 - round2Turns.length} voice{5 - round2Turns.length !== 1 ? 's' : ''} still responding…
                  </span>
                </div>
              )}
            </>
          )}

          {/* Synthesis */}
          {synthesis && (
            <div
              style={{
                marginTop: '2.5rem',
                animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <span
                  style={{
                    fontSize: 'clamp(0.7rem, 0.65rem + 0.15vw, 0.75rem)',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: `rgb(${ACCENT} / 0.7)`,
                  }}
                >
                  Synthesis
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: `rgb(${ACCENT} / 0.15)`,
                  }}
                  aria-hidden="true"
                />
              </div>
              <div
                style={{
                  padding: '1.375rem 1.5rem',
                  background: 'rgb(var(--color-surface-2))',
                  borderRadius: '6px',
                  border: `1px solid rgb(${ACCENT} / 0.12)`,
                }}
              >
                <p
                  style={{
                    fontSize: 'clamp(0.875rem, 0.8rem + 0.3vw, 0.9375rem)',
                    color: 'rgb(var(--color-text-muted))',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {synthesis}
                </p>
              </div>
            </div>
          )}

          {/* Done / redirect notice */}
          {phase === 'done' && sessionId && (
            <div
              style={{
                marginTop: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                animation: 'fadeSlideUp 0.3s ease both',
              }}
            >
              <span
                style={{
                  fontSize: '0.9375rem',
                  color: `rgb(${ACCENT})`,
                  fontStyle: 'italic',
                }}
              >
                Session recorded. Opening records…
              </span>
              <Link
                href={`/session/${sessionId}`}
                style={{
                  fontSize: '0.8125rem',
                  color: 'rgb(var(--color-text-faint))',
                  textDecoration: 'none',
                  letterSpacing: '0.03em',
                }}
              >
                Open now →
              </Link>
            </div>
          )}

          {/* Downstream summary */}
          {phase === 'done' && downstream.length > 0 && (
            <DownstreamSummary downstream={downstream} />
          )}
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div>
          <div
            className="inline-error"
            role="alert"
            style={{ marginBottom: '1.5rem' }}
          >
            {streamError}
          </div>
          <button
            onClick={() => setPhase('idle')}
            className="btn-ghost"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
