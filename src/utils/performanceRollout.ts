import { NUGGET_PERFORMANCE } from '@/config/nuggetPerformanceConfig';
import { isFeatureEnabled } from '@/constants/featureFlags';

const SEED_KEY = 'nuggets_preload_cohort';

/**
 * Deterministic 0–99 bucket for canary / staged rollout.
 * Logged-in users: stable per `userId`. Anonymous: stable for the browser session.
 */
export function stableBucket0to99(userId: string | null | undefined): number {
  const seed = cohortSeed(userId);
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100;
}

function cohortSeed(userId: string | null | undefined): string {
  if (userId) return `u:${userId}`;
  if (typeof window === 'undefined') return 'ssr:anon';
  try {
    const existing = window.sessionStorage.getItem(SEED_KEY);
    if (existing) return existing;
    const next = `anon:${Math.random().toString(36).slice(2, 12)}`;
    window.sessionStorage.setItem(SEED_KEY, next);
    return next;
  } catch {
    return 'anon:local';
  }
}

/** 0–100: percentage of users (by cohort bucket) that receive nugget modal preload. Default 100. */
export function getNuggetModalPreloadRolloutPercent(): number {
  return NUGGET_PERFORMANCE.preloadRolloutPercent;
}

/**
 * Gated nugget modal chunk preload (hover / pointerdown + open handlers).
 * Respects NUGGET_MODAL_CHUNK_PRELOAD and rollout percentage.
 */
export function shouldEnableNuggetModalPreloadForUser(userId: string | null | undefined): boolean {
  if (!isFeatureEnabled('NUGGET_MODAL_CHUNK_PRELOAD')) {
    return false;
  }
  const pct = getNuggetModalPreloadRolloutPercent();
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return stableBucket0to99(userId) < pct;
}

/** 0–100 from build env `VITE_NUGGET_COMPOSER_V2` (see `nuggetPerformanceConfig`). */
export function getNuggetComposerV2RolloutPercent(): number {
  return NUGGET_PERFORMANCE.composerV2RolloutPercent;
}

/**
 * Per-user gate for ContentDraft-first composer hydration (Phase 3) vs legacy Article-first init.
 * Uses the same stable cohort bucket as modal chunk preload.
 */
export function shouldEnableNuggetComposerV2ForUser(userId: string | null | undefined): boolean {
  const pct = getNuggetComposerV2RolloutPercent();
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return stableBucket0to99(userId) < pct;
}
