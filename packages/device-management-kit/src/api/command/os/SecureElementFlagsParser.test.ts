import { describe, expect, it } from "vitest";

import { type DeviceGeneralState } from "@api/device/SecureElementFlags";

import { SecureElementFlagsParser } from "./SecureElementFlagsParser";

describe("SecureElementFlagsParser", () => {
  it("should throw an error if the secure element flags length is not 4", () => {
    expect(
      () => new SecureElementFlagsParser(new Uint8Array([0x00, 0x01, 0x02])),
    ).toThrow("Invalid secure element flags length");
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

  it("should throw an error for endorsementInformation method", () => {
    const seFlags = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const parser = new SecureElementFlagsParser(seFlags);
    expect(() => parser.endorsementInformation()).toThrow("Not implemented");
  });

  it("should throw an error for wordsInformation method", () => {
    const seFlags = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const parser = new SecureElementFlagsParser(seFlags);
    expect(() => parser.wordsInformation()).toThrow("Not implemented");
  });

  it("should throw an error for onboardingStatus method", () => {
    const seFlags = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const parser = new SecureElementFlagsParser(seFlags);
    expect(() => parser.onboardingStatus()).toThrow("Not implemented");
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
