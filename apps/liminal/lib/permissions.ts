/**
 * Centralized permissions / plan-check utility.
 *
 * All feature-gating logic lives here. Components and API routes import
 * these helpers instead of scattering ad-hoc plan checks.
 *
 * Quotas are defined in one place — easy to adjust later.
 */

import type { UserPlan } from '@/lib/auth/session';

// ── Quotas ─────────────────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  aspirant: {
    /** Monthly session cap for free users */
    monthlySessionLimit: 8,
    /** Archive: only show sessions from the last N days */
    archiveDays: 7,
    /** Archive: max sessions visible */
    archiveMaxSessions: 10,
    /** Can use session comparison? */
    canCompare: false,
    /** Can export / copy as markdown? */
    canExport: false,
  },
  fellow: {
    monthlySessionLimit: Infinity,
    archiveDays: Infinity,
    archiveMaxSessions: Infinity,
    canCompare: true,
    canExport: true,
  },
} as const;

type PlanKey = 'aspirant' | 'fellow';

function limitsFor(plan: UserPlan) {
  if (plan === 'fellow' || plan === 'trialing' || plan === 'grandfathered') {
    return PLAN_LIMITS.fellow;
  }
  return PLAN_LIMITS.aspirant;
}

// ── Feature checks ─────────────────────────────────────────────────────────────

export function canCreateSession(plan: UserPlan, currentMonthlyCount: number): boolean {
  const limits = limitsFor(plan);
  return currentMonthlyCount < limits.monthlySessionLimit;
}

export function sessionsRemaining(plan: UserPlan, currentMonthlyCount: number): number {
  const limits = limitsFor(plan);
  if (limits.monthlySessionLimit === Infinity) return Infinity;
  return Math.max(0, limits.monthlySessionLimit - currentMonthlyCount);
}

export function canAccessArchive(plan: UserPlan): boolean {
  // Everyone can access archive, but depth is limited
  return true;
}

export function archiveLimits(plan: UserPlan) {
  return {
    days: limitsFor(plan).archiveDays,
    maxSessions: limitsFor(plan).archiveMaxSessions,
  };
}

export function canCompare(plan: UserPlan): boolean {
  return limitsFor(plan).canCompare;
}

export function canExport(plan: UserPlan): boolean {
  return limitsFor(plan).canExport;
}

export function isOracle(role: string): boolean {
  return role === 'oracle';
}

export function isPaidPlan(plan: UserPlan): boolean {
  return plan === 'fellow' || plan === 'trialing' || plan === 'grandfathered';
}

/** Human-readable plan name */
export function planLabel(plan: UserPlan): string {
  switch (plan) {
    case 'aspirant': return 'Aspirant';
    case 'fellow': return 'Fellow';
    case 'trialing': return 'Fellow (Trial)';
    case 'canceled': return 'Aspirant (Canceled)';
    case 'grandfathered': return 'Fellow (Legacy)';
    default: return 'Aspirant';
  }
}

// ── Monthly reset check ────────────────────────────────────────────────────────

/** Returns true if the monthly counter needs resetting (different calendar month). */
export function needsMonthlyReset(lastReset: Date | string | null): boolean {
  if (!lastReset) return true;
  const d = typeof lastReset === 'string' ? new Date(lastReset) : lastReset;
  const now = new Date();
  return d.getUTCMonth() !== now.getUTCMonth() || d.getUTCFullYear() !== now.getUTCFullYear();
}
