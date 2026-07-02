import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { SignPcztOrchardCommand } from "@internal/app-binder/command/SignPcztOrchardCommand";
import { SignPcztTransparentCommand } from "@internal/app-binder/command/SignPcztTransparentCommand";

const apduHex = (raw: Uint8Array): string => Buffer.from(raw).toString("hex");
const response = (statusCode: number[], data: Uint8Array): ApduResponse =>
  new ApduResponse({ statusCode: Uint8Array.from(statusCode), data });

const OK = [0x90, 0x00];
const REJECTED = [0x69, 0x85]; // ConditionOfUseNotSatisfied (signed before finalize)

describe("SignPcztOrchardCommand", () => {
  it("builds INS 0x57 with empty data and the action index in P2", () => {
    const apdu = new SignPcztOrchardCommand({ actionIndex: 3 })
      .getApdu()
      .getRawApdu();
    expect(apduHex(apdu)).toBe("e057000300");
  });

  it("parses a 64-byte spendAuthSig", () => {
    const sig = new Uint8Array(64).fill(0xab);
    const result = new SignPcztOrchardCommand({ actionIndex: 0 }).parseResponse(
      response(OK, sig),
    );
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data.spendAuthSig).toEqual(sig);
    }
  });

  it("rejects a spendAuthSig of the wrong length", () => {
    const result = new SignPcztOrchardCommand({ actionIndex: 0 }).parseResponse(
      response(OK, new Uint8Array(63).fill(0xab)),
    );
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("surfaces a device rejection", () => {
    const result = new SignPcztOrchardCommand({ actionIndex: 0 }).parseResponse(
      response(REJECTED, new Uint8Array()),
    );
    expect(isSuccessCommandResult(result)).toBe(false);
  });
});

describe("SignPcztTransparentCommand", () => {
  it("builds INS 0x55 with empty data and the input index in P2", () => {
    const apdu = new SignPcztTransparentCommand({ inputIndex: 1 })
      .getApdu()
      .getRawApdu();
    expect(apduHex(apdu)).toBe("e055000100");
  });

  it("parses a DER signature followed by a SIGHASH_ALL byte", () => {
    const sig = Uint8Array.from([
      0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x01,
    ]);
    const result = new SignPcztTransparentCommand({
      inputIndex: 0,
    }).parseResponse(response(OK, sig));
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data.signature).toEqual(sig);
    }
  });

  it("rejects a trailing sighash byte that is not SIGHASH_ALL", () => {
    const sig = Uint8Array.from([
      0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x02,
    ]);
    const result = new SignPcztTransparentCommand({
      inputIndex: 0,
    }).parseResponse(response(OK, sig));
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("rejects a response too short to hold a signature + sighash", () => {
    const result = new SignPcztTransparentCommand({
      inputIndex: 0,
    }).parseResponse(response(OK, Uint8Array.of(0x01)));
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("surfaces a device rejection", () => {
    const result = new SignPcztTransparentCommand({
      inputIndex: 0,
    }).parseResponse(response(REJECTED, new Uint8Array()));
    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
