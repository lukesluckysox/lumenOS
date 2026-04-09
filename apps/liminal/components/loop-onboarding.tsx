'use client';

/**
 * LoopOnboarding — behavior-triggered banners that reveal Loop consequences.
 *
 * Shown on the homepage after the first and third completed Liminal sessions.
 * Reads `liminal_sessions_completed` from localStorage (set by tool page clients).
 * Each banner is dismissible and localStorage-gated.
 */

import { useState, useEffect } from 'react';

type BannerVariant = 'first' | 'third' | null;

export function LoopOnboarding() {
  const [variant, setVariant] = useState<BannerVariant>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const count = parseInt(localStorage.getItem('liminal_sessions_completed') ?? '0', 10);

    if (count >= 3 && !localStorage.getItem('loop_onboarding_third_dismissed')) {
      setVariant('third');
      setVisible(true);
    } else if (count >= 1 && !localStorage.getItem('loop_onboarding_first_dismissed')) {
      setVariant('first');
      setVisible(true);
    }
  }, []);

  function dismiss() {
    const key =
      variant === 'third'
        ? 'loop_onboarding_third_dismissed'
        : 'loop_onboarding_first_dismissed';
    localStorage.setItem(key, '1');
    setVisible(false);
  }

  if (!visible || !variant) return null;

  const isThird = variant === 'third';
  const accentColor = isThird ? '#c4943e' : '#9c8654';
  const message = isThird
    ? 'Three sessions in. Patterns are forming — an experiment may soon crystallize.'
    : 'Your first session was recorded. Your patterns are now being woven into the broader picture.';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        padding: '0.875rem 1rem',
        marginBottom: 'clamp(1rem, 2vw, 1.5rem)',
        borderLeft: `2px solid ${accentColor}`,
        background: `${accentColor}0d`,
        borderRadius: '0 3px 3px 0',
        animation: 'fadeSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <p
        style={{
          flex: 1,
          fontSize: 'clamp(0.8125rem, 0.76rem + 0.18vw, 0.875rem)',
          color: 'rgb(var(--color-text-muted))',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {message}
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          padding: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          color: 'rgb(var(--color-text-faint))',
          fontFamily: 'inherit',
          lineHeight: 1,
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}
