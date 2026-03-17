export const DELAY = {
  swipeStep: 200,
  swipeBetween: 1200,
  signInit: 4000,
  pollInterval: 500,
  screenChangePollMs: 200,
  screenChangeTimeoutMs: 3000,
} as const;

export const REJECT_BUTTON_PATTERNS = [
  /^reject$/i,
  /^reject transaction$/i,
  /^back to safety$/i,
  /^refuse$/i,
  /^decline$/i,
] as const;

export const CONFIRM_REJECT_PATTERNS = [
  /yes.+reject/i,
  /^yes$/i,
  /^confirm$/i,
  /^reject$/i,
] as const;

export const BLIND_SIGNING_WARNING_PATTERNS = [
  /blind signing ahead/i,
  /^blind signing$/i,
] as const;

export const BLIND_SIGNING_ACCEPT_PATTERNS = [
  /accept risk and continue/i,
  /accept risk/i,
] as const;

export const BLIND_SIGNING_REJECT_PATTERNS = [/^back to safety$/i] as const;

export const GO_TO_SETTINGS_PATTERNS = [/^go to settings$/i] as const;

export const SETTINGS_BLIND_SIGNING_PATTERNS = [/^blind signing$/i] as const;
