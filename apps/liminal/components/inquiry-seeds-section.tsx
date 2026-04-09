'use client';

/**
 * InquirySeedsSection — client wrapper for the home page.
 *
 * When a seed is selected, navigate to /tool/small-council
 * with the seed text as a query param (?seed=...) so it can be pre-filled.
 */

import { useRouter } from 'next/navigation';
import { InquirySeeds } from '@/components/inquiry-seeds';

export function InquirySeedsSection() {
  const router = useRouter();

  function handleSelectSeed(text: string) {
    const params = new URLSearchParams({ seed: text });
    router.push(`/tool/small-council?${params.toString()}`);
  }

  return <InquirySeeds onSelectSeed={handleSelectSeed} />;
}
