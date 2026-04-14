'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BookOpen, Sparkles, User, CircleDot } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/tool/small-council', label: 'Council', Icon: Users },
  { href: '/tool/fool', label: 'Fool', Icon: Sparkles },
  { href: '/archive', label: 'Archive', Icon: BookOpen },
  { href: '/account', label: 'Account', Icon: User },
] as const;

const LUMEN_HUB_URL = 'https://lumen-os.up.railway.app';

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: '1px solid rgb(var(--color-border) / 0.15)',
        background: 'rgb(var(--color-bg) / 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className="md:hidden"
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'stretch',
        }}
      >
        <a
          href={LUMEN_HUB_URL}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.625rem 0.5rem',
            minHeight: '48px',
            textDecoration: 'none',
            color: 'rgb(var(--color-text-faint))',
            opacity: 0.55,
            transition: 'opacity 0.15s ease, color 0.15s ease',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <CircleDot
            style={{ width: '20px', height: '20px', flexShrink: 0 }}
            strokeWidth={1.5}
          />
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-body), system-ui, sans-serif',
              letterSpacing: '0.04em',
              lineHeight: 1,
              fontWeight: 400,
            }}
          >
            Lumen
          </span>
        </a>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.625rem 0.5rem',
                minHeight: '48px',
                textDecoration: 'none',
                color: isActive
                  ? 'rgb(var(--color-gold))'
                  : 'rgb(var(--color-text-faint))',
                opacity: isActive ? 1 : 0.55,
                transition: 'opacity 0.15s ease, color 0.15s ease',
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <Icon
                style={{ width: '20px', height: '20px', flexShrink: 0 }}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-body), system-ui, sans-serif',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
