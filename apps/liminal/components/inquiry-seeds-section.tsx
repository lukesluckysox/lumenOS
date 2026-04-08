'use client';

/**
 * InquirySeedsSection — client wrapper for the home page.
 *
 * Renders pending inquiry seeds from the Lumen recursive loop.
 * When a seed is selected, it copies the seed text to the clipboard
 * and navigates the user to the Small Council — the general-purpose
 * entry point for questions surfaced by other Lumen tools.
 */

import { useRouter } from 'next/navigation';
import { InquirySeeds } from '@/components/inquiry-seeds';

export function InquirySeedsSection() {
  const router = useRouter();

  function handleSelectSeed(text: string) {
    // Write to clipboard so the user can paste into any tool input
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* ignore */});
    }
    // Navigate to Small Council as the default vessel for loop-generated questions
    router.push('/tool/small-council');
  }

  return <InquirySeeds onSelectSeed={handleSelectSeed} />;
}
