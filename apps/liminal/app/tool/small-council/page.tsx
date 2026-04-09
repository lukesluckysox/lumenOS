import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Nav } from '@/components/nav';
import { SmallCouncilClient } from '@/components/small-council-client';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Small Council — Liminal',
  description:
    'Five voices — The Instinct, The Critic, The Realist, The Shadow, The Sage — deliberate your dilemma across two rounds and reach a synthesis.',
};

export default async function SmallCouncilPage() {
  const user = await getSession();

  return (
    <>
      <Nav user={user} />
      <main>
        <Suspense fallback={null}>
          <SmallCouncilClient />
        </Suspense>
      </main>
    </>
  );
}
