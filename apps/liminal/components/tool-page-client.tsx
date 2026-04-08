'use client';

import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { ToolIcon } from '@/components/tool-icon';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export interface ToolConfig {
  slug: string;
  name: string;
  tagline: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputFieldName: string;
  isTextarea?: boolean;
  minLength?: number;
  submitLabel?: string;
  processingLabel?: string;
  accentHue?: string;
  preamble?: ReactNode;
}

interface ToolPageClientProps {
  config: ToolConfig;
}

// ── Trust notes — best used for / not a replacement for ───────────────────────
// Rendered as a small note below the preamble. Keeps tool pages DRY.

const TRUST_NOTES: Record<string, { bestFor: string; notFor: string }> = {
  'small-council': {
    bestFor: 'Decisions where you suspect one voice is drowning out the others — career crossroads, relationship dilemmas, strategy choices with long tails.',
    notFor: 'Emergency decisions or anything requiring legal, financial, or medical expertise from a licensed professional.',
  },
  genealogist: {
    bestFor: 'Beliefs you hold deeply but have never examined — convictions about work, family, identity, or the way the world works.',
    notFor: 'Fact-checking or verifying historical claims. The Genealogist reads roots, not receipts.',
  },
  interlocutor: {
    bestFor: 'Arguments you want to strengthen, or positions you want to stress-test before presenting them to others.',
    notFor: 'Emotional processing or grief. This is a tool for arguments, not for feelings — bring those to the Stoic\'s Ledger or Small Council.',
  },
  'stoics-ledger': {
    bestFor: 'A daily moral inventory — end-of-day reckoning with what you did, deferred, or avoided. Best used with specificity.',
    notFor: 'Crisis support or mental health care. If you are in distress, please reach out to a qualified professional.',
  },
  fool: {
    bestFor: 'Positions you feel certain about — especially the ones where certainty feels earned. The Fool works hardest on confident ground.',
    notFor: 'Validation. If you want to be told you\'re right, the Fool is the wrong instrument. Bring your least-shaken conviction.',
  },
  interpreter: {
    bestFor: 'Recurring symbols, vivid dreams, patterns that keep appearing in your life without explanation.',
    notFor: 'Literal prediction or fortune-telling. These are interpretive lenses, not oracles.',
  },
};

export function ToolPageClient({ config }: ToolPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState('');
  const [seedActive, setSeedActive] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill from ?seed= param (loop-routed inquiry seeds)
  useEffect(() => {
    const seed = searchParams.get('seed');
    if (seed && !input) {
      setInput(seed);
      setSeedActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [loading, setLoading] = useState(false);

  const minLen = config.minLength ?? 10;
  const accent = config.accentHue ?? 'var(--color-gold)';
  const accentRgb = accent.startsWith('var') ? 'var(--color-gold)' : `rgb(${accent})`;
  const accentAlpha = (a: number) =>
    accent.startsWith('var')
      ? `rgb(var(--color-gold) / ${a})`
      : `rgb(${accent} / ${a})`;

  const trustNote = TRUST_NOTES[config.slug];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (input.trim().length < minLen) {
      setError(`Give the instrument more to work with — at least ${minLen} characters.`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const body: Record<string, string> = {};
      body[config.inputFieldName] = input.trim();

      const res = await fetch(`/api/tools/${config.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError('Your session has expired. Sign in again to continue.');
        } else if (res.status === 429 && data.code === 'SESSION_LIMIT') {
          setError('SESSION_LIMIT');
        } else if (res.status === 429) {
          setError('Too many requests. Wait a moment and try again.');
        } else {
          setError(data.error ?? 'Something went wrong — please try again.');
        }
        return;
      }

      router.push(`/session/${data.sessionId}`);
    } catch {
      setError('A network error occurred. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

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
            slug={config.slug}
            size={18}
            style={{ color: accentAlpha(0.65), flexShrink: 0 }}
          />
          <div
            style={{
              width: '20px',
              height: '1.5px',
              background: accentRgb,
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
          {config.name}
        </h1>
        <p
          style={{
            fontSize: 'clamp(0.875rem, 0.8rem + 0.3vw, 1rem)',
            color: accentAlpha(0.85),
            fontStyle: 'italic',
            letterSpacing: '0.01em',
          }}
        >
          {config.tagline}
        </p>
      </header>

      {/* Optional preamble */}
      {config.preamble && (
        <div style={{ marginBottom: '2rem' }}>{config.preamble}</div>
      )}

      {/* Trust note */}
      {trustNote && (
        <div
          style={{
            marginBottom: '2rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.875rem 1.5rem',
          }}
        >
          <div>
            <p
              style={{
                fontSize: 'clamp(0.625rem, 0.58rem + 0.12vw, 0.6875rem)',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: accentAlpha(0.65),
                marginBottom: '0.3rem',
              }}
            >
              Best for
            </p>
            <p
              style={{
                fontSize: 'clamp(0.8rem, 0.75rem + 0.15vw, 0.85rem)',
                color: 'rgb(var(--color-text-muted))',
                lineHeight: 1.6,
              }}
            >
              {trustNote.bestFor}
            </p>
          </div>
          <div>
            <p
              style={{
                fontSize: 'clamp(0.625rem, 0.58rem + 0.12vw, 0.6875rem)',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgb(var(--color-text-faint))',
                marginBottom: '0.3rem',
              }}
            >
              Not a replacement for
            </p>
            <p
              style={{
                fontSize: 'clamp(0.8rem, 0.75rem + 0.15vw, 0.85rem)',
                color: 'rgb(var(--color-text-faint))',
                lineHeight: 1.6,
              }}
            >
              {trustNote.notFor}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
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
            {config.inputLabel}
          </label>

          {seedActive && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                fontSize: '0.6875rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: accentAlpha(0.45),
              }}
            >
              <span style={{ opacity: 0.5 }}>↺</span>
              <span>From the loop — edit freely</span>
            </div>
          )}

          {config.isTextarea !== false ? (
            <textarea
              id="tool-input"
              value={input}
              onChange={(e) => { setInput(e.target.value); setSeedActive(false); }}
              placeholder={config.inputPlaceholder}
              disabled={loading}
              rows={8}
              className="liminal-input"
              style={{
                resize: 'vertical',
                minHeight: '180px',
                ...(seedActive ? { borderColor: accentAlpha(0.25) } : {}),
              }}
            />
          ) : (
            <input
              id="tool-input"
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setSeedActive(false); }}
              placeholder={config.inputPlaceholder}
              disabled={loading}
              className="liminal-input"
              style={seedActive ? { borderColor: accentAlpha(0.25) } : {}}
            />
          )}

          {/* Character count hint */}
          <div
            style={{
              marginTop: '0.375rem',
              textAlign: 'right',
              fontSize: '0.75rem',
              color:
                input.length < minLen
                  ? 'rgb(var(--color-text-faint))'
                  : accentAlpha(0.6),
            }}
          >
            {input.length} characters
          </div>
        </div>

        {error && error === 'SESSION_LIMIT' ? (
          <div
            role="alert"
            aria-live="polite"
            style={{
              marginBottom: '1.25rem',
              padding: '1.5rem 1.75rem',
              background: 'rgb(var(--color-gold-dim) / 0.35)',
              border: '1px solid rgb(var(--color-gold) / 0.12)',
              borderRadius: '4px',
              borderLeft: '2px solid rgb(var(--color-gold) / 0.3)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontSize: 'clamp(0.9375rem, 0.875rem + 0.3vw, 1.0625rem)',
                fontStyle: 'italic',
                color: 'rgb(var(--color-text))',
                marginBottom: '0.5rem',
              }}
            >
              Keep a private cabinet of thought
            </p>
            <p
              style={{
                fontSize: 'clamp(0.8rem, 0.75rem + 0.15vw, 0.85rem)',
                color: 'rgb(var(--color-text-muted))',
                lineHeight: 1.6,
                marginBottom: '1rem',
                maxWidth: '48ch',
              }}
            >
              You have used your free sessions for the month. The Cabinet offers unlimited access to all six instruments.
            </p>
            <a
              href="/account"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1.25rem',
                background: 'rgb(var(--color-gold))',
                color: 'rgb(20 18 14)',
                fontSize: 'clamp(0.8125rem, 0.76rem + 0.15vw, 0.875rem)',
                fontWeight: 500,
                borderRadius: '3px',
                textDecoration: 'none',
              }}
            >
              Upgrade to Cabinet
            </a>
          </div>
        ) : error ? (
          <div
            className="inline-error"
            role="alert"
            aria-live="polite"
            style={{ marginBottom: '1.25rem' }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || input.trim().length < minLen}
          style={{ padding: '0.7rem 2rem' }}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16 }} />
              <span>{config.processingLabel ?? 'Working…'}</span>
            </>
          ) : (
            config.submitLabel ?? 'Submit'
          )}
        </button>
      </form>

      {/* Processing overlay */}
      {loading && (
        <div
          style={{
            marginTop: '3rem',
            paddingTop: '2rem',
            borderTop: '1px solid rgb(var(--color-border) / 0.12)',
            animation: 'fadeSlideUp 0.3s ease both',
          }}
          aria-live="polite"
          aria-label="Processing your request"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.625rem',
            }}
          >
            <div
              className="spinner"
              style={{ width: 16, height: 16, flexShrink: 0 }}
            />
            <p
              style={{
                fontSize: 'clamp(0.875rem, 0.8rem + 0.2vw, 0.9375rem)',
                color: 'rgb(var(--color-text-muted))',
                fontStyle: 'italic',
                fontFamily: 'var(--font-display), Georgia, serif',
              }}
            >
              {config.processingLabel ?? 'Working…'}
            </p>
          </div>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'rgb(var(--color-text-faint))',
              paddingLeft: '1.75rem',
            }}
          >
            This may take 15–45 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
