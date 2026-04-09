'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './bottom-nav';

export function MobileNavWrapper() {
  const pathname = usePathname();
  // Hide on login/signup pages
  const hideOn = ['/login', '/signup'];
  if (hideOn.includes(pathname)) return null;
  return <BottomNav />;
}
