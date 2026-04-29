import {
  CommandResultFactory,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it } from "vitest";

import { SignActionsCommand } from "@internal/app-binder/command/SignActionsCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SignActionsTask } from "./SignActionsTask";

const DEFAULT_DERIVATION_PATH = "44'/637'/0'/0'";

const createSignatureResponse = (overrides: {
  signaturesLeft: number;
  r?: string;
  s?: string;
  v?: number;
}) =>
  CommandResultFactory({
    data: {
      signaturesLeft: overrides.signaturesLeft,
      signature: {
        r:
          overrides.r ??
          "1a7718eede70393bbc640a649ee65401748953a1b671ffa15fea9cb7e2092898",
        s:
          overrides.s ??
          "37e2621d96135f05f54fe891bb5850a94003717dfe228c270fba5d8e7f35b590",
        v: overrides.v ?? 0x1c,
      },
    },
  });

describe("SignActionsTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    apiMock.sendCommand.mockClear();
  });

  it("returns error when sendCommand returns an error", async () => {
    // GIVEN
    const error = CommandResultFactory({
      error: new UnknownDeviceExchangeError(),
    });
    apiMock.sendCommand.mockResolvedValue(error);

    // WHEN
    const task = new SignActionsTask(apiMock, {
      derivationPath: DEFAULT_DERIVATION_PATH,
    });
    const result = await task.run();

    // THEN
    expect(isSuccessCommandResult(result)).toBe(false);
    expect(result).toEqual(error);
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      new SignActionsCommand({ derivationPath: DEFAULT_DERIVATION_PATH }),
    );
  });

  it("returns one signature when device returns signaturesLeft 0 on first call", async () => {
    // GIVEN
    apiMock.sendCommand.mockResolvedValue(
      createSignatureResponse({ signaturesLeft: 0 }),
    );

    // WHEN
    const task = new SignActionsTask(apiMock, {
      derivationPath: DEFAULT_DERIVATION_PATH,
    });
    const result = await task.run();

    // THEN
    expect(isSuccessCommandResult(result)).toBe(true);
    if (!isSuccessCommandResult(result)) {
      throw new Error("Unexpected");
    }
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      r: "1a7718eede70393bbc640a649ee65401748953a1b671ffa15fea9cb7e2092898",
      s: "37e2621d96135f05f54fe891bb5850a94003717dfe228c270fba5d8e7f35b590",
      v: 0x1c,
    });
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("returns three signatures when device returns signaturesLeft 2, 1, 0 across three calls", async () => {
    // GIVEN
    apiMock.sendCommand
      .mockResolvedValueOnce(
        createSignatureResponse({
          signaturesLeft: 2,
          r: "sig1_r",
          s: "sig1_s",
          v: 27,
        }),
      )
      .mockResolvedValueOnce(
        createSignatureResponse({
          signaturesLeft: 1,
          r: "sig2_r",
          s: "sig2_s",
          v: 28,
        }),
      )
      .mockResolvedValueOnce(
        createSignatureResponse({
          signaturesLeft: 0,
          r: "sig3_r",
          s: "sig3_s",
          v: 27,
        }),
      );

    // WHEN
    const task = new SignActionsTask(apiMock, {
      derivationPath: DEFAULT_DERIVATION_PATH,
    });
    const result = await task.run();

    // THEN
    expect(isSuccessCommandResult(result)).toBe(true);
    if (!isSuccessCommandResult(result)) {
      throw new Error("Unexpected");
    }
    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toEqual({ r: "sig1_r", s: "sig1_s", v: 27 });
    expect(result.data[1]).toEqual({ r: "sig2_r", s: "sig2_s", v: 28 });
    expect(result.data[2]).toEqual({ r: "sig3_r", s: "sig3_s", v: 27 });
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      1,
      new SignActionsCommand({ derivationPath: DEFAULT_DERIVATION_PATH }),
    );
    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      2,
      new SignActionsCommand({ derivationPath: DEFAULT_DERIVATION_PATH }),
    );
    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      3,
      new SignActionsCommand({ derivationPath: DEFAULT_DERIVATION_PATH }),
    );
  });
});
