/**
 * User-visible copy and persistence keys for onboarding / nudge surfaces.
 * Dismiss triggers and layout live in the consuming components.
 */

/** localStorage — must stay stable for existing users. */
export const NOTIFICATION_PROMPT_DISMISSED_KEY = 'nuggets_notif_prompt_dismissed';

export const HOME_MICRO_HEADER_COPY = {
  title: 'Nuggets is a curated knowledge feed for markets, AI, technology, and geopolitics.',
  body: 'High-signal updates, organized without the noise.',
} as const;

export const MARKET_PULSE_MICRO_HEADER_COPY = {
  title: 'Market Pulse: high-signal updates for investors and operators',
  body: 'High-signal updates, organized without the noise.',
} as const;

export const NOTIFICATION_PROMPT_COPY = {
  title: 'Stay in the loop',
  body: 'Get notified when new nuggets drop. You can customize frequency anytime in settings.',
  enableButton: 'Enable notifications',
  enableButtonLoading: 'Enabling...',
  dismissButton: 'Not now',
} as const;
