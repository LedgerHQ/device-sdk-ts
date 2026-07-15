/**
 * Onboarding simulation for a mocked device.
 *
 * A device created with `onboarded: false` starts not onboarded and walks
 * itself through Ledger Live's SyncOnboarding steps as it is polled. Everything
 * Ledger Live observes is derived from the GetOsVersion (`e001`) `seFlags`
 * bytes (see `extractOnboardingState` in live-common): `flags[0] & 0x04` is the
 * onboarded bit and `flags[3]` is the onboarding step. The WELCOME and
 * EARLY_CHECK steps are gated by the toggleOnboardingEarlyCheck APDU (`e003`);
 * the remaining steps auto-advance one per GetOsVersion poll until READY.
 */

/**
 * Onboarding step, valued with the `flags[3]` code Ledger Live's
 * `extractOnboardingState` decodes it to.
 */
export enum OnboardingStep {
  Welcome = 0x00,
  EarlyCheck = 0x0f,
  ChooseName = 0x0c,
  Pin = 0x06,
  SetupChoice = 0x05,
  NewDevice = 0x07,
  NewDeviceConfirming = 0x08,
  SafetyWarning = 0x0a,
  Ready = 0x0b,
}

/**
 * The auto-advancing part of the flow, walked one step per GetOsVersion poll
 * once the device leaves the early-security-check step. Ordered per Ledger Live
 * Desktop's SyncOnboarding companion mapping.
 */
export const ONBOARDING_WALK: readonly OnboardingStep[] = [
  OnboardingStep.ChooseName,
  OnboardingStep.Pin,
  OnboardingStep.SetupChoice,
  OnboardingStep.NewDevice,
  OnboardingStep.NewDeviceConfirming,
  OnboardingStep.SafetyWarning,
  OnboardingStep.Ready,
];

/** Per-device onboarding simulation state. */
export interface OnboardingRuntimeState {
  step: OnboardingStep;
  /** True once the device has reached READY and reports itself onboarded. */
  completed: boolean;
}

/** `seFlags` byte 0 while onboarding: nothing set (not onboarded). */
const SE_FLAGS_BYTE0_ONBOARDING = 0x00;
/** `seFlags` byte 0 once onboarded: matches the default onboarded device. */
const SE_FLAGS_BYTE0_ONBOARDED = 0xe6;

const toHexByte = (n: number): string =>
  (n & 0xff).toString(16).padStart(2, "0");

/** Initial onboarding state for a device opting into the simulation. */
export function initialOnboardingState(): OnboardingRuntimeState {
  return { step: OnboardingStep.Welcome, completed: false };
}

/**
 * The 4-byte `seFlags` (hex) reported for an onboarding state: `[byte0][00][00]
 * [step]`, where byte 0 carries the onboarded bit and byte 3 the step. Byte 2
 * is `0x00`, which Ledger Live decodes as a 24-word seed at index 0 (a valid
 * value it requires at every step).
 */
export function deriveOnboardingSeFlags(state: OnboardingRuntimeState): string {
  const byte0 = state.completed
    ? SE_FLAGS_BYTE0_ONBOARDED
    : SE_FLAGS_BYTE0_ONBOARDING;
  return toHexByte(byte0) + "0000" + toHexByte(state.step);
}

/**
 * Apply a toggleOnboardingEarlyCheck (`e003`) transition:
 * - `enter` (p2 = 0x00) moves WELCOME -> EARLY_CHECK,
 * - `exit` (p2 = 0x01) moves EARLY_CHECK -> the first walk step (CHOOSE_NAME).
 *
 * Returns the (possibly unchanged) next state; the command always succeeds.
 */
export function onEarlyCheckToggle(
  state: OnboardingRuntimeState,
  enter: boolean,
): OnboardingRuntimeState {
  if (enter && state.step === OnboardingStep.Welcome) {
    return { ...state, step: OnboardingStep.EarlyCheck };
  }
  if (!enter && state.step === OnboardingStep.EarlyCheck) {
    return { ...state, step: ONBOARDING_WALK[0]! };
  }
  return state;
}

/**
 * Advance one step on a GetOsVersion poll. WELCOME and EARLY_CHECK do not
 * auto-advance (they wait for the `e003` enter/exit APDUs). Within the walk,
 * each poll moves to the next step; reaching READY marks the device onboarded.
 * A completed device stays put.
 */
export function advanceOnboarding(
  state: OnboardingRuntimeState,
): OnboardingRuntimeState {
  if (
    state.completed ||
    state.step === OnboardingStep.Welcome ||
    state.step === OnboardingStep.EarlyCheck
  ) {
    return state;
  }
  const index = ONBOARDING_WALK.indexOf(state.step);
  if (index === -1 || index === ONBOARDING_WALK.length - 1) {
    // Already at (or off) the last walk step: settle on READY + onboarded.
    return { step: OnboardingStep.Ready, completed: true };
  }
  const next = ONBOARDING_WALK[index + 1]!;
  return { step: next, completed: next === OnboardingStep.Ready };
}
