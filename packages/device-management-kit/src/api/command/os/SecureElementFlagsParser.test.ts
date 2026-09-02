import { describe, expect, it } from "vitest";

import {
  type DeviceGeneralState,
  OnboardingState,
} from "@api/device/SecureElementFlags";

import { SecureElementFlagsParser } from "./SecureElementFlagsParser";

describe("SecureElementFlagsParser", () => {
  it("should default missing secure element flag bytes to zero", () => {
    const parser = new SecureElementFlagsParser(new Uint8Array([0xe0]));

    expect(parser.generalDeviceState().isPinValidated).toBe(true);
    expect(parser.endorsementInformation()).toEqual({
      hasEndorsementCertificateInSlot1: false,
      hasEndorsementCertificateInSlot2: false,
    });
    expect(parser.wordsInformation()).toEqual({
      numberOfWords: 24,
      currentWordIndex: 0,
    });
    expect(parser.onboardingStatus()).toEqual({
      onboardingState: OnboardingState.Unknown,
    });
  });

  it("should correctly parse the general device state", () => {
    const seFlags = new Uint8Array([0b10101010, 0x00, 0x00, 0x00]);
    const parser = new SecureElementFlagsParser(seFlags);
    const expectedState: DeviceGeneralState = {
      isPinValidated: true,
      hasMcuSerialNumber: false,
      hasValidCertificate: true,
      isCustomAuthorityConnectionAllowed: false,
      isSecureConnectionAllowed: true,
      isOnboarded: false,
      isMcuCodeSigned: true,
      isInRecoveryMode: false,
    };
    expect(parser.generalDeviceState()).toEqual(expectedState);
  });

  it.each([
    [0x00, false, false],
    [0x01, true, false],
    [0x02, false, true],
    [0x03, true, true],
  ])(
    "should parse endorsement information value %#",
    (value, hasSlot1, hasSlot2) => {
      const parser = new SecureElementFlagsParser(
        new Uint8Array([0x00, value, 0x00, 0x00]),
      );

      expect(parser.endorsementInformation()).toEqual({
        hasEndorsementCertificateInSlot1: hasSlot1,
        hasEndorsementCertificateInSlot2: hasSlot2,
      });
    },
  );

  it.each([
    [0b00000000, 24, 0],
    [0b00100101, 18, 5],
    [0b01010001, 12, 17],
    [0b01111111, undefined, 31],
  ])(
    "should parse words information value %#",
    (value, numberOfWords, currentWordIndex) => {
      const parser = new SecureElementFlagsParser(
        new Uint8Array([0x00, 0x00, value, 0x00]),
      );

      expect(parser.wordsInformation()).toEqual({
        numberOfWords,
        currentWordIndex,
      });
    },
  );

  it("should ignore the reserved most-significant bit in words information", () => {
    const parser = new SecureElementFlagsParser(
      new Uint8Array([0x00, 0x00, 0b10100101, 0x00]),
    );

    expect(parser.wordsInformation()).toEqual({
      numberOfWords: 18,
      currentWordIndex: 5,
    });
  });

  describe("onboardingStatus", () => {
    it.each([
      [0x00, OnboardingState.Unknown],
      [0x01, OnboardingState.WelcomeScreen1],
      [0x02, OnboardingState.WelcomeScreen2],
      [0x03, OnboardingState.WelcomeScreen3],
      [0x04, OnboardingState.WelcomeScreen4],
      [0x05, OnboardingState.WelcomeScreenReminder],
      [0x06, OnboardingState.SetupChoice],
      [0x07, OnboardingState.NewDevice],
      [0x08, OnboardingState.ConfirmNewDevice],
      [0x09, OnboardingState.RestoreRecoveryPhrase],
      [0x0a, OnboardingState.SafetyWarning],
      [0x0b, OnboardingState.DeviceIsReady],
      [0x0c, OnboardingState.ChooseName],
      [0x0d, OnboardingState.RestoreRecoverBackup],
      [0x0e, OnboardingState.SetupRestoreChoice],
      [0x0f, OnboardingState.OnboardingStatusCheck],
      [0x10, OnboardingState.RestoreWithRk],
      [0x11, OnboardingState.Unknown],
      [0x43, OnboardingState.Unknown],
      [0xff, OnboardingState.Unknown],
    ] as const)("should parse byte 0x%s as %s", (value, onboardingState) => {
      const parser = new SecureElementFlagsParser(
        new Uint8Array([0x00, 0x00, 0x00, value]),
      );

      expect(parser.onboardingStatus()).toEqual({ onboardingState });
    });

    it("should always expose a defined onboarding state so it survives serialization", () => {
      const parser = new SecureElementFlagsParser(
        new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      );

      const status = parser.onboardingStatus();

      expect(status.onboardingState).toBe(OnboardingState.Unknown);
      expect(JSON.parse(JSON.stringify(status))).toEqual({
        onboardingState: OnboardingState.Unknown,
      });
    });

    it("should map every documented GET VERSION byte to a distinct OnboardingState", () => {
      const documentedBytes = Array.from(
        { length: 0x10 },
        (_, index) => index + 1,
      );
      const parsedStates = documentedBytes.map(
        (value) =>
          new SecureElementFlagsParser(
            new Uint8Array([0x00, 0x00, 0x00, value]),
          ).onboardingStatus().onboardingState,
      );

      expect(parsedStates).toEqual(
        Object.values(OnboardingState).filter(
          (state) => state !== OnboardingState.Unknown,
        ),
      );
    });
  });

  it("should correctly check the nth bit in a byte", () => {
    const seFlags = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const parser = new SecureElementFlagsParser(seFlags);
    const byte = 0b10101010;
    expect(parser._checkNthBitInByte(byte, 1)).toBe(true);
    expect(parser._checkNthBitInByte(byte, 2)).toBe(false);
    expect(parser._checkNthBitInByte(byte, 3)).toBe(true);
    expect(parser._checkNthBitInByte(byte, 4)).toBe(false);
    expect(parser._checkNthBitInByte(byte, 5)).toBe(true);
    expect(parser._checkNthBitInByte(byte, 6)).toBe(false);
    expect(parser._checkNthBitInByte(byte, 7)).toBe(true);
    expect(parser._checkNthBitInByte(byte, 8)).toBe(false);
  });
});
