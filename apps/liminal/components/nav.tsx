'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { LiminalWordmark } from './logo';

interface NavProps {
  user: { id: string; email: string; role?: string; plan?: string } | null;
}

export function Nav({ user }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <nav
      style={{
        borderBottom: '1px solid rgb(var(--color-border) / 0.1)',
        background: 'rgb(var(--color-bg) / 0.9)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 1.5rem',
          height: '3.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo + Lumen return */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a
            href="https://lumen-os.up.railway.app"
            style={{
              color: 'rgb(var(--color-text-faint))',
              textDecoration: 'none',
              fontSize: '0.7rem',
              letterSpacing: '0.06em',
              opacity: 0.5,
              transition: 'opacity 0.15s ease',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
          >
            ◁ Lumen
          </a>
          <Link
            href="/"
            style={{
              color: 'rgb(var(--color-text))',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <LiminalWordmark />
          </Link>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {user ? (
            <>
              <Link
                href="/archive"
                className="btn-ghost"
                style={{
                  textDecoration: 'none',
                  fontSize: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
                  color: pathname === '/archive' ? 'rgb(var(--color-gold))' : undefined,
                  minHeight: '44px',
                }}
              >
                Archive
              </Link>
              <Link
                href="/account"
                className="btn-ghost"
                style={{
                  textDecoration: 'none',
                  fontSize: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
                  color: pathname === '/account' ? 'rgb(var(--color-gold))' : undefined,
                  minHeight: '44px',
                }}
              >
                Account
              </Link>
              {user.role === 'oracle' && (
                <Link
                  href="/oracle"
                  className="btn-ghost"
                  style={{
                    textDecoration: 'none',
                    fontSize: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
                    color: 'rgb(var(--color-gold) / 0.8)',
                    opacity: pathname === '/oracle' ? 1 : 0.8,
                    minHeight: '44px',
                  }}
                >
                  Oracle
                </Link>
              )}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn-ghost"
                style={{
                  fontSize: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
                  minHeight: '44px',
                }}
              >
                {loggingOut ? 'Leaving…' : 'Leave'}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-ghost"
                style={{
                  textDecoration: 'none',
                  fontSize: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
                  minHeight: '44px',
                }}
              >
                Enter
              </Link>
              <Link
                href="/signup"
                className="btn-primary"
                style={{
                  textDecoration: 'none',
                  fontSize: 'clamp(0.8rem, 0.75rem + 0.25vw, 0.9rem)',
                  padding: '0.45rem 1rem',
                }}
              >
                Begin
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
