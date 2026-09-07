import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { SignPcztIronwoodCommand } from "@internal/app-binder/command/SignPcztIronwoodCommand";
import { SignPcztOrchardCommand } from "@internal/app-binder/command/SignPcztOrchardCommand";
import { SignPcztTransparentCommand } from "@internal/app-binder/command/SignPcztTransparentCommand";
import { ZcashAppCommandError } from "@internal/app-binder/command/utils/zcashApplicationErrors";

const apduHex = (raw: Uint8Array): string => Buffer.from(raw).toString("hex");
const response = (statusCode: number[], data: Uint8Array): ApduResponse =>
  new ApduResponse({ statusCode: Uint8Array.from(statusCode), data });

const OK = [0x90, 0x00];
const REJECTED = [0x69, 0x85]; // the user declined on device
// Preconditions the app refuses a signature on: a derivation path that is not the
// account the change returns to, and a command issued before the PCZT is finalized.
const PRECONDITION_UNMET = [0x69, 0x86];

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

  it("names the unmet-precondition status word", () => {
    const result = new SignPcztOrchardCommand({ actionIndex: 0 }).parseResponse(
      response(PRECONDITION_UNMET, new Uint8Array()),
    );
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ZcashAppCommandError);
      expect((result.error as ZcashAppCommandError).errorCode).toBe("6986");
    }
  });
});

describe("SignPcztIronwoodCommand", () => {
  it("builds INS 0x59 with empty data and the action index in P2", () => {
    // actionIndex: 3 → P2 = 0x03; INS = 0x59; P1 = 0x00 (FIRST); no data → Lc = 0x00
    const apdu = new SignPcztIronwoodCommand({ actionIndex: 3 })
      .getApdu()
      .getRawApdu();
    expect(apduHex(apdu)).toBe("e059000300");
  });

  it("parses a 64-byte spendAuthSig correctly", () => {
    const sig = new Uint8Array(64).fill(0xcd);
    const result = new SignPcztIronwoodCommand({
      actionIndex: 0,
    }).parseResponse(response(OK, sig));
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data.spendAuthSig).toEqual(sig);
    }
  });

  it("rejects a spendAuthSig of the wrong length (63 bytes)", () => {
    const result = new SignPcztIronwoodCommand({
      actionIndex: 0,
    }).parseResponse(response(OK, new Uint8Array(63).fill(0xcd)));
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("surfaces a device rejection status word", () => {
    const result = new SignPcztIronwoodCommand({
      actionIndex: 0,
    }).parseResponse(response(REJECTED, new Uint8Array()));
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("names the unmet-precondition status word", () => {
    const result = new SignPcztIronwoodCommand({
      actionIndex: 0,
    }).parseResponse(response(PRECONDITION_UNMET, new Uint8Array()));
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ZcashAppCommandError);
      expect((result.error as ZcashAppCommandError).errorCode).toBe("6986");
    }
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

  it("names the unmet-precondition status word", () => {
    const result = new SignPcztTransparentCommand({
      inputIndex: 0,
    }).parseResponse(response(PRECONDITION_UNMET, new Uint8Array()));
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ZcashAppCommandError);
      expect((result.error as ZcashAppCommandError).errorCode).toBe("6986");
    }
  });
});
