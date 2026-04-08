'use client';

/**
 * InquirySeedsSection — client wrapper for the home page.
 *
 * Renders pending inquiry seeds from the Lumen recursive loop.
 * When a seed is selected, it navigates to the routed Liminal tool
 * with the seed text pre-filled via `?seed=` URL param.
 *
 * Routing is determined server-side when the seed is created.
 * Seeds without a suggested_tool fall back to Small Council.
 */

import { useRouter } from 'next/navigation';
import { InquirySeeds } from '@/components/inquiry-seeds';

// Default tool when no routing is available
const FALLBACK_TOOL = 'small-council';

interface Seed {
  id: string;
  source_app: string;
  source_event_type: string;
  seed_text: string;
  suggested_tool: string | null;
  routing_reason: string | null;
  created_at: string;
}

export function InquirySeedsSection() {
  const router = useRouter();

  function handleSelectSeed(seed: Seed) {
    const tool = seed.suggested_tool || FALLBACK_TOOL;
    // Encode the seed text as a URL param so the tool page can prefill it
    const params = new URLSearchParams({ seed: seed.seed_text });
    router.push(`/tool/${tool}?${params.toString()}`);
  }

  return <InquirySeeds onSelectSeed={handleSelectSeed} />;
}
