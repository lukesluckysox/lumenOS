'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles, Users, TreePine, MessageSquare, Eye, Scale,
  BookOpen, Home,
} from 'lucide-react';
import { LiminalLogo } from './logo';

const LUMEN_HUB_URL = 'https://lumen-os.up.railway.app';

const toolItems = [
  { href: '/tool/fool',          label: 'The Fool',         shortLabel: 'FOOL',         Icon: Sparkles },
  { href: '/tool/small-council', label: 'Small Council',    shortLabel: 'COUNCIL',      Icon: Users },
  { href: '/tool/genealogist',   label: 'The Genealogist',  shortLabel: 'GENEALOGIST',  Icon: TreePine },
  { href: '/tool/interlocutor',  label: 'The Interlocutor', shortLabel: 'INTERLOCUTOR', Icon: MessageSquare },
  { href: '/tool/interpreter',   label: 'The Interpreter',  shortLabel: 'INTERPRETER',  Icon: Eye },
  { href: '/tool/stoics-ledger', label: "Stoic's Ledger",   shortLabel: 'LEDGER',       Icon: Scale },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside
      className="hidden md:flex flex-col flex-shrink-0"
      style={{
        width: 220,
        minWidth: 220,
        background: 'rgb(var(--color-bg))',
        borderRight: '1px solid rgb(var(--color-border) / 0.12)',
        height: '100dvh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand */}
      <div style={{ padding: '1.75rem 1.25rem 1.5rem' }}>
        <a
          href={LUMEN_HUB_URL}
          style={{
            color: 'rgb(var(--color-text-faint))',
            textDecoration: 'none',
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: '0.75rem',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(var(--color-text-muted))')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgb(var(--color-text-faint))')}
        >
          ◁ Lumen
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <LiminalLogo size={26} className="text-text-faint" />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontSize: '0.875rem',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgb(var(--color-text))',
              }}
            >
              LIMINAL
            </div>
            <div
              style={{
                color: 'rgb(var(--color-text-faint))',
                fontSize: '10px',
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}
            >
              Instruments for Thought
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ margin: '0 1.25rem', height: '1px', background: 'rgb(var(--color-border) / 0.12)' }} />

      {/* Tool Navigation */}
      <nav
        style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '1rem 0.75rem 0' }}
        role="navigation"
        aria-label="Tool navigation"
      >
        {toolItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  background: active ? 'rgb(var(--color-gold) / 0.08)' : 'transparent',
                  color: active ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-muted))',
                }}
                className={active ? '' : 'sidebar-nav-item'}
              >
                <item.Icon
                  size={15}
                  strokeWidth={active ? 2 : 1.5}
                  style={{ flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.08em',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.shortLabel}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ margin: '1rem 1.25rem', height: '1px', background: 'rgb(var(--color-border) / 0.12)' }} />

      {/* Home link */}
      <div style={{ padding: '0 0.75rem' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
              background: isActive('/') ? 'rgb(var(--color-gold) / 0.08)' : 'transparent',
              color: isActive('/') ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-faint))',
            }}
            className={isActive('/') ? '' : 'sidebar-nav-item'}
          >
            <Home size={15} strokeWidth={isActive('/') ? 2 : 1.5} style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                fontWeight: isActive('/') ? 600 : 400,
              }}
            >
              Dashboard
            </span>
          </div>
        </Link>
      </div>

      {/* Archive — pushed to bottom */}
      <div style={{ marginTop: 'auto', padding: '0 0.75rem 1.5rem' }}>
        <Link href="/archive" style={{ textDecoration: 'none' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
              background: isActive('/archive') ? 'rgb(var(--color-gold) / 0.08)' : 'transparent',
              color: isActive('/archive') ? 'rgb(var(--color-gold))' : 'rgb(var(--color-text-faint))',
            }}
            className={isActive('/archive') ? '' : 'sidebar-nav-item'}
          >
            <BookOpen size={15} strokeWidth={isActive('/archive') ? 2 : 1.5} style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                fontWeight: isActive('/archive') ? 600 : 400,
              }}
            >
              Archive
            </span>
          </div>
        </Link>

        {/* Footer */}
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgb(var(--color-border) / 0.08)',
            color: 'rgb(var(--color-text-faint))',
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.6,
          }}
        >
          LIMINAL
        </div>
      </div>
    </aside>
  );
}
