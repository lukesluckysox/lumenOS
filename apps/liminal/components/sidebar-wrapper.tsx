'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from './app-sidebar';

export function SidebarWrapper() {
  const pathname = usePathname();
  const hideOn = ['/login', '/signup'];
  if (hideOn.includes(pathname)) return null;
  return <AppSidebar />;
}
