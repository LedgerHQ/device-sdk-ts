import {
  advanceOnboarding,
  deriveOnboardingSeFlags,
  initialOnboardingState,
  type OnboardingRuntimeState,
  OnboardingStep,
  onEarlyCheckToggle,
} from "./onboarding";

const state = (
  step: OnboardingStep,
  completed = false,
): OnboardingRuntimeState => ({ step, completed });

describe("initialOnboardingState", () => {
  it("starts not onboarded at WELCOME", () => {
    expect(initialOnboardingState()).toEqual({
      step: OnboardingStep.Welcome,
      completed: false,
    });
  });
});

describe("deriveOnboardingSeFlags", () => {
  it("encodes the step in byte 3 and clears the onboarded bit while onboarding", () => {
    expect(deriveOnboardingSeFlags(state(OnboardingStep.Welcome))).toBe(
      "00000000",
    );
    expect(deriveOnboardingSeFlags(state(OnboardingStep.EarlyCheck))).toBe(
      "0000000f",
    );
    expect(deriveOnboardingSeFlags(state(OnboardingStep.ChooseName))).toBe(
      "0000000c",
    );
  });

  it("sets the onboarded byte once completed", () => {
    expect(deriveOnboardingSeFlags(state(OnboardingStep.Ready, true))).toBe(
      "e600000b",
    );
  });
});

describe("onEarlyCheckToggle", () => {
  it("enters the early check from WELCOME", () => {
    expect(onEarlyCheckToggle(state(OnboardingStep.Welcome), true)).toEqual(
      state(OnboardingStep.EarlyCheck),
    );
  });

  it("exits the early check to the first walk step", () => {
    expect(onEarlyCheckToggle(state(OnboardingStep.EarlyCheck), false)).toEqual(
      state(OnboardingStep.ChooseName),
    );
  });

  it("is a no-op outside the gated steps", () => {
    expect(onEarlyCheckToggle(state(OnboardingStep.Pin), true)).toEqual(
      state(OnboardingStep.Pin),
    );
    expect(onEarlyCheckToggle(state(OnboardingStep.Welcome), false)).toEqual(
      state(OnboardingStep.Welcome),
    );
  });
});

describe("advanceOnboarding", () => {
  it("does not auto-advance on the gated steps", () => {
    expect(advanceOnboarding(state(OnboardingStep.Welcome))).toEqual(
      state(OnboardingStep.Welcome),
    );
    expect(advanceOnboarding(state(OnboardingStep.EarlyCheck))).toEqual(
      state(OnboardingStep.EarlyCheck),
    );
  });

  it("walks one step per call and completes at READY", () => {
    const walk = [
      OnboardingStep.ChooseName,
      OnboardingStep.Pin,
      OnboardingStep.SetupChoice,
      OnboardingStep.NewDevice,
      OnboardingStep.NewDeviceConfirming,
      OnboardingStep.SafetyWarning,
      OnboardingStep.Ready,
    ];
    let current = state(OnboardingStep.ChooseName);
    for (let i = 1; i < walk.length; i += 1) {
      current = advanceOnboarding(current);
      expect(current.step).toBe(walk[i]);
    }
    expect(current).toEqual({ step: OnboardingStep.Ready, completed: true });
  });

  it("stays put once completed", () => {
    expect(advanceOnboarding(state(OnboardingStep.Ready, true))).toEqual(
      state(OnboardingStep.Ready, true),
    );
  });
});
